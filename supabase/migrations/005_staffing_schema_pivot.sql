-- ============================================================
-- RelayDispatch — Migration 005
-- Schema Pivot: HVAC → Staffing Platform
-- intake_email_address + candidates + job_requisitions
-- ============================================================
-- This migration:
--   1. Adds intake_email_address to organizations (P0-2 fix)
--   2. Introduces the staffing data model: candidates, job_requisitions
--   3. Renames/aliases threads → applications (additive, non-breaking)
--   4. Adds pgvector extension + embedding columns for semantic matching
--   5. Deprecates pricing_rules (hidden from app users, kept for billing)
-- ============================================================

-- ============================================================
-- SECTION 1: intake_email_address (P0-2 fix dependency)
-- ============================================================
-- Stores the exact email address Nylas watches for this org.
-- The /intake/gmail webhook now does .eq('intake_email_address', emailAddress)
-- instead of the fragile ilike domain heuristic.

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS intake_email_address TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_orgs_intake_email
  ON organizations(intake_email_address)
  WHERE intake_email_address IS NOT NULL;

-- Backfill: if you have existing orgs, set this manually:
-- UPDATE organizations SET intake_email_address = '<your-nylas-email>';

COMMENT ON COLUMN organizations.intake_email_address IS
  'Exact email address monitored by Nylas for this org. Used for precise '
  'webhook routing. Set to the Nylas grant email, not just the domain.';

-- ============================================================
-- SECTION 2: Enable pgvector
-- ============================================================
-- Required for semantic candidate-job matching.
-- Enable in Supabase Dashboard: Database → Extensions → vector
-- Or via SQL:
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================
-- SECTION 3: candidates table
-- ============================================================
-- Core staffing entity. Employer-as-tenant: org_id is the employer.
-- Candidate data is owned by the platform on behalf of the employer.

CREATE TABLE IF NOT EXISTS candidates (
  id                UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id            UUID          NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Identity (redacted at rest — real PII in vault, placeholders here)
  email_placeholder TEXT,         -- e.g. [[EMAIL_1]] — real email in PII vault
  name_placeholder  TEXT,         -- e.g. [[CUSTOMER_1]]

  -- Profile (structured, parsed from resume)
  current_title     TEXT,
  years_experience  SMALLINT,
  skills            TEXT[],       -- normalized skill tags
  location_city     TEXT,
  location_country  TEXT DEFAULT 'US',

  -- Resume
  resume_raw_text   TEXT,         -- plain text (redacted) for LLM context
  resume_storage_path TEXT,       -- S3/GCS path to original file (access controlled)
  resume_parsed_at  TIMESTAMPTZ,

  -- Embedding (pgvector) — candidate skill vector for semantic matching
  -- Populated by the embedding pipeline; model version tracked separately
  skill_embedding   vector(1536), -- OpenAI text-embedding-3-small dimensions
  embedding_model   TEXT,         -- e.g. 'text-embedding-3-small-v1'
  embedded_at       TIMESTAMPTZ,

  -- Deduplication
  dedup_hash        TEXT,         -- SHA-256(normalized_email + name) for fuzzy dedup
  canonical_id      UUID          REFERENCES candidates(id), -- points to master record if duplicate

  -- Status
  status            TEXT          NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active','withdrawn','hired','do_not_contact')),

  -- GDPR/DPDPA compliance
  consent_given_at  TIMESTAMPTZ,  -- when candidate consented to processing
  consent_ip        TEXT,         -- IP at time of consent
  erasure_requested_at TIMESTAMPTZ, -- right-to-erasure request timestamp

  -- Audit
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_candidates_org        ON candidates(org_id);
CREATE INDEX IF NOT EXISTS idx_candidates_status     ON candidates(org_id, status);
CREATE INDEX IF NOT EXISTS idx_candidates_dedup      ON candidates(dedup_hash) WHERE dedup_hash IS NOT NULL;
-- HNSW index for vector similarity search (tune m/ef_construction at >10k rows)
CREATE INDEX IF NOT EXISTS idx_candidates_embedding
  ON candidates USING hnsw (skill_embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "candidates_isolated_to_org" ON candidates
  FOR ALL
  USING (org_id = current_org_id());

-- ============================================================
-- SECTION 4: job_requisitions table
-- ============================================================
-- Employer-posted job requirements. Source of truth for JD parsing.
-- Deterministic — LLMs cannot invent requirements.

CREATE TABLE IF NOT EXISTS job_requisitions (
  id                UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id            UUID          NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Job details
  title             TEXT          NOT NULL,
  department        TEXT,
  location_city     TEXT,
  location_country  TEXT DEFAULT 'US',
  remote_policy     TEXT          CHECK (remote_policy IN ('onsite','hybrid','remote','flexible')),

  -- Requirements (structured — parsed from JD by LLM, then human-verified)
  required_skills   TEXT[],
  preferred_skills  TEXT[],
  min_years_exp     SMALLINT,
  max_years_exp     SMALLINT,

  -- Raw JD text for LLM context
  jd_raw_text       TEXT,

  -- Embedding for semantic matching against candidate pool
  jd_embedding      vector(1536),
  embedding_model   TEXT,
  embedded_at       TIMESTAMPTZ,

  -- Status
  status            TEXT          NOT NULL DEFAULT 'open'
                    CHECK (status IN ('draft','open','paused','closed','filled')),

  -- Audit
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_jobs_org_status ON job_requisitions(org_id, status);
CREATE INDEX IF NOT EXISTS idx_jobs_embedding
  ON job_requisitions USING hnsw (jd_embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

ALTER TABLE job_requisitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "jobs_isolated_to_org" ON job_requisitions
  FOR ALL
  USING (org_id = current_org_id());

-- ============================================================
-- SECTION 5: applications table (threads → staffing pivot)
-- ============================================================
-- Additive rename: threads stays intact for HVAC backward compat.
-- applications is the staffing equivalent — a candidate-job linkage.

CREATE TABLE IF NOT EXISTS applications (
  id                UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id            UUID          NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  candidate_id      UUID          NOT NULL REFERENCES candidates(id),
  job_req_id        UUID          NOT NULL REFERENCES job_requisitions(id),

  -- Link to the intake thread (email/upload workflow)
  thread_id         UUID          REFERENCES threads(id),

  -- AI match scores
  fit_score         NUMERIC(4,3)  CHECK (fit_score BETWEEN 0 AND 1),
  fit_summary       TEXT,         -- LLM-generated qualitative summary (auditable)
  fit_scored_at     TIMESTAMPTZ,
  fit_model         TEXT,         -- model used for scoring

  -- Human review
  status            TEXT          NOT NULL DEFAULT 'new'
                    CHECK (status IN ('new','ai_screened','human_review','interview','offer','rejected','withdrawn')),
  assigned_recruiter_id UUID,

  -- Audit trail (EU AI Act Art. 6 — high-risk AI in hiring)
  ai_rejection_reason TEXT,       -- if AI auto-rejected, reason must be logged
  human_override    BOOLEAN       NOT NULL DEFAULT FALSE,

  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_apps_org_status    ON applications(org_id, status);
CREATE INDEX IF NOT EXISTS idx_apps_candidate     ON applications(candidate_id);
CREATE INDEX IF NOT EXISTS idx_apps_job           ON applications(job_req_id);

ALTER TABLE applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "applications_isolated_to_org" ON applications
  FOR ALL
  USING (org_id = current_org_id());

-- ============================================================
-- SECTION 6: Deprecate pricing_rules from app users
-- ============================================================
-- pricing_rules is HVAC-domain. Hide from authenticated app users.
-- service_role (Temporal workers) retains full access.
-- Keep the table — billing_events still references it.

REVOKE SELECT ON pricing_rules FROM authenticated;

COMMENT ON TABLE pricing_rules IS
  'DEPRECATED for staffing pivot. Access restricted to service_role. '
  'Retained for HVAC billing_events backward compat. '
  'Replace with job_requisitions for staffing rate cards.';

-- ============================================================
-- SECTION 7: updated_at triggers for new tables
-- ============================================================

CREATE TRIGGER trg_candidates_updated_at
  BEFORE UPDATE ON candidates
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_job_reqs_updated_at
  BEFORE UPDATE ON job_requisitions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_applications_updated_at
  BEFORE UPDATE ON applications
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- SECTION 8: grants
-- ============================================================

GRANT ALL ON candidates        TO service_role;
GRANT ALL ON job_requisitions  TO service_role;
GRANT ALL ON applications      TO service_role;
GRANT SELECT ON candidates        TO authenticated;
GRANT SELECT ON job_requisitions  TO authenticated;
GRANT SELECT ON applications      TO authenticated;

-- ============================================================
-- END OF MIGRATION 005
-- Next: 006_embedding_pipeline.sql (resume upload + embed job)
-- ============================================================
