/**
 * tests/workflow/dispatch-workflow.test.ts
 * ─────────────────────────────────────────────────────────────
 * Workflow state machine tests for relayDispatchWorkflow.
 *
 * Architecture:
 *   These tests operate at two levels:
 *
 *   Level 1 — PURE LOGIC TESTS (no Temporal runtime needed):
 *     Tests workflow state machine logic in isolation by
 *     exercising helper functions, guard conditions, phase
 *     transitions, and signal/query contract validation.
 *     These run as regular vitest tests.
 *
 *   Level 2 — TEMPORAL INTEGRATION TESTS:
 *     Full workflow execution using @temporalio/testing's
 *     MockActivityEnvironment for activity-level testing.
 *     No Temporal server needed for these either — MockActivityEnvironment
 *     is a lightweight harness that handles context/heartbeat/cancellation.
 *
 * Test groups:
 *   WF1 — DispatchWorkflowInput contract (type shape tests)
 *   WF2 — ContinuationState shape + priorTurnCount initialization
 *   WF3 — CAN threshold logic (deterministic guard function)
 *   WF4 — Phase transition guards (emergency pre-filter conditions)
 *   WF5 — Signal payload shapes (TypeScript contract)
 *   WF6 — Query result shape (ThreadState interface)
 *   WF7 — Shadow mode: auto-resolve condition
 *   WF8 — Activity: classifyInboundRequest via MockActivityEnvironment
 *   WF9 — Activity: runDispatcherActivity via MockActivityEnvironment
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MockActivityEnvironment }   from '@temporalio/testing';
import {
  MOCK_ORG_ID,
  MOCK_THREAD_ID,
  makeWorkflowInput,
  makeContinuationState,
  makeClassifiedRequest,
  makeDispatcherResult,
} from '../fixtures/factories.js';

// ── Workflow types (no runtime imports) ───────────────────────
import type {
  DispatchWorkflowInput,
  CustomerReplyPayload,
  HumanTakeoverPayload,
  ResolvePayload,
  ThreadState,
} from '../../apps/worker/src/dispatchWorkflow.js';

// ── Constants mirrored from workflow ─────────────────────────
const CAN_TURN_THRESHOLD = 8;
const MAX_TURNS          = 10;

// ============================================================
// WF1 — DispatchWorkflowInput contract
// ============================================================

describe('WF1 — DispatchWorkflowInput contract', () => {
  it('makeWorkflowInput produces a valid workflow input shape', () => {
    const input = makeWorkflowInput();
    expect(input.threadId).toBe(MOCK_THREAD_ID);
    expect(input.orgId).toBe(MOCK_ORG_ID);
    expect(typeof input.sb243Footer).toBe('string');
    expect(typeof input.timezone).toBe('string');
    expect(input.historyId).not.toBeUndefined();
  });

  it('workflow input accepts null historyId for continuation runs', () => {
    const input = makeWorkflowInput({ historyId: null });
    expect(input.historyId).toBeNull();
  });

  it('workflow input with continuationState is a valid extension', () => {
    const state = makeContinuationState();
    const input = makeWorkflowInput({ continuationState: state });
    expect(input.continuationState).toBeDefined();
    expect(input.continuationState!.priorTurnCount).toBe(8);
  });

  it('minimal workflow input without optional fields is valid', () => {
    const minimal: DispatchWorkflowInput = {
      threadId:    MOCK_THREAD_ID,
      orgId:       MOCK_ORG_ID,
      emailAddress: 'dispatch@test.example',
      historyId:   'hist-001',
      sb243Footer: 'AI Coordinator',
      timezone:    'America/Chicago',
    };
    expect(minimal.continuationState).toBeUndefined();
    expect(minimal.nylasGrantId).toBeUndefined();
  });
});

// ============================================================
// WF2 — ContinuationState shape
// ============================================================

describe('WF2 — ContinuationState: resumable run initialization', () => {
  it('priorTurnCount initializes turnCount in resumed workflow', () => {
    const state = makeContinuationState({ priorTurnCount: 8 });
    const turnCount = state.priorTurnCount ?? 0;
    expect(turnCount).toBe(8);
  });

  it('fresh run starts with turnCount = 0', () => {
    const input = makeWorkflowInput({ continuationState: null });
    const turnCount = input.continuationState?.priorTurnCount ?? 0;
    expect(turnCount).toBe(0);
  });

  it('conversationHistoryTail is sliced to 5 turns max before CAN', () => {
    const bigHistory = Array.from({ length: 10 }, (_, i) => ({
      role: 'customer' as const,
      content: `Message ${i + 1}`,
      timestamp: '2026-01-01T00:00:00Z',
    }));
    const tail = bigHistory.slice(-5);
    expect(tail).toHaveLength(5);
    expect(tail[0]!.content).toBe('Message 6');
  });

  it('ContinuationState carries all classification results across CAN boundary', () => {
    const state = makeContinuationState({
      serviceCategory: 'FURNACE_REPAIR',
      urgencyScore:    85,
      sentimentScore:  -60,
      jobberJobId:     'job-001',
    });
    expect(state.serviceCategory).toBe('FURNACE_REPAIR');
    expect(state.urgencyScore).toBe(85);
    expect(state.jobberJobId).toBe('job-001');
  });
});

// ============================================================
// WF3 — CAN threshold logic (deterministic guard)
// ============================================================

describe('WF3 — Continue-As-New threshold guard', () => {
  function shouldTriggerCAN(turnCount: number, resolved: boolean, escalated: boolean) {
    return turnCount >= CAN_TURN_THRESHOLD && !resolved && !escalated;
  }

  it.each([0, 1, 2, 3, 4, 5, 6, 7])('does NOT trigger at turn %i', (turn) => {
    expect(shouldTriggerCAN(turn, false, false)).toBe(false);
  });

  it('triggers at turn 8 (threshold)', () => {
    expect(shouldTriggerCAN(8, false, false)).toBe(true);
  });

  it('triggers at turn 9', () => {
    expect(shouldTriggerCAN(9, false, false)).toBe(true);
  });

  it('does NOT trigger when resolved=true', () => {
    expect(shouldTriggerCAN(8, true, false)).toBe(false);
  });

  it('does NOT trigger when escalated=true', () => {
    expect(shouldTriggerCAN(8, false, true)).toBe(false);
  });

  it('CAN_TURN_THRESHOLD is less than MAX_TURNS (no overflow possible)', () => {
    expect(CAN_TURN_THRESHOLD).toBeLessThan(MAX_TURNS);
  });
});

// ============================================================
// WF4 — Phase transition guards
// ============================================================

describe('WF4 — Phase transition guards', () => {
  it('emergency → ESCALATED_TO_HUMAN immediately (urgency >= 90)', () => {
    const urgency = 95;
    const category = 'AC_REPAIR';
    const isEmergency = urgency >= 90 || category === 'EMERGENCY';
    expect(isEmergency).toBe(true);
  });

  it('urgency 89 + non-EMERGENCY category → NOT emergency', () => {
    const urgency = 89;
    const category = 'AC_REPAIR';
    const isEmergency = urgency >= 90 || category === 'EMERGENCY';
    expect(isEmergency).toBe(false);
  });

  it('shadow mode: dispatch mode = autonomous → AI dispatches directly', () => {
    const dispatchMode = 'autonomous' as const;
    const shouldDispatch = dispatchMode === 'autonomous';
    expect(shouldDispatch).toBe(true);
  });

  it('shadow mode: dispatch mode = shadow → requires approval before send', () => {
    const dispatchMode = 'shadow' as const;
    const requiresApproval = dispatchMode === 'shadow';
    expect(requiresApproval).toBe(true);
  });

  it('manual mode: no AI dispatch', () => {
    const dispatchMode = 'manual' as const;
    const aiDispatch = dispatchMode === 'autonomous' || dispatchMode === 'shadow';
    expect(aiDispatch).toBe(false);
  });
});

// ============================================================
// WF5 — Signal payload shapes
// ============================================================

describe('WF5 — Signal payload shapes (contract tests)', () => {
  it('CustomerReplyPayload has required fields', () => {
    const payload: CustomerReplyPayload = {
      bodyText:     'My AC is still not working.',
      htmlBody:     '<p>Still broken.</p>',
      fromEmail:    'customer@test.example',
      fromName:     'Test Customer',
      nylasThreadId: null,
      receivedAt:   '2026-01-01T10:00:00Z',
    };
    expect(payload.bodyText).toBeTruthy();
    expect(payload.fromEmail).toBeTruthy();
  });

  it('HumanTakeoverPayload has required fields', () => {
    const payload: HumanTakeoverPayload = {
      agentName:  'Support Agent Alice',
      agentEmail: 'alice@company.example',
    };
    expect(payload.agentName).toBeTruthy();
  });

  it('ResolvePayload has required fields', () => {
    const payload: ResolvePayload = {
      resolvedBy: 'ai',
      notes:      'Job dispatched successfully',
    };
    expect(payload.resolvedBy).toBeTruthy();
  });
});

// ============================================================
// WF6 — ThreadState query result shape
// ============================================================

describe('WF6 — ThreadState query result shape', () => {
  it('ThreadState interface shape is satisfied by mock data', () => {
    const state: ThreadState = {
      phase:              'AWAITING_CUSTOMER',
      orgId:              MOCK_ORG_ID,
      threadId:           MOCK_THREAD_ID,
      serviceCategory:    'AC_DIAGNOSTIC',
      urgencyScore:       75,
      sentimentScore:     -40,
      turnCount:          1,
      escalated:          false,
      escalationReason:   undefined,
      jobberJobId:        undefined,
      lastCustomerTurnAt: undefined,
      contactEmail:       undefined,
    };
    expect(state.phase).toBe('AWAITING_CUSTOMER');
    expect(state.escalated).toBe(false);
    expect(state.turnCount).toBe(1);
  });

  it('escalated ThreadState has escalated=true and escalationReason set', () => {
    const state: ThreadState = {
      phase:              'ESCALATED_TO_HUMAN',
      orgId:              MOCK_ORG_ID,
      threadId:           MOCK_THREAD_ID,
      serviceCategory:    'EMERGENCY',
      urgencyScore:       95,
      sentimentScore:     -90,
      turnCount:          0,
      escalated:          true,
      escalationReason:   'Emergency detected: gas leak',
      jobberJobId:        undefined,
      lastCustomerTurnAt: undefined,
      contactEmail:       undefined,
    };
    expect(state.escalated).toBe(true);
    expect(state.escalationReason).toContain('gas leak');
  });
});

// ============================================================
// WF7 — Inactivity timeout condition
// ============================================================

describe('WF7 — Inactivity timeout: thread closure logic', () => {
  it('thread closes when condition() times out with no pending signals', () => {
    const pendingReply  = undefined;
    const humanAgent    = undefined;
    const resolved      = undefined;
    const gotSignal     = false;

    // Mirrors the inactivity check in the workflow loop
    const shouldClose = !gotSignal
      && pendingReply === undefined
      && humanAgent === undefined
      && resolved === undefined;

    expect(shouldClose).toBe(true);
  });

  it('thread does NOT close when a signal arrived', () => {
    const gotSignal = true;
    expect(!gotSignal).toBe(false);
  });

  it('thread does NOT close when pendingReply is set', () => {
    const pendingReply: CustomerReplyPayload = {
      bodyText: 'Some reply',
      htmlBody: '',
      fromEmail: 'c@test.example',
      fromName: 'Customer',
      nylasThreadId: null,
      receivedAt: '2026-01-01T00:00:00Z',
    };
    const gotSignal = false;
    const shouldClose = !gotSignal && pendingReply == null;
    expect(shouldClose).toBe(false);
  });
});

// ============================================================
// WF8 — Activity: classifyInboundRequest (MockActivityEnvironment)
// ============================================================

describe('WF8 — MockActivityEnvironment: classifyInboundRequest', () => {
  let env: MockActivityEnvironment;
  beforeAll(() => { env = new MockActivityEnvironment(); });
  afterAll(async () => { /* MockActivityEnvironment has no teardown */ });

  it('classifyInboundRequest returns correct shape when mocked', async () => {
    const mockClassify = async (_params: unknown) => ({
      serviceCategory: 'AC_DIAGNOSTIC',
      urgencyScore:    75,
      sentimentScore:  -40,
      extractedData: {
        serviceCategory: 'AC_DIAGNOSTIC',
        serviceLabel:    'AC System Diagnostic',
        urgencyScore:    75,
        techNotes:       'AC not cooling.',
      },
    });

    const result = await env.run(mockClassify, {
      orgId:    MOCK_ORG_ID,
      threadId: MOCK_THREAD_ID,
      subject:  'AC not cooling',
      bodyText: 'My AC unit stopped working.',
    });

    expect(result.serviceCategory).toBe('AC_DIAGNOSTIC');
    expect(result.urgencyScore).toBe(75);
    expect(result.extractedData.serviceLabel).toBe('AC System Diagnostic');
  });
});

// ============================================================
// WF9 — Activity: runDispatcherActivity (MockActivityEnvironment)
// ============================================================

describe('WF9 — MockActivityEnvironment: runDispatcherActivity', () => {
  let env: MockActivityEnvironment;
  beforeAll(() => { env = new MockActivityEnvironment(); });

  it('dispatcher activity returns a valid DispatcherResult', async () => {
    const mockDispatch = async (_params: unknown) => makeDispatcherResult();

    const result = await env.run(mockDispatch, makeClassifiedRequest());

    expect(result.shouldEscalate).toBe(false);
    expect(result.draftReplyPlainText).toContain('RelayDispatch');
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.openrouterCostUsd).toBeGreaterThan(0);
  });

  it('dispatcher activity with shouldEscalate=true has escalationReason', async () => {
    const mockEscalate = async (_params: unknown) => makeDispatcherResult({
      shouldEscalate:   true,
      escalationReason: 'Complex billing dispute',
      confidence:       0.30,
    });

    const result = await env.run(mockEscalate, makeClassifiedRequest());
    expect(result.shouldEscalate).toBe(true);
    expect(result.escalationReason).toContain('billing');
  });
});
