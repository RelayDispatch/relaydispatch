-- Restore SELECT permissions on pricing_rules for authenticated users
-- RLS remains enabled, preserving organization-level tenant isolation.
GRANT SELECT ON public.pricing_rules TO authenticated;
