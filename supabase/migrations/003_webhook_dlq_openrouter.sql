-- ============================================================
-- RelayDispatch — Migration 003
-- Webhook DLQ + OpenRouter cost tracking + ROI view + vault
-- Run AFTER 002_billing_events.sql
-- ============================================================
-- Changes:
--   1. failed_webhooks — Dead-letter queue for Temporal failures
--   2. billing_events — openrouter_cost_usd + openrouter_model_id columns
--   3. v_roi_dashboard — Revenue, fees, token margin rollup view
--   4. organizations — Jobber vault hardening columns
--   5. RLS on failed_webhooks — admins read-only, service_role writes
-- ============================================================

-- ============================================================
-- SECTION 1: DEAD-LETTER QUEUE FOR FAILED WEBHOOKS
-- ============================================================
-- When /intake/gmail cannot start a Temporal workflow, the event
-- is written here. A 5-minute cron poller (to be built) retries.
-- Supabase Pub/Sub already acked the message, so no re-delivery.

CREATE TABLE IF NOT EXISTS failed_webhooks (
  id                  UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  source              TEXT          NOT NULL DEFAULT 'gmail_pubsub',

  -- Original raw Pub/Sub payload (for replay)
  raw_payload         JSONB         NOT NULL,

  -- Parsed fields (for quick querying without JSON extraction)
  email_address       TEXT,
  history_id          TEXT,

  -- Failure metadata
  failure_reason      TEXT          NOT NULL,
  retry_count         SMALLINT      NOT NULL DEFAULT 0,
  last_attempted_at   TIMESTAMPTZ,
  resolved            BOOLEAN       NOT NULL DEFAULT FALSE,

  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_failed_webhooks_unresolved
  ON failed_webhooks(created_at DESC)
  WHERE resolved = FALSE;

-- RLS: Admins read; service_role writes
ALTER TABLE failed_webhooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "failed_webhooks_readable_by_admins" ON failed_webhooks
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM org_members
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
  );

COMMENT ON TABLE failed_webhooks IS
  'Dead-letter queue for Gmail Pub/Sub webhooks that failed to start a Temporal workflow. '
  'Retried by the relaydispatch-dlq-poller worker. No app-user INSERT policy — service_role only.';

-- ============================================================
-- SECTION 2: OPENROUTER COST TRACKING ON BILLING EVENTS
-- ============================================================
-- Adds provider-level cost from OpenRouter x-openrouter-cost header.
-- Used in v_roi_dashboard for token margin calculation.

ALTER TABLE billing_events
  ADD COLUMN IF NOT EXISTS openrouter_cost_usd   NUMERIC(10,6),
  ADD COLUMN IF NOT EXISTS openrouter_model_id   TEXT;

-- ============================================================
-- SECTION 3: ROI DASHBOARD VIEW
-- ============================================================
-- Rollup per org per month. Used by the Next.js Revenue page.
-- security_invoker = ON so it respects the RLS of billing_events.

CREATE OR REPLACE VIEW v_roi_dashboard AS
SELECT
  org_id,
  date_trunc('month', created_at)                       AS month,

  -- Thread volume
  COUNT(*)                                               AS total_events,
  COUNT(*) FILTER (WHERE event_type = 'JOB_BOOKED')     AS jobs_booked,
  COUNT(*) FILTER (WHERE event_type = 'QUOTE_SENT')     AS quotes_sent,
  COUNT(*) FILTER (WHERE event_type = 'ESCALATION')     AS human_escalations,
  COUNT(*) FILTER (WHERE event_type = 'THREAD_RESOLVED') AS threads_resolved,

  -- Revenue
  COALESCE(SUM(line_item_price_usd)
    FILTER (WHERE event_type = 'JOB_BOOKED'), 0)        AS revenue_quoted_usd,

  -- Success fees ($20 per booked job — RelayDispatch's billing model)
  COUNT(*) FILTER (WHERE event_type = 'JOB_BOOKED')
    * 20.00                                              AS success_fees_usd,

  -- AI cost (OpenRouter actual spend)
  COALESCE(SUM(openrouter_cost_usd), 0)                 AS total_ai_cost_usd,

  -- Token counts
  COALESCE(SUM(ai_prompt_tokens + COALESCE(ai_completion_tokens, 0)), 0)
                                                         AS total_tokens_used,

  -- Headcount efficiency proxy: AI handled vs human intervention
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE event_type = 'JOB_BOOKED')
    / NULLIF(COUNT(*) FILTER (WHERE event_type IN ('JOB_BOOKED','ESCALATION')), 0),
    1
  )                                                      AS ai_resolution_pct

FROM   billing_events
GROUP BY org_id, date_trunc('month', created_at);

-- Enforce caller's RLS context on the view
ALTER VIEW v_roi_dashboard SET (security_invoker = ON);

-- Grant for authenticated role (RLS filters rows)
GRANT SELECT ON v_roi_dashboard TO authenticated;

-- ============================================================
-- SECTION 4: JOBBER TOKEN VAULT HARDENING
-- ============================================================
-- Adds pgsodium vault reference columns to store Jobber OAuth tokens
-- encrypted at rest. The plain-text columns from Migration 002 are
-- kept for backward compat but should be migrated and then nulled.
--
-- Action plan:
--   1. Run this migration to add vault_id columns.
--   2. Write a one-off data migration script that calls vault.create_secret()
--      for each org row with existing tokens, stores the vault_id.
--   3. Once all vault_ids populated, revoke read on plain-text columns
--      from `authenticated` role.

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS jobber_access_token_vault_id  UUID,
  ADD COLUMN IF NOT EXISTS jobber_refresh_token_vault_id UUID;

-- Helper function callable by service_role only.
-- App code calls this instead of reading the column directly.
CREATE OR REPLACE FUNCTION get_jobber_token(p_org_id UUID)
RETURNS TABLE (access_token TEXT, refresh_token TEXT, expires_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER  -- Runs as the function owner (service_role context)
AS $$
DECLARE
  v_org RECORD;
BEGIN
  SELECT
    jobber_access_token,
    jobber_refresh_token,
    jobber_token_expires_at,
    jobber_access_token_vault_id,
    jobber_refresh_token_vault_id
  INTO v_org
  FROM organizations
  WHERE id = p_org_id;

  -- Phase 2: prefer vault-stored tokens when vault_id is present
  IF v_org.jobber_access_token_vault_id IS NOT NULL THEN
    RETURN QUERY
    SELECT
      decrypted_secret::TEXT AS access_token,
      (SELECT decrypted_secret::TEXT FROM vault.decrypted_secrets
        WHERE id = v_org.jobber_refresh_token_vault_id) AS refresh_token,
      v_org.jobber_token_expires_at AS expires_at
    FROM vault.decrypted_secrets
    WHERE id = v_org.jobber_access_token_vault_id;
  ELSE
    -- Phase 1 fallback: plain-text columns (to be deprecated)
    RETURN QUERY
    SELECT
      v_org.jobber_access_token,
      v_org.jobber_refresh_token,
      v_org.jobber_token_expires_at;
  END IF;
END;
$$;

-- Revoke direct read of token columns from authenticated users
-- Keep read access for service_role (bypasses RLS/grants).
REVOKE SELECT (jobber_access_token, jobber_refresh_token)
  ON organizations FROM authenticated;

-- ============================================================
-- SECTION 5: UPDATED_AT TRIGGER FOR billing_events
-- ============================================================
-- billing_events is append-only (no updates), so no trigger needed.
-- Documenting for clarity:
COMMENT ON COLUMN billing_events.created_at IS
  'Immutable — billing_events has no updated_at. Never UPDATE a row.';

-- ============================================================
-- END OF MIGRATION 003
-- Next: 004_dlq_poller.sql (retry worker, cron schedule)
-- ============================================================
