-- ============================================================
-- RelayDispatch — Migration 008
-- Restore pricing_rules Access (Corrective — Reverses 005 REVOKE)
-- ============================================================
-- Migration 005 (005_staffing_schema_pivot.sql) was a partial
-- platform pivot attempt. It contained:
--
--   REVOKE SELECT ON pricing_rules FROM authenticated;
--
-- This was incorrect — pricing_rules is actively used by:
--   1. GET /api/pricing (frontend pricing matrix UI)
--   2. The AI Dispatcher agent (price lookup before quoting)
--   3. billing_events (line_item_price_usd references it)
--
-- RelayDispatch is a field-service dispatch platform (not a staffing
-- platform). This migration reverts the erroneous permission
-- change and corrects the table comment.
-- ============================================================

-- ============================================================
-- SECTION 1: Re-grant SELECT to authenticated users
-- ============================================================
-- RLS still applies — rows are org-scoped via pricing_readable_by_org policy.
-- Authenticated users can only read their own org's pricing rules.

GRANT SELECT ON pricing_rules TO authenticated;

-- ============================================================
-- SECTION 2: Confirm the RLS policy exists
-- ============================================================
-- The policy was created in the base schema but may have been
-- affected by session state. Re-create with IF NOT EXISTS guard.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'pricing_rules'
      AND policyname = 'pricing_readable_by_org'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "pricing_readable_by_org" ON pricing_rules
        FOR SELECT
        USING (org_id = current_org_id())
    $policy$;
    RAISE NOTICE 'pricing_readable_by_org policy re-created';
  ELSE
    RAISE NOTICE 'pricing_readable_by_org policy already exists — no action needed';
  END IF;
END;
$$;

-- ============================================================
-- SECTION 3: Correct the table comment left by migration 005
-- ============================================================

COMMENT ON TABLE pricing_rules IS
  'Service category pricing rules. Source of truth for AI quoting — '
  'the Dispatcher agent MUST query this table before sending any price '
  'to a customer. Hallucinated prices are a compliance violation. '
  'Org-scoped via RLS. Admins manage rows; authenticated users read.';

-- ============================================================
-- END OF MIGRATION 008
-- Applied: Reversal of 005 pricing_rules REVOKE
-- ============================================================
