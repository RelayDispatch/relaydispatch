-- Add Jobber integration columns if missing
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS jobber_account_id TEXT UNIQUE;
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS jobber_access_token TEXT;
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS jobber_refresh_token TEXT;
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS jobber_token_expires_at TIMESTAMPTZ;

-- Add ServiceTitan integration columns to organizations
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS servicetitan_tenant_id TEXT;
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS servicetitan_client_id TEXT;
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS servicetitan_client_secret TEXT;
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS servicetitan_access_token TEXT;
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS servicetitan_token_expires_at TIMESTAMPTZ;

-- Add Housecall Pro integration columns to organizations
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS housecall_access_token TEXT;
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS housecall_refresh_token TEXT;
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS housecall_token_expires_at TIMESTAMPTZ;

-- Add GCP direct mail OAuth columns to organizations
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS mail_provider TEXT; -- 'google' | 'microsoft' | 'sandbox'
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS mail_email_address TEXT;
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS mail_access_token TEXT;
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS mail_refresh_token TEXT;
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS mail_token_expires_at TIMESTAMPTZ;

-- Restrict RLS column select access on sensitive tokens for authenticated users
REVOKE SELECT (
  jobber_access_token, jobber_refresh_token, jobber_token_expires_at,
  servicetitan_access_token, servicetitan_client_secret, servicetitan_token_expires_at,
  housecall_access_token, housecall_refresh_token, housecall_token_expires_at,
  mail_access_token, mail_refresh_token, mail_token_expires_at
) ON public.organizations FROM authenticated;
