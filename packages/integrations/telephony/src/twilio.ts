/**
 * packages/integrations/telephony/src/twilio.ts
 * ─────────────────────────────────────────────────────────────
 * Twilio Voice AI adapter for RelayDispatch.
 *
 * Flow:
 *   1. Twilio calls POST /api/calls/inbound when a customer calls
 *   2. We respond with TwiML — the AI greets and gathers spoken input
 *   3. Twilio POSTs transcribed speech to /api/calls/gather
 *   4. We pass it to the AI, generate a response, and reply with TwiML
 *   5. On call completion, Twilio POSTs to /api/calls/status
 *   6. We create a thread + messages in Supabase so the call flows through triage
 *
 * Environment variables needed:
 *   TWILIO_ACCOUNT_SID   — from Twilio console
 *   TWILIO_AUTH_TOKEN    — from Twilio console
 *   TWILIO_PHONE_NUMBER  — your purchased Twilio phone number
 *   TWILIO_WEBHOOK_URL   — public HTTPS URL of your deployed API
 */

import twilio from 'twilio';
import OpenAI from 'openai';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../../database/src/database.types.js';

// ── Twilio client (lazy — only instantiated when env vars are present) ─────────

let _twilioClient: ReturnType<typeof twilio> | null = null;

export function getTwilioClient(): ReturnType<typeof twilio> | null {
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
    return null;
  }
  if (!_twilioClient) {
    _twilioClient = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN,
    );
  }
  return _twilioClient;
}

export const isTwilioConfigured = (): boolean =>
  !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER);

// ── OpenRouter client for AI voice responses ───────────────────────────────────

const openai = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey:  process.env.OPENROUTER_API_KEY || '',
  defaultHeaders: {
    'HTTP-Referer': process.env.APP_BASE_URL || 'http://localhost:3001',
    'X-Title':      'RelayDispatch AI Voice Agent',
  },
});

// ── AI Voice Agent System Prompt ──────────────────────────────────────────────

const VOICE_AGENT_SYSTEM_PROMPT = `You are a professional AI voice receptionist for an HVAC service company.
Your job is to:
1. Warmly greet customers and understand their service needs
2. Classify the urgency (emergency vs. routine vs. inquiry)
3. Collect: customer name, address/service location, description of the issue
4. Set expectations (dispatch time, pricing range based on service type)
5. Create a service request in the system

Speak naturally and concisely — this is a phone call. Keep responses under 3 sentences.
If the customer has a gas leak, CO alarm, or fire emergency, immediately tell them to call 911 and end the call.
Never make up information. If you don't know something, say you'll have a human follow up.

Detected service types and responses:
- AC not cooling → "We can have a technician out within 2-4 hours. Our diagnostic fee is $89."
- Heating issue → "We'll get someone out to you. Heating emergencies are prioritized."
- General maintenance → "We can schedule that for [next available slot]. Our tune-up package starts at $129."
- Emergency → "This sounds urgent. I'm flagging this as a priority dispatch right now."`;

// ── TwiML Response Builders ───────────────────────────────────────────────────

export function buildGreetingTwiML(orgName: string, webhookUrl: string): string {
  const gatherUrl = `${webhookUrl}/api/calls/gather`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna" language="en-US">
    Thank you for calling ${orgName}. I'm your AI service coordinator.
    How can I help you today? Please describe your issue after the tone.
  </Say>
  <Gather input="speech" action="${gatherUrl}" method="POST" 
          timeout="5" speechTimeout="auto" language="en-US">
  </Gather>
  <Say voice="Polly.Joanna">
    I didn't catch that. Let me connect you with our team. Please hold.
  </Say>
  <Dial>
    <Number>${process.env.TWILIO_PHONE_NUMBER || ''}</Number>
  </Dial>
</Response>`;
}

export function buildAIResponseTwiML(
  aiText: string,
  webhookUrl: string,
  isEndCall: boolean = false,
): string {
  const gatherUrl = `${webhookUrl}/api/calls/gather`;

  if (isEndCall) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna" language="en-US">${escapeXml(aiText)}</Say>
  <Hangup/>
</Response>`;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna" language="en-US">${escapeXml(aiText)}</Say>
  <Gather input="speech" action="${gatherUrl}" method="POST"
          timeout="5" speechTimeout="auto" language="en-US">
  </Gather>
  <Say voice="Polly.Joanna">
    Is there anything else I can help you with? If not, I'll create your service request now.
  </Say>
  <Hangup/>
</Response>`;
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// ── AI Processing ─────────────────────────────────────────────────────────────

export interface CallConversationTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface AICallResponse {
  text: string;
  isEndCall: boolean;
  serviceType?: string;
  urgency?: 'emergency' | 'urgent' | 'routine' | 'inquiry';
  extractedInfo?: {
    callerName?: string;
    address?: string;
    issue?: string;
  };
}

export async function generateAICallResponse(
  conversation: CallConversationTurn[],
  orgName: string,
): Promise<AICallResponse> {
  const lastUserMsg = conversation[conversation.length - 1]?.content?.toLowerCase() || '';
  const emergencyKeywords = ['gas leak', 'carbon monoxide', 'co alarm', 'fire', 'smoke', 'explosion', 'burning smell'];

  if (emergencyKeywords.some(kw => lastUserMsg.includes(kw))) {
    return {
      text: 'This sounds like an emergency. Please call 911 immediately. Do not use any electrical switches. Get everyone out of the building. I am alerting our emergency team right now.',
      isEndCall: true,
      urgency: 'emergency',
    };
  }

  try {
    const systemPrompt = `${VOICE_AGENT_SYSTEM_PROMPT}\n\nYou are representing: ${orgName}\n\nAfter collecting enough information (name, issue, location), end with: "END_CALL: [summary of service request]"\nOtherwise, continue the conversation naturally.`;

    const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
      { role: 'system', content: systemPrompt },
      ...conversation.map(t => ({ role: t.role, content: t.content })),
    ];

    const completion = await openai.chat.completions.create({
      model:       'google/gemini-flash-1.5',
      messages,
      max_tokens:  200,
      temperature: 0.7,
    });

    const responseText = completion.choices[0]?.message?.content
      || "I'll have our team follow up with you shortly. Thank you for calling.";

    const isEndCall = responseText.includes('END_CALL:');
    const cleanText = responseText.replace(/END_CALL:.*$/s, '').trim()
      || "We've created your service request. A technician will contact you shortly. Thank you for calling.";

    const urgency     = detectUrgency(lastUserMsg);
    const serviceType = detectServiceType(lastUserMsg);

    return {
      text: cleanText,
      isEndCall,
      ...(urgency     ? { urgency }     : {}),
      ...(serviceType ? { serviceType } : {}),
      extractedInfo: { issue: lastUserMsg.substring(0, 500) },
    } as AICallResponse;

  } catch (err) {
    console.error('[twilio-adapter] AI response generation failed:', err);
    return {
      text:      "I'm sorry, I'm having trouble processing your request. Let me connect you with our team directly.",
      isEndCall: true,
      urgency:   'routine',
    };
  }
}

function detectUrgency(text: string): AICallResponse['urgency'] {
  const emergencyWords = ['emergency', 'not working', 'broken', 'no heat', 'no ac', 'no air', 'no cool', 'flooded', 'leaking'];
  const urgentWords    = ['urgent', 'asap', 'today', 'soon', 'quickly', 'problem'];
  if (emergencyWords.some(w => text.includes(w))) return 'urgent';
  if (urgentWords.some(w => text.includes(w))) return 'urgent';
  return 'routine';
}

function detectServiceType(text: string): string {
  if (text.match(/ac|air.?conditioning|cool|hvac/i)) return 'AC_REPAIR';
  if (text.match(/heat|furnace|boiler|warm/i)) return 'HEATING_REPAIR';
  if (text.match(/maintenance|tune.?up|checkup|service/i)) return 'PREVENTIVE_MAINTENANCE';
  if (text.match(/install|new|replace|replacement/i)) return 'INSTALLATION';
  if (text.match(/duct|vent|filter/i)) return 'DUCT_SERVICE';
  return 'GENERAL_HVAC';
}

// ── Call Log CRUD ─────────────────────────────────────────────────────────────

export async function createCallLog(
  supabase: SupabaseClient<Database>,
  data: {
    orgId:       string;
    fromNumber:  string;
    toNumber:    string;
    callSid:     string;
    callerName?: string;
  },
): Promise<string> {
  const { data: callLog, error } = await supabase
    .from('call_logs')
    .insert({
      org_id:      data.orgId,
      from_number: data.fromNumber,
      to_number:   data.toNumber,
      call_sid:    data.callSid,
      ...(data.callerName ? { caller_name: data.callerName } : {}),
      status:    'ringing' as const,
      direction: 'inbound' as const,
    })
    .select('id')
    .single();

  if (error) throw new Error(`Failed to create call log: ${error.message}`);
  return callLog.id;
}

export async function updateCallLog(
  supabase: SupabaseClient<Database>,
  callSid: string,
  updates: {
    status?:            Database['public']['Tables']['call_logs']['Row']['status'];
    duration_seconds?:  number;
    ai_transcript?:     string | null;
    ai_summary?:        string;
    thread_id?:         string;
    service_type?:      string;
    caller_name?:       string;
    human_handoff?:     boolean;
    recording_url?:     string;
  },
): Promise<void> {
  const { error } = await supabase
    .from('call_logs')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('call_sid', callSid);

  if (error) console.error(`[twilio-adapter] Failed to update call log ${callSid}:`, error);
}

export async function createCallThread(
  supabase: SupabaseClient<Database>,
  orgId: string,
  callLog: {
    id:           string;
    fromNumber:   string;
    callerName?:  string;
    serviceType:  string;
    urgency:      string;
    transcript:   string;
    aiSummary:    string;
  },
): Promise<string> {
  let contactId: string | null = null;

  try {
    const { data: existingContact } = await supabase
      .from('contacts')
      .select('id')
      .eq('org_id', orgId)
      .eq('phone', callLog.fromNumber)
      .maybeSingle();

    if (existingContact) {
      contactId = existingContact.id;
    } else {
      const { data: newContact, error: contactErr } = await supabase
        .from('contacts')
        .insert({
          org_id:     orgId,
          first_name: callLog.callerName?.split(' ')[0] || 'Unknown',
          last_name:  callLog.callerName?.split(' ').slice(1).join(' ') || 'Caller',
          phone:      callLog.fromNumber,
          // phone-only contacts use a synthetic placeholder email
          email: `phone_${callLog.fromNumber.replace(/\D/g, '')}@voice.local`,
        })
        .select('id')
        .single();
      if (!contactErr) contactId = newContact.id;
    }
  } catch {
    // Non-fatal: proceed without contact link
  }

  const { data: thread, error: threadErr } = await (supabase as any)
    .from('threads')
    .insert({
      org_id:    orgId,
      ...(contactId ? { contact_id: contactId } : {}),
      subject:   `[CALL] ${callLog.serviceType.replace(/_/g, ' ')} — ${callLog.callerName || callLog.fromNumber}`,
      status:    'new',
      source:    'phone',
      priority:  callLog.urgency === 'emergency' ? 'emergency' : callLog.urgency === 'urgent' ? 'urgent' : 'normal',
      body_text: callLog.aiSummary,
    })
    .select('id')
    .single();

  if (threadErr) throw new Error(`Failed to create call thread: ${threadErr.message}`);

  await supabase.from('messages').insert({
    thread_id:           thread.id,
    org_id:              orgId,
    direction:           'inbound',
    body_text:           callLog.transcript,
    role:                'customer',
    from_address:        callLog.fromNumber,
    ...(callLog.id ? { external_message_id: `call_${callLog.id}` } : {}),
  });

  await supabase
    .from('call_logs')
    .update({ thread_id: thread.id, updated_at: new Date().toISOString() })
    .eq('id', callLog.id);

  return thread.id;
}

// ── Webhook Signature Validation ──────────────────────────────────────────────

export function validateTwilioSignature(
  authToken: string,
  signature: string,
  url:       string,
  params:    Record<string, string>,
): boolean {
  return twilio.validateRequest(authToken, signature, url, params);
}
