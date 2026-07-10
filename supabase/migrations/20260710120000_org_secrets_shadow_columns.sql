-- Option B: shadow encrypted columns for org-scoped integration secrets.
-- Plaintext columns remain during cutover; run scripts/migrate-org-secrets-cutover.mjs
-- before deploying app code that writes only to *_enc columns.
--
-- Drop plaintext columns manually via scripts/drop-org-secrets-plaintext-columns.mjs
-- (applies supabase/migrations/manual/20260710120100_org_secrets_drop_plaintext_columns.sql).

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS twilio_auth_token_enc TEXT,
  ADD COLUMN IF NOT EXISTS mail_access_token_enc TEXT,
  ADD COLUMN IF NOT EXISTS mail_refresh_token_enc TEXT,
  ADD COLUMN IF NOT EXISTS jobber_access_token_enc TEXT,
  ADD COLUMN IF NOT EXISTS jobber_refresh_token_enc TEXT,
  ADD COLUMN IF NOT EXISTS servicetitan_client_secret_enc TEXT,
  ADD COLUMN IF NOT EXISTS servicetitan_access_token_enc TEXT,
  ADD COLUMN IF NOT EXISTS housecall_access_token_enc TEXT,
  ADD COLUMN IF NOT EXISTS housecall_refresh_token_enc TEXT,
  ADD COLUMN IF NOT EXISTS org_secrets_cutover_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS org_secrets_plaintext_dropped_at TIMESTAMPTZ;

COMMENT ON COLUMN public.organizations.twilio_auth_token_enc IS
  'AES-256-GCM encrypted Twilio auth token (iv:tag:ciphertext). Plaintext twilio_auth_token is deprecated.';
COMMENT ON COLUMN public.organizations.org_secrets_cutover_completed_at IS
  'Set by scripts/migrate-org-secrets-cutover.mjs when all secrets for this org are encrypted.';
COMMENT ON COLUMN public.organizations.org_secrets_plaintext_dropped_at IS
  'Set by scripts/drop-org-secrets-plaintext-columns.mjs after plaintext secret columns are dropped.';

-- Mirror plaintext column RLS restrictions on encrypted shadow columns.
REVOKE SELECT (
  twilio_auth_token_enc,
  mail_access_token_enc,
  mail_refresh_token_enc,
  jobber_access_token_enc,
  jobber_refresh_token_enc,
  servicetitan_client_secret_enc,
  servicetitan_access_token_enc,
  housecall_access_token_enc,
  housecall_refresh_token_enc
) ON public.organizations FROM authenticated;
