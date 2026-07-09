-- ── Add updated_at column to organizations to satisfy the set_updated_at trigger ──
ALTER TABLE public.organizations 
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Grant select on updated_at to the authenticated role (since it is a column-level grant setup)
GRANT SELECT (updated_at) ON public.organizations TO authenticated;
