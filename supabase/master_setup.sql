-- ============================================================
-- RELAYDISPATCH — COMPLETE MASTER INITIALIZATION SETUP SCRIPT
-- ============================================================
-- Compliance: NIST RMF, TRAIGA (Texas), SB 243, EU AI Act
-- Multi-Tenant Schema  •  Supabase / PostgreSQL
-- 
-- Run this entire script in the Supabase Dashboard SQL Editor (under SQL Editor -> New Query).
-- WARNING: This drops and recreates the public schema to ensure a clean slate.
-- ============================================================

-- ── 0. Fresh Slate Reset ────────────────────────────────────
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres, anon, authenticated, service_role;

-- Set default privileges so that all tables/sequences/functions created hereafter automatically grant access
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres, anon, authenticated, service_role;

-- ── 1. Extensions ───────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";        -- Fuzzy search for text columns
CREATE EXTENSION IF NOT EXISTS "vector";         -- Required for Staffing Matchings (pgvector)

-- ── 2. Custom Type Definitions & Enums ──────────────────────
CREATE TYPE public.org_role AS ENUM ('owner', 'admin', 'dispatcher', 'technician', 'readonly');
CREATE TYPE public.job_status AS ENUM ('new', 'triaged', 'ready_for_dispatch', 'scheduled', 'assigned', 'in_progress', 'completed', 'cancelled');
CREATE TYPE public.thread_channel AS ENUM ('email', 'sms', 'web_form', 'phone');
CREATE TYPE public.thread_status AS ENUM ('new', 'triaged', 'quoted', 'scheduled', 'in_progress', 'completed', 'escalated', 'closed');
CREATE TYPE public.thread_priority AS ENUM ('low', 'normal', 'urgent', 'emergency');
CREATE TYPE public.message_role AS ENUM ('customer', 'ethan_ai', 'human_agent', 'system');
CREATE TYPE public.message_direction AS ENUM ('inbound', 'outbound');
CREATE TYPE public.pricing_type AS ENUM ('flat', 'per_unit', 'hourly', 'diagnostic');
CREATE TYPE public.billing_event_type AS ENUM ('JOB_BOOKED', 'QUOTE_SENT', 'THREAD_RESOLVED', 'ESCALATION', 'COMPACTION_RUN');

-- ── 3. Organizations (Tenant Root) ──────────────────────────
CREATE TABLE public.organizations (
  id                  UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  name                TEXT          NOT NULL,
  slug                TEXT          NOT NULL UNIQUE DEFAULT 'org-' || substring(md5(random()::text) from 1 for 8),
  plan_tier           TEXT          NOT NULL DEFAULT 'starter' CHECK (plan_tier IN ('starter', 'pro', 'enterprise')),
  plan                TEXT          NOT NULL DEFAULT 'starter' CHECK (plan IN ('starter', 'pro', 'enterprise')),
  jobber_account_id   TEXT          UNIQUE,
  nylas_grant_id      TEXT,
  twilio_number       TEXT,
  timezone            TEXT          NOT NULL DEFAULT 'America/Chicago',
  sb243_footer        TEXT          NOT NULL DEFAULT 'Ethan is an AI Service Coordinator — Powered by RelayDispatch AI',
  is_active           BOOLEAN       NOT NULL DEFAULT TRUE,
  intake_email_address TEXT,
  
  -- Jobber OAuth Encrypted Storage Columns
  jobber_access_token      TEXT,
  jobber_refresh_token     TEXT,
  jobber_token_expires_at  TIMESTAMPTZ,
  
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_orgs_intake_email
  ON public.organizations(intake_email_address)
  WHERE intake_email_address IS NOT NULL;

-- ── 4. Org Members ──────────────────────────────────────────
CREATE TABLE public.org_members (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id      UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id     UUID        NOT NULL REFERENCES auth.users(id)    ON DELETE CASCADE,
  role        public.org_role NOT NULL DEFAULT 'dispatcher',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, user_id)
);

-- ── 5. Core CRM Communication Tables (Contacts, Threads, Messages) ──
CREATE TABLE public.contacts (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  first_name      TEXT,
  last_name       TEXT,
  email           TEXT,
  phone           TEXT,
  jobber_client_id TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, email)
);

CREATE TABLE public.threads (
  id                  UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id              UUID            NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  contact_id          UUID            REFERENCES public.contacts(id) ON DELETE SET NULL,
  channel             public.thread_channel NOT NULL DEFAULT 'email',
  external_thread_id  TEXT,
  subject             TEXT,
  status              public.thread_status NOT NULL DEFAULT 'new',
  priority            public.thread_priority NOT NULL DEFAULT 'normal',
  
  -- AI Classifiers
  service_category    TEXT,
  urgency_score       SMALLINT        CHECK (urgency_score BETWEEN 0 AND 100),
  sentiment_score     SMALLINT        CHECK (sentiment_score BETWEEN -100 AND 100),
  
  -- Workflow / Nylas
  temporal_workflow_id TEXT           UNIQUE,
  temporal_run_id      TEXT,
  nylas_thread_id      TEXT,
  nylas_message_id     TEXT,
  
  -- Jobber Refs
  jobber_quote_id     TEXT,
  jobber_job_id       TEXT,
  assigned_to         UUID,
  escalation_reason   TEXT,
  created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_threads_org_status   ON public.threads(org_id, status);
CREATE INDEX idx_threads_org_channel  ON public.threads(org_id, channel);
CREATE INDEX idx_threads_contact      ON public.threads(contact_id);
CREATE UNIQUE INDEX idx_threads_org_external_id_unique
  ON public.threads(org_id, external_thread_id)
  WHERE external_thread_id IS NOT NULL;

CREATE TABLE public.messages (
  id                  UUID              PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id              UUID              NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  thread_id           UUID              NOT NULL REFERENCES public.threads(id) ON DELETE CASCADE,
  role                public.message_role NOT NULL,
  direction           public.message_direction NOT NULL,
  body_text           TEXT              NOT NULL,
  body_html           TEXT,
  from_address        TEXT,
  to_address          TEXT,
  external_message_id TEXT,
  
  -- AI Provenance & compliance
  ai_model_used       TEXT,
  ai_prompt_tokens    INTEGER,
  ai_completion_tokens INTEGER,
  ai_latency_ms       INTEGER,
  sb243_footer_applied BOOLEAN          NOT NULL DEFAULT FALSE,
  
  delivered_at        TIMESTAMPTZ,
  read_at             TIMESTAMPTZ,
  created_at          TIMESTAMPTZ       NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_messages_thread   ON public.messages(thread_id, created_at DESC);
CREATE INDEX idx_messages_org      ON public.messages(org_id, created_at DESC);
CREATE INDEX idx_messages_external ON public.messages(external_message_id);

-- ── 6. Helper Functions for Security & RLS ──────────────────
-- (Defined here now that organizations, org_members, and threads exist)
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

-- ── 7. Pricing Rules & AI Audit Logs ────────────────────────
CREATE TABLE public.pricing_rules (
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

CREATE INDEX idx_pricing_org_category ON public.pricing_rules(org_id, category);
CREATE INDEX idx_pricing_org_active   ON public.pricing_rules(org_id, is_active, effective_from);

CREATE TABLE public.ai_audit_log (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  thread_id       UUID        REFERENCES public.threads(id),
  message_id      UUID        REFERENCES public.messages(id),
  agent_name      TEXT        NOT NULL,   -- 'classifier' | 'dispatcher' | 'scribe' | 'librarian'
  action          TEXT        NOT NULL,   -- 'classify' | 'draft_reply' | 'fetch_price' | 'escalate'
  model_id        TEXT        NOT NULL,
  prompt_summary  TEXT,
  decision_made   TEXT,
  confidence      NUMERIC(4,3) CHECK (confidence BETWEEN 0 AND 1),
  hallucination_risk_flagged  BOOLEAN NOT NULL DEFAULT FALSE,
  price_sourced_from_db       BOOLEAN,
  sb243_disclosure_present    BOOLEAN NOT NULL DEFAULT FALSE,
  
  -- LLM Cost Tracking
  prompt_tokens       INTEGER,
  completion_tokens   INTEGER,
  openrouter_cost_usd NUMERIC(10,6),
  latency_ms          INTEGER,
  
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_org_agent  ON public.ai_audit_log(org_id, agent_name, created_at DESC);
CREATE INDEX idx_audit_thread     ON public.ai_audit_log(thread_id);
CREATE INDEX idx_ai_audit_org_created ON public.ai_audit_log(org_id, created_at);

-- ── 8. Dispatch Fleet Management Tables ────────────────────
CREATE TABLE public.technicians (
  id              UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          UUID          NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name            TEXT          NOT NULL,
  skills          TEXT[]        NOT NULL DEFAULT '{}',
  is_active       BOOLEAN       NOT NULL DEFAULT TRUE,
  location_zone   TEXT          NOT NULL DEFAULT 'America/Chicago',
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_technicians_org ON public.technicians(org_id) WHERE is_active = TRUE;

CREATE TABLE public.jobs (
  id              UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          UUID          NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  thread_id       UUID          NOT NULL REFERENCES public.threads(id) ON DELETE CASCADE,
  contact_id      UUID          REFERENCES public.contacts(id) ON DELETE SET NULL,
  service_type    TEXT          NOT NULL,
  status          public.job_status NOT NULL DEFAULT 'new',
  scheduled_at    TIMESTAMPTZ,
  assigned_to     UUID          REFERENCES public.technicians(id) ON DELETE SET NULL,
  notes           TEXT,
  external_id     TEXT,
  external_provider TEXT,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_jobs_org_id       ON public.jobs(org_id);
CREATE INDEX idx_jobs_thread_id    ON public.jobs(thread_id);
CREATE INDEX idx_jobs_status       ON public.jobs(status);
CREATE INDEX idx_jobs_assigned_to  ON public.jobs(assigned_to) WHERE assigned_to IS NOT NULL;

-- ── 9. Outreach Automation ──────────────────────────────────
CREATE TABLE public.outreach_contacts (
  id              UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_name   TEXT          NOT NULL,
  email           TEXT          NOT NULL UNIQUE,
  status          TEXT          NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','replied','followup','trial','closed')),
  last_message    TEXT,
  last_contacted_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE TABLE public.outreach_messages (
  id              UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  contact_id      UUID          NOT NULL REFERENCES public.outreach_contacts(id) ON DELETE CASCADE,
  direction       TEXT          NOT NULL CHECK (direction IN ('outbound','inbound')),
  provider_message_id TEXT,
  subject         TEXT,
  content         TEXT          NOT NULL,
  timestamp       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ── 10. API Ledgers & Dead Letter Queues (DLQ) ──────────────
CREATE TABLE public.api_idempotency_responses (
  id              UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          UUID          NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  endpoint        TEXT          NOT NULL,
  idempotency_key TEXT          NOT NULL,
  resource_id     UUID          NOT NULL,
  http_status     INTEGER       NOT NULL,
  response_body   JSONB         NOT NULL,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, endpoint, resource_id, idempotency_key)
);

CREATE INDEX idx_api_idem_org_endpoint_resource ON public.api_idempotency_responses(org_id, endpoint, resource_id);
CREATE INDEX idx_api_idem_created_at            ON public.api_idempotency_responses(created_at);

CREATE TABLE public.failed_webhooks (
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

CREATE INDEX idx_failed_webhooks_unresolved ON public.failed_webhooks(created_at DESC) WHERE resolved = FALSE;
CREATE INDEX idx_failed_webhooks_org        ON public.failed_webhooks(org_id) WHERE org_id IS NOT NULL;

-- ── 11. Immutable Billing Event Logs ────────────────────────
CREATE TABLE public.billing_events (
  id                    UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id                UUID          NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  thread_id             UUID          REFERENCES public.threads(id) ON DELETE SET NULL,
  event_type            public.billing_event_type NOT NULL,
  
  -- Jobber specifics
  jobber_job_id         TEXT,
  jobber_job_number     TEXT,
  
  -- Pricing/Revenue metrics
  service_category      TEXT,
  line_item_price_usd   NUMERIC(10,2),
  
  -- AI cost parameters
  ai_prompt_tokens      INTEGER,
  ai_completion_tokens  INTEGER,
  ai_model_id           TEXT,
  
  metadata              JSONB,
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_billing_org_type      ON public.billing_events(org_id, event_type, created_at DESC);
CREATE INDEX idx_billing_org_month     ON public.billing_events(org_id, created_at);
CREATE INDEX idx_billing_jobber_job    ON public.billing_events(jobber_job_id) WHERE jobber_job_id IS NOT NULL;
CREATE INDEX idx_billing_thread        ON public.billing_events(thread_id) WHERE thread_id IS NOT NULL;

-- ── 12. Staffing Pivot Tables (EU AI Act & pgvector) ────────
CREATE TABLE public.candidates (
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
  
  -- Semantic skills mapping vector
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

CREATE INDEX idx_candidates_org        ON public.candidates(org_id);
CREATE INDEX idx_candidates_status     ON public.candidates(org_id, status);
CREATE INDEX idx_candidates_dedup      ON public.candidates(dedup_hash) WHERE dedup_hash IS NOT NULL;
CREATE INDEX idx_candidates_embedding  ON public.candidates USING hnsw (skill_embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);

CREATE TABLE public.job_requisitions (
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

CREATE INDEX idx_jobs_org_status ON public.job_requisitions(org_id, status);
CREATE INDEX idx_jobs_embedding  ON public.job_requisitions USING hnsw (jd_embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);

CREATE TABLE public.applications (
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

CREATE INDEX idx_apps_org_status    ON public.applications(org_id, status);
CREATE INDEX idx_apps_candidate     ON public.applications(candidate_id);
CREATE INDEX idx_apps_job           ON public.applications(job_req_id);

-- ── 13. System Triggers ─────────────────────────────────────
CREATE TRIGGER trg_organizations_updated_at BEFORE UPDATE ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_contacts_updated_at      BEFORE UPDATE ON public.contacts      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_threads_updated_at       BEFORE UPDATE ON public.threads       FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_pricing_rules_updated_at BEFORE UPDATE ON public.pricing_rules FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_jobs_updated_at          BEFORE UPDATE ON public.jobs          FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_candidates_updated_at    BEFORE UPDATE ON public.candidates    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_job_reqs_updated_at      BEFORE UPDATE ON public.job_requisitions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_applications_updated_at  BEFORE UPDATE ON public.applications  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── 14. Analytical Database Views ──────────────────────────
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

-- ── 15. Security Hardening & Row-Level Security (RLS) ───────
ALTER TABLE public.organizations     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_members       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.threads           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_rules      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_audit_log      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.technicians       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outreach_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outreach_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_idempotency_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.failed_webhooks   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_events    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidates        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_requisitions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applications      ENABLE ROW LEVEL SECURITY;

-- organizations Policies
CREATE POLICY "org_members_read_own_org" ON public.organizations FOR SELECT USING (id = public.current_org_id());
CREATE POLICY "owner_update_org" ON public.organizations FOR UPDATE USING (id = public.current_org_id() AND public.has_org_role(id, 'owner'));
CREATE POLICY "organizations_authenticated_insert" ON public.organizations FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- org_members Policies
CREATE POLICY "members_read_own_org" ON public.org_members FOR SELECT USING (org_id = public.current_org_id());
CREATE POLICY "admins_manage_members" ON public.org_members FOR ALL USING (org_id = public.current_org_id() AND (public.has_org_role(org_id, 'owner') OR public.has_org_role(org_id, 'admin')));
CREATE POLICY "org_members_insert_bootstrap" ON public.org_members FOR INSERT WITH CHECK (user_id = auth.uid() AND role = 'owner');

-- contacts Policies
CREATE POLICY "contacts_isolated_to_org" ON public.contacts FOR ALL USING (org_id = public.current_org_id());

-- threads Policies
CREATE POLICY "threads_isolated_to_org" ON public.threads FOR ALL USING (org_id = public.current_org_id());

-- messages Policies
CREATE POLICY "messages_isolated_to_org" ON public.messages FOR ALL USING (org_id = public.current_org_id() AND (thread_id IS NULL OR public.get_org_id_for_thread(thread_id) = public.current_org_id()));

-- pricing_rules Policies
CREATE POLICY "pricing_readable_by_org" ON public.pricing_rules FOR SELECT USING (org_id = public.current_org_id());
CREATE POLICY "pricing_writable_by_admins" ON public.pricing_rules FOR INSERT WITH CHECK (org_id = public.current_org_id() AND (public.has_org_role(org_id, 'owner') OR public.has_org_role(org_id, 'admin')));
CREATE POLICY "pricing_update_by_admins" ON public.pricing_rules FOR UPDATE USING (org_id = public.current_org_id() AND (public.has_org_role(org_id, 'owner') OR public.has_org_role(org_id, 'admin')));

-- ai_audit_log Policies
CREATE POLICY "audit_readable_by_admins" ON public.ai_audit_log FOR SELECT USING (org_id = public.current_org_id() AND (public.has_org_role(org_id, 'owner') OR public.has_org_role(org_id, 'admin')));

-- technicians Policies
CREATE POLICY "technicians_member_select" ON public.technicians FOR SELECT USING (public.is_org_member(org_id));
CREATE POLICY "technicians_member_insert" ON public.technicians FOR INSERT WITH CHECK (public.is_org_member(org_id));
CREATE POLICY "technicians_admin_owner_update" ON public.technicians FOR UPDATE USING (public.has_org_role(org_id, 'owner') OR public.has_org_role(org_id, 'admin'));
CREATE POLICY "technicians_owner_delete" ON public.technicians FOR DELETE USING (public.has_org_role(org_id, 'owner'));

-- jobs Policies
CREATE POLICY "jobs_member_select" ON public.jobs FOR SELECT USING (public.is_org_member(org_id));
CREATE POLICY "jobs_member_insert" ON public.jobs FOR INSERT WITH CHECK (public.is_org_member(org_id));
CREATE POLICY "jobs_admin_owner_update" ON public.jobs FOR UPDATE USING (public.has_org_role(org_id, 'owner') OR public.has_org_role(org_id, 'admin'));
CREATE POLICY "jobs_owner_delete" ON public.jobs FOR DELETE USING (public.has_org_role(org_id, 'owner'));

-- failed_webhooks Policies
CREATE POLICY "failed_webhooks_readable_by_org_admins" ON public.failed_webhooks FOR SELECT USING (org_id = public.current_org_id() AND (public.has_org_role(org_id, 'owner') OR public.has_org_role(org_id, 'admin')));

-- billing_events Policies
CREATE POLICY "billing_readable_by_admins" ON public.billing_events FOR SELECT USING (org_id = public.current_org_id() AND (public.has_org_role(org_id, 'owner') OR public.has_org_role(org_id, 'admin')));

-- candidates Policies
CREATE POLICY "candidates_isolated_to_org" ON public.candidates FOR ALL USING (org_id = public.current_org_id());

-- job_requisitions Policies
CREATE POLICY "jobs_isolated_to_org" ON public.job_requisitions FOR ALL USING (org_id = public.current_org_id());

-- applications Policies
CREATE POLICY "applications_isolated_to_org" ON public.applications FOR ALL USING (org_id = public.current_org_id());

-- API ledgers & outreach are fully restricted to service_role in RLS
CREATE POLICY api_idempotency_denied ON public.api_idempotency_responses FOR ALL USING (false);

-- Grant standard permissions to Supabase roles on all created tables, sequences, and functions
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO postgres, anon, authenticated, service_role;

-- ── 16. Security Column Restrictions ───────────────────────
-- Revoke selecting Jobber credentials and tokens directly from authenticated users (must run via worker / service_role)
REVOKE SELECT (jobber_access_token, jobber_refresh_token, jobber_token_expires_at)
  ON public.organizations FROM authenticated;

-- Hide pricing_rules and deep logs for staffing candidates from non-tenant scopes
REVOKE SELECT ON public.pricing_rules FROM authenticated;

-- ── 17. Database View Security Configuration ────────────────
ALTER VIEW public.v_monthly_job_bookings SET (security_invoker = ON);
ALTER VIEW public.v_llm_cost_by_org SET (security_invoker = ON);
ALTER VIEW public.v_roi_dashboard SET (security_invoker = ON);

-- ── 18. Service Role Grants ─────────────────────────────────
GRANT SELECT ON public.v_monthly_job_bookings TO authenticated;
GRANT SELECT ON public.v_llm_cost_by_org TO authenticated;
GRANT SELECT ON public.v_roi_dashboard TO authenticated;
GRANT SELECT ON public.candidates TO authenticated;
GRANT SELECT ON public.job_requisitions TO authenticated;
GRANT SELECT ON public.applications TO authenticated;

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

-- ── 19. Seed Template pricing rules (Default tenant org template) ──────
-- (Creates a default HVAC category structure for initial lookup test)
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

-- ── 20. Pilot Applications Table (Public Intake) ─────────────
CREATE TABLE IF NOT EXISTS public.pilot_applications (
  id              UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_name   TEXT,
  contact_name    TEXT,
  phone           TEXT,
  software        TEXT,
  weekly_volume   TEXT,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

ALTER TABLE public.pilot_applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_public_insert_pilot" ON public.pilot_applications FOR INSERT WITH CHECK (true);
GRANT ALL ON public.pilot_applications TO postgres, anon, authenticated, service_role;

-- ============================================================
-- END OF CONSOLIDATED MASTER SETUP SQL
-- ============================================================
