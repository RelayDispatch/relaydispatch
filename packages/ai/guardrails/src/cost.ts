/**
 * packages/ai/guardrails/src/cost.ts
 * ────────────────────────────────────
 * Per-org AI cost tracking and guardrails.
 * Extracted from the monolithic api/index.ts.
 *
 * Architecture note: This is an in-memory accumulator that resets on restart.
 * It is a fast-path guardrail only — the authoritative source of truth for
 * cost accounting is the ai_audit_log table. This accumulator prevents runaway
 * spend within a single server process lifetime.
 *
 * For persistent cost tracking across restarts, query ai_audit_log directly.
 */

import pino from 'pino';

const log = pino({ name: 'relay-guardrails', level: process.env.LOG_LEVEL ?? 'info' });

const ORG_COST_LIMIT_DAILY_USD   = parseFloat(process.env.ORG_COST_LIMIT_USD_DAILY   ?? '5');
const ORG_COST_LIMIT_MONTHLY_USD = parseFloat(process.env.ORG_COST_LIMIT_USD_MONTHLY ?? '100');

interface OrgCostEntry {
  daily: number;
  monthly: number;
  resetDay: number;
  resetMonth: number;
}

// In-memory per-org accumulator. Resets on restart — full tracking in ai_audit_log.
const _orgCostAccumulator = new Map<string, OrgCostEntry>();

/**
 * Records LLM cost for an organization.
 * Logs ALERT-level messages when daily or monthly limits are exceeded.
 *
 * @param orgId - Organization UUID
 * @param costUsd - Cost in USD for this AI call
 */
export function recordOrgCost(orgId: string, costUsd: number): void {
  const now = new Date();
  let entry = _orgCostAccumulator.get(orgId);

  if (!entry || entry.resetDay !== now.getUTCDate()) {
    entry = {
      daily: 0,
      monthly: entry?.resetMonth === now.getUTCMonth() ? (entry?.monthly ?? 0) : 0,
      resetDay: now.getUTCDate(),
      resetMonth: now.getUTCMonth(),
    };
    _orgCostAccumulator.set(orgId, entry);
  }

  entry.daily   += costUsd;
  entry.monthly += costUsd;

  if (entry.daily > ORG_COST_LIMIT_DAILY_USD) {
    log.error(
      {
        type: 'ALERT', severity: 'HIGH', metric: 'cost_limit_exceeded',
        org_id: orgId, value: entry.daily, limit: ORG_COST_LIMIT_DAILY_USD, window: 'daily',
      },
      'Org daily cost limit exceeded',
    );
  }
  if (entry.monthly > ORG_COST_LIMIT_MONTHLY_USD) {
    log.error(
      {
        type: 'ALERT', severity: 'CRITICAL', metric: 'cost_limit_exceeded',
        org_id: orgId, value: entry.monthly, limit: ORG_COST_LIMIT_MONTHLY_USD, window: 'monthly',
      },
      'Org monthly cost limit exceeded',
    );
  }
}

/**
 * Checks whether an organization has exceeded its configured cost limits.
 *
 * Returns { blocked: false } if no limits are exceeded or no accumulator entry exists.
 */
export function isOrgOverBudget(orgId: string): { blocked: boolean; reason?: string } {
  const entry = _orgCostAccumulator.get(orgId);
  if (!entry) return { blocked: false };
  if (entry.daily > ORG_COST_LIMIT_DAILY_USD) {
    return {
      blocked: true,
      reason: `daily_limit_exceeded ($${entry.daily.toFixed(4)} > $${ORG_COST_LIMIT_DAILY_USD})`,
    };
  }
  if (entry.monthly > ORG_COST_LIMIT_MONTHLY_USD) {
    return {
      blocked: true,
      reason: `monthly_limit_exceeded ($${entry.monthly.toFixed(4)} > $${ORG_COST_LIMIT_MONTHLY_USD})`,
    };
  }
  return { blocked: false };
}
