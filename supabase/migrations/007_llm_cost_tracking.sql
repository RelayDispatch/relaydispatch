-- ============================================================
-- RelayDispatch — Migration 007
-- Per-Org LLM Cost Tracking
-- ─────────────────────────────────────────────────────────────
-- Adds token + cost columns to ai_audit_log so per-org LLM
-- spend is queryable from the DB without requiring OTEL/Grafana.
-- Creates a per-org monthly cost view for the dashboard.
-- ============================================================

-- ============================================================
-- SECTION 1: Add cost/token columns to ai_audit_log
-- ============================================================

ALTER TABLE ai_audit_log
  ADD COLUMN IF NOT EXISTS prompt_tokens       INTEGER,
  ADD COLUMN IF NOT EXISTS completion_tokens   INTEGER,
  ADD COLUMN IF NOT EXISTS openrouter_cost_usd NUMERIC(10,6),
  ADD COLUMN IF NOT EXISTS latency_ms          INTEGER;

COMMENT ON COLUMN ai_audit_log.prompt_tokens       IS 'Input token count from OpenRouter usage object';
COMMENT ON COLUMN ai_audit_log.completion_tokens   IS 'Output token count from OpenRouter usage object';
COMMENT ON COLUMN ai_audit_log.openrouter_cost_usd IS 'Actual inference cost in USD from x-openrouter-cost header';
COMMENT ON COLUMN ai_audit_log.latency_ms          IS 'Wall-clock latency from request start to response received';

-- ============================================================
-- SECTION 2: Composite index for per-org cost queries
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_ai_audit_org_created
  ON ai_audit_log(org_id, created_at);

-- ============================================================
-- SECTION 3: Per-org LLM spend view
-- ============================================================
-- Queryable from the dashboard without OTEL.
-- Groups by org, month, and model for granular cost attribution.

CREATE OR REPLACE VIEW v_llm_cost_by_org AS
SELECT
  org_id,
  date_trunc('month', created_at)          AS month,
  COUNT(*)                                 AS total_llm_calls,
  SUM(prompt_tokens)                       AS total_prompt_tokens,
  SUM(completion_tokens)                   AS total_completion_tokens,
  SUM(openrouter_cost_usd)                 AS total_cost_usd,
  AVG(latency_ms)                          AS avg_latency_ms,
  model_id
FROM ai_audit_log
GROUP BY org_id, date_trunc('month', created_at), model_id;

-- security_invoker: view runs as the calling user, so RLS on
-- ai_audit_log is enforced — orgs can only see their own rows.
ALTER VIEW v_llm_cost_by_org SET (security_invoker = ON);

GRANT SELECT ON v_llm_cost_by_org TO authenticated;

-- ============================================================
-- END OF MIGRATION 007
-- ============================================================
