-- Add dispatch_mode column to organizations
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS dispatch_mode text DEFAULT 'shadow';

-- Create check_org_limits function to enforce plan limits on technicians
CREATE OR REPLACE FUNCTION public.check_org_limits(p_org_id uuid, p_action text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan text;
  v_tech_count int;
  v_tech_limit int;
BEGIN
  -- Get organization plan
  SELECT plan INTO v_plan FROM public.organizations WHERE id = p_org_id;
  IF v_plan IS NULL THEN
    v_plan := 'starter';
  END IF;

  IF p_action = 'create_technician' THEN
    -- Count active technicians
    SELECT COUNT(*) INTO v_tech_count FROM public.technicians WHERE org_id = p_org_id AND is_active = true;
    
    -- Determine limit
    IF v_plan = 'starter' THEN
      v_tech_limit := 3;
    ELSIF v_plan = 'pro' THEN
      v_tech_limit := 15;
    ELSE
      -- Enterprise or other has no limit
      RETURN;
    END IF;

    -- Check if limit exceeded
    IF v_tech_count >= v_tech_limit THEN
      RAISE EXCEPTION 'Roster quota exceeded for plan %. Limit is %.', v_plan, v_tech_limit;
    END IF;
  END IF;
END;
$$;
