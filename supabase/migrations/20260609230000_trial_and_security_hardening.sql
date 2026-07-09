-- ==============================================================================
-- RELAYDISPATCH — 14-DAY TRIAL & SECURITY HARDENING
-- Adds trial columns and revokes SELECT access on credentials from the authenticated role.
-- ==============================================================================

-- ── 1. Add Trial Columns ──────────────────────────────────────────────────────
ALTER TABLE public.organizations 
  ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '14 days');

-- ── 2. Revoke Credentials SELECT From Authenticated ───────────────────────────
-- Revoke table-level SELECT on organizations from the authenticated role (JWT callers)
REVOKE SELECT ON public.organizations FROM authenticated;

-- Grant column-level SELECT on organizations for only non-sensitive columns
GRANT SELECT (
  id, 
  name, 
  slug, 
  plan, 
  plan_tier, 
  timezone, 
  sb243_footer, 
  created_at, 
  trial_ends_at, 
  is_active, 
  dispatch_mode, 
  mail_provider, 
  mail_email_address, 
  jobber_account_id, 
  servicetitan_tenant_id, 
  servicetitan_client_id, 
  nylas_grant_id,
  twilio_number,
  intake_email_address,
  jobber_access_token_vault_id,
  jobber_refresh_token_vault_id,
  twilio_webhook_configured
) ON public.organizations TO authenticated;

-- Verify authenticated is granted SELECT on the views as well
GRANT SELECT ON public.v_monthly_job_bookings TO authenticated;
GRANT SELECT ON public.v_llm_cost_by_org TO authenticated;
GRANT SELECT ON public.v_roi_dashboard TO authenticated;
