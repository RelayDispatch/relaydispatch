-- Migration: Restore table-level permissions for authenticated role on core dashboard tables

GRANT SELECT, INSERT, UPDATE, DELETE ON public.threads TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.jobs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.technicians TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contacts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO authenticated;
GRANT SELECT ON public.org_members TO authenticated;
GRANT SELECT ON public.call_logs TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.pricing_rules TO authenticated;
GRANT SELECT ON public.ai_audit_log TO authenticated;
GRANT SELECT ON public.failed_webhooks TO authenticated;
GRANT SELECT ON public.billing_events TO authenticated;
