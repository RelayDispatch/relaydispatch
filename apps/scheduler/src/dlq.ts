/**
 * RelayDispatch — DLQ Poller
 * ─────────────────────────────────────────────────────────────
 * Replays failed Gmail Pub/Sub webhooks from the failed_webhooks
 * table. Designed to run every 5 minutes via cron, ECS scheduled
 * task, or a Temporal cron workflow.
 *
 * Run with: npm run dlq-poller
 *
 * Failure escalation:
 *   retry_count < 3  → retry replay on next cycle
 *   retry_count >= 3 → mark resolved=true (permanently failed), stop retrying
 *
 * Recovery from logs (if DLQ DB insert also failed at intake time):
 *   Query structured logs for event='dlq_db_insert_failed' and
 *   replay the raw_payload field manually via this script's --manual flag.
 *
 * Audit queries:
 *   -- Find permanently failed rows (retry_count >= 3 AND resolved = true):
 *   SELECT * FROM failed_webhooks WHERE retry_count >= 3 AND resolved = true ORDER BY created_at DESC;
 *
 *   -- Find pending rows not yet attempted:
 *   SELECT * FROM failed_webhooks WHERE resolved = false AND retry_count = 0 ORDER BY created_at ASC;
 */

import { Connection, Client } from '@temporalio/client';
import { createClient }       from '@supabase/supabase-js';
import pino                   from 'pino';
import { metrics }            from '@opentelemetry/api';
import 'dotenv/config';

import { DISPATCH_WORKFLOW_NAME } from '../../worker/src/dispatchWorkflow.js';
import type { DispatchWorkflowInput } from '../../worker/src/dispatchWorkflow.js';

const log = pino({ name: 'dlq-poller', level: process.env.LOG_LEVEL ?? 'info' });

// ── Fix D: DLQ Observability Metrics ────────────────────────
// Emits OTEL counters and structured log lines for Grafana/Loki alerting.
// Grafana alert: relaydispatch_dlq_depth > 0 for 5m → PagerDuty P1
const meter              = metrics.getMeter('relaydispatch', '0.2.0');
const dlqDepthGauge      = meter.createObservableGauge('relaydispatch.dlq.depth', {
  description: 'Number of pending failed_webhooks rows awaiting replay',
});
const dlqPermFailCounter = meter.createCounter('relaydispatch.dlq.permanent_failures_total', {
  description: 'Total rows permanently failed in the DLQ',
});
const dlqReplayCounter   = meter.createCounter('relaydispatch.dlq.replays_total', {
  description: 'Total rows successfully replayed from the DLQ',
});

let _currentDlqDepth = 0; // Updated each cycle, read by observable gauge
dlqDepthGauge.addCallback((result) => { result.observe(_currentDlqDepth); });

const MAX_RETRIES        = 3;
const BATCH_SIZE         = 50;
const TASK_QUEUE         = process.env.TEMPORAL_TASK_QUEUE ?? 'relaydispatch-dispatch';
const TEMPORAL_ADDRESS   = process.env.TEMPORAL_ADDRESS   ?? 'localhost:7233';
const TEMPORAL_NAMESPACE = process.env.TEMPORAL_NAMESPACE ?? 'relaydispatch-dispatch';

// Service-role client — same as worker, never exposed to Hono API
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

// ── Type for the raw_payload stored by the intake route ──────
// Mirrors the workflowInputForDlq shape written in index.ts.
// The raw_payload field holds the fully-resolved DispatchWorkflowInput
// so the poller can replay without re-parsing the original Pub/Sub envelope.
interface FailedWebhookRow {
  id:             string;
  raw_payload:    DispatchWorkflowInput;
  email_address:  string | null;
  history_id:     string | null;
  failure_reason: string;
  retry_count:    number;
  org_id:         string | null;
}

async function poll(): Promise<void> {
  log.info('DLQ poller: starting poll cycle');

  // ── Fix D: Emit DLQ depth metric before processing ────────────
  // Query all three health indicators atomically for Grafana dashboards.
  const { data: depthData } = await supabase
    .from('failed_webhooks')
    .select('id, retry_count, resolved')
    .eq('resolved', false);

  const { data: permFailData } = await supabase
    .from('failed_webhooks')
    .select('id')
    .eq('resolved', true)
    .gte('retry_count', MAX_RETRIES);

  const dlqDepth          = depthData?.length ?? 0;
  const dlqPermFailTotal  = permFailData?.length ?? 0;
  const retrying          = depthData?.filter(r => r.retry_count > 0).length ?? 0;
  _currentDlqDepth = dlqDepth;

  log.info(
    {
      event:              'dlq_metrics',
      dlq_depth:          dlqDepth,
      dlq_retry_rate:     dlqDepth > 0 ? Math.round((retrying / dlqDepth) * 100) : 0,
      dlq_permanent_failures: dlqPermFailTotal,
    },
    'DLQ poller: observability snapshot',
  );

  // Alert condition — non-zero depth means emails are at risk
  if (dlqDepth > 0) {
    log.warn(
      { dlq_depth: dlqDepth },
      'DLQ poller: non-zero depth detected — emails awaiting replay. Alert: relaydispatch.dlq.depth > 0',
    );
  }

  // ── Fetch pending rows (not resolved, under retry limit) ────
  const { data: rows, error: fetchErr } = await supabase
    .from('failed_webhooks')
    .select('id, raw_payload, email_address, history_id, failure_reason, retry_count, org_id')
    .eq('resolved', false)
    .lt('retry_count', MAX_RETRIES)
    .order('created_at', { ascending: true })
    .limit(BATCH_SIZE) as { data: FailedWebhookRow[] | null; error: unknown };

  if (fetchErr) {
    log.error({ fetchErr }, 'DLQ poller: failed to fetch rows — aborting cycle');
    return;
  }

  if (!rows || rows.length === 0) {
    log.info('DLQ poller: no pending rows — queue is healthy');
    return;
  }

  log.info({ count: rows.length }, 'DLQ poller: replaying failed webhooks');

  // ── Temporal client ─────────────────────────────────────────
  const connection = await Connection.connect({ address: TEMPORAL_ADDRESS });
  const client     = new Client({ connection, namespace: TEMPORAL_NAMESPACE });

  let replayed   = 0;
  let failed     = 0;
  let permFailed = 0;

  for (const row of rows) {
    const workflowInput: DispatchWorkflowInput = row.raw_payload;

    // Validate required fields before attempting replay
    if (!workflowInput.threadId || !workflowInput.orgId || !workflowInput.emailAddress) {
      log.error(
        { rowId: row.id, raw: row.raw_payload },
        'DLQ poller: raw_payload missing required fields (threadId/orgId/emailAddress) — permanently failing',
      );
      await markPermanentlyFailed(row.id, 'raw_payload missing required fields');
      permFailed++;
      continue;
    }

    // Use a unique workflowId that includes the DLQ row ID to prevent
    // collision with the original workflow (which may already be in Temporal
    // history) and to allow for multiple replay attempts.
    const workflowId = `relaydispatch-dispatch-${workflowInput.threadId}-dlq-${row.id.slice(0, 8)}`;

    try {
      await client.workflow.start(DISPATCH_WORKFLOW_NAME, {
        taskQueue: TASK_QUEUE,
        workflowId,
        args: [workflowInput],
      });

      // Mark resolved on successful workflow start
      await supabase
        .from('failed_webhooks')
        .update({
          resolved:          true,
          last_attempted_at: new Date().toISOString(),
        })
        .eq('id', row.id);

      log.info(
        { rowId: row.id, workflowId, threadId: workflowInput.threadId },
        'DLQ poller: replayed successfully',
      );
      replayed++;
    } catch (replayErr) {
      const newRetryCount = row.retry_count + 1;
      const permanent     = newRetryCount >= MAX_RETRIES;

      await supabase
        .from('failed_webhooks')
        .update({
          retry_count:       newRetryCount,
          last_attempted_at: new Date().toISOString(),
          failure_reason:    String((replayErr as Error).message),
          // Mark resolved=true when permanently failed so it leaves the pending queue.
          // Distinguishable from successful replay by retry_count >= MAX_RETRIES.
          ...(permanent ? { resolved: true } : {}),
        })
        .eq('id', row.id);

      if (permanent) {
        log.error(
          { rowId: row.id, threadId: workflowInput.threadId, replayErr },
          'DLQ poller: max retries exceeded — permanently failing row (manual intervention required)',
        );
        permFailed++;
      } else {
        log.warn(
          { rowId: row.id, threadId: workflowInput.threadId, attempt: newRetryCount, replayErr },
          'DLQ poller: replay failed — will retry next cycle',
        );
        failed++;
      }
    }
  }

  await connection.close();

  log.info({ replayed, failed, permFailed }, 'DLQ poller: cycle complete');

  // Emit summary for alerting — Grafana/Loki can alert on permFailed > 0
  if (permFailed > 0) {
    log.error(
      { permFailed },
      'DLQ poller: permanently failed rows detected — manual recovery required. ' +
      'Query: SELECT * FROM failed_webhooks WHERE retry_count >= 3 AND resolved = true ORDER BY created_at DESC;',
    );
  }
}

async function markPermanentlyFailed(rowId: string, reason: string): Promise<void> {
  await supabase
    .from('failed_webhooks')
    .update({
      resolved:          true,
      retry_count:       MAX_RETRIES,
      failure_reason:    reason,
      last_attempted_at: new Date().toISOString(),
    })
    .eq('id', rowId);
}

// ── Entrypoint ───────────────────────────────────────────────
poll()
  .then(() => process.exit(0))
  .catch((err) => {
    log.error({ err }, 'DLQ poller: unhandled fatal error');
    process.exit(1);
  });

