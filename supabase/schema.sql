-- ============================================================
-- Ethan — AI Service Coordinator | RelayDispatch
-- Multi-Tenant Schema  •  Supabase / PostgreSQL
-- Compliance: NIST RMF, TRAIGA (Texas), SB 243
-- ============================================================
-- DESIGN PRINCIPLES:
--   1. Every data row is scoped to an org_id (multi-tenant isolation).
--   2. RLS is ENABLED on every table — no policy = no access.
--   3. Prices ALWAYS come from pricing_rules — never LLM-generated.
--   4. auth.uid() is wrapped in a helper to avoid repeated subqueries.
-- ============================================================

-- ── Extensions ──────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";        -- fuzzy search on subject lines

-- ============================================================
-- SECTION 1: ORGANIZATION MANAGEMENT (Tenant Root)
-- ============================================================

CREATE TABLE IF NOT EXISTS organizations (
  id                  UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  name                TEXT          NOT NULL,
  slug                TEXT          NOT NULL UNIQUE,           -- e.g. "arctic-air-hvac"
  plan_tier           TEXT          NOT NULL DEFAULT 'starter' -- 'starter' | 'pro' | 'enterprise'
                      CHECK (plan_tier IN ('starter', 'pro', 'enterprise')),
  jobber_account_id   TEXT          UNIQUE,                    -- Jobber CRM tenant ID
  nylas_grant_id      TEXT,                                    -- Gmail/Nylas OAuth grant
  twilio_number       TEXT,                                    -- Assigned Twilio phone
  timezone            TEXT          NOT NULL DEFAULT 'America/Chicago',
  sb243_footer        TEXT          NOT NULL DEFAULT
    'Ethan is an AI Service Coordinator — Powered by RelayDispatch',
  is_active           BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ── Org Members (maps Supabase auth.users to orgs) ──────────
CREATE TABLE IF NOT EXISTS org_members (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id      UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id     UUID        NOT NULL REFERENCES auth.users(id)    ON DELETE CASCADE,
  role        TEXT        NOT NULL DEFAULT 'dispatcher'
              CHECK (role IN ('owner', 'admin', 'dispatcher', 'technician', 'readonly')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, user_id)
);

-- ── RLS helper: resolves caller's org_id once per transaction ──
-- Caches result in a session-local GUC to avoid repeated auth.uid() calls.
CREATE OR REPLACE FUNCTION current_org_id()
RETURNS UUID
LANGUAGE sql
STABLE SECURITY DEFINER
AS $$
  SELECT org_id
  FROM   org_members
  WHERE  user_id = auth.uid()
  LIMIT  1;
$$;

-- ============================================================
-- SECTION 2: CUSTOMER CONTACTS
-- ============================================================

CREATE TABLE IF NOT EXISTS contacts (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  -- Identity
  first_name      TEXT,
  last_name       TEXT,
  email           TEXT,
  phone           TEXT,
  -- Address
  street          TEXT,
  city            TEXT,
  state           CHAR(2),
  zip             TEXT,
  -- CRM refs
  jobber_client_id TEXT,
  -- Metadata
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, email)
);

-- ============================================================
-- SECTION 3: CONVERSATION THREADS
-- A "Thread" maps 1:1 to a customer service request lifecycle.
-- It persists across multiple email/SMS turns.
-- ============================================================

CREATE TYPE thread_channel  AS ENUM ('email', 'sms', 'web_form', 'phone');
CREATE TYPE thread_status   AS ENUM (
  'new',
  'triaged',
  'quoted',
  'scheduled',
  'in_progress',
  'completed',
  'escalated',
  'closed'
);
CREATE TYPE thread_priority AS ENUM ('low', 'normal', 'urgent', 'emergency');

CREATE TABLE IF NOT EXISTS threads (
  id                  UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id              UUID            NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  contact_id          UUID            REFERENCES contacts(id),
  -- Source
  channel             thread_channel  NOT NULL DEFAULT 'email',
  external_thread_id  TEXT,                    -- e.g. Gmail thread ID
  subject             TEXT,
  -- State machine
  status              thread_status   NOT NULL DEFAULT 'new',
  priority            thread_priority NOT NULL DEFAULT 'normal',
  -- AI classification results (written by Classifier agent)
  service_category    TEXT,                    -- e.g. 'AC_REPAIR', 'FURNACE_INSTALL'
  urgency_score       SMALLINT        CHECK (urgency_score BETWEEN 0 AND 100),
  sentiment_score     SMALLINT        CHECK (sentiment_score BETWEEN -100 AND 100),
  -- Workflow tracking
  temporal_workflow_id TEXT           UNIQUE,  -- Temporal.io run ID
  temporal_run_id      TEXT,
  -- Jobber CRM
  jobber_quote_id     TEXT,
  jobber_job_id       TEXT,
  -- Audit
  assigned_to         UUID            REFERENCES auth.users(id),
  escalation_reason   TEXT,
  created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_threads_org_status   ON threads(org_id, status);
CREATE INDEX idx_threads_org_channel  ON threads(org_id, channel);
CREATE INDEX idx_threads_temporal     ON threads(temporal_workflow_id);
CREATE INDEX idx_threads_contact      ON threads(contact_id);

-- ============================================================
-- SECTION 4: MESSAGES (Individual turns in a thread)
-- ============================================================

CREATE TYPE message_role       AS ENUM ('customer', 'ethan_ai', 'human_agent', 'system');
CREATE TYPE message_direction  AS ENUM ('inbound', 'outbound');

CREATE TABLE IF NOT EXISTS messages (
  id                  UUID              PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id              UUID              NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  thread_id           UUID              NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  -- Content
  role                message_role      NOT NULL,
  direction           message_direction NOT NULL,
  body_text           TEXT              NOT NULL,
  body_html           TEXT,
  -- Routing metadata
  from_address        TEXT,
  to_address          TEXT,
  external_message_id TEXT,             -- Gmail message ID, Twilio SID, etc.
  -- AI provenance (SB 243 / NIST audit trail)
  ai_model_used       TEXT,             -- e.g. 'claude-opus-4-6', 'gemini-flash-lite'
  ai_prompt_tokens    INTEGER,
  ai_completion_tokens INTEGER,
  ai_latency_ms       INTEGER,
  -- Compliance: was the SB 243 footer injected?
  sb243_footer_applied BOOLEAN         NOT NULL DEFAULT FALSE,
  -- Delivery status
  delivered_at        TIMESTAMPTZ,
  read_at             TIMESTAMPTZ,
  -- Audit
  created_at          TIMESTAMPTZ       NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_messages_thread   ON messages(thread_id, created_at DESC);
CREATE INDEX idx_messages_org      ON messages(org_id, created_at DESC);
CREATE INDEX idx_messages_external ON messages(external_message_id);

-- ============================================================
-- SECTION 5: PRICING RULES (Source of Truth — No LLM Pricing)
-- ============================================================
-- CRITICAL: The Dispatcher agent MUST query this table.
-- Hallucinating a price is a compliance violation.
-- ============================================================

CREATE TYPE pricing_type AS ENUM ('flat', 'per_unit', 'hourly', 'diagnostic');

CREATE TABLE IF NOT EXISTS pricing_rules (
  id              UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          UUID          NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  -- Service identification
  service_code    TEXT          NOT NULL,           -- e.g. 'AC_DIAGNOSTIC', 'FILTER_REPLACE'
  service_label   TEXT          NOT NULL,           -- Human-readable label
  category        TEXT          NOT NULL,           -- 'COOLING' | 'HEATING' | 'MAINTENANCE'
  -- Pricing
  pricing_type    pricing_type  NOT NULL DEFAULT 'flat',
  base_price_usd  NUMERIC(10,2) NOT NULL CHECK (base_price_usd >= 0),
  min_price_usd   NUMERIC(10,2) CHECK (min_price_usd >= 0),
  max_price_usd   NUMERIC(10,2) CHECK (max_price_usd >= 0),
  unit_label      TEXT,                             -- e.g. 'per hour', 'per unit'
  -- Conditions
  is_active       BOOLEAN       NOT NULL DEFAULT TRUE,
  effective_from  DATE          NOT NULL DEFAULT CURRENT_DATE,
  effective_until DATE,
  -- Audit
  created_by      UUID          REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, service_code)
);

CREATE INDEX idx_pricing_org_category ON pricing_rules(org_id, category);
CREATE INDEX idx_pricing_org_active   ON pricing_rules(org_id, is_active, effective_from);

-- ── Seed: Default HVAC pricing (org_id = NULL = global defaults) ──
-- Real orgs override via their own rows.
INSERT INTO pricing_rules (org_id, service_code, service_label, category, pricing_type, base_price_usd, min_price_usd, max_price_usd, unit_label)
VALUES
  -- placeholder org_id; replace with real org UUIDs in seeding scripts
  -- These serve as template rows only
  ('00000000-0000-0000-0000-000000000001', 'AC_DIAGNOSTIC',      'AC System Diagnostic',           'COOLING',     'diagnostic', 89.00,  75.00,  149.00, NULL),
  ('00000000-0000-0000-0000-000000000001', 'AC_REFRIGERANT_ADD', 'Refrigerant Recharge (per lb)',  'COOLING',     'per_unit',   75.00,  65.00,  95.00,  'per lb'),
  ('00000000-0000-0000-0000-000000000001', 'AC_CAPACITOR',       'Capacitor Replacement',          'COOLING',     'flat',       175.00, 150.00, 225.00, NULL),
  ('00000000-0000-0000-0000-000000000001', 'FURNACE_DIAGNOSTIC', 'Furnace Diagnostic',             'HEATING',     'diagnostic', 89.00,  75.00,  149.00, NULL),
  ('00000000-0000-0000-0000-000000000001', 'FILTER_1IN',         'Filter Replacement (1 inch)',    'MAINTENANCE', 'flat',       25.00,  20.00,  35.00,  NULL),
  ('00000000-0000-0000-0000-000000000001', 'FILTER_4IN',         'Filter Replacement (4 inch)',    'MAINTENANCE', 'flat',       45.00,  35.00,  55.00,  NULL),
  ('00000000-0000-0000-0000-000000000001', 'MAINTENANCE_ANNUAL', 'Annual Maintenance Agreement',   'MAINTENANCE', 'flat',       199.00, 179.00, 249.00, NULL),
  ('00000000-0000-0000-0000-000000000001', 'LABOR_HOURLY',       'Labor (Hourly Rate)',            'HEATING',     'hourly',     125.00, 110.00, 150.00, 'per hour')
ON CONFLICT (org_id, service_code) DO NOTHING;

-- ============================================================
-- SECTION 6: AI AUDIT LOG (NIST RMF / TRAIGA Compliance)
-- ============================================================

CREATE TABLE IF NOT EXISTS ai_audit_log (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  thread_id       UUID        REFERENCES threads(id),
  message_id      UUID        REFERENCES messages(id),
  -- What happened
  agent_name      TEXT        NOT NULL,   -- 'classifier' | 'dispatcher' | 'scribe' | 'librarian'
  action          TEXT        NOT NULL,   -- 'classify' | 'draft_reply' | 'fetch_price' | 'escalate'
  -- Model provenance
  model_id        TEXT        NOT NULL,
  prompt_summary  TEXT,                   -- Truncated, never full PII
  decision_made   TEXT,
  confidence      NUMERIC(4,3) CHECK (confidence BETWEEN 0 AND 1),
  -- Safety flags
  hallucination_risk_flagged  BOOLEAN NOT NULL DEFAULT FALSE,
  price_sourced_from_db       BOOLEAN,    -- NULL if no price involved
  sb243_disclosure_present    BOOLEAN NOT NULL DEFAULT FALSE,
  -- Timing
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_org_agent  ON ai_audit_log(org_id, agent_name, created_at DESC);
CREATE INDEX idx_audit_thread     ON ai_audit_log(thread_id);

-- ============================================================
-- SECTION 7: ROW-LEVEL SECURITY POLICIES
-- ============================================================
-- Pattern: USING (org_id = current_org_id())
-- The helper function current_org_id() is STABLE + SECURITY DEFINER,
-- so it executes once per query plan, not per row — critical for perf.
-- ============================================================

-- ── organizations ───────────────────────────────────────────
ALTER TABLE organizations     ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_members_read_own_org" ON organizations
  FOR SELECT
  USING (id = current_org_id());

CREATE POLICY "owner_update_org" ON organizations
  FOR UPDATE
  USING (
    id = current_org_id()
    AND EXISTS (
      SELECT 1 FROM org_members
      WHERE org_id = organizations.id
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
  );

-- ── org_members ──────────────────────────────────────────────
ALTER TABLE org_members       ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members_read_own_org" ON org_members
  FOR SELECT
  USING (org_id = current_org_id());

CREATE POLICY "admins_manage_members" ON org_members
  FOR ALL
  USING (
    org_id = current_org_id()
    AND EXISTS (
      SELECT 1 FROM org_members om
      WHERE om.org_id = org_members.org_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
  );

-- ── contacts ─────────────────────────────────────────────────
ALTER TABLE contacts          ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contacts_isolated_to_org" ON contacts
  FOR ALL
  USING (org_id = current_org_id());

-- ── threads ──────────────────────────────────────────────────
ALTER TABLE threads            ENABLE ROW LEVEL SECURITY;

CREATE POLICY "threads_isolated_to_org" ON threads
  FOR ALL
  USING (org_id = current_org_id());

-- ── messages ─────────────────────────────────────────────────
ALTER TABLE messages           ENABLE ROW LEVEL SECURITY;

CREATE POLICY "messages_isolated_to_org" ON messages
  FOR ALL
  USING (org_id = current_org_id());

-- ── pricing_rules ─────────────────────────────────────────────
ALTER TABLE pricing_rules      ENABLE ROW LEVEL SECURITY;

-- All authenticated org members can READ prices
CREATE POLICY "pricing_readable_by_org" ON pricing_rules
  FOR SELECT
  USING (org_id = current_org_id());

-- Only admins/owners can modify pricing
CREATE POLICY "pricing_writable_by_admins" ON pricing_rules
  FOR INSERT
  WITH CHECK (
    org_id = current_org_id()
    AND EXISTS (
      SELECT 1 FROM org_members
      WHERE org_id = pricing_rules.org_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "pricing_update_by_admins" ON pricing_rules
  FOR UPDATE
  USING (
    org_id = current_org_id()
    AND EXISTS (
      SELECT 1 FROM org_members
      WHERE org_id = pricing_rules.org_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
  );

-- ── ai_audit_log ─────────────────────────────────────────────
ALTER TABLE ai_audit_log       ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_readable_by_admins" ON ai_audit_log
  FOR SELECT
  USING (
    org_id = current_org_id()
    AND EXISTS (
      SELECT 1 FROM org_members
      WHERE org_id = ai_audit_log.org_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
  );

-- Service role (used by Temporal workers / server-side) bypasses RLS.
-- GRANT is managed in Supabase dashboard under service_role key.

-- ============================================================
-- SECTION 8: UPDATED_AT TRIGGERS
-- ============================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_contacts_updated_at
  BEFORE UPDATE ON contacts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_threads_updated_at
  BEFORE UPDATE ON threads
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_pricing_rules_updated_at
  BEFORE UPDATE ON pricing_rules
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- END OF SCHEMA
-- Next migration: 002_jobber_sync_tables.sql
-- ============================================================
