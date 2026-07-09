-- ============================================================
-- RelayDispatch — Migration 006
-- Activity Idempotency Table
-- ─────────────────────────────────────────────────────────────
-- Prevents duplicate external side effects (email sends, Jobber
-- job creation, Slack notifications) when Temporal retries
-- activities on transient failure.
--
-- Key format: <activityName>:<threadId>:<turn>
-- Auto-expires after 30 days — activities older than this are
-- safe to replay without risk of duplicate customer-facing actions.
-- ============================================================

-- ============================================================
-- SECTION 1: completed_activity_keys table
-- ============================================================

CREATE TABLE IF NOT EXISTS completed_activity_keys (
  key           TEXT        PRIMARY KEY,
  meta          JSONB,
  completed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE completed_activity_keys IS
  'Idempotency registry for Temporal activities. Records completed external '
  'side effects (email send, Jobber job create, Slack notify) to prevent '
  'duplicates on Temporal retry. Keys expire logically after 30 days.';

COMMENT ON COLUMN completed_activity_keys.key IS
  'Format: <activityName>:<threadId>:<turn>. Example: sendEmail:uuid:1';
COMMENT ON COLUMN completed_activity_keys.meta IS
  'Optional JSON payload — stores result identifiers (e.g. nylasMessageId) '
  'for observability. Not used for idempotency logic.';

-- ============================================================
-- SECTION 2: Indexes
-- ============================================================

-- Index for expiry-based pruning (background cleanup job can delete
-- WHERE completed_at < NOW() - INTERVAL '30 days')
CREATE INDEX IF NOT EXISTS idx_activity_keys_expiry
  ON completed_activity_keys(completed_at);

-- ============================================================
-- SECTION 3: Permissions
-- ============================================================

-- service_role only — Temporal workers write this table.
-- No authenticated (app user) access needed.
GRANT ALL ON completed_activity_keys TO service_role;

-- Deny direct access from the anon/authenticated roles
REVOKE ALL ON completed_activity_keys FROM anon;
REVOKE ALL ON completed_activity_keys FROM authenticated;

-- ============================================================
-- END OF MIGRATION 006
-- Next: 007_llm_cost_tracking.sql (ai_audit_log cost columns)
-- ============================================================
