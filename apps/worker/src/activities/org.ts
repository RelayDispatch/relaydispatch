/**
 * backend/workflows/activities/org.ts
 * Organization and technician lookup activities.
 */

import {
  log,
  supabase,
} from './shared.js';

// ============================================================
// ACTIVITY: fetchOrgConfigActivity
// ============================================================

export async function fetchOrgConfigActivity(orgId: string): Promise<{
  id:           string;
  name:         string;
  sb243Footer:  string;
  timezone:     string;
  nylasGrantId: string | null;
  dispatchMode: 'shadow' | 'autonomous';
  plan:         string;
  planTier:     string;
  trialEndsAt:  string | null;
} | null> {
  // @ts-ignore
  const { data, error } = await (supabase
    .from('organizations')
    .select('id, name, sb243_footer, timezone, nylas_grant_id, dispatch_mode, plan, plan_tier, trial_ends_at')
    .eq('id', orgId)
    .eq('is_active', true)
    .single() as any);

  if (error || !data) {
    log.warn({ orgId, error }, 'fetchOrgConfig: not found');
    return null;
  }
  return {
    id:           data.id,
    name:         data.name,
    sb243Footer:  data.sb243_footer ?? '',
    timezone:     data.timezone ?? 'America/Chicago',
    nylasGrantId: data.nylas_grant_id ?? null,
    dispatchMode: data.dispatch_mode ?? (process.env.DISPATCH_MODE === 'shadow' ? 'shadow' : 'autonomous'),
    plan:         data.plan ?? 'starter',
    planTier:     data.plan_tier ?? 'starter',
    trialEndsAt:  data.trial_ends_at ?? null,
  };
}

// ============================================================
// ACTIVITY: fetchAvailableTechniciansActivity
// ============================================================

export async function fetchAvailableTechniciansActivity(orgId: string) {
  const { data: techs, error } = await supabase
    .from('technicians')
    .select('id, name, skills, location_zone')
    .eq('org_id', orgId)
    .eq('is_active', true);

  if (error || !techs) return [];

  return techs.map(t => ({
    id:            t.id,
    name:          t.name,
    skills:        Array.isArray(t.skills) ? (t.skills as string[]) : [],
    location_zone: t.location_zone ?? 'Unknown',
  }));
}

