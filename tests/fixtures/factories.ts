/**
 * tests/fixtures/factories.ts
 * ─────────────────────────────────────────────────────────────
 * Typed factory functions for RelayDispatch domain objects.
 *
 * Each factory returns a fully-populated object with sensible defaults.
 * Accepts a Partial<T> override so tests only specify what matters:
 *
 *   const thread = makeThread({ status: 'escalated' });
 *   const org    = makeOrg({ dispatch_mode: 'shadow' });
 *
 * Philosophy:
 *   - Defaults are realistic but safe (no real PII, no real API keys)
 *   - IDs follow a recognisable test UUID pattern (00000000-000N-...)
 *   - Timestamps are deterministic (ISO 2026-01-01T00:00:00Z)
 */

import type { ClassifiedRequest, DispatcherResult } from '../../packages/ai/dispatcher/src/index.js';
import type { RawTurn, CompactedHistory }            from '../../packages/ai/librarian/src/index.js';
import type { ContinuationState }                    from '../../apps/worker/src/dispatchWorkflow.js';

// ============================================================
// CONSTANTS
// ============================================================

export const MOCK_ORG_ID     = '00000000-0000-0000-0000-000000000001';
export const MOCK_THREAD_ID  = '11111111-0000-0000-0000-000000000001';
export const MOCK_CONTACT_ID = '22222222-0000-0000-0000-000000000001';
export const MOCK_JOB_ID     = 'jobber-job-test-001';
export const MOCK_TIMESTAMP  = '2026-01-01T00:00:00.000Z';

/** A 32-byte hex key safe for use in tests (not for production). */
export const TEST_VAULT_KEY  = 'cc2df5bd177d37b8e2f3c20c54278818d4071bee82f7c704322ca863224155b2';
/** A second key for key-rotation tests. */
export const TEST_VAULT_KEY2 = 'aabbccddeeff00112233445566778899aabbccddeeff00112233445566778899';

// ============================================================
// ORG FACTORY
// ============================================================

export interface MockOrg {
  id:                    string;
  name:                  string;
  sb243_footer:          string;
  timezone:              string;
  nylas_grant_id:        string | null;
  is_active:             boolean;
  dispatch_mode:         'autonomous' | 'shadow' | 'manual';
  twilio_number:         string | null;
  intake_email_address:  string | null;
  trial_ends_at:         string | null;
}

export function makeOrg(overrides: Partial<MockOrg> = {}): MockOrg {
  return {
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
    ...overrides,
  };
}

// ============================================================
// THREAD FACTORY
// ============================================================

export type ThreadStatus =
  | 'new'
  | 'classifying'
  | 'awaiting_customer'
  | 'pending_approval'
  | 'escalated'
  | 'completed'
  | 'closed';

export interface MockThread {
  id:               string;
  org_id:           string;
  status:           ThreadStatus;
  service_category: string | null;
  urgency_score:    number | null;
  sentiment_score:  number | null;
  created_at:       string;
  updated_at:       string;
}

export function makeThread(overrides: Partial<MockThread> = {}): MockThread {
  return {
    id:               MOCK_THREAD_ID,
    org_id:           MOCK_ORG_ID,
    status:           'new',
    service_category: null,
    urgency_score:    null,
    sentiment_score:  null,
    created_at:       MOCK_TIMESTAMP,
    updated_at:       MOCK_TIMESTAMP,
    ...overrides,
  };
}

// ============================================================
// TECHNICIAN FACTORY
// ============================================================

export interface MockTechnician {
  id:             string;
  org_id:         string;
  name:           string;
  email:          string;
  phone:          string | null;
  specialties:    string[];
  is_available:   boolean;
  location_zone:  string | null;
}

export function makeTechnician(overrides: Partial<MockTechnician> = {}): MockTechnician {
  return {
    id:            '33333333-0000-0000-0000-000000000001',
    org_id:        MOCK_ORG_ID,
    name:          'Sam Technician',
    email:         'sam@arcticair.test',
    phone:         null,
    specialties:   ['AC_DIAGNOSTIC', 'AC_REPAIR'],
    is_available:  true,
    location_zone: null,
    ...overrides,
  };
}

// ============================================================
// CLASSIFIED REQUEST FACTORY
// ============================================================

export function makeClassifiedRequest(
  overrides: Partial<ClassifiedRequest> = {},
): ClassifiedRequest {
  return {
    threadId:             MOCK_THREAD_ID,
    orgId:                MOCK_ORG_ID,
    contactEmail:         'customer@test.example',
    subject:              'AC not cooling — please help!',
    bodyText:             'My Carrier AC unit stopped working. It is about 5 years old.',
    serviceCategory:      'AC_DIAGNOSTIC',
    urgencyScore:         75,
    sentimentScore:       -40,
    conversationHistory:  [],
    availableTechnicians: [],
    ...overrides,
  };
}

// ============================================================
// DISPATCHER RESULT FACTORY
// ============================================================

export function makeDispatcherResult(
  overrides: Partial<DispatcherResult> = {},
): DispatcherResult {
  const footer = 'Dispatch is an AI Service Coordinator — Powered by RelayDispatch';
  return {
    draftReply:         `<div>Your appointment is confirmed for tomorrow 9–11 AM.<br/><small>${footer}</small></div>`,
    draftReplyPlainText: `Your appointment is confirmed for tomorrow 9–11 AM.\n\n${footer}`,
    pricingUsed:        '$89 diagnostic fee',
    priceSourcedFromDb: true,
    shouldEscalate:     false,
    escalationReason:   undefined,
    confidence:         0.92,
    modelUsed:          'anthropic/claude-sonnet-4.6',
    promptTokens:       350,
    completionTokens:   180,
    latencyMs:          823,
    openrouterCostUsd:  0.00375,
    ...overrides,
  };
}

// ============================================================
// RAW TURN FACTORY (Librarian)
// ============================================================

export function makeRawTurn(overrides: Partial<RawTurn> = {}): RawTurn {
  return {
    role:      'customer',
    content:   'My AC is not working.',
    timestamp: MOCK_TIMESTAMP,
    ...overrides,
  };
}

// ============================================================
// COMPACTED HISTORY FACTORY
// ============================================================

export function makeCompactedHistory(
  overrides: Partial<CompactedHistory> = {},
): CompactedHistory {
  return {
    summary:             null,
    summaryCoversUntil:  null,
    summarizedTurnCount: 0,
    rawTailTurns:        [],
    totalTokens:         0,
    wasCompacted:        false,
    compactionCount:     0,
    ...overrides,
  };
}

// ============================================================
// CONTINUATION STATE FACTORY (Continue-As-New)
// ============================================================

export function makeContinuationState(
  overrides: Partial<ContinuationState> = {},
): ContinuationState {
  return {
    priorTurnCount:          8,
    vaultSerialized:         '{}',
    nylasThreadId:           null,
    serviceCategory:         'AC_DIAGNOSTIC',
    urgencyScore:            75,
    sentimentScore:          -40,
    conversationHistoryTail: [],
    jobberJobId:             undefined,
    relaydispatchJobId:      undefined,
    ...overrides,
  };
}

// ============================================================
// PII VAULT FACTORY
// ============================================================

export interface MockPiiVault {
  [placeholder: string]: string;
}

export function makeVault(overrides: MockPiiVault = {}): MockPiiVault {
  return {
    '[[CUSTOMER_1]]': 'John Smith',
    '[[PHONE_1]]':    '(512) 555-1234',
    '[[EMAIL_1]]':    'jsmith@example.com',
    ...overrides,
  };
}

// ============================================================
// WORKFLOW INPUT FACTORY
// ============================================================

export interface MockDispatchWorkflowInput {
  threadId:           string;
  orgId:              string;
  emailAddress:       string;
  historyId:          string | null;
  nylasGrantId?:      string | null;
  sb243Footer:        string;
  timezone:           string;
  continuationState?: ContinuationState | null;
}

export function makeWorkflowInput(
  overrides: Partial<MockDispatchWorkflowInput> = {},
): MockDispatchWorkflowInput {
  return {
    threadId:     MOCK_THREAD_ID,
    orgId:        MOCK_ORG_ID,
    emailAddress: 'dispatch@arcticair.test',
    historyId:    'hist-001',
    nylasGrantId: null,
    sb243Footer:  'Dispatch is an AI Service Coordinator — Powered by RelayDispatch',
    timezone:     'America/Chicago',
    ...overrides,
  };
}
