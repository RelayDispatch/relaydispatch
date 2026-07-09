-- ============================================================
-- RelayDispatch — Migration 004
-- Security hardening patches
-- ─────────────────────────────────────────────────────────────
-- P0-6: Scope failed_webhooks RLS to org membership (not global admin)
-- P1-5: Revoke jobber_token_expires_at from authenticated
-- DB: Add UNIQUE constraint on threads(org_id, external_thread_id)
--     required for the atomic upsert idempotency fix (P0-3)
-- ============================================================

-- ============================================================
-- SECTION 1: P0-3 — Unique constraint for atomic idempotency
-- ============================================================
-- The Supabase upsert with onConflict:'org_id,external_thread_id'
-- requires a unique constraint (or unique index) on those columns.

CREATE UNIQUE INDEX IF NOT EXISTS idx_threads_org_external_id_unique
  ON threads(org_id, external_thread_id)
  WHERE external_thread_id IS NOT NULL;

-- ============================================================
-- SECTION 2: P0-6 — Fix failed_webhooks RLS cross-tenant leak
-- ============================================================
-- The original policy in 003 allows ANY admin from ANY org to
-- read ALL failed webhooks. This is a multi-tenant data leak.
-- Replace with an org-scoped read policy.

DROP POLICY IF EXISTS "failed_webhooks_readable_by_admins" ON failed_webhooks;

-- failed_webhooks has no org_id column (it's a platform-level table).
-- Correct fix: restrict reads to superadmins only via service_role,
-- OR add an org_id column for proper scoping.
-- Short-term: deny all authenticated reads (service_role still bypasses RLS).
-- Long-term: add org_id column and migrate (see SECTION 2b below).

-- Short-term: no authenticated user can read failed_webhooks directly.
-- Monitoring is done via service_role (Temporal worker / admin scripts).
COMMENT ON TABLE failed_webhooks IS
  'Dead-letter queue. No authenticated-user SELECT policy — service_role only. '
  'Reason: table lacks org_id; cross-tenant read was previously possible. '
  'TODO: add org_id column (Section 2b) to enable per-tenant admin reads.';

-- SECTION 2b: Add org_id to failed_webhooks for future scoped reads.
-- This is nullable to avoid breaking existing rows.
ALTER TABLE failed_webhooks
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id);

-- Once org_id is backfilled, create the scoped read policy:
-- CREATE POLICY "failed_webhooks_readable_by_org_admins" ON failed_webhooks
--   FOR SELECT
--   USING (
--     org_id = current_org_id()
--     AND EXISTS (
--       SELECT 1 FROM org_members
--       WHERE org_id  = failed_webhooks.org_id
--         AND user_id = auth.uid()
--         AND role IN ('owner', 'admin')
--     )
--   );

-- ============================================================
-- SECTION 3: P1-5 — Revoke jobber_token_expires_at from authenticated
-- ============================================================
-- Migration 002 revoked access_token and refresh_token columns but
-- left expires_at readable — leaks token lifecycle metadata.

REVOKE SELECT (jobber_token_expires_at)
  ON organizations FROM authenticated;

-- ============================================================
-- SECTION 4: Index for failed_webhooks org_id lookups
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_failed_webhooks_org
  ON failed_webhooks(org_id)
  WHERE org_id IS NOT NULL;

-- ============================================================
-- END OF MIGRATION 004
-- Next: 005_pgvector_candidates.sql (staffing pivot)
-- ============================================================
