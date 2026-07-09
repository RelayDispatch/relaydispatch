-- ==============================================================================
-- RELAYDISPATCH — CORRECTIVE SCHEMA SYNC MIGRATION
-- Synchronizes the Supabase database with missing tables, columns, enums, and views.
-- ==============================================================================

-- ── 1. Enable Extensions ──────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "vector"; -- pgvector for staffing search

-- ── 2. Add Missing Enum Values ────────────────────────────────────────────────
-- Altering enums is safe and idempotent in PG 12+ (ADD VALUE IF NOT EXISTS)
ALTER TYPE public.org_role ADD VALUE IF NOT EXISTS 'technician';
ALTER TYPE public.org_role ADD VALUE IF NOT EXISTS 'readonly';

ALTER TYPE public.thread_channel ADD VALUE IF NOT EXISTS 'web_form';
ALTER TYPE public.thread_channel ADD VALUE IF NOT EXISTS 'phone';

ALTER TYPE public.thread_status ADD VALUE IF NOT EXISTS 'triaged';
ALTER TYPE public.thread_status ADD VALUE IF NOT EXISTS 'quoted';
ALTER TYPE public.thread_status ADD VALUE IF NOT EXISTS 'scheduled';
ALTER TYPE public.thread_status ADD VALUE IF NOT EXISTS 'in_progress';
ALTER TYPE public.thread_status ADD VALUE IF NOT EXISTS 'completed';
ALTER TYPE public.thread_status ADD VALUE IF NOT EXISTS 'escalated';

ALTER TYPE public.thread_priority ADD VALUE IF NOT EXISTS 'emergency';

ALTER TYPE public.message_role ADD VALUE IF NOT EXISTS 'ethan_ai';
ALTER TYPE public.message_role ADD VALUE IF NOT EXISTS 'human_agent';

-- Create pricing_type and billing_event_type if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'pricing_type') THEN
    CREATE TYPE public.pricing_type AS ENUM ('flat', 'per_unit', 'hourly', 'diagnostic');
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'billing_event_type') THEN
    CREATE TYPE public.billing_event_type AS ENUM ('JOB_BOOKED', 'QUOTE_SENT', 'THREAD_RESOLVED', 'ESCALATION', 'COMPACTION_RUN');
  END IF;
END $$;

-- ── 3. Add Columns to Existing Tables (Idempotent via ADD COLUMN IF NOT EXISTS) ──

ALTER TABLE public.organizations 
  ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE DEFAULT 'org-' || substring(md5(random()::text) from 1 for 8),
  ADD COLUMN IF NOT EXISTS plan_tier TEXT DEFAULT 'starter' CHECK (plan_tier IN ('starter', 'pro', 'enterprise')),
  ADD COLUMN IF NOT EXISTS jobber_account_id TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS nylas_grant_id TEXT,
  ADD COLUMN IF NOT EXISTS twilio_number TEXT,
  ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'America/Chicago',
  ADD COLUMN IF NOT EXISTS sb243_footer TEXT DEFAULT 'Ethan is an AI Service Coordinator — Powered by RelayDispatch AI',
  ADD COLUMN IF NOT EXISTS intake_email_address TEXT,
  ADD COLUMN IF NOT EXISTS jobber_access_token TEXT,
  ADD COLUMN IF NOT EXISTS jobber_refresh_token TEXT,
  ADD COLUMN IF NOT EXISTS jobber_token_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS jobber_access_token_vault_id UUID,
  ADD COLUMN IF NOT EXISTS jobber_refresh_token_vault_id UUID,
  ADD COLUMN IF NOT EXISTS dispatch_mode TEXT,
  ADD COLUMN IF NOT EXISTS servicetitan_tenant_id TEXT,
  ADD COLUMN IF NOT EXISTS servicetitan_client_id TEXT,
  ADD COLUMN IF NOT EXISTS servicetitan_client_secret TEXT,
  ADD COLUMN IF NOT EXISTS servicetitan_access_token TEXT,
  ADD COLUMN IF NOT EXISTS servicetitan_token_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS housecall_access_token TEXT,
  ADD COLUMN IF NOT EXISTS housecall_refresh_token TEXT,
  ADD COLUMN IF NOT EXISTS housecall_token_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS mail_provider TEXT,
  ADD COLUMN IF NOT EXISTS mail_email_address TEXT,
  ADD COLUMN IF NOT EXISTS mail_access_token TEXT,
  ADD COLUMN IF NOT EXISTS mail_refresh_token TEXT,
  ADD COLUMN IF NOT EXISTS mail_token_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS twilio_account_sid TEXT,
  ADD COLUMN IF NOT EXISTS twilio_auth_token TEXT,
  ADD COLUMN IF NOT EXISTS twilio_phone_number TEXT,
  ADD COLUMN IF NOT EXISTS twilio_webhook_configured BOOLEAN DEFAULT false;

ALTER TABLE public.threads
  ADD COLUMN IF NOT EXISTS temporal_workflow_id TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS temporal_run_id TEXT,
  ADD COLUMN IF NOT EXISTS nylas_thread_id TEXT,
  ADD COLUMN IF NOT EXISTS nylas_message_id TEXT,
  ADD COLUMN IF NOT EXISTS jobber_quote_id TEXT,
  ADD COLUMN IF NOT EXISTS jobber_job_id TEXT,
  ADD COLUMN IF NOT EXISTS assigned_to UUID,
  ADD COLUMN IF NOT EXISTS escalation_reason TEXT,
  ADD COLUMN IF NOT EXISTS service_category TEXT,
  ADD COLUMN IF NOT EXISTS urgency_score SMALLINT CHECK (urgency_score BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS sentiment_score SMALLINT CHECK (sentiment_score BETWEEN -100 AND 100);

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS to_address TEXT,
  ADD COLUMN IF NOT EXISTS ai_model_used TEXT,
  ADD COLUMN IF NOT EXISTS ai_prompt_tokens INTEGER,
  ADD COLUMN IF NOT EXISTS ai_completion_tokens INTEGER,
  ADD COLUMN IF NOT EXISTS ai_latency_ms INTEGER,
  ADD COLUMN IF NOT EXISTS sb243_footer_applied BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;

ALTER TABLE public.technicians
  ADD COLUMN IF NOT EXISTS location_zone TEXT DEFAULT 'America/Chicago';

-- ── 4. Helper Functions ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.current_org_id()
RETURNS UUID
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT org_id
  FROM   public.org_members
  WHERE  user_id = auth.uid()
  LIMIT  1;
$$;

CREATE OR REPLACE FUNCTION public.is_org_member(p_org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.org_members om
    WHERE om.org_id = p_org_id AND om.user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.has_org_role(p_org_id UUID, p_role public.org_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.org_members om
    WHERE om.org_id = p_org_id AND om.user_id = auth.uid() AND om.role = p_role
  );
$$;

CREATE OR REPLACE FUNCTION public.get_org_id_for_thread(p_thread_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT org_id FROM public.threads WHERE id = p_thread_id LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ── 5. Create Missing Tables ──────────────────────────────────────────────────

-- pricing_rules
CREATE TABLE IF NOT EXISTS public.pricing_rules (
  id              UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          UUID          NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  service_code    TEXT          NOT NULL,
  service_label   TEXT          NOT NULL,
  category        TEXT          NOT NULL,
  pricing_type    public.pricing_type NOT NULL DEFAULT 'flat',
  base_price_usd  NUMERIC(10,2) NOT NULL CHECK (base_price_usd >= 0),
  min_price_usd   NUMERIC(10,2) CHECK (min_price_usd >= 0),
  max_price_usd   NUMERIC(10,2) CHECK (max_price_usd >= 0),
  unit_label      TEXT,
  is_active       BOOLEAN       NOT NULL DEFAULT TRUE,
  effective_from  DATE          NOT NULL DEFAULT CURRENT_DATE,
  effective_until DATE,
  created_by      UUID,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, service_code)
);

CREATE INDEX IF NOT EXISTS idx_pricing_org_category ON public.pricing_rules(org_id, category);
CREATE INDEX IF NOT EXISTS idx_pricing_org_active   ON public.pricing_rules(org_id, is_active, effective_from);

-- ai_audit_log
CREATE TABLE IF NOT EXISTS public.ai_audit_log (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  thread_id       UUID        REFERENCES public.threads(id) ON DELETE SET NULL,
  message_id      UUID        REFERENCES public.messages(id) ON DELETE SET NULL,
  agent_name      TEXT        NOT NULL,
  action          TEXT        NOT NULL,
  model_id        TEXT        NOT NULL,
  prompt_summary  TEXT,
  decision_made   TEXT,
  confidence      NUMERIC(4,3) CHECK (confidence BETWEEN 0 AND 1),
  hallucination_risk_flagged  BOOLEAN NOT NULL DEFAULT FALSE,
  price_sourced_from_db       BOOLEAN,
  sb243_disclosure_present    BOOLEAN NOT NULL DEFAULT FALSE,
  prompt_tokens       INTEGER,
  completion_tokens   INTEGER,
  openrouter_cost_usd NUMERIC(10,6),
  latency_ms          INTEGER,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_org_agent  ON public.ai_audit_log(org_id, agent_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_thread     ON public.ai_audit_log(thread_id);
CREATE INDEX IF NOT EXISTS idx_ai_audit_org_created ON public.ai_audit_log(org_id, created_at);

-- billing_events
CREATE TABLE IF NOT EXISTS public.billing_events (
  id                    UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id                UUID          NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  thread_id             UUID          REFERENCES public.threads(id) ON DELETE SET NULL,
  event_type            public.billing_event_type NOT NULL,
  jobber_job_id         TEXT,
  jobber_job_number     TEXT,
  service_category      TEXT,
  line_item_price_usd   NUMERIC(10,2),
  ai_prompt_tokens      INTEGER,
  ai_completion_tokens  INTEGER,
  ai_model_id           TEXT,
  openrouter_cost_usd   NUMERIC(10,6),
  openrouter_model_id   TEXT,
  metadata              JSONB,
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_billing_org_type      ON public.billing_events(org_id, event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_billing_org_month     ON public.billing_events(org_id, created_at);
CREATE INDEX IF NOT EXISTS idx_billing_jobber_job    ON public.billing_events(jobber_job_id) WHERE jobber_job_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_billing_thread        ON public.billing_events(thread_id) WHERE thread_id IS NOT NULL;

-- failed_webhooks
CREATE TABLE IF NOT EXISTS public.failed_webhooks (
  id                  UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id              UUID          REFERENCES public.organizations(id) ON DELETE CASCADE,
  source              TEXT          NOT NULL DEFAULT 'gmail_pubsub',
  raw_payload         JSONB         NOT NULL,
  email_address       TEXT,
  history_id          TEXT,
  failure_reason      TEXT          NOT NULL,
  retry_count         SMALLINT      NOT NULL DEFAULT 0,
  last_attempted_at   TIMESTAMPTZ,
  resolved            BOOLEAN       NOT NULL DEFAULT FALSE,
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_failed_webhooks_unresolved ON public.failed_webhooks(created_at DESC) WHERE resolved = FALSE;
CREATE INDEX IF NOT EXISTS idx_failed_webhooks_org        ON public.failed_webhooks(org_id) WHERE org_id IS NOT NULL;

-- candidates
CREATE TABLE IF NOT EXISTS public.candidates (
  id                UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id            UUID          NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email_placeholder TEXT,
  name_placeholder  TEXT,
  current_title     TEXT,
  years_experience  SMALLINT,
  skills            TEXT[],
  location_city     TEXT,
  location_country  TEXT DEFAULT 'US',
  resume_raw_text   TEXT,
  resume_storage_path TEXT,
  resume_parsed_at  TIMESTAMPTZ,
  skill_embedding   vector(1536),
  embedding_model   TEXT,
  embedded_at       TIMESTAMPTZ,
  dedup_hash        TEXT,
  canonical_id      UUID          REFERENCES public.candidates(id),
  status            TEXT          NOT NULL DEFAULT 'active' CHECK (status IN ('active','withdrawn','hired','do_not_contact')),
  consent_given_at  TIMESTAMPTZ,
  consent_ip        TEXT,
  erasure_requested_at TIMESTAMPTZ,
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_candidates_org        ON public.candidates(org_id);
CREATE INDEX IF NOT EXISTS idx_candidates_status     ON public.candidates(org_id, status);
CREATE INDEX IF NOT EXISTS idx_candidates_dedup      ON public.candidates(dedup_hash) WHERE dedup_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_candidates_embedding  ON public.candidates USING hnsw (skill_embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);

-- job_requisitions
CREATE TABLE IF NOT EXISTS public.job_requisitions (
  id                UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id            UUID          NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  title             TEXT          NOT NULL,
  department        TEXT,
  location_city     TEXT,
  location_country  TEXT DEFAULT 'US',
  remote_policy     TEXT          CHECK (remote_policy IN ('onsite','hybrid','remote','flexible')),
  required_skills   TEXT[],
  preferred_skills  TEXT[],
  min_years_exp     SMALLINT,
  max_years_exp     SMALLINT,
  jd_raw_text       TEXT,
  jd_embedding      vector(1536),
  embedding_model   TEXT,
  embedded_at       TIMESTAMPTZ,
  status            TEXT          NOT NULL DEFAULT 'open' CHECK (status IN ('draft','open','paused','closed','filled')),
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_job_reqs_org_status ON public.job_requisitions(org_id, status);
CREATE INDEX IF NOT EXISTS idx_job_reqs_embedding  ON public.job_requisitions USING hnsw (jd_embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);

-- applications
CREATE TABLE IF NOT EXISTS public.applications (
  id                UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id            UUID          NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  candidate_id      UUID          NOT NULL REFERENCES public.candidates(id),
  job_req_id        UUID          NOT NULL REFERENCES public.job_requisitions(id),
  thread_id         UUID          REFERENCES public.threads(id),
  fit_score         NUMERIC(4,3)  CHECK (fit_score BETWEEN 0 AND 1),
  fit_summary       TEXT,
  fit_scored_at     TIMESTAMPTZ,
  fit_model         TEXT,
  status            TEXT          NOT NULL DEFAULT 'new' CHECK (status IN ('new','ai_screened','human_review','interview','offer','rejected','withdrawn')),
  assigned_recruiter_id UUID,
  ai_rejection_reason TEXT,
  human_override    BOOLEAN       NOT NULL DEFAULT FALSE,
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_apps_org_status    ON public.applications(org_id, status);
CREATE INDEX IF NOT EXISTS idx_apps_candidate     ON public.applications(candidate_id);
CREATE INDEX IF NOT EXISTS idx_apps_job           ON public.applications(job_req_id);

-- ── 6. Triggers ──────────────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS trg_organizations_updated_at ON public.organizations;
CREATE TRIGGER trg_organizations_updated_at BEFORE UPDATE ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_contacts_updated_at ON public.contacts;
CREATE TRIGGER trg_contacts_updated_at BEFORE UPDATE ON public.contacts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_threads_updated_at ON public.threads;
CREATE TRIGGER trg_threads_updated_at BEFORE UPDATE ON public.threads FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_pricing_rules_updated_at ON public.pricing_rules;
CREATE TRIGGER trg_pricing_rules_updated_at BEFORE UPDATE ON public.pricing_rules FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_jobs_updated_at ON public.jobs;
CREATE TRIGGER trg_jobs_updated_at BEFORE UPDATE ON public.jobs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_candidates_updated_at ON public.candidates;
CREATE TRIGGER trg_candidates_updated_at BEFORE UPDATE ON public.candidates FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_job_reqs_updated_at ON public.job_requisitions;
CREATE TRIGGER trg_job_reqs_updated_at BEFORE UPDATE ON public.job_requisitions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_applications_updated_at ON public.applications;
CREATE TRIGGER trg_applications_updated_at BEFORE UPDATE ON public.applications FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── 7. Views ─────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW public.v_monthly_job_bookings AS
SELECT
  org_id,
  date_trunc('month', created_at)        AS month,
  COUNT(*)                               AS jobs_booked,
  SUM(line_item_price_usd)               AS total_quoted_usd,
  AVG(line_item_price_usd)               AS avg_job_price_usd,
  SUM(ai_prompt_tokens + COALESCE(ai_completion_tokens, 0)) AS total_tokens_used
FROM   public.billing_events
WHERE  event_type = 'JOB_BOOKED'
GROUP BY org_id, date_trunc('month', created_at);

CREATE OR REPLACE VIEW public.v_llm_cost_by_org AS
SELECT
  org_id,
  date_trunc('month', created_at)          AS month,
  COUNT(*)                                 AS total_llm_calls,
  SUM(prompt_tokens)                       AS total_prompt_tokens,
  SUM(completion_tokens)                   AS total_completion_tokens,
  SUM(openrouter_cost_usd)                 AS total_cost_usd,
  AVG(latency_ms)                          AS avg_latency_ms,
  model_id
FROM public.ai_audit_log
GROUP BY org_id, date_trunc('month', created_at), model_id;

CREATE OR REPLACE VIEW public.v_roi_dashboard AS
WITH monthly_audit AS (
  SELECT
    org_id,
    date_trunc('month', created_at)                       AS month,
    COUNT(*)                                               AS total_events,
    COALESCE(SUM(openrouter_cost_usd), 0)                 AS total_ai_cost_usd,
    MAX(model_id)                                         AS primary_model_id
  FROM public.ai_audit_log
  GROUP BY org_id, date_trunc('month', created_at)
),
monthly_billing AS (
  SELECT
    org_id,
    date_trunc('month', created_at)                       AS month,
    COUNT(*) FILTER (WHERE event_type = 'JOB_BOOKED')     AS jobs_booked,
    COUNT(*) FILTER (WHERE event_type = 'QUOTE_SENT')     AS quotes_sent,
    COUNT(*) FILTER (WHERE event_type = 'ESCALATION')     AS human_escalations,
    COUNT(*) FILTER (WHERE event_type = 'THREAD_RESOLVED') AS threads_resolved,
    COALESCE(SUM(line_item_price_usd) FILTER (WHERE event_type = 'JOB_BOOKED'), 0)        AS revenue_quoted_usd,
    COUNT(*) FILTER (WHERE event_type = 'JOB_BOOKED') * 20.00                              AS success_fees_usd
  FROM public.billing_events
  GROUP BY org_id, date_trunc('month', created_at)
)
SELECT
  COALESCE(a.org_id, b.org_id)                            AS org_id,
  COALESCE(a.month, b.month)                              AS month,
  COALESCE(a.total_events, 0)                             AS total_events,
  COALESCE(b.jobs_booked, 0)                              AS jobs_booked,
  COALESCE(b.quotes_sent, 0)                              AS quotes_sent,
  COALESCE(b.human_escalations, 0)                        AS human_escalations,
  COALESCE(b.threads_resolved, 0)                         AS threads_resolved,
  COALESCE(b.revenue_quoted_usd, 0.00)                    AS revenue_quoted_usd,
  COALESCE(b.success_fees_usd, 0.00)                      AS success_fees_usd,
  COALESCE(a.total_ai_cost_usd, 0.000000)                 AS total_ai_cost_usd,
  a.primary_model_id
FROM monthly_audit a
FULL OUTER JOIN monthly_billing b USING (org_id, month);

ALTER VIEW public.v_monthly_job_bookings SET (security_invoker = ON);
ALTER VIEW public.v_llm_cost_by_org SET (security_invoker = ON);
ALTER VIEW public.v_roi_dashboard SET (security_invoker = ON);

-- ── 8. Security Hardening & Row-Level Security (RLS) ─────────────────────────

ALTER TABLE public.pricing_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.failed_webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_requisitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;

-- Clean recreate policies to prevent duplicate errors
DROP POLICY IF EXISTS "pricing_readable_by_org" ON public.pricing_rules;
DROP POLICY IF EXISTS "pricing_writable_by_admins" ON public.pricing_rules;
DROP POLICY IF EXISTS "pricing_update_by_admins" ON public.pricing_rules;
DROP POLICY IF EXISTS "audit_readable_by_admins" ON public.ai_audit_log;
DROP POLICY IF EXISTS "billing_readable_by_admins" ON public.billing_events;
DROP POLICY IF EXISTS "failed_webhooks_readable_by_org_admins" ON public.failed_webhooks;
DROP POLICY IF EXISTS "candidates_isolated_to_org" ON public.candidates;
DROP POLICY IF EXISTS "jobs_isolated_to_org" ON public.job_requisitions;
DROP POLICY IF EXISTS "applications_isolated_to_org" ON public.applications;

-- pricing_rules Policies
CREATE POLICY "pricing_readable_by_org" ON public.pricing_rules FOR SELECT USING (org_id = public.current_org_id());
CREATE POLICY "pricing_writable_by_admins" ON public.pricing_rules FOR INSERT WITH CHECK (org_id = public.current_org_id() AND (public.has_org_role(org_id, 'owner') OR public.has_org_role(org_id, 'admin')));
CREATE POLICY "pricing_update_by_admins" ON public.pricing_rules FOR UPDATE USING (org_id = public.current_org_id() AND (public.has_org_role(org_id, 'owner') OR public.has_org_role(org_id, 'admin')));

-- ai_audit_log Policies
CREATE POLICY "audit_readable_by_admins" ON public.ai_audit_log FOR SELECT USING (org_id = public.current_org_id() AND (public.has_org_role(org_id, 'owner') OR public.has_org_role(org_id, 'admin')));

-- billing_events Policies
CREATE POLICY "billing_readable_by_admins" ON public.billing_events FOR SELECT USING (org_id = public.current_org_id() AND (public.has_org_role(org_id, 'owner') OR public.has_org_role(org_id, 'admin')));

-- failed_webhooks Policies
CREATE POLICY "failed_webhooks_readable_by_org_admins" ON public.failed_webhooks FOR SELECT USING (org_id = public.current_org_id() AND (public.has_org_role(org_id, 'owner') OR public.has_org_role(org_id, 'admin')));

-- candidates Policies
CREATE POLICY "candidates_isolated_to_org" ON public.candidates FOR ALL USING (org_id = public.current_org_id());

-- job_requisitions Policies
CREATE POLICY "jobs_isolated_to_org" ON public.job_requisitions FOR ALL USING (org_id = public.current_org_id());

-- applications Policies
CREATE POLICY "applications_isolated_to_org" ON public.applications FOR ALL USING (org_id = public.current_org_id());

-- ── 9. Grants & Privileges ────────────────────────────────────────────────────

GRANT SELECT ON public.v_monthly_job_bookings TO authenticated;
GRANT SELECT ON public.v_llm_cost_by_org TO authenticated;
GRANT SELECT ON public.v_roi_dashboard TO authenticated;
GRANT SELECT ON public.candidates TO authenticated;
GRANT SELECT ON public.job_requisitions TO authenticated;
GRANT SELECT ON public.applications TO authenticated;
GRANT SELECT ON public.pricing_rules TO authenticated;

GRANT ALL ON public.organizations TO service_role;
GRANT ALL ON public.org_members TO service_role;
GRANT ALL ON public.contacts TO service_role;
GRANT ALL ON public.threads TO service_role;
GRANT ALL ON public.messages TO service_role;
GRANT ALL ON public.pricing_rules TO service_role;
GRANT ALL ON public.ai_audit_log TO service_role;
GRANT ALL ON public.technicians TO service_role;
GRANT ALL ON public.jobs TO service_role;
GRANT ALL ON public.outreach_contacts TO service_role;
GRANT ALL ON public.outreach_messages TO service_role;
GRANT ALL ON public.api_idempotency_responses TO service_role;
GRANT ALL ON public.failed_webhooks TO service_role;
GRANT ALL ON public.billing_events TO service_role;
GRANT ALL ON public.candidates TO service_role;
GRANT ALL ON public.job_requisitions TO service_role;
GRANT ALL ON public.applications TO service_role;

-- ── 10. Seeding & Template Setup ──────────────────────────────────────────────

INSERT INTO public.organizations (id, name, slug)
VALUES ('00000000-0000-0000-0000-000000000001', 'Template Organization', 'template-org')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.pricing_rules (org_id, service_code, service_label, category, pricing_type, base_price_usd, min_price_usd, max_price_usd, unit_label)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'AC_DIAGNOSTIC',      'AC System Diagnostic',           'COOLING',     'diagnostic', 89.00,  75.00,  149.00, NULL),
  ('00000000-0000-0000-0000-000000000001', 'AC_REFRIGERANT_ADD', 'Refrigerant Recharge (per lb)',  'COOLING',     'per_unit',   75.00,  65.00,  95.00,  'per lb'),
  ('00000000-0000-0000-0000-000000000001', 'AC_CAPACITOR',       'Capacitor Replacement',          'COOLING',     'flat',       175.00, 150.00, 225.00, NULL),
  ('00000000-0000-0000-0000-000000000001', 'FURNACE_DIAGNOSTIC', 'Furnace Diagnostic',             'HEATING',     'diagnostic', 89.00,  75.00,  149.00, NULL),
  ('00000000-0000-0000-0000-000000000001', 'FILTER_1IN',         'Filter Replacement (1 inch)',    'MAINTENANCE', 'flat',       25.00,  20.00,  35.00,  NULL),
  ('00000000-0000-0000-0000-000000000001', 'FILTER_4IN',         'Filter Replacement (4 inch)',    'MAINTENANCE', 'flat',       45.00,  35.00,  55.00,  NULL),
  ('00000000-0000-0000-0000-000000000001', 'MAINTENANCE_ANNUAL', 'Annual Maintenance Agreement',   'MAINTENANCE', 'flat',       199.00, 179.00, 249.00, NULL),
  ('00000000-0000-0000-0000-000000000001', 'LABOR_HOURLY',       'Labor (Hourly Rate)',            'HEATING',     'hourly',     125.00, 110.00, 150.00, 'per hour')
ON CONFLICT (org_id, service_code) DO NOTHING;
