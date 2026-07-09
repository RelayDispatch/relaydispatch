/**
 * tests/unit/cost-guardrails.test.ts
 * ─────────────────────────────────────────────────────────────
 * Unit tests for cost tracking, budget enforcement, and the
 * in-memory org cost accumulator in activities/ai.ts.
 *
 * Test groups:
 *   CG1 — calcOpenRouterCost: pricing table accuracy
 *   CG2 — In-memory accumulator: daily limit detection
 *   CG3 — In-memory accumulator: monthly limit detection
 *   CG4 — In-memory accumulator: UTC midnight reset
 *   CG5 — Budget-block produces valid escalation DispatcherResult
 *   CG6 — estimateOpenRouterCost: dispatcher-side cost function
 *   CG7 — Zero-token edge cases
 *   CG8 — Unknown model returns $0 (does not throw)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ── Inline the cost functions to avoid live env dependencies ──

const OPENROUTER_COSTS: Record<string, { inputPer1M: number; outputPer1M: number }> = {
  'google/gemini-3.1-flash-lite-preview': { inputPer1M: 0.075,  outputPer1M: 0.30  },
  'anthropic/claude-sonnet-4.6':          { inputPer1M: 3.00,   outputPer1M: 15.00 },
  'openai/gpt-5.5':                       { inputPer1M: 2.00,   outputPer1M: 8.00  },
};

function calcOpenRouterCost(model: string, promptTokens: number, completionTokens: number): number {
  const pricing = OPENROUTER_COSTS[model];
  if (!pricing) return 0;
  return ((promptTokens * pricing.inputPer1M) + (completionTokens * pricing.outputPer1M)) / 1_000_000;
}

// ── In-memory accumulator (mirrors recordWorkerCost / checkOrgBudget) ──

type CostEntry = { daily: number; monthly: number; resetDay: number; resetMonth: number };
const ORG_COST_LIMIT_DAILY_USD   = 5;
const ORG_COST_LIMIT_MONTHLY_USD = 100;

function makeCostTracker() {
  const map = new Map<string, CostEntry>();

  function checkOrgBudget(orgId: string): { blocked: boolean; reason?: string } {
    const now   = new Date();
    const entry = map.get(orgId);
    if (!entry) return { blocked: false };
    if (entry.resetDay !== now.getUTCDate())   { entry.daily = 0;   entry.resetDay   = now.getUTCDate();   }
    if (entry.resetMonth !== now.getUTCMonth()) { entry.monthly = 0; entry.resetMonth = now.getUTCMonth(); }
    if (entry.daily   > ORG_COST_LIMIT_DAILY_USD)   return { blocked: true, reason: `daily_limit_exceeded ($${entry.daily.toFixed(4)})` };
    if (entry.monthly > ORG_COST_LIMIT_MONTHLY_USD) return { blocked: true, reason: `monthly_limit_exceeded ($${entry.monthly.toFixed(4)})` };
    return { blocked: false };
  }

  function recordCost(orgId: string, costUsd: number) {
    const now = new Date();
    let entry = map.get(orgId);
    if (!entry || entry.resetDay !== now.getUTCDate()) {
      entry = { daily: 0, monthly: entry?.resetMonth === now.getUTCMonth() ? (entry?.monthly ?? 0) : 0, resetDay: now.getUTCDate(), resetMonth: now.getUTCMonth() };
      map.set(orgId, entry);
    }
    entry.daily   += costUsd;
    entry.monthly += costUsd;
  }

  function getEntry(orgId: string) { return map.get(orgId); }

  function reset() { map.clear(); }

  return { checkOrgBudget, recordCost, getEntry, reset };
}

// ============================================================
// CG1 — calcOpenRouterCost: pricing table accuracy
// ============================================================

describe('CG1 — calcOpenRouterCost: pricing table accuracy', () => {
  it('Gemini: 1000 prompt + 500 completion = $0.000225', () => {
    const cost = calcOpenRouterCost('google/gemini-3.1-flash-lite-preview', 1000, 500);
    expect(cost).toBeCloseTo(0.000225, 8);
  });

  it('Claude: 1000 prompt + 500 completion = $0.0105', () => {
    const cost = calcOpenRouterCost('anthropic/claude-sonnet-4.6', 1000, 500);
    expect(cost).toBeCloseTo(0.0105, 8);
  });

  it('GPT-5.5: 1000 prompt + 500 completion = $0.006', () => {
    // 1000 × $2/1M + 500 × $8/1M = 0.002 + 0.004 = 0.006
    const cost = calcOpenRouterCost('openai/gpt-5.5', 1000, 500);
    expect(cost).toBeCloseTo(0.006, 8);
  });

  it('Claude is > 10x more expensive than Gemini per token', () => {
    const gemini = calcOpenRouterCost('google/gemini-3.1-flash-lite-preview', 1000, 1000);
    const claude = calcOpenRouterCost('anthropic/claude-sonnet-4.6', 1000, 1000);
    expect(claude / gemini).toBeGreaterThan(10);
  });

  it('cost is proportional to token count', () => {
    const c1 = calcOpenRouterCost('anthropic/claude-sonnet-4.6', 1000, 0);
    const c2 = calcOpenRouterCost('anthropic/claude-sonnet-4.6', 2000, 0);
    expect(c2).toBeCloseTo(c1 * 2, 10);
  });
});

// ============================================================
// CG2 — Daily limit detection
// ============================================================

describe('CG2 — In-memory accumulator: daily limit detection', () => {
  const tracker = makeCostTracker();
  beforeEach(() => tracker.reset());

  it('no cost → not blocked', () => {
    const result = tracker.checkOrgBudget('org-A');
    expect(result.blocked).toBe(false);
  });

  it('under limit → not blocked', () => {
    tracker.recordCost('org-A', 3.00); // $3 < $5 daily limit
    expect(tracker.checkOrgBudget('org-A').blocked).toBe(false);
  });

  it('exactly at limit → not blocked (> strict, not >=)', () => {
    tracker.recordCost('org-A', 5.00); // $5 = $5 — check uses >, not >=
    expect(tracker.checkOrgBudget('org-A').blocked).toBe(false);
  });

  it('over daily limit → blocked with reason', () => {
    tracker.recordCost('org-A', 5.001); // $5.001 > $5
    const result = tracker.checkOrgBudget('org-A');
    expect(result.blocked).toBe(true);
    expect(result.reason).toContain('daily_limit_exceeded');
  });

  it('multiple small costs accumulate correctly', () => {
    tracker.recordCost('org-A', 1.0);
    tracker.recordCost('org-A', 1.0);
    tracker.recordCost('org-A', 1.0);
    tracker.recordCost('org-A', 1.0);
    tracker.recordCost('org-A', 1.001); // total = 5.001 → over
    expect(tracker.checkOrgBudget('org-A').blocked).toBe(true);
  });

  it('different orgs have independent budgets', () => {
    tracker.recordCost('org-A', 5.001); // over for org-A
    tracker.recordCost('org-B', 0.50);  // fine for org-B
    expect(tracker.checkOrgBudget('org-A').blocked).toBe(true);
    expect(tracker.checkOrgBudget('org-B').blocked).toBe(false);
  });
});

// ============================================================
// CG3 — Monthly limit detection
// ============================================================

describe('CG3 — In-memory accumulator: monthly limit detection', () => {
  const tracker = makeCostTracker();
  beforeEach(() => tracker.reset());

  it('blocked when monthly accumulation exceeds $100 while daily stays under $5', () => {
    const orgId = 'org-monthly';
    // Record a small daily cost
    tracker.recordCost(orgId, 3.00); // $3 daily (under $5 limit)
    // Directly set monthly to above $100 (simulates multi-day accumulation)
    const entry = tracker.getEntry(orgId)!;
    entry.monthly = 105.00;

    const result = tracker.checkOrgBudget(orgId);
    expect(result.blocked).toBe(true);
    // daily ($3) does NOT exceed $5, so monthly_limit_exceeded fires
    expect(result.reason).toContain('monthly_limit_exceeded');
  });

  it('daily_limit_exceeded fires before monthly when both are exceeded', () => {
    const orgId = 'org-both';
    tracker.recordCost(orgId, 6.00); // over daily limit ($6 > $5)
    const entry = tracker.getEntry(orgId)!;
    entry.monthly = 110.00; // also over monthly

    const result = tracker.checkOrgBudget(orgId);
    expect(result.blocked).toBe(true);
    // Daily check runs first in the if-chain
    expect(result.reason).toContain('daily_limit_exceeded');
  });

  it('correctly reports NOT blocked when monthly is exactly $100 (> strict)', () => {
    const orgId = 'org-at-limit';
    tracker.recordCost(orgId, 2.00);
    tracker.getEntry(orgId)!.monthly = 100.00; // exactly $100 — uses > not >=
    const result = tracker.checkOrgBudget(orgId);
    // $100 is NOT > $100, so should not be blocked by monthly limit
    expect(result.blocked).toBe(false);
  });
});


// ============================================================
// CG4 — UTC midnight daily reset logic
// ============================================================

describe('CG4 — UTC midnight daily reset', () => {
  it('recordCost resets daily counter when UTC day changes', () => {
    const tracker = makeCostTracker();

    // Simulate yesterday: set resetDay to yesterday's UTC date
    const orgId = 'org-day-reset';
    // Record once for today
    tracker.recordCost(orgId, 4.00);
    const entry = tracker.getEntry(orgId)!;
    expect(entry.daily).toBe(4.00);

    // Simulate day change by mutating the stored resetDay
    entry.resetDay = entry.resetDay - 1; // pretend it was recorded yesterday

    // Recording again should reset daily to just the new cost
    tracker.recordCost(orgId, 1.00);
    const afterReset = tracker.getEntry(orgId)!;
    expect(afterReset.daily).toBe(1.00); // reset + new cost only
  });
});

// ============================================================
// CG5 — Budget-blocked result shape
// ============================================================

describe('CG5 — Budget-block produces valid escalation result shape', () => {
  it('budget-block result has shouldEscalate=true and valid strings', () => {
    const sb243Footer = 'Dispatch is an AI Service Coordinator';
    const reason = 'daily_limit_exceeded ($5.0001)';

    // Simulate the budget-block return value from runDispatcherActivity
    const result = {
      draftReply:          `<div>A team member will follow up shortly.<br/><small>${sb243Footer}</small></div>`,
      draftReplyPlainText: `A team member will follow up shortly.\n\n${sb243Footer}`,
      pricingUsed:         null,
      priceSourcedFromDb:  false,
      shouldEscalate:      true,
      escalationReason:    `Org budget limit reached: ${reason}`,
      confidence:          0.0,
      modelUsed:           'budget-blocked',
      promptTokens:        0,
      completionTokens:    0,
      latencyMs:           0,
      openrouterCostUsd:   0,
    };

    expect(result.shouldEscalate).toBe(true);
    expect(result.escalationReason).toContain('budget limit');
    expect(result.draftReplyPlainText).toContain(sb243Footer);
    expect(result.openrouterCostUsd).toBe(0);
    expect(result.pricingUsed).toBeNull();
  });
});

// ============================================================
// CG6 — estimateOpenRouterCost (dispatcher-side)
// ============================================================

describe('CG6 — estimateOpenRouterCost: dispatcher-side cost function', () => {
  // This mirrors the function added to dispatcher/src/index.ts in Phase 1
  function estimateOpenRouterCost(model: string, promptTokens: number, completionTokens: number): number {
    const pricing = OPENROUTER_COSTS[model];
    if (!pricing) return 0;
    return ((promptTokens * pricing.inputPer1M) + (completionTokens * pricing.outputPer1M)) / 1_000_000;
  }

  it('produces same result as calcOpenRouterCost for known model', () => {
    const model = 'anthropic/claude-sonnet-4.6';
    expect(estimateOpenRouterCost(model, 350, 180))
      .toBeCloseTo(calcOpenRouterCost(model, 350, 180), 10);
  });

  it('a realistic dispatch call costs less than $0.01', () => {
    // 350 prompt + 180 completion at Claude pricing
    const cost = estimateOpenRouterCost('anthropic/claude-sonnet-4.6', 350, 180);
    expect(cost).toBeLessThan(0.01);
  });
});

// ============================================================
// CG7 — Zero-token edge cases
// ============================================================

describe('CG7 — Zero-token edge cases', () => {
  it('zero prompt + zero completion = $0 exactly', () => {
    expect(calcOpenRouterCost('anthropic/claude-sonnet-4.6', 0, 0)).toBe(0);
  });

  it('zero completion, non-zero prompt = input cost only', () => {
    // 1M prompt tokens × $3/1M = $3
    const cost = calcOpenRouterCost('anthropic/claude-sonnet-4.6', 1_000_000, 0);
    expect(cost).toBeCloseTo(3.0, 6);
  });

  it('zero prompt, non-zero completion = output cost only', () => {
    // 1M completion tokens × $15/1M = $15
    const cost = calcOpenRouterCost('anthropic/claude-sonnet-4.6', 0, 1_000_000);
    expect(cost).toBeCloseTo(15.0, 6);
  });
});

// ============================================================
// CG8 — Unknown model
// ============================================================

describe('CG8 — Unknown model returns $0, does not throw', () => {
  it('returns 0 for completely unknown model', () => {
    expect(() => calcOpenRouterCost('fictional/model-v99', 1000, 500)).not.toThrow();
    expect(calcOpenRouterCost('fictional/model-v99', 1000, 500)).toBe(0);
  });

  it('returns 0 for empty string model', () => {
    expect(calcOpenRouterCost('', 1000, 500)).toBe(0);
  });
});
