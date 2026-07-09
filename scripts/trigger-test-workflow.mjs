/**
 * scripts/trigger-test-workflow.mjs
 * ---------------------------------------------------------------------------
 * Starts a single dispatchWorkflow with a safe test payload and polls its
 * state for 30 seconds, printing every status update.
 *
 * Run with: node scripts/trigger-test-workflow.mjs
 *
 * Constraints:
 *   - Read-only query after start — we do NOT send signals or cancel.
 *   - Uses the same TEMPORAL_ADDRESS / TEMPORAL_NAMESPACE from .env.
 * ---------------------------------------------------------------------------
 */

import { createDotenv } from './load-env.mjs';
createDotenv();               // loads .env before anything else

import { Connection, Client } from '@temporalio/client';
import { randomUUID }         from 'node:crypto';

const TEMPORAL_ADDRESS   = process.env.TEMPORAL_ADDRESS   ?? 'localhost:7233';
const TEMPORAL_NAMESPACE = process.env.TEMPORAL_NAMESPACE ?? 'relaydispatch-dispatch';
const DISPATCH_WORKFLOW_NAME = 'ethanDispatchWorkflow';

// ── Safe test payload ────────────────────────────────────────────────────────
// threadId must be a valid UUID (Postgres uuid column).
// orgId is intentionally non-existent — org lookup will fail gracefully.
const testInput = {
  threadId: '33333333-3333-3333-3333-333333333333',
  orgId: '11111111-1111-1111-1111-111111111111',  // intentionally non-existent
  emailAddress:  'test@example.com',
  historyId:     null,
  sb243Footer:   'Ethan is an AI Service Coordinator — Powered by RelayDispatch',
  timezone:      'America/Chicago',
};

console.log('\n──────────────────────────────────────────────────────');
console.log(' RelayDispatch — Manual Workflow Trigger Test');
console.log('──────────────────────────────────────────────────────');
console.log('Temporal  :', TEMPORAL_ADDRESS);
console.log('Namespace :', TEMPORAL_NAMESPACE);
console.log('Workflow  :', DISPATCH_WORKFLOW_NAME);
console.log('Payload   :', JSON.stringify(testInput, null, 2));
console.log('──────────────────────────────────────────────────────\n');

const connection = await Connection.connect({ address: TEMPORAL_ADDRESS });
const client     = new Client({ connection, namespace: TEMPORAL_NAMESPACE });

const handle = await client.workflow.start(DISPATCH_WORKFLOW_NAME, {
  taskQueue: 'relaydispatch-dispatch',
  workflowId: testInput.threadId,
  args: [testInput],
});

console.log(`✅ Workflow started — workflowId: ${handle.workflowId}`);
console.log(`   Temporal UI → http://localhost:8233/namespaces/${TEMPORAL_NAMESPACE}/workflows/${handle.workflowId}\n`);

// ── Poll for 30 seconds ──────────────────────────────────────────────────────
const POLL_INTERVAL_MS = 2000;
const POLL_DURATION_MS = 30_000;
const deadline = Date.now() + POLL_DURATION_MS;

console.log(`Polling workflow state for up to ${POLL_DURATION_MS / 1000}s...\n`);

let lastPhase = '';
while (Date.now() < deadline) {
  try {
    const state = await handle.query('getThreadState');
    if (state?.phase !== lastPhase) {
      lastPhase = state?.phase;
      console.log(`[${new Date().toISOString()}] phase → ${lastPhase}`);
    }
    if (['COMPLETED', 'FAILED', 'ESCALATED_TO_HUMAN'].includes(state?.phase ?? '')) {
      console.log('\nWorkflow reached terminal/stable state — stopping poll.');
      console.log('Final state:', JSON.stringify(state, null, 2));
      break;
    }
  } catch (err) {
    // Query may throw while the workflow is still initializing — that's OK.
    console.log(`[${new Date().toISOString()}] query error (may be transient): ${err.message}`);
  }
  await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
}

console.log('\n──────────────────────────────────────────────────────');
console.log('Poll complete. Check full activity logs in worker output.');
console.log('──────────────────────────────────────────────────────\n');

await connection.close();
