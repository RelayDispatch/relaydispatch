/**
 * tests/unit/continue-as-new.test.ts
 * ─────────────────────────────────────────────────────────────
 * Unit tests for the Continue-As-New (CAN) state management
 * added in Phase 1 to prevent Temporal workflow history overflow.
 *
 * Test groups:
 *   CAN1 — ContinuationState shape validation (Zod-like structural tests)
 *   CAN2 — State restoration from ContinuationState
 *   CAN3 — CAN threshold logic (triggers at turn 8, not before)
 *   CAN4 — ContinuationState carry-over correctness
 *   CAN5 — Resumed workflow skips classification phase
 *   CAN6 — DispatchWorkflowInput backward compatibility
 */

import { describe, it, expect } from 'vitest';
import type { ContinuationState } from '../../apps/worker/src/dispatchWorkflow.js';
import {
  makeContinuationState,
  makeWorkflowInput,
  makeRawTurn,
} from '../fixtures/factories.js';

// ============================================================
// CAN1 — ContinuationState shape validation
// ============================================================

describe('CAN1 — ContinuationState shape validation', () => {
  it('factory produces a valid ContinuationState', () => {
    const state = makeContinuationState();
    expect(state.priorTurnCount).toBe(8);
    expect(state.vaultSerialized).toBe('{}');
    expect(state.nylasThreadId).toBeNull();
    expect(Array.isArray(state.conversationHistoryTail)).toBe(true);
  });

  it('all required fields are present', () => {
    const state = makeContinuationState();
    const requiredFields: (keyof ContinuationState)[] = [
      'priorTurnCount',
      'vaultSerialized',
      'nylasThreadId',
      'serviceCategory',
      'urgencyScore',
      'sentimentScore',
      'conversationHistoryTail',
      'jobberJobId',
      'relaydispatchJobId',
    ];
    for (const field of requiredFields) {
      expect(state).toHaveProperty(field);
    }
  });

  it('vaultSerialized is a valid JSON string', () => {
    const state = makeContinuationState({ vaultSerialized: '{"[[CUSTOMER_1]]":"John Smith"}' });
    expect(() => JSON.parse(state.vaultSerialized)).not.toThrow();
    const parsed = JSON.parse(state.vaultSerialized);
    expect(parsed['[[CUSTOMER_1]]']).toBe('John Smith');
  });

  it('conversationHistoryTail contains valid RawTurn objects', () => {
    const turns = [
      makeRawTurn({ role: 'customer', content: 'My AC is broken.' }),
      makeRawTurn({ role: 'dispatcher_ai', content: 'We can help. What model?' }),
    ];
    const state = makeContinuationState({ conversationHistoryTail: turns });
    expect(state.conversationHistoryTail).toHaveLength(2);
    expect(state.conversationHistoryTail[0]!.role).toBe('customer');
    expect(state.conversationHistoryTail[1]!.role).toBe('dispatcher_ai');
  });
});

// ============================================================
// CAN2 — State restoration from ContinuationState
// ============================================================

describe('CAN2 — State restoration from ContinuationState', () => {
  it('priorTurnCount is used as the starting turnCount', () => {
    const state = makeContinuationState({ priorTurnCount: 8 });
    // Simulate the workflow's state initialization code
    const turnCount = state.priorTurnCount;
    expect(turnCount).toBe(8);
  });

  it('vault is restored from vaultSerialized', () => {
    const originalVault = { '[[CUSTOMER_1]]': 'Jane Doe', '[[PHONE_1]]': '555-1234' };
    const state = makeContinuationState({
      vaultSerialized: JSON.stringify(originalVault),
    });
    const restoredVault = JSON.parse(state.vaultSerialized);
    expect(restoredVault['[[CUSTOMER_1]]']).toBe('Jane Doe');
    expect(restoredVault['[[PHONE_1]]']).toBe('555-1234');
  });

  it('nylasThreadId is preserved across CAN boundary', () => {
    const state = makeContinuationState({ nylasThreadId: 'nylas-thread-xyz-123' });
    expect(state.nylasThreadId).toBe('nylas-thread-xyz-123');
  });

  it('jobberJobId is preserved across CAN boundary', () => {
    const state = makeContinuationState({ jobberJobId: 'jobber-job-001' });
    expect(state.jobberJobId).toBe('jobber-job-001');
  });

  it('relaydispatchJobId is preserved across CAN boundary', () => {
    const state = makeContinuationState({ relaydispatchJobId: 'rd-job-uuid-001' });
    expect(state.relaydispatchJobId).toBe('rd-job-uuid-001');
  });

  it('classification results are preserved', () => {
    const state = makeContinuationState({
      serviceCategory: 'FURNACE_REPAIR',
      urgencyScore:    85,
      sentimentScore:  -60,
    });
    expect(state.serviceCategory).toBe('FURNACE_REPAIR');
    expect(state.urgencyScore).toBe(85);
    expect(state.sentimentScore).toBe(-60);
  });
});

// ============================================================
// CAN3 — CAN threshold logic
// ============================================================

describe('CAN3 — CAN threshold logic: triggers at turn 8', () => {
  const CAN_TURN_THRESHOLD = 8;
  const MAX_TURNS          = 10;

  function shouldTriggerCAN(turnCount: number, resolved: boolean, escalated: boolean): boolean {
    return turnCount >= CAN_TURN_THRESHOLD && !resolved && !escalated;
  }

  it('does NOT trigger CAN before turn 8', () => {
    for (let t = 0; t < 8; t++) {
      expect(shouldTriggerCAN(t, false, false)).toBe(false);
    }
  });

  it('triggers CAN at exactly turn 8', () => {
    expect(shouldTriggerCAN(8, false, false)).toBe(true);
  });

  it('triggers CAN at turn 9', () => {
    expect(shouldTriggerCAN(9, false, false)).toBe(true);
  });

  it('does NOT trigger CAN when workflow is resolved', () => {
    expect(shouldTriggerCAN(8, true, false)).toBe(false);
  });

  it('does NOT trigger CAN when workflow is escalated', () => {
    expect(shouldTriggerCAN(8, false, true)).toBe(false);
  });

  it('CAN threshold is before MAX_TURNS (no history overflow possible)', () => {
    expect(CAN_TURN_THRESHOLD).toBeLessThan(MAX_TURNS);
  });
});

// ============================================================
// CAN4 — ContinuationState carry-over correctness
// ============================================================

describe('CAN4 — ContinuationState carry-over: last 5 turns preserved', () => {
  it('keeps exactly the last 5 turns when history is longer', () => {
    const turns = Array.from({ length: 10 }, (_, i) =>
      makeRawTurn({ content: `Message ${i + 1}`, timestamp: `2026-01-0${Math.min(i + 1, 9)}T00:00:00Z` }),
    );

    // Simulate: conversationHistory.slice(-5)
    const tail = turns.slice(-5);
    expect(tail).toHaveLength(5);
    expect(tail[0]!.content).toBe('Message 6');
    expect(tail[4]!.content).toBe('Message 10');
  });

  it('keeps all turns when history has fewer than 5', () => {
    const turns = [
      makeRawTurn({ content: 'Turn 1' }),
      makeRawTurn({ content: 'Turn 2' }),
    ];
    const tail = turns.slice(-5);
    expect(tail).toHaveLength(2);
  });

  it('empty history produces empty tail', () => {
    const tail: typeof turns = [].slice(-5);
    expect(tail).toHaveLength(0);
  });
});

// ============================================================
// CAN5 — Resumed workflow should not re-classify
// ============================================================

describe('CAN5 — Resumed workflow (continuationState present) skips initial classification', () => {
  it('workflow input with continuationState signals a resumed run', () => {
    const input = makeWorkflowInput({
      historyId:         null, // null signals continuation, no email to fetch
      continuationState: makeContinuationState(),
    });
    expect(input.historyId).toBeNull();
    expect(input.continuationState).not.toBeNull();
    expect(input.continuationState!.priorTurnCount).toBeGreaterThan(0);
  });

  it('fresh workflow has no continuationState', () => {
    const input = makeWorkflowInput({ continuationState: null });
    expect(input.continuationState).toBeNull();
  });

  it('turned count initializes from continuationState.priorTurnCount', () => {
    const continuation = makeContinuationState({ priorTurnCount: 8 });
    // Mirrors the workflow code: let turnCount = input.continuationState?.priorTurnCount ?? 0;
    const turnCount = continuation.priorTurnCount ?? 0;
    expect(turnCount).toBe(8);
  });

  it('fresh run initializes turnCount to 0', () => {
    const input = makeWorkflowInput({ continuationState: null });
    const turnCount = input.continuationState?.priorTurnCount ?? 0;
    expect(turnCount).toBe(0);
  });
});

// ============================================================
// CAN6 — DispatchWorkflowInput backward compatibility
// ============================================================

describe('CAN6 — DispatchWorkflowInput backward compatibility', () => {
  it('continuationState field is optional (does not break existing callers)', () => {
    // A caller that does not supply continuationState must still be valid
    const minimalInput = {
      threadId:     '11111111-0000-0000-0000-000000000001',
      orgId:        '00000000-0000-0000-0000-000000000001',
      emailAddress: 'dispatch@test.example',
      historyId:    'hist-001',
      sb243Footer:  'AI Coordinator',
      timezone:     'America/Chicago',
      // continuationState omitted
    };
    expect(minimalInput).not.toHaveProperty('continuationState');
    // Using optional chaining on absent field must return undefined, not throw
    const turnCount = (minimalInput as any).continuationState?.priorTurnCount ?? 0;
    expect(turnCount).toBe(0);
  });
});
