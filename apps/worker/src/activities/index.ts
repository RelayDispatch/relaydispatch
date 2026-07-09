/**
 * backend/workflows/activities/index.ts
 * ─────────────────────────────────────────────────────────────
 * Barrel re-export for all Temporal activities.
 *
 * Temporal worker.ts imports this namespace as:
 *   import * as activities from './activities/index.js';
 *
 * Every exported function in this file is a registered activity.
 * Keep this list complete — omitting an export here means the
 * Temporal worker cannot execute that activity.
 */

// ── Shared utilities (exported for external use) ─────────────
export { calcOpenRouterCost, encryptVault, decryptVault } from './shared.js';

// ── Organization ────────────────────────────────────────────
export { fetchOrgConfigActivity } from './org.js';

// ── Email / Communications ──────────────────────────────────
export type { FetchEmailResult }  from './email.js';
export {
  fetchEmailContent,
  sendEmailResponseActivity,
  sendReplyActivity,
  sendSmsAlertActivity,
} from './email.js';

// ── Security / PII ──────────────────────────────────────────
export { redactInboundActivity } from './security.js';

// ── AI / Dispatch / Librarian ───────────────────────────────
export type { ClassificationResult } from './ai.js';
export {
  classifyInboundRequest,
  recordWorkerCost,
  runDispatcherActivity,
  processLibrarianTurnActivity,
  emergencyPreFilterActivity,
} from './ai.js';

// ── Threads / Contacts ───────────────────────────────────────
export {
  updateThreadStatusActivity,
  createOrUpdateContactActivity,
  validateThreadExistsActivity,
} from './threads.js';

// ── Notifications ────────────────────────────────────────────
export { notifyHumanAgentActivity } from './notifications.js';

// ── Jobs ─────────────────────────────────────────────────────
export type { CreateJobResult } from './jobs.js';
export {
  fetchAvailableTechniciansActivity,
  dispatchJobActivity,
  createJobActivity,
  fetchDirectIntakeMessageActivity,
} from './jobs.js';

