-- ==============================================================================
-- RELAYDISPATCH — COMPLETE FRESH START SCHEMA
-- Run this entire script in the Supabase Dashboard SQL Editor to reset your DB.
-- WARNING: THIS DELETES ALL EXISTING DATA AND TABLES IN THE PUBLIC SCHEMA.
-- ==============================================================================

DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres, anon, authenticated, service_role;

-- 1. EXTENSIONS & TYPES
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE public.org_role AS ENUM ('owner', 'admin', 'dispatcher');
CREATE TYPE public.job_status AS ENUM ('new', 'triaged', 'ready_for_dispatch', 'scheduled', 'assigned', 'in_progress', 'completed', 'cancelled');
CREATE TYPE public.thread_channel AS ENUM ('email', 'sms', 'web');
CREATE TYPE public.thread_status AS ENUM ('new', 'open', 'closed');
CREATE TYPE public.thread_priority AS ENUM ('low', 'normal', 'high', 'urgent');
CREATE TYPE public.message_role AS ENUM ('customer', 'agent', 'system');
CREATE TYPE public.message_direction AS ENUM ('inbound', 'outbound');

-- 2. ORGANIZATIONS & MEMBERS
CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  plan TEXT DEFAULT 'starter',
  is_active BOOLEAN DEFAULT true,
  timezone TEXT DEFAULT 'America/Los_Angeles',
  sb243_footer TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.org_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.org_role NOT NULL DEFAULT 'dispatcher',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, user_id)
);

-- 3. CORE COMMUNICATION (Contacts, Threads, Messages)
CREATE TABLE public.contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, email)
);

CREATE TABLE public.threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  channel public.thread_channel NOT NULL DEFAULT 'email',
  external_thread_id TEXT,
  subject TEXT,
  status public.thread_status NOT NULL DEFAULT 'new',
  priority public.thread_priority NOT NULL DEFAULT 'normal',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  thread_id UUID NOT NULL REFERENCES public.threads(id) ON DELETE CASCADE,
  role public.message_role NOT NULL,
  direction public.message_direction NOT NULL,
  body_text TEXT,
  body_html TEXT,
  from_address TEXT,
  external_message_id TEXT,
  sb243_footer_applied BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. DISPATCH (Technicians, Jobs)
CREATE TABLE public.technicians (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  skills TEXT[] NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  thread_id UUID NOT NULL REFERENCES public.threads(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  service_type TEXT NOT NULL,
  status public.job_status NOT NULL DEFAULT 'new',
  scheduled_at TIMESTAMPTZ,
  assigned_to UUID REFERENCES public.technicians(id) ON DELETE SET NULL,
  notes TEXT,
  external_id TEXT,
  external_provider TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. OUTREACH AUTOMATION
CREATE TABLE public.outreach_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','replied','followup','trial','closed')),
  last_message TEXT,
  last_contacted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.outreach_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES public.outreach_contacts(id) ON DELETE CASCADE,
  direction TEXT NOT NULL CHECK (direction IN ('outbound','inbound')),
  provider_message_id TEXT,
  subject TEXT,
  content TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. API IDEMPOTENCY LEDGER
CREATE TABLE public.api_idempotency_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  resource_id UUID NOT NULL,
  http_status INT NOT NULL,
  response_body JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, endpoint, resource_id, idempotency_key)
);

-- 7. INDEXES
CREATE INDEX idx_org_members_user_id ON public.org_members(user_id);
CREATE INDEX idx_org_members_org_role ON public.org_members(org_id, role);
CREATE INDEX idx_threads_org_created ON public.threads(org_id, created_at DESC);
CREATE INDEX idx_contacts_email ON public.contacts(email);
CREATE INDEX idx_jobs_org_id ON public.jobs(org_id);
CREATE INDEX idx_jobs_thread_id ON public.jobs(thread_id);
CREATE INDEX idx_jobs_status ON public.jobs(status);
CREATE INDEX idx_jobs_assigned_to ON public.jobs(assigned_to) WHERE assigned_to IS NOT NULL;
CREATE INDEX idx_technicians_org ON public.technicians(org_id) WHERE is_active = TRUE;
CREATE INDEX idx_api_idem_org_endpoint_resource ON public.api_idempotency_responses(org_id, endpoint, resource_id);
CREATE INDEX idx_api_idem_created_at ON public.api_idempotency_responses(created_at);

-- 8. HELPER FUNCTIONS
CREATE OR REPLACE FUNCTION public.is_org_member(p_org_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.org_members om WHERE om.org_id = p_org_id AND om.user_id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.has_org_role(p_org_id uuid, p_role public.org_role) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.org_members om WHERE om.org_id = p_org_id AND om.user_id = auth.uid() AND om.role = p_role);
$$;

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER jobs_updated_at BEFORE UPDATE ON public.jobs FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER threads_updated_at BEFORE UPDATE ON public.threads FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 9. ROW LEVEL SECURITY (RLS)
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.technicians ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_idempotency_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY organizations_member_select ON public.organizations FOR SELECT USING (public.is_org_member(id));
CREATE POLICY organizations_authenticated_insert ON public.organizations FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY organizations_owner_admin_update ON public.organizations FOR UPDATE USING (public.has_org_role(id, 'owner'::public.org_role) OR public.has_org_role(id, 'admin'::public.org_role));
CREATE POLICY organizations_owner_delete ON public.organizations FOR DELETE USING (public.has_org_role(id, 'owner'::public.org_role));

CREATE POLICY org_members_read_member_org ON public.org_members FOR SELECT USING (public.is_org_member(org_id));
CREATE POLICY org_members_insert_bootstrap ON public.org_members FOR INSERT WITH CHECK ((user_id = auth.uid() AND role = 'owner'::public.org_role) OR public.has_org_role(org_id, 'owner'::public.org_role) OR public.has_org_role(org_id, 'admin'::public.org_role));
CREATE POLICY org_members_update_owner_admin ON public.org_members FOR UPDATE USING (public.has_org_role(org_id, 'owner'::public.org_role) OR public.has_org_role(org_id, 'admin'::public.org_role));
CREATE POLICY org_members_delete_owner_only ON public.org_members FOR DELETE USING (public.has_org_role(org_id, 'owner'::public.org_role));

CREATE POLICY jobs_member_select ON public.jobs FOR SELECT USING (public.is_org_member(org_id));
CREATE POLICY jobs_member_insert ON public.jobs FOR INSERT WITH CHECK (public.is_org_member(org_id));
CREATE POLICY jobs_admin_owner_update ON public.jobs FOR UPDATE USING (public.has_org_role(org_id, 'owner'::public.org_role) OR public.has_org_role(org_id, 'admin'::public.org_role));
CREATE POLICY jobs_owner_delete ON public.jobs FOR DELETE USING (public.has_org_role(org_id, 'owner'::public.org_role));

CREATE POLICY technicians_member_select ON public.technicians FOR SELECT USING (public.is_org_member(org_id));
CREATE POLICY technicians_member_insert ON public.technicians FOR INSERT WITH CHECK (public.is_org_member(org_id));
CREATE POLICY technicians_admin_owner_update ON public.technicians FOR UPDATE USING (public.has_org_role(org_id, 'owner'::public.org_role) OR public.has_org_role(org_id, 'admin'::public.org_role));
CREATE POLICY technicians_owner_delete ON public.technicians FOR DELETE USING (public.has_org_role(org_id, 'owner'::public.org_role));

CREATE POLICY threads_member_select ON public.threads FOR SELECT USING (public.is_org_member(org_id));
CREATE POLICY threads_member_insert ON public.threads FOR INSERT WITH CHECK (public.is_org_member(org_id));
CREATE POLICY threads_admin_owner_update ON public.threads FOR UPDATE USING (public.has_org_role(org_id, 'owner'::public.org_role) OR public.has_org_role(org_id, 'admin'::public.org_role));

CREATE POLICY messages_member_select ON public.messages FOR SELECT USING (public.is_org_member(org_id));
CREATE POLICY messages_member_insert ON public.messages FOR INSERT WITH CHECK (public.is_org_member(org_id));

CREATE POLICY contacts_member_select ON public.contacts FOR SELECT USING (public.is_org_member(org_id));
CREATE POLICY contacts_member_insert ON public.contacts FOR INSERT WITH CHECK (public.is_org_member(org_id));
CREATE POLICY contacts_admin_owner_update ON public.contacts FOR UPDATE USING (public.has_org_role(org_id, 'owner'::public.org_role) OR public.has_org_role(org_id, 'admin'::public.org_role));

CREATE POLICY api_idempotency_denied ON public.api_idempotency_responses FOR ALL USING (false);
