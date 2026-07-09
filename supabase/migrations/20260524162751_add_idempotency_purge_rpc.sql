-- ============================================================
-- Migration: Idempotency purge RPC + shadow status tracking
-- ============================================================

-- ── IDEMPOTENCY PURGE RPC ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.api_purge_expired_idempotency_keys(ttl_hours integer DEFAULT 24)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM public.api_idempotency_responses
  WHERE created_at < NOW() - (ttl_hours || ' hours')::interval;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.api_purge_expired_idempotency_keys(integer) TO service_role;

-- ── SHADOW STATUS TRACKING (real data, not hardcoded) ───────
-- Track AI dispatch decisions for shadow mode evaluation
CREATE TABLE IF NOT EXISTS public.ai_dispatch_log (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  job_id        uuid        REFERENCES public.jobs(id) ON DELETE SET NULL,
  thread_id     uuid        REFERENCES public.threads(id) ON DELETE SET NULL,
  decision      text        NOT NULL CHECK (decision IN ('auto_dispatched','escalated','rejected','pending_human')),
  was_correct   boolean,  -- Set retroactively if human validates
  ai_confidence numeric(4,3),
  model_used    text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_dispatch_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_members_select_ai_dispatch_log"
  ON public.ai_dispatch_log FOR SELECT
  USING (org_id IN (
    SELECT org_id FROM public.org_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "service_role_all_ai_dispatch_log"
  ON public.ai_dispatch_log FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_ai_dispatch_log_org_id     ON public.ai_dispatch_log(org_id);
CREATE INDEX IF NOT EXISTS idx_ai_dispatch_log_created_at ON public.ai_dispatch_log(created_at DESC);

-- ── Real shadow status function ──────────────────────────────
CREATE OR REPLACE FUNCTION public.get_org_shadow_status(p_org_id uuid, p_window_hours integer DEFAULT 48)
RETURNS TABLE (
  clean_run_hours       numeric,
  total_required_hours  integer,
  auto_dispatch_count   integer,
  escalation_count      integer,
  success_rate          numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_last_escalation  timestamptz;
  v_clean_run_hours  numeric;
  v_auto_count       integer;
  v_escalation_count integer;
BEGIN
  -- Find last escalation time
  SELECT MAX(created_at) INTO v_last_escalation
  FROM public.ai_dispatch_log
  WHERE org_id = p_org_id AND decision = 'escalated';

  -- Calculate clean run hours
  IF v_last_escalation IS NULL THEN
    -- No escalations ever — use org creation time
    SELECT EXTRACT(EPOCH FROM (NOW() - o.created_at)) / 3600
    INTO v_clean_run_hours
    FROM public.organizations o WHERE o.id = p_org_id;
  ELSE
    v_clean_run_hours := EXTRACT(EPOCH FROM (NOW() - v_last_escalation)) / 3600;
  END IF;

  -- Count recent decisions
  SELECT
    COUNT(*) FILTER (WHERE decision = 'auto_dispatched'),
    COUNT(*) FILTER (WHERE decision = 'escalated')
  INTO v_auto_count, v_escalation_count
  FROM public.ai_dispatch_log
  WHERE org_id = p_org_id
    AND created_at >= NOW() - (p_window_hours || ' hours')::interval;

  RETURN QUERY SELECT
    ROUND(COALESCE(v_clean_run_hours, 0), 1),
    p_window_hours,
    COALESCE(v_auto_count, 0),
    COALESCE(v_escalation_count, 0),
    CASE
      WHEN COALESCE(v_auto_count, 0) + COALESCE(v_escalation_count, 0) = 0 THEN 1.0
      ELSE ROUND(v_auto_count::numeric / NULLIF(v_auto_count + v_escalation_count, 0), 3)
    END;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_org_shadow_status(uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_org_shadow_status(uuid, integer) TO authenticated;

-- ── Idempotency ledger purge of completed_activity_keys ─────
CREATE OR REPLACE FUNCTION public.purge_completed_activity_keys(ttl_hours integer DEFAULT 72)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM public.completed_activity_keys
  WHERE created_at < NOW() - (ttl_hours || ' hours')::interval;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.purge_completed_activity_keys(integer) TO service_role;
