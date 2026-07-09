/**
 * tests/mocks/supabase.ts
 * ─────────────────────────────────────────────────────────────
 * Centralised MSW (Mock Service Worker) handlers for Supabase REST API.
 *
 * Import `supabaseMswHandlers` in any test that needs Supabase mocked,
 * then merge with test-specific overrides using server.use(...overrides).
 *
 * Usage:
 *   import { setupServer } from 'msw/node';
 *   import { supabaseMswHandlers } from '../mocks/supabase.js';
 *
 *   const server = setupServer(...supabaseMswHandlers);
 *   beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
 *   afterAll(() => server.close());
 */

import { http, HttpResponse } from 'msw';
import {
  MOCK_ORG_ID,
  MOCK_THREAD_ID,
  MOCK_CONTACT_ID,
  MOCK_JOB_ID,
} from '../fixtures/factories.js';

const BASE = 'https://mock-supabase.supabase.co';

export const supabaseMswHandlers = [

  // ── Organizations ─────────────────────────────────────────────
  http.get(`${BASE}/rest/v1/organizations`, () =>
    HttpResponse.json([{
      id:                   MOCK_ORG_ID,
      name:                 'Arctic Air HVAC (Test)',
      sb243_footer:         'Dispatch is an AI Service Coordinator — Powered by RelayDispatch',
      timezone:             'America/Chicago',
      nylas_grant_id:       null,
      is_active:            true,
      dispatch_mode:        'autonomous',
      twilio_number:        null,
      intake_email_address: 'dispatch@arcticair.test',
      trial_ends_at:        null,
    }]),
  ),

  http.patch(`${BASE}/rest/v1/organizations`, () =>
    HttpResponse.json([{ id: MOCK_ORG_ID }], { status: 200 }),
  ),

  // ── Threads ───────────────────────────────────────────────────
  http.post(`${BASE}/rest/v1/threads`, () =>
    HttpResponse.json([{ id: MOCK_THREAD_ID }], { status: 201 }),
  ),

  http.patch(`${BASE}/rest/v1/threads`, () =>
    HttpResponse.json([{ id: MOCK_THREAD_ID }], { status: 200 }),
  ),

  http.get(`${BASE}/rest/v1/threads`, () =>
    HttpResponse.json([{ id: MOCK_THREAD_ID, status: 'new' }]),
  ),

  // ── Messages ─────────────────────────────────────────────────
  http.post(`${BASE}/rest/v1/messages`, () =>
    HttpResponse.json([{ id: 'msg-001', sb243_footer_applied: true }], { status: 201 }),
  ),

  // ── Contacts ──────────────────────────────────────────────────
  http.post(`${BASE}/rest/v1/contacts`, () =>
    HttpResponse.json([{ id: MOCK_CONTACT_ID }], { status: 201 }),
  ),

  http.get(`${BASE}/rest/v1/contacts`, () =>
    HttpResponse.json([{ id: MOCK_CONTACT_ID }], { status: 200 }),
  ),

  http.patch(`${BASE}/rest/v1/contacts`, () =>
    HttpResponse.json([{ id: MOCK_CONTACT_ID }], { status: 200 }),
  ),

  // ── Jobs ──────────────────────────────────────────────────────
  http.post(`${BASE}/rest/v1/jobs`, () =>
    HttpResponse.json([{ id: MOCK_JOB_ID }], { status: 201 }),
  ),

  http.get(`${BASE}/rest/v1/jobs`, () =>
    HttpResponse.json([], { status: 200 }),
  ),

  http.patch(`${BASE}/rest/v1/jobs`, () =>
    HttpResponse.json([{ id: MOCK_JOB_ID }], { status: 200 }),
  ),

  // ── Pricing rules ─────────────────────────────────────────────
  http.get(`${BASE}/rest/v1/pricing_rules`, () =>
    HttpResponse.json([{
      service_code:   'AC_DIAGNOSTIC',
      service_label:  'AC System Diagnostic',
      base_price_usd: '89.00',
      min_price_usd:  '75.00',
      max_price_usd:  '149.00',
      pricing_type:   'diagnostic',
      unit_label:     null,
    }]),
  ),

  // ── AI audit log ─────────────────────────────────────────────
  http.post(`${BASE}/rest/v1/ai_audit_log`, () =>
    HttpResponse.json([{ id: 'audit-001' }], { status: 201 }),
  ),

  // ── Billing events ────────────────────────────────────────────
  http.post(`${BASE}/rest/v1/billing_events`, () =>
    HttpResponse.json([{ id: 'billing-001', event_type: 'JOB_BOOKED' }], { status: 201 }),
  ),

  // ── Idempotency keys ─────────────────────────────────────────
  http.get(`${BASE}/rest/v1/completed_activity_keys`, () =>
    HttpResponse.json([]),
  ),

  http.post(`${BASE}/rest/v1/completed_activity_keys`, () =>
    HttpResponse.json([{ key: 'mock-key' }], { status: 201 }),
  ),

  http.patch(`${BASE}/rest/v1/completed_activity_keys`, () =>
    HttpResponse.json([{ key: 'mock-key' }], { status: 200 }),
  ),

  // ── Org members ──────────────────────────────────────────────
  http.get(`${BASE}/rest/v1/org_members`, () =>
    HttpResponse.json([{ org_id: MOCK_ORG_ID, user_id: 'user-001', role: 'admin' }]),
  ),

  // ── RPCs ─────────────────────────────────────────────────────
  http.post(`${BASE}/rest/v1/rpc/check_org_limits`, () =>
    HttpResponse.json(null, { status: 200 }),
  ),

  http.post(`${BASE}/rest/v1/rpc/increment_org_jobs_usage`, () =>
    HttpResponse.json(null, { status: 200 }),
  ),
];

/**
 * Override: simulates a Supabase DB error response for any table.
 * Use in tests that validate error-handling paths.
 */
export function makeSupabaseErrorHandler(table: string, method: 'GET' | 'POST' | 'PATCH' = 'GET') {
  const url = `${BASE}/rest/v1/${table}`;
  const handler = method === 'GET'
    ? http.get(url, () => HttpResponse.json({ message: 'DB error', code: '23503' }, { status: 500 }))
    : method === 'POST'
    ? http.post(url, () => HttpResponse.json({ message: 'DB error', code: '23503' }, { status: 500 }))
    : http.patch(url, () => HttpResponse.json({ message: 'DB error', code: '23503' }, { status: 500 }));
  return handler;
}
