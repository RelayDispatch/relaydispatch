/**
 * RelayDispatch — Data Retention Worker (S-13 Fix)
 * ─────────────────────────────────────────────────────────────
 * Deletes records older than DATA_RETENTION_DAYS (default: 90).
 * Safe by design:
 *   - Logs row counts before deletion
 *   - Runs in dry-run mode unless RETENTION_DRY_RUN=false
 *   - Never deletes org or contact records (identity data)
 *   - Deletes in correct FK order (messages → threads → logs)
 *   - Idempotent — safe to run multiple times
 *
 * Run: npm run retention-worker
 * Dry-run (inspect only): RETENTION_DRY_RUN=true npm run retention-worker
 *
 * Schedule: run daily via cron, ECS scheduled task, or Temporal cron.
 *
 * Supported retention windows: 30 | 60 | 90 days (env: DATA_RETENTION_DAYS)
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import pino             from 'pino';
import { validateEnv }  from '../../../packages/shared/utils/src/validateEnv.js';

// ── Startup validation ────────────────────────────────────────
validateEnv(['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'], 'RetentionWorker');

const log = pino({ name: 'retention-worker', level: process.env.LOG_LEVEL ?? 'info' });

// ── Config ────────────────────────────────────────────────────
const RETENTION_DAYS = (() => {
  const raw = parseInt(process.env.DATA_RETENTION_DAYS ?? '90', 10);
  if (![30, 60, 90].includes(raw)) {
    log.warn({ configured: raw }, 'DATA_RETENTION_DAYS must be 30, 60, or 90 — defaulting to 90');
    return 90;
  }
  return raw;
})();

const DRY_RUN = process.env.RETENTION_DRY_RUN !== 'false'; // safe default: dry-run ON

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

// ── Retention cutoff ──────────────────────────────────────────
function cutoffDate(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - RETENTION_DAYS);
  return d.toISOString();
}

// ── Count helper ──────────────────────────────────────────────
async function countOlderThan(table: string, column: string, cutoff: string): Promise<number> {
  const { count, error } = await supabase
    .from(table as never)
    .select('*', { count: 'exact', head: true })
    .lt(column as never, cutoff);
  if (error) {
    log.warn({ table, error }, `retention: count query failed for ${table}`);
    return 0;
  }
  return count ?? 0;
}

// ── Delete helper (logs + respects dry-run) ───────────────────
async function deleteOlderThan(
  table: string,
  column: string,
  cutoff: string,
): Promise<number> {
  const count = await countOlderThan(table, column, cutoff);

  log.info({ table, column, cutoff, rowsEligible: count, dryRun: DRY_RUN }, `retention: ${table} — ${count} rows eligible`);

  if (count === 0) return 0;

  if (DRY_RUN) {
    log.info({ table }, `retention: DRY RUN — skipping delete of ${count} rows`);
    return count; // report as if deleted (for inspection)
  }

  const { error } = await supabase
    .from(table as never)
    .delete()
    .lt(column as never, cutoff);

  if (error) {
    log.error({ table, error }, `retention: DELETE failed for ${table}`);
    return 0;
  }

  log.info({ type: 'AUDIT', event: 'retention_delete', table, rowsDeleted: count, cutoff, retentionDays: RETENTION_DAYS }, `retention: deleted ${count} rows from ${table}`);
  return count;
}

// ── Main ──────────────────────────────────────────────────────
async function run(): Promise<void> {
  const cutoff = cutoffDate();

  log.info({
    retentionDays: RETENTION_DAYS,
    cutoff,
    dryRun:        DRY_RUN,
  }, 'RelayDispatch Retention Worker starting');

  if (DRY_RUN) {
    log.warn('RETENTION_DRY_RUN=true — no data will be deleted. Set RETENTION_DRY_RUN=false to enable deletion.');
  }

  // Deletion order respects FK constraints:
  // messages → threads → ai_audit_log → failed_webhooks
  // contacts and organizations are NEVER deleted by this worker.

  const results = {
    messages:        0,
    threads:         0,
    ai_audit_log:    0,
    failed_webhooks: 0,
  };

  // 1. messages (FK child of threads)
  results.messages = await deleteOlderThan('messages', 'created_at', cutoff);

  // 2. threads (FK parent of messages — delete after messages)
  results.threads = await deleteOlderThan('threads', 'created_at', cutoff);

  // 3. ai_audit_log (independent — LLM call records)
  results.ai_audit_log = await deleteOlderThan('ai_audit_log', 'created_at', cutoff);

  // 4. failed_webhooks DLQ (resolved rows only — keep unresolved for safety)
  const { count: resolvedDlqCount, error: dlqErr } = await supabase
    .from('failed_webhooks' as never)
    .select('*', { count: 'exact', head: true })
    .eq('resolved' as never, true)
    .lt('created_at' as never, cutoff);

  if (!dlqErr && (resolvedDlqCount ?? 0) > 0) {
    log.info({ rowsEligible: resolvedDlqCount, dryRun: DRY_RUN }, 'retention: failed_webhooks (resolved) — eligible rows');
    if (!DRY_RUN) {
      await supabase.from('failed_webhooks' as never).delete()
        .eq('resolved' as never, true)
        .lt('created_at' as never, cutoff);
      results.failed_webhooks = resolvedDlqCount ?? 0;
      log.info({ type: 'AUDIT', event: 'retention_delete', table: 'failed_webhooks', rowsDeleted: results.failed_webhooks }, 'retention: DLQ resolved rows deleted');
    } else {
      results.failed_webhooks = resolvedDlqCount ?? 0;
    }
  }

  log.info({
    type:    'AUDIT',
    event:   'retention_run_complete',
    dryRun:  DRY_RUN,
    cutoff,
    results,
    total:   Object.values(results).reduce((a, b) => a + b, 0),
  }, 'Retention worker complete');
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    log.error({ err }, 'Retention worker: unhandled fatal error');
    process.exit(1);
  });

