-- ============================================================
-- Migration: Add call_logs table + Twilio org columns
--            + fix org_usage_monthly missing table
-- ============================================================

-- ── CALL LOGS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.call_logs (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            uuid        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  thread_id         uuid        REFERENCES public.threads(id) ON DELETE SET NULL,
  from_number       text        NOT NULL,
  to_number         text        NOT NULL,
  duration_seconds  integer     NOT NULL DEFAULT 0,
  status            text        NOT NULL DEFAULT 'ringing'
                                CHECK (status IN ('ringing','in-progress','completed','no-answer','busy','failed','canceled')),
  direction         text        NOT NULL DEFAULT 'inbound'
                                CHECK (direction IN ('inbound','outbound')),
  ai_transcript     text,
  call_sid          text        UNIQUE,
  recording_url     text,
  caller_name       text,
  service_type      text,
  ai_summary        text,
  human_handoff     boolean     NOT NULL DEFAULT false,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.call_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'call_logs' AND policyname = 'org_members_select_call_logs'
  ) THEN
    CREATE POLICY "org_members_select_call_logs"
      ON public.call_logs FOR SELECT
      USING (org_id IN (
        SELECT org_id FROM public.org_members WHERE user_id = auth.uid()
      ));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'call_logs' AND policyname = 'service_role_all_call_logs'
  ) THEN
    CREATE POLICY "service_role_all_call_logs"
      ON public.call_logs FOR ALL
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_call_logs_org_id     ON public.call_logs(org_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_created_at ON public.call_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_call_logs_status     ON public.call_logs(status);
CREATE INDEX IF NOT EXISTS idx_call_logs_thread_id  ON public.call_logs(thread_id);

-- ── TWILIO COLUMNS ON ORGANIZATIONS ─────────────────────────
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS twilio_account_sid       text,
  ADD COLUMN IF NOT EXISTS twilio_auth_token        text,
  ADD COLUMN IF NOT EXISTS twilio_phone_number      text,
  ADD COLUMN IF NOT EXISTS twilio_webhook_configured boolean NOT NULL DEFAULT false;

-- ── FIX: completed_activity_keys — ensure org_id column exists ──
-- The table was created in a prior migration with just (key, created_at).
-- Add org_id if not already present.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'completed_activity_keys'
      AND column_name = 'org_id'
  ) THEN
    ALTER TABLE public.completed_activity_keys
      ADD COLUMN org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_completed_activity_keys_org_id
      ON public.completed_activity_keys(org_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'completed_activity_keys' AND policyname = 'service_role_all_completed_activity_keys'
  ) THEN
    CREATE POLICY "service_role_all_completed_activity_keys"
      ON public.completed_activity_keys FOR ALL
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_completed_activity_keys_created_at
  ON public.completed_activity_keys(created_at DESC);

-- ── FIX: org_usage_monthly (referenced in POST /api/technicians) ──
CREATE TABLE IF NOT EXISTS public.org_usage_monthly (
  id               uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           uuid          NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  month            date          NOT NULL,
  technician_count integer       NOT NULL DEFAULT 0,
  job_count        integer       NOT NULL DEFAULT 0,
  ai_cost_usd      numeric(10,6) NOT NULL DEFAULT 0,
  created_at       timestamptz   NOT NULL DEFAULT now(),
  updated_at       timestamptz   NOT NULL DEFAULT now(),
  UNIQUE (org_id, month)
);

ALTER TABLE public.org_usage_monthly ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'org_usage_monthly' AND policyname = 'org_members_select_usage'
  ) THEN
    CREATE POLICY "org_members_select_usage"
      ON public.org_usage_monthly FOR SELECT
      USING (org_id IN (
        SELECT org_id FROM public.org_members WHERE user_id = auth.uid()
      ));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'org_usage_monthly' AND policyname = 'service_role_all_usage'
  ) THEN
    CREATE POLICY "service_role_all_usage"
      ON public.org_usage_monthly FOR ALL
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_org_usage_monthly_org_id ON public.org_usage_monthly(org_id);
CREATE INDEX IF NOT EXISTS idx_org_usage_monthly_month  ON public.org_usage_monthly(month DESC);

-- Note: outreach_contacts and outreach_messages have non-standard schemas,
-- their RLS policies are managed separately.

