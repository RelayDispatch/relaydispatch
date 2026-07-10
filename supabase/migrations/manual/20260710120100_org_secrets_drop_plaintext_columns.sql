-- MANUAL MIGRATION — do NOT apply via `supabase db push` / automatic migration runner.
--
-- Prerequisites (all required):
--   1. 20260710120000_org_secrets_shadow_columns.sql applied
--   2. scripts/migrate-org-secrets-cutover.mjs completed successfully
--   3. Application code deployed that reads *_enc columns and never writes plaintext
--   4. Verified backup exists
--
-- Apply only via:
--   node scripts/drop-org-secrets-plaintext-columns.mjs --confirm-drop-plaintext-secrets I_UNDERSTAND_THIS_IS_IRREVERSIBLE
--
-- This permanently removes legacy plaintext secret columns from organizations.

BEGIN;

-- Safety gate: refuse to drop if any org still has plaintext secrets populated.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.organizations
    WHERE
      twilio_auth_token IS NOT NULL
      OR mail_access_token IS NOT NULL
      OR mail_refresh_token IS NOT NULL
      OR jobber_access_token IS NOT NULL
      OR jobber_refresh_token IS NOT NULL
      OR servicetitan_client_secret IS NOT NULL
      OR servicetitan_access_token IS NOT NULL
      OR housecall_access_token IS NOT NULL
      OR housecall_refresh_token IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Refusing to drop plaintext org secret columns: plaintext values still present. Run cutover script first.';
  END IF;
END $$;

ALTER TABLE public.organizations
  DROP COLUMN IF EXISTS twilio_auth_token,
  DROP COLUMN IF EXISTS mail_access_token,
  DROP COLUMN IF EXISTS mail_refresh_token,
  DROP COLUMN IF EXISTS jobber_access_token,
  DROP COLUMN IF EXISTS jobber_refresh_token,
  DROP COLUMN IF EXISTS servicetitan_client_secret,
  DROP COLUMN IF EXISTS servicetitan_access_token,
  DROP COLUMN IF EXISTS housecall_access_token,
  DROP COLUMN IF EXISTS housecall_refresh_token;

UPDATE public.organizations
SET org_secrets_plaintext_dropped_at = NOW()
WHERE org_secrets_plaintext_dropped_at IS NULL;

COMMIT;
