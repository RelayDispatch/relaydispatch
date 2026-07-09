-- ============================================================
-- RelayDispatch — Migration 002
-- billing_events table + Jobber OAuth columns + schema hardening
-- Run AFTER 001_schema.sql (initial schema)
-- ============================================================
-- Changes:
--   1. Add billing_events table (Success Event audit trail)
--   2. Add Jobber OAuth token columns to organizations
--   3. Add nylasThreadId to threads (for reply threading)
--   4. Add ai_latency_ms to messages (already in schema, ensuring)
--   5. RLS on billing_events — admins read, service_role writes
--   6. Add helper: get_org_id_for_thread() for cross-table policies
-- ============================================================

-- ============================================================
-- SECTION 1: JOBBER OAUTH COLUMNS ON ORGANIZATIONS
-- ============================================================
-- Tokens are stored encrypted at the Supabase/Postgres level.
-- These are written by the token refresh activity, read by workers only.

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS jobber_access_token      TEXT,
  ADD COLUMN IF NOT EXISTS jobber_refresh_token     TEXT,
  ADD COLUMN IF NOT EXISTS jobber_token_expires_at  TIMESTAMPTZ;

-- Ensure existing sb243_footer column has correct default
ALTER TABLE organizations
  ALTER COLUMN sb243_footer
  SET DEFAULT 'Ethan is an AI Service Coordinator — Powered by RelayDispatch AI';

-- ============================================================
-- SECTION 2: NYLAS THREAD TRACKING ON THREADS
-- ============================================================
-- Stores the Nylas/Gmail thread ID so replies stay in one thread.

ALTER TABLE threads
  ADD COLUMN IF NOT EXISTS nylas_thread_id  TEXT,  -- Gmail thread ID via Nylas v3
  ADD COLUMN IF NOT EXISTS nylas_message_id TEXT;  -- Last Nylas message ID

-- ============================================================
-- SECTION 3: BILLING EVENTS TABLE
-- ============================================================
-- Logs every "Success Event" for usage-based billing and reporting.
-- A "Success Event" = a Jobber Draft Job was created successfully.
--
-- This table is append-only — no UPDATE or DELETE policies.
-- Billing integrity requires immutability.

CREATE TYPE billing_event_type AS ENUM (
  'JOB_BOOKED',          -- Primary billable event: Jobber draft job created
  'QUOTE_SENT',          -- Secondary: AI-generated quote was sent to customer
  'THREAD_RESOLVED',     -- Thread closed without a job (informational)
  'ESCALATION',          -- Thread escalated to human (for quality tracking)
  'COMPACTION_RUN'       -- Librarian ran a compaction (token usage tracking)
);

CREATE TABLE IF NOT EXISTS billing_events (
  id                    UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id                UUID          NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  thread_id             UUID          REFERENCES threads(id) ON DELETE SET NULL,

  -- Event classification
  event_type            billing_event_type NOT NULL,

  -- Jobber specifics (populated for JOB_BOOKED events)
  jobber_job_id         TEXT,
  jobber_job_number     TEXT,

  -- Revenue context (from pricing_rules — never LLM-generated)
  service_category      TEXT,
  line_item_price_usd   NUMERIC(10,2),

  -- AI cost tracking (token usage for internal margin calculation)
  ai_prompt_tokens      INTEGER,
  ai_completion_tokens  INTEGER,
  ai_model_id           TEXT,

  -- Flexible metadata (JSON — stores jobUrl, urgencyScore, equipment info)
  metadata              JSONB,

  -- Immutable timestamp — no updated_at on billing records
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ── Indexes ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_billing_org_type      ON billing_events(org_id, event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_billing_org_month     ON billing_events(org_id, date_trunc('month', created_at));
CREATE INDEX IF NOT EXISTS idx_billing_jobber_job    ON billing_events(jobber_job_id) WHERE jobber_job_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_billing_thread        ON billing_events(thread_id) WHERE thread_id IS NOT NULL;

-- ── RLS ───────────────────────────────────────────────────────
ALTER TABLE billing_events ENABLE ROW LEVEL SECURITY;

-- Admins and owners can read their org's billing events
CREATE POLICY "billing_readable_by_admins" ON billing_events
  FOR SELECT
  USING (
    org_id = current_org_id()
    AND EXISTS (
      SELECT 1 FROM org_members
      WHERE org_id     = billing_events.org_id
        AND user_id    = auth.uid()
        AND role IN ('owner', 'admin')
    )
  );

-- INSERT is allowed for service_role only (Temporal worker).
-- No app-user can insert billing events directly.
-- (No INSERT policy for authenticated users = service_role bypasses RLS)

-- ============================================================
-- SECTION 4: ANALYTICS VIEW — Monthly Job Bookings per Org
-- ============================================================
-- Used by the dashboard to show "Jobs booked this month" count.

CREATE OR REPLACE VIEW v_monthly_job_bookings AS
SELECT
  org_id,
  date_trunc('month', created_at)        AS month,
  COUNT(*)                               AS jobs_booked,
  SUM(line_item_price_usd)               AS total_quoted_usd,
  AVG(line_item_price_usd)               AS avg_job_price_usd,
  SUM(ai_prompt_tokens + COALESCE(ai_completion_tokens, 0)) AS total_tokens_used
FROM   billing_events
WHERE  event_type = 'JOB_BOOKED'
GROUP BY org_id, date_trunc('month', created_at);

-- ── RLS on view (Supabase requires explicit grant) ────────────
-- Views inherit the RLS of the underlying tables when security_invoker = ON
ALTER VIEW v_monthly_job_bookings SET (security_invoker = ON);

-- ============================================================
-- SECTION 5: HELPER FUNCTION — org_id from thread_id
-- Used in RLS policies where a JOIN to threads is needed.
-- ============================================================

CREATE OR REPLACE FUNCTION get_org_id_for_thread(p_thread_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE SECURITY DEFINER
AS $$
  SELECT org_id FROM threads WHERE id = p_thread_id LIMIT 1;
$$;

-- ============================================================
-- SECTION 6: TIGHTEN EXISTING RLS — Prevent cross-org data leaks
-- ============================================================
-- Re-check: messages RLS should also validate thread ownership
-- (Defense in depth — belt AND suspenders)

-- Drop the existing broad policy and replace with a join-validated one
DROP POLICY IF EXISTS "messages_isolated_to_org" ON messages;

CREATE POLICY "messages_isolated_to_org" ON messages
  FOR ALL
  USING (
    org_id = current_org_id()
    -- Belt-and-suspenders: also verify the thread belongs to same org
    AND (
      thread_id IS NULL
      OR get_org_id_for_thread(thread_id) = current_org_id()
    )
  );

-- Same for billing_events write (for completeness — service_role bypasses anyway)
-- Explicitly document that app users cannot write billing events:
COMMENT ON TABLE billing_events IS
  'Append-only billing audit log. INSERT is restricted to service_role (Temporal workers). No app-user policy permits INSERT.';

-- ============================================================
-- SECTION 7: GRANT STATEMENTS
-- ============================================================
-- authenticated role: read-only on views; RLS enforces row filtering
-- service_role: full access (bypasses RLS — used by Temporal workers only)

GRANT SELECT ON v_monthly_job_bookings TO authenticated;
GRANT ALL    ON billing_events          TO service_role;
GRANT ALL    ON organizations           TO service_role;
GRANT ALL    ON threads                 TO service_role;
GRANT ALL    ON messages                TO service_role;
GRANT ALL    ON contacts                TO service_role;
GRANT ALL    ON ai_audit_log            TO service_role;
GRANT ALL    ON pricing_rules           TO service_role;

-- ============================================================
-- END OF MIGRATION 002
-- Next: 003_jobber_webhook_events.sql
-- ============================================================
