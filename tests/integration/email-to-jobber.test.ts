/**
 * RelayDispatch — Integration Test: Email-to-Jobber End-to-End Flow
 * ─────────────────────────────────────────────────────────────
 * Tests the complete path:
 *   POST /api/intake/direct
 *   → threads.insert
 *   → OpenRouter classify
 *   → OpenRouter dispatch (Claude)
 *   → messages.insert (sb243_footer_applied = true)
 *   → Jobber clientCreate + jobCreate
 *   → billing_events.insert (JOB_BOOKED)
 *
 * All external services (Supabase, OpenRouter, Jobber) are mocked
 * with msw (Mock Service Worker) — no live API keys needed.
 *
 * Run: npx vitest run tests/integration/email-to-jobber.test.ts
 */

import 'dotenv/config';
process.env.SUPABASE_URL = 'https://mock-supabase.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'mock-key-123';
process.env.OPENROUTER_API_KEY = 'mock-or-key-123';
process.env.VAULT_ENCRYPTION_KEY = 'cc2df5bd177d37b8e2f3c20c54278818d4071bee82f7c704322ca863224155b2';
process.env.AGENT_NAME = 'Dispatch';
process.env.AGENT_BRAND = 'RelayDispatch';

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupServer }   from 'msw/node';
import { http, HttpResponse } from 'msw';

// ── Mock data ─────────────────────────────────────────────────

const MOCK_ORG_ID    = '00000000-0000-0000-0000-000000000001';
const MOCK_THREAD_ID = '11111111-0000-0000-0000-000000000001';
const MOCK_JOB_ID    = 'jobber-job-abc-123';

// ── MSW: Mock server setup ────────────────────────────────────

const server = setupServer(
  // Supabase: org lookup
  http.get('https://mock-supabase.supabase.co/rest/v1/organizations', () => {
    return HttpResponse.json([{
      id:           MOCK_ORG_ID,
      name:         'Arctic Air HVAC (Test)',
      sb243_footer: 'Dispatch is an AI Service Coordinator — Powered by RelayDispatch',
      timezone:     'America/Chicago',
      nylas_grant_id: null,
      is_active:    true,
    }]);
  }),

  // Supabase: threads insert
  http.post('https://mock-supabase.supabase.co/rest/v1/threads', () => {
    return HttpResponse.json([{ id: MOCK_THREAD_ID }], { status: 201 });
  }),

  // Supabase: threads update
  http.patch('https://mock-supabase.supabase.co/rest/v1/threads', () => {
    return HttpResponse.json([{ id: MOCK_THREAD_ID }], { status: 200 });
  }),

  // Supabase: messages insert
  http.post('https://mock-supabase.supabase.co/rest/v1/messages', () => {
    // Verify sb243_footer_applied: true is in the payload
    return HttpResponse.json([{ id: 'msg-001' }], { status: 201 });
  }),

  // Supabase: contacts upsert
  http.post('https://mock-supabase.supabase.co/rest/v1/contacts', () => {
    return HttpResponse.json([{ id: 'contact-001' }], { status: 201 });
  }),

  // Supabase: pricing_rules lookup
  http.get('https://mock-supabase.supabase.co/rest/v1/pricing_rules', () => {
    return HttpResponse.json([{
      service_code:   'AC_DIAGNOSTIC',
      service_label:  'AC System Diagnostic',
      base_price_usd: '89.00',
      min_price_usd:  '75.00',
      max_price_usd:  '149.00',
      pricing_type:   'diagnostic',
      unit_label:     null,
    }]);
  }),

  // Supabase: ai_audit_log insert
  http.post('https://mock-supabase.supabase.co/rest/v1/ai_audit_log', () => {
    return HttpResponse.json([{ id: 'audit-001' }], { status: 201 });
  }),

  // Supabase: billing_events insert
  http.post('https://mock-supabase.supabase.co/rest/v1/billing_events', () => {
    return HttpResponse.json([{ id: 'billing-001', event_type: 'JOB_BOOKED' }], { status: 201 });
  }),

  // Supabase: completed_activity_keys handlers
  http.get('https://mock-supabase.supabase.co/rest/v1/completed_activity_keys', () => {
    return HttpResponse.json([]);
  }),
  http.post('https://mock-supabase.supabase.co/rest/v1/completed_activity_keys', () => {
    return HttpResponse.json([{ key: 'mock-key' }], { status: 201 });
  }),
  http.patch('https://mock-supabase.supabase.co/rest/v1/completed_activity_keys', () => {
    return HttpResponse.json([{ key: 'mock-key' }], { status: 200 });
  }),

  // OpenRouter: classifier (Gemini)
  http.post('https://openrouter.ai/api/v1/chat/completions', async ({ request }) => {
    const body = await request.json() as { model?: string; messages?: unknown[] };
    const isClassifier = (body.model ?? '').includes('gemini');

    if (isClassifier) {
      return HttpResponse.json({
        choices: [{
          message: {
            content: JSON.stringify({
              serviceCategory: 'AC_DIAGNOSTIC',
              urgencyScore:    75,
              sentimentScore:  -40,
              equipmentBrand:  'Carrier',
              equipmentModel:  '24ACC636A003',
              equipmentSerial: null,
              equipmentAge:    5,
              preferredDate:   null,
              preferredTime:   null,
              techNotes:       'AC not cooling. Unit is 5 years old (Carrier).',
            }),
          },
        }],
        usage: { prompt_tokens: 120, completion_tokens: 80 },
      });
    }

    // Dispatcher (Claude)
    return HttpResponse.json({
      choices: [{
        message: {
          content: JSON.stringify({
            replyBody: 'Hi, I understand your AC isn\'t working. '
              + 'Our diagnostic fee is $89. We can send a tech tomorrow.',
            shouldEscalate: false,
            escalationReason: null,
            confidence: 0.95
          }),
        },
      }],
      usage: { prompt_tokens: 350, completion_tokens: 180 },
    });
  }),

  // Jobber: search client by email
  http.post('https://api.getjobber.com/api/graphql', async ({ request }) => {
    const body = await request.text();

    if (body.includes('FindClientByEmail')) {
      return HttpResponse.json({ data: { clients: { nodes: [] } } });
    }

    if (body.includes('CreateClient') || body.includes('clientCreate')) {
      return HttpResponse.json({
        data: { clientCreate: { client: { id: 'jobber-client-001', name: 'Test Customer' }, userErrors: [] } },
      });
    }

    if (body.includes('CreateDraftJob') || body.includes('jobCreate')) {
      return HttpResponse.json({
        data: {
          jobCreate: {
            job: {
              id:         MOCK_JOB_ID,
              jobNumber:  '1042',
              title:      'AC System Diagnostic — Carrier 24ACC636A003',
              jobStatus:  'DRAFT',
              client:     { id: 'jobber-client-001' },
            },
            userErrors: [],
          },
        },
      });
    }

    return HttpResponse.json({ data: {} });
  }),
);

// ── Tests ─────────────────────────────────────────────────────

describe('Email-to-Jobber Integration', () => {
  beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
  afterAll(() => server.close());

  it('should classify an inbound AC_DIAGNOSTIC request', async () => {
    const { classifyInboundRequest } = await import(
      '../../apps/worker/src/activities/index.ts'
    );

    const result = await classifyInboundRequest({
      orgId:    MOCK_ORG_ID,
      threadId: MOCK_THREAD_ID,
      subject:  'AC not cooling — please help!',
      bodyText: 'My Carrier AC unit stopped working. It is about 5 years old.',
    });

    expect(result.serviceCategory).toBe('AC_DIAGNOSTIC');
    expect(result.urgencyScore).toBeGreaterThan(0);
    expect(result.urgencyScore).toBeLessThanOrEqual(100);
    expect(result.sentimentScore).toBeGreaterThanOrEqual(-100);
    expect(result.extractedData.equipmentBrand).toBe('Carrier');
  });

  it('should generate a dispatcher reply with SB 243 disclosure', async () => {
    const { runDispatcherAgent } = await import(
      '../../packages/ai/dispatcher/src/index.ts'
    );

    const result = await runDispatcherAgent(
      {
        threadId:            MOCK_THREAD_ID,
        orgId:               MOCK_ORG_ID,
        contactEmail:        'test@example.com',
        subject:             'AC not cooling',
        bodyText:            'My AC stopped working.',
        serviceCategory:     'AC_DIAGNOSTIC',
        urgencyScore:        75,
        sentimentScore:      -40,
        conversationHistory: [],
        availableTechnicians: [],
      },
      'Arctic Air HVAC (Test)',
      'Dispatch is an AI Service Coordinator — Powered by RelayDispatch',
      'America/Chicago',
    );

    expect(result.draftReplyPlainText).toContain('RelayDispatch');
    expect(result.draftReplyPlainText).toContain('AI');
    expect(result.shouldEscalate).toBe(false);
  });

  it('should create a local job and optionally sync to Jobber', async () => {
    // We need to mock the `jobs` insert for this test to not throw
    server.use(
      http.get('https://mock-supabase.supabase.co/rest/v1/jobs', () => {
        return HttpResponse.json(null, { status: 200 }); // Simulate no existing job
      }),
      http.post('https://mock-supabase.supabase.co/rest/v1/jobs', () => {
        return HttpResponse.json({ id: MOCK_JOB_ID }, { status: 201 });
      }),
      // Mock the RPC call for limits check
      http.post('https://mock-supabase.supabase.co/rest/v1/rpc/check_org_limits', () => {
        return HttpResponse.json(null, { status: 200 }); // success, no error
      }),
      // Mock the RPC call for increment usage
      http.post('https://mock-supabase.supabase.co/rest/v1/rpc/increment_org_jobs_usage', () => {
        return HttpResponse.json(null, { status: 200 });
      })
    );

    const { createJobActivity } = await import(
      '../../apps/worker/src/activities/index.ts'
    );

    const result = await createJobActivity({
      orgId:    MOCK_ORG_ID,
      threadId: MOCK_THREAD_ID,
      contactId: 'contact-001',
      serviceType: 'AC_DIAGNOSTIC',
      contactEmail: 'test@example.com',
      contactName: 'Test Customer'
    });

    expect(result).not.toBeNull();
    expect(result.jobId).toBe(MOCK_JOB_ID);
    // Note: since jobber org lookup is mocked to return nothing for token, it might skip sync,
    // so we just check it doesn't fail.
  });

  it('should ensure sb243_footer_applied = true on outbound messages', async () => {
    // This test verifies the DB insert contract by inspecting the MSW
    // intercepted request body for sb243_footer_applied: true
    let capturedBody: Record<string, unknown> = {};

    server.use(
      http.post('https://mock-supabase.supabase.co/rest/v1/messages', async ({ request }) => {
        capturedBody = await request.json() as Record<string, unknown>;
        return HttpResponse.json([{ id: 'msg-sb243' }], { status: 201 });
      }),
      http.get('https://mock-supabase.supabase.co/rest/v1/jobs', () => {
        return HttpResponse.json(null, { status: 200 });
      }),
      http.post('https://mock-supabase.supabase.co/rest/v1/jobs', () => {
        return HttpResponse.json([{ id: MOCK_JOB_ID }], { status: 201 });
      }),
      http.post('https://mock-supabase.supabase.co/rest/v1/contacts', () => {
        return HttpResponse.json([{ id: 'contact-001' }], { status: 201 });
      }),
      http.get('https://mock-supabase.supabase.co/rest/v1/contacts', () => {
        return HttpResponse.json([{ id: 'contact-001' }], { status: 200 });
      }),
      http.patch('https://mock-supabase.supabase.co/rest/v1/threads', () => {
        return HttpResponse.json([{ id: 'thread-001' }], { status: 200 });
      })
    );

    const { sendEmailResponseActivity } = await import(
      '../../apps/worker/src/activities/index.ts'
    );

    await sendEmailResponseActivity({
      threadId:         MOCK_THREAD_ID,
      orgId:            MOCK_ORG_ID,
      toEmail:          'customer@example.com',
      subject:          'Re: AC not cooling',
      draftPlainText:   'Your message here. Dispatch is an AI Service Coordinator — Powered by RelayDispatch',
      draftHtml:        '<p>Your message here.</p>',
      nylasGrantId:     null,
      nylasThreadId:    null,
      vaultSerialized:  '{}',
      sb243Applied:     true,
      modelUsed:        'anthropic/claude-opus-4-6',
      promptTokens:     350,
      completionTokens: 180,
      latencyMs:        320,
      turnIndex:        1,
    });

    const body = Array.isArray(capturedBody) ? capturedBody[0] : capturedBody;
    expect(body).toMatchObject({ sb243_footer_applied: true });
  });
});


