/**
 * RelayDispatch — Temporal Worker
 * ─────────────────────────────────────────────────────────────
 * Starts the Temporal worker process that executes all activities
 * and hosts the dispatchWorkflow.
 *
 * Run with: npm run worker
 * Build & run: npm run worker:build
 *
 * Concurrency config:
 *   maxConcurrentActivityTaskExecutions — controls parallelism of
 *   activities (LLM calls, DB writes, Nylas sends).
 *   Set conservatively to avoid OpenRouter rate limits.
 *   Tune up as you validate throughput under load.
 *
 *   maxConcurrentWorkflowTaskExecutions — number of concurrent
 *   workflow state machine replays. Higher is fine (pure CPU,
 *   no I/O in workflow code).
 */

import 'dotenv/config';
// ── S-06 Fix: validate all required env vars before ANY startup ─
// Must be the first executable code — catches missing secrets at
// process launch, not on first workflow execution.
import { validateWorkerEnv } from '../../../packages/shared/utils/src/validateEnv.js';
validateWorkerEnv();

import { fileURLToPath } from 'url';
import { Worker, NativeConnection } from '@temporalio/worker';
import * as activities from './activities/index.js';
import { DISPATCH_WORKFLOW_NAME } from './dispatchWorkflow.js';
import pino from 'pino';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const log = pino({ name: 'temporal-worker', level: process.env.LOG_LEVEL ?? 'info' });


// ── Startup: validate VAULT_ENCRYPTION_KEY ─────────────────────────────────
// Called before accepting any Temporal tasks.
// Fails fast so misconfiguration is caught at process start,
// not on the first workflow execution.
function validateVaultEncryptionKey(): void {
  const keyHex = process.env.VAULT_ENCRYPTION_KEY;

  // 1. Presence + length
  if (!keyHex || keyHex.length !== 64) {
    throw new Error(
      'FATAL: VAULT_ENCRYPTION_KEY must be a 64-char hex string (32 bytes).\n' +
      'Generate: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
    );
  }

  // 2. Hex-only characters
  if (!/^[0-9a-fA-F]{64}$/.test(keyHex)) {
    throw new Error(
      'FATAL: VAULT_ENCRYPTION_KEY contains non-hex characters. ' +
      'Ensure the key is hex-encoded (0-9, a-f only). ' +
      'Do not use base64 or raw bytes.',
    );
  }

  // 3. Round-trip encrypt/decrypt test — catches silent truncation bugs
  try {
    const key       = Buffer.from(keyHex, 'hex');
    const iv        = randomBytes(12);
    const plaintext = 'relaydispatch-vault-key-validation-probe';
    const cipher    = createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag       = cipher.getAuthTag();

    const decipher  = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    const decrypted = decipher.update(encrypted) + decipher.final('utf8');

    if (decrypted !== plaintext) {
      throw new Error('Round-trip mismatch — key may be corrupted');
    }
  } catch (err) {
    throw new Error(`FATAL: VAULT_ENCRYPTION_KEY failed round-trip validation: ${(err as Error).message}`);
  }

  log.info('VAULT_ENCRYPTION_KEY: validated (format + round-trip OK)');
}

// ── Startup: validate Supabase connectivity ──────────────────────────
// A simple query against a known-small table. Fails fast if
// SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY are wrong, or if
// Supabase is unreachable before the worker accepts any tasks.
async function validateSupabaseConnectivity(): Promise<void> {
  const { createClient } = await import('@supabase/supabase-js');
  const sb = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  const { error } = await sb
    .from('organizations')
    .select('id')
    .limit(1);

  if (error) {
    throw new Error(`FATAL: Supabase connectivity check failed: ${error.message} (code: ${error.code})`);
  }

  log.info('Supabase connectivity: OK');
}

async function run() {
  const address   = process.env.TEMPORAL_ADDRESS   ?? 'localhost:7233';
  const namespace = process.env.TEMPORAL_NAMESPACE ?? 'relaydispatch-dispatch';
  const taskQueue = process.env.TEMPORAL_TASK_QUEUE ?? 'relaydispatch-dispatch';

  // ── Pre-flight checks (fail fast before accepting any tasks) ─
  validateVaultEncryptionKey();
  await validateSupabaseConnectivity();
  log.info('Pre-flight checks passed — starting Temporal worker');

  // ── Persistent connection (reused across all activities) ─────
  const connection = await NativeConnection.connect({ address });

  const worker = await Worker.create({
    connection,
    namespace,
    taskQueue,

    // ── Workflow bundle: register by name ──────────────────────
    // Using workflowsPath so Temporal bundles the workflow code.
    workflowsPath: fileURLToPath(new URL('./dispatchWorkflow.ts', import.meta.url)),

    // ── Activity implementations ───────────────────────────────
    activities,

    // ── Concurrency controls ───────────────────────────────────
    // Activities: each LLM call can block ~2-10s.
    // 10 concurrent = ~100 emails/min throughput at p50.
    // Raise to 100 to handle load testing spikes.
    maxConcurrentActivityTaskExecutions: parseInt(
      process.env.WORKER_MAX_CONCURRENT_ACTIVITIES ?? '100',
      10,
    ),

    // Workflow replays are pure CPU — can run many in parallel.
    maxConcurrentWorkflowTaskExecutions: parseInt(
      process.env.WORKER_MAX_CONCURRENT_WORKFLOWS ?? '200',
      10,
    ),

    // ── Graceful shutdown ──────────────────────────────────────
    // Allows in-flight activities to complete before process exits.
    // Container orchestrators (ECS, k8s) send SIGTERM first.
    shutdownGraceTime: '30s',
  });

  log.info({
    address,
    namespace,
    taskQueue,
    maxActivities: process.env.WORKER_MAX_CONCURRENT_ACTIVITIES ?? '10',
    maxWorkflows:  process.env.WORKER_MAX_CONCURRENT_WORKFLOWS  ?? '50',
  }, '🚀 RelayDispatch Temporal worker started');

  // Runs until SIGTERM / SIGINT
  await worker.run();
}

run().catch((err) => {
  log.error({ err }, 'Temporal worker crashed');
  process.exit(1);
});

