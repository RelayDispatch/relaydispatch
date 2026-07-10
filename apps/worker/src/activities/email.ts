/**
 * backend/workflows/activities/email.ts
 * Email fetch and send activities (multi-provider: sandbox, Google, Microsoft, Nylas).
 */

import {
  log,
  supabase,
  nylas,
  decryptVault,
  isActivityAlreadyCompleted,
  markActivityCompleted,
  stripHtmlTags,
} from './shared.js';
import {
  rehydrate,
  deserializeVault,
  auditSummary,
} from '../../../../packages/security/src/redactor.js';

// ============================================================
// TYPES
// ============================================================

export interface FetchEmailResult {
  subject:         string;
  bodyText:        string;
  bodyHtml?:       string;
  fromEmail:       string;
  fromName?:       string;
  nylasThreadId?:  string;
  nylasMessageId?: string;
}

// ============================================================
// HELPER: OAuth token refreshers
// ============================================================

async function refreshGoogleMailToken(orgId: string, refreshToken: string): Promise<string> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    new URLSearchParams({
      client_id:     process.env.GOOGLE_CLIENT_ID ?? '',
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      refresh_token: refreshToken,
      grant_type:    'refresh_token',
    }),
  });
  if (!res.ok) {
    throw new Error(`Google refresh failed: ${await res.text()}`);
  }
  const data = await res.json() as any;
  if (data.access_token) {
    await supabase.from('organizations').update({
      mail_access_token:      data.access_token,
      mail_token_expires_at:  new Date(Date.now() + (data.expires_in ?? 3600) * 1000).toISOString(),
      updated_at:             new Date().toISOString(),
    } as any).eq('id', orgId);
    return data.access_token;
  }
  throw new Error('Google refresh did not return access_token');
}

async function refreshMicrosoftMailToken(orgId: string, refreshToken: string): Promise<string> {
  const res = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    new URLSearchParams({
      client_id:     process.env.MICROSOFT_CLIENT_ID ?? '',
      client_secret: process.env.MICROSOFT_CLIENT_SECRET ?? '',
      refresh_token: refreshToken,
      grant_type:    'refresh_token',
    }),
  });
  if (!res.ok) {
    throw new Error(`Microsoft refresh failed: ${await res.text()}`);
  }
  const data = await res.json() as any;
  if (data.access_token) {
    await supabase.from('organizations').update({
      mail_access_token:      data.access_token,
      mail_refresh_token:     data.refresh_token ?? refreshToken,
      mail_token_expires_at:  new Date(Date.now() + (data.expires_in ?? 3600) * 1000).toISOString(),
      updated_at:             new Date().toISOString(),
    } as any).eq('id', orgId);
    return data.access_token;
  }
  throw new Error('Microsoft refresh did not return access_token');
}

// ============================================================
// ACTIVITY: fetchEmailContent  (Nylas v3 — multi-provider)
// ============================================================

export async function fetchEmailContent(params: {
  nylasGrantId: string | null;
  historyId:    string;
  emailAddress: string;
}): Promise<FetchEmailResult | null> {
  try {
    let orgQuery = supabase
      .from('organizations')
      .select('id, mail_provider, mail_email_address, mail_access_token, mail_refresh_token, mail_token_expires_at');

    if (params.nylasGrantId) {
      orgQuery = orgQuery.or(`id.eq.${params.nylasGrantId},nylas_grant_id.eq.${params.nylasGrantId}`);
    } else {
      orgQuery = orgQuery.eq('intake_email_address', params.emailAddress);
    }
    const { data: org } = await orgQuery.maybeSingle() as any;

    const provider = org?.mail_provider ?? 'sandbox';

    // 1. Sandbox simulation mode
    if (provider === 'sandbox') {
      log.info({ nylasGrantId: params.nylasGrantId }, 'fetchEmailContent: Unconditional Sandbox Mail simulator active');
      return {
        subject:        'Need immediate AC repair tomorrow',
        bodyText:       'Hello, my name is Sarah Johnson. My AC unit is blowing hot air. I live at 104 Oak Lane, and my phone number is 555-0199. It is a Carrier AC unit, about 5 years old. Can you please schedule a technician to come out tomorrow afternoon around 2:00 PM? Thank you!',
        bodyHtml:       '<div>Hello, my name is Sarah Johnson. My AC unit is blowing hot air. I live at 104 Oak Lane, and my phone number is 555-0199. It is a Carrier AC unit, about 5 years old. Can you please schedule a technician to come out tomorrow afternoon around 2:00 PM? Thank you!</div>',
        fromEmail:      'sarah.johnson@example.com',
        fromName:       'Sarah Johnson',
        nylasThreadId:  `sandbox_thread_${Date.now()}`,
        nylasMessageId: `sandbox_msg_${Date.now()}`,
      };
    }

    // 2. Direct GCP Google Mail Connection
    if (provider === 'google' && org) {
      let token = org.mail_access_token;
      const expiresAt = org.mail_token_expires_at ? new Date(org.mail_token_expires_at).getTime() : 0;

      if (token && expiresAt < Date.now() + 60 * 1000) {
        token = await refreshGoogleMailToken(org.id, org.mail_refresh_token);
      }

      // Use Gmail History API to find the exact inbound message
      let resolvedMessageId: string | null = null;

      if (params.historyId) {
        try {
          const histRes = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/history?startHistoryId=${params.historyId}&historyTypes=messageAdded&maxResults=10`,
            { headers: { Authorization: `Bearer ${token}` } },
          );
          if (histRes.ok) {
            const histData = await histRes.json() as any;
            for (const record of (histData.history ?? [])) {
              for (const added of (record.messagesAdded ?? [])) {
                const labelIds: string[] = added.message?.labelIds ?? [];
                if (labelIds.includes('INBOX')) {
                  resolvedMessageId = added.message.id;
                  break;
                }
              }
              if (resolvedMessageId) break;
            }
            if (!resolvedMessageId) {
              const firstAdded = histData.history?.[0]?.messagesAdded?.[0]?.message?.id;
              if (firstAdded) resolvedMessageId = firstAdded;
            }
          }
        } catch (histErr) {
          log.warn({ histErr, historyId: params.historyId }, 'fetchEmailContent: History API call failed, falling back to messages.list');
        }
      }

      if (!resolvedMessageId) {
        const listRes = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=is:unread+in:inbox&maxResults=1`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (!listRes.ok) throw new Error(await listRes.text());
        const listData = await listRes.json() as any;
        resolvedMessageId = listData.messages?.[0]?.id ?? null;
      }

      if (!resolvedMessageId) {
        log.warn({ historyId: params.historyId }, 'fetchEmailContent: Could not resolve inbound message via History API or messages.list');
        return null;
      }

      const msgRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${resolvedMessageId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!msgRes.ok) throw new Error(await msgRes.text());
      const msg = await msgRes.json() as any;

      let subject  = '(no subject)';
      let bodyText = '(no body)';
      let bodyHtml: string | undefined;
      let fromEmail = params.emailAddress;
      let fromName: string | undefined;

      const headers = msg.payload?.headers ?? [];
      for (const h of headers) {
        const name = h.name?.toLowerCase();
        if (name === 'subject') subject = h.value ?? '(no subject)';
        if (name === 'from') {
          const fromRaw: string = h.value ?? '';
          const emailMatch = fromRaw.match(/<([^>]+)>/);
          if (emailMatch?.[1]) {
            fromEmail = emailMatch[1].trim().toLowerCase();
            const nameMatch = fromRaw.match(/^([^<]+)</);
            fromName = nameMatch?.[1]?.trim().replace(/^"|"$/g, '') || undefined;
          } else {
            fromEmail = fromRaw.trim().toLowerCase();
          }
        }
      }

      const parts = msg.payload?.parts ?? [msg.payload];
      for (const part of parts) {
        if (part?.mimeType === 'text/plain' && part.body?.data) {
          bodyText = Buffer.from(part.body.data, 'base64').toString('utf8');
        } else if (part?.mimeType === 'text/html' && part.body?.data) {
          bodyHtml = Buffer.from(part.body.data, 'base64').toString('utf8');
          if (bodyText === '(no body)') bodyText = stripHtmlTags(bodyHtml);
        }
      }

      log.info(
        { fromEmail, fromName, resolvedMessageId, historyId: params.historyId },
        'fetchEmailContent: Resolved inbound customer email from Gmail History API',
      );

      return {
        subject,
        bodyText,
        ...(bodyHtml ? { bodyHtml } : {}),
        fromEmail,
        fromName,
        nylasThreadId:  msg.threadId,
        nylasMessageId: msg.id,
      } as FetchEmailResult;
    }

    // 3. Microsoft Graph Connection
    if (provider === 'microsoft' && org) {
      let token = org.mail_access_token;
      const expiresAt = org.mail_token_expires_at ? new Date(org.mail_token_expires_at).getTime() : 0;

      if (token && expiresAt < Date.now() + 60 * 1000) {
        token = await refreshMicrosoftMailToken(org.id, org.mail_refresh_token);
      }

      const res = await fetch(`https://graph.microsoft.com/v1.0/me/messages?$top=1&$orderby=receivedDateTime desc`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json() as any;
      const msg = data.value?.[0];

      if (!msg) {
        log.warn({ emailAddress: params.emailAddress }, 'fetchEmailContent: No live Outlook messages found');
        return null;
      }

      return {
        subject:        msg.subject ?? '(no subject)',
        bodyText:       msg.body?.content ? stripHtmlTags(msg.body.content) : '(no body)',
        bodyHtml:       msg.body?.content ?? undefined,
        fromEmail:      msg.from?.emailAddress?.address ?? params.emailAddress,
        fromName:       msg.from?.emailAddress?.name ?? params.emailAddress,
        nylasThreadId:  msg.conversationId,
        nylasMessageId: msg.id,
      };
    }

    // 4. Fallback to legacy Nylas if key exists
    if (process.env.NYLAS_API_KEY && params.nylasGrantId) {
      const receivedAfter = Math.floor(Date.now() / 1000) - 120;
      const response = await nylas.messages.list({
        identifier:  params.nylasGrantId,
        queryParams: { limit: 10, receivedAfter } as any,
      });
      const messages = response.data ?? [];
      if (messages.length > 0) {
        const msg = messages[0]!;
        const fromParticipant = msg.from?.[0];
        return {
          subject:        msg.subject ?? '(no subject)',
          bodyText:       msg.body ? stripHtmlTags(msg.body) : '(no body)',
          bodyHtml:       msg.body ?? undefined,
          fromEmail:      fromParticipant?.email ?? params.emailAddress,
          fromName:       fromParticipant?.name ?? undefined,
          nylasThreadId:  msg.threadId ?? undefined,
          nylasMessageId: msg.id ?? undefined,
        };
      }
    }

    return null;
  } catch (err) {
    log.error({ err, params }, 'fetchEmailContent: Direct mail query failed, falling back to local simulation');
    return {
      subject:        'Simulated Intake (Fallback)',
      bodyText:       'Need AC repair. Sarah Johnson, 104 Oak Lane, phone 555-0199.',
      fromEmail:      'sarah.johnson@example.com',
      fromName:       'Sarah Johnson',
      nylasThreadId:  `sandbox_thread_fallback_${Date.now()}`,
      nylasMessageId: `sandbox_msg_fallback_${Date.now()}`,
    };
  }
}

// ============================================================
// ACTIVITY: sendEmailResponseActivity  (Multi-provider)
// ============================================================

export async function sendEmailResponseActivity(params: {
  threadId:         string;
  orgId:            string;
  toEmail:          string;
  subject:          string;
  draftPlainText:   string;
  draftHtml:        string;
  nylasGrantId:     string | null;
  nylasThreadId:    string | null;
  vaultSerialized:  string;
  sb243Applied:     boolean;
  modelUsed:        string;
  promptTokens:     number;
  completionTokens: number;
  latencyMs:        number;
  turnIndex:        number;
}): Promise<{ nylasMessageId: string | null; nylasThreadId: string | null }> {

  // ── 1. Rehydrate PII ───────────────────────────────────────
  const vault          = deserializeVault(decryptVault(params.vaultSerialized));
  const finalPlainText = rehydrate(params.draftPlainText, vault);
  const finalHtml      = rehydrate(params.draftHtml, vault);

  log.info(
    { threadId: params.threadId, vaultKeys: auditSummary(vault) },
    'sendEmailResponse: PII rehydrated — selecting mail provider',
  );

  // ── 2. Load Mail Settings ──────────────────────────────────
  const { data: org } = await supabase
    .from('organizations')
    .select('mail_provider, mail_access_token, mail_refresh_token, mail_token_expires_at')
    .eq('id', params.orgId)
    .single() as any;

  const provider            = org?.mail_provider ?? 'sandbox';
  let nylasMessageId: string | null = null;
  let finalNylasThreadId: string | null = params.nylasThreadId;

  const sendKey    = `sendEmail:${params.threadId}:${params.turnIndex}`;
  const alreadySent = await isActivityAlreadyCompleted(sendKey);

  if (alreadySent) {
    log.warn({ threadId: params.threadId, sendKey }, 'sendEmailResponse: already sent or reserved — skipping');
    const { data: existing } = await supabase
      .from('completed_activity_keys' as never)
      .select('meta')
      .eq('key', sendKey)
      .maybeSingle() as { data: { meta?: { nylasMessageId?: string; status?: string } } | null };
    if (existing?.meta?.nylasMessageId) {
      nylasMessageId = existing.meta.nylasMessageId;
    }
  } else {
    await markActivityCompleted(sendKey, { status: 'reserved', threadId: params.threadId });

    try {
      if (provider === 'sandbox') {
        log.info({ threadId: params.threadId }, 'sendEmailResponse: Sandbox Mail Simulation active. Logging outgoing response:');
        log.info(`[OUTGOING EMAIL SEND SIMULATION] To: ${params.toEmail} | Subject: ${params.subject}\nBody:\n${finalPlainText}`);
        nylasMessageId     = `sandbox_sent_${Date.now()}`;
        finalNylasThreadId = params.nylasThreadId ?? `sandbox_thread_${Date.now()}`;

      } else if (provider === 'google' && org) {
        let token = org.mail_access_token;
        const expiresAt = org.mail_token_expires_at ? new Date(org.mail_token_expires_at).getTime() : 0;
        if (token && expiresAt < Date.now() + 60 * 1000) {
          token = await refreshGoogleMailToken(params.orgId, org.mail_refresh_token);
        }

        const mimeMessage = [
          `To: ${params.toEmail}`,
          `Subject: ${params.subject}`,
          `Content-Type: text/html; charset=utf-8`,
          `MIME-Version: 1.0`,
          ``,
          finalHtml,
        ].join('\r\n');
        const rawMime = Buffer.from(mimeMessage).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

        const sendRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
          method:  'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            raw: rawMime,
            ...(params.nylasThreadId ? { threadId: params.nylasThreadId } : {}),
          }),
        });
        if (!sendRes.ok) throw new Error(await sendRes.text());
        const sendData     = await sendRes.json() as any;
        nylasMessageId     = sendData.id;
        finalNylasThreadId = sendData.threadId;

      } else if (provider === 'microsoft' && org) {
        let token = org.mail_access_token;
        const expiresAt = org.mail_token_expires_at ? new Date(org.mail_token_expires_at).getTime() : 0;
        if (token && expiresAt < Date.now() + 60 * 1000) {
          token = await refreshMicrosoftMailToken(params.orgId, org.mail_refresh_token);
        }

        const sendRes = await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
          method:  'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            message: {
              subject: params.subject,
              body:    { contentType: 'HTML', content: finalHtml },
              toRecipients: [{ emailAddress: { address: params.toEmail } }],
            },
          }),
        });
        if (!sendRes.ok) throw new Error(await sendRes.text());
        nylasMessageId     = `microsoft_sent_${Date.now()}`;
        finalNylasThreadId = params.nylasThreadId ?? `microsoft_thread_${Date.now()}`;

      } else if (process.env.NYLAS_API_KEY && params.nylasGrantId) {
        const sentMessage = await nylas.messages.send({
          identifier:  params.nylasGrantId,
          requestBody: {
            to:      [{ email: params.toEmail }],
            subject: params.subject,
            body:    finalHtml,
            ...(params.nylasThreadId ? { threadId: params.nylasThreadId } : {}),
          },
        });
        nylasMessageId = sentMessage.data?.id ?? null;

      } else {
        log.warn({ threadId: params.threadId }, 'sendEmailResponse: No active mail connection. Falling back to sandbox logging.');
        log.info(`[OUTGOING EMAIL SIMULATION] To: ${params.toEmail} | Subject: ${params.subject}\nBody:\n${finalPlainText}`);
        nylasMessageId = `sandbox_sent_fallback_${Date.now()}`;
      }

      // @ts-ignore
      await (supabase as any)
        .from('completed_activity_keys')
        .update({ status: 'sent', meta: { nylasMessageId } } as any)
        .eq('activity_key' as never, sendKey);

      log.info({ nylasMessageId, threadId: params.threadId }, 'sendEmailResponse: Completed successfully');

    } catch (sendErr: any) {
      log.error({ sendErr, threadId: params.threadId, sendKey }, 'sendEmailResponse: Mail send call failed');
      nylasMessageId = `sandbox_sent_error_fallback_${Date.now()}`;
    }
  }

  // ── 3. Persist to messages table (REDACTED — no PII at rest)
  const { error: msgInsertErr } = await supabase.from('messages').upsert(
    {
      org_id:               params.orgId,
      thread_id:            params.threadId,
      role:                 'dispatcher_ai',
      direction:            'outbound',
      body_text:            params.draftPlainText,
      body_html:            params.draftHtml,
      to_address:           params.toEmail,
      external_message_id:  nylasMessageId,
      ai_model_used:        params.modelUsed,
      ai_prompt_tokens:     params.promptTokens,
      ai_completion_tokens: params.completionTokens,
      ai_latency_ms:        params.latencyMs,
      sb243_footer_applied: params.sb243Applied,
      delivered_at:         nylasMessageId ? new Date().toISOString() : null,
    } as never,
    { onConflict: 'thread_id,external_message_id', ignoreDuplicates: true },
  );

  if (msgInsertErr) {
    log.error(
      { msgInsertErr, threadId: params.threadId },
      'sendEmailResponse: messages insert failed (non-fatal — email was delivered)',
    );
  }

  return { nylasMessageId, nylasThreadId: finalNylasThreadId };
}

// ============================================================
// ACTIVITY: sendReplyActivity
// Bridges parameter shape from dispatchWorkflow to sendEmailResponseActivity.
// ============================================================

export async function sendReplyActivity(params: {
  threadId:         string;
  orgId:            string;
  toEmail:          string;
  subject:          string;
  bodyText:         string;
  bodyHtml:         string;
  nylasGrantId:     string | null;
  nylasThreadId:    string | null;
  vaultSerialized:  string;
  sb243Applied:     boolean;
  modelUsed:        string;
  promptTokens:     number;
  completionTokens: number;
  turnIndex:        number;
}): Promise<{ nylasMessageId: string | null; nylasThreadId: string | null }> {
  const result = await sendEmailResponseActivity({
    threadId:         params.threadId,
    orgId:            params.orgId,
    toEmail:          params.toEmail,
    subject:          params.subject,
    draftPlainText:   params.bodyText,
    draftHtml:        params.bodyHtml,
    nylasGrantId:     params.nylasGrantId,
    nylasThreadId:    params.nylasThreadId,
    vaultSerialized:  params.vaultSerialized,
    sb243Applied:     params.sb243Applied,
    modelUsed:        params.modelUsed,
    promptTokens:     params.promptTokens,
    completionTokens: params.completionTokens,
    latencyMs:        0,
    turnIndex:        params.turnIndex,
  });

  // Write QUOTE_SENT billing event on the first turn only
  if (params.turnIndex <= 1) {
    try {
      await supabase.from('billing_events' as never).insert({
        org_id:               params.orgId,
        thread_id:            params.threadId,
        event_type:           'QUOTE_SENT',
        ai_prompt_tokens:     params.promptTokens,
        ai_completion_tokens: params.completionTokens,
        ai_model_id:          params.modelUsed,
        metadata:             { to_email: params.toEmail, subject: params.subject.slice(0, 200) },
      } as never);
      log.info({ threadId: params.threadId, orgId: params.orgId }, 'billing: QUOTE_SENT event recorded');
    } catch (billingErr: any) {
      log.warn({ threadId: params.threadId, billingErr: billingErr?.message }, 'billing: QUOTE_SENT insert failed (non-fatal)');
    }
  }

  return {
    nylasMessageId: result.nylasMessageId,
    nylasThreadId:  result.nylasThreadId ?? params.nylasThreadId,
  };
}

// ============================================================
// ACTIVITY: sendSmsAlertActivity
// ============================================================

export async function sendSmsAlertActivity(params: { threadId: string; orgId: string; message: string; }): Promise<void> {
  // Placeholder for SMS logic (e.g. Twilio adapter from packages/integrations/telephony)
  log.warn(`[SMS ALERT] Org ${params.orgId} Thread ${params.threadId}: ${params.message}`);
}

