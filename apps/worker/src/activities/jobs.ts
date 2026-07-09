/**
 * backend/workflows/activities/jobs.ts
 * Job lifecycle activities: dispatch, create, and direct intake.
 */

import {
  log,
  supabase,
} from './shared.js';

// ============================================================
// TYPES
// ============================================================

export interface CreateJobResult {
  jobId:            string;
  externalId:       string | null;
  externalProvider: string | null;
}

// ============================================================
// ACTIVITY: fetchAvailableTechniciansActivity
// (Also in org.ts — kept here as a jobs concern)
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

// ============================================================
// ACTIVITY: dispatchJobActivity
// ============================================================

export async function dispatchJobActivity(params: {
  jobId:         string;
  technicianId:  string;
  scheduledAt:   string;
}) {
  const { data, error } = await (supabase as any).rpc('api_dispatch_job_atomic', {
    p_job_id:             params.jobId,
    p_technician_id:      params.technicianId,
    p_scheduled_at:       params.scheduledAt,
    p_expected_open_jobs: null,
    p_idempotency_key:    `dispatch-${params.jobId}-${Date.now()}`,
  });

  if (error) {
    throw new Error(`Failed to dispatch job ${params.jobId}: ${error.message}`);
  }

  const envelope = data as any;
  if (envelope?.http_status === 409 && envelope?.body?.code === 'already_assigned') {
    const err = new Error(`Technician ${params.technicianId} was already booked for this slot.`);
    (err as any).type = 'DOUBLE_BOOKING';
    throw err;
  }
  if (envelope?.http_status && envelope.http_status >= 400) {
    throw new Error(`Dispatch failed with status ${envelope.http_status}: ${JSON.stringify(envelope.body)}`);
  }

  // ── Best-effort external CRM sync ───────────────────────────
  try {
    const { data: job } = await (supabase as any)
      .from('jobs')
      .select('id, org_id, thread_id, service_type, external_id, external_provider')
      .eq('id', params.jobId)
      .single();

    if (job?.org_id) {
      // Write JOB_BOOKED billing event
      try {
        let basePrice: number | null = null;
        if (job.service_type) {
          const { data: rule } = await supabase
            .from('pricing_rules')
            .select('base_price_usd')
            .eq('org_id', job.org_id)
            .eq('service_code', job.service_type)
            .eq('is_active', true)
            .limit(1)
            .maybeSingle();
          if (rule) basePrice = Number(rule.base_price_usd);
        }

        await supabase.from('billing_events' as never).insert({
          org_id:              job.org_id,
          thread_id:           job.thread_id,
          event_type:          'JOB_BOOKED',
          jobber_job_id:       job.external_provider === 'jobber' ? job.external_id : null,
          service_category:    job.service_type,
          line_item_price_usd: basePrice,
          metadata:            { technician_id: params.technicianId, scheduled_at: params.scheduledAt, job_id: params.jobId },
        } as never);
        log.info({ jobId: params.jobId, orgId: job.org_id }, 'billing: JOB_BOOKED event recorded');
      } catch (billingErr: any) {
        log.warn({ jobId: params.jobId, billingErr: billingErr?.message }, 'billing: JOB_BOOKED insert failed (non-fatal)');
      }
    }

    if (job?.external_id && job?.external_provider && job?.org_id) {
      const { data: tech } = await (supabase as any)
        .from('technicians')
        .select('name')
        .eq('id', params.technicianId)
        .single();

      const { getDispatchProvider } = await import('../../../../packages/integrations/crm/src/registry.js');
      const synced = await getDispatchProvider().updateExternalJob(job.external_id, {
        jobId:          params.jobId,
        orgId:          job.org_id,
        technicianName: tech?.name ?? 'Assigned Technician',
        scheduledAt:    params.scheduledAt,
        notes:          `Dispatched by RelayDispatch AI. Scheduled: ${params.scheduledAt}`,
      });

      log.info(
        { jobId: params.jobId, externalId: job.external_id, provider: job.external_provider, synced },
        'dispatchJobActivity: external CRM sync result',
      );
    } else {
      log.info({ jobId: params.jobId }, 'dispatchJobActivity: no external_id — CRM sync skipped (local-only job)');
    }
  } catch (syncErr: any) {
    log.warn(
      { jobId: params.jobId, technicianId: params.technicianId, syncErr: syncErr?.message },
      'dispatchJobActivity: external CRM sync failed (non-fatal — local dispatch committed)',
    );
  }
}

// ============================================================
// ACTIVITY: createJobActivity  (Phase 3 — Job Lifecycle)
// Idempotent: returns existing job if already created for this thread.
// ============================================================

export async function createJobActivity(params: {
  orgId:        string;
  threadId:     string;
  contactId:    string | null;
  serviceType:  string;
  notes?:       string;
  contactEmail: string;
  contactName?: string;
}): Promise<CreateJobResult> {

  // Idempotency: return existing job if already created
  const { data: existing } = await supabase
    .from('jobs' as never)
    .select('id, external_id, external_provider')
    .eq('thread_id' as never, params.threadId)
    .eq('org_id' as never, params.orgId)
    .maybeSingle() as { data: { id: string; external_id: string | null; external_provider: string | null } | null };

  if (existing) {
    log.info({ jobId: existing.id, threadId: params.threadId }, 'createJob: job already exists — returning existing (idempotent)');
    return { jobId: existing.id, externalId: existing.external_id, externalProvider: existing.external_provider };
  }

  const { error: limitsErr } = await supabase.rpc(
    'check_org_limits' as never,
    { p_org_id: params.orgId, p_action: 'create_job' } as never,
  );
  if (limitsErr) {
    log.error({ limitsErr, orgId: params.orgId, threadId: params.threadId }, 'createJob: plan limits check failed');
    throw new Error(String(limitsErr.message ?? 'plan_limit_check_failed'));
  }

  const jobPayload = {
    org_id:       params.orgId,
    thread_id:    params.threadId,
    service_type: params.serviceType,
    status:       'triaged' as const,
    ...(params.contactId != null ? { contact_id: params.contactId } : {}),
    ...(params.notes     != null ? { notes:      params.notes     } : {}),
  };

  const { data: job, error } = await supabase
    .from('jobs')
    .insert(jobPayload)
    .select('id')
    .single() as { data: { id: string } | null; error: unknown };

  if (error || !job) {
    log.error({ error, threadId: params.threadId }, 'createJob: DB insert failed');
    throw new Error(`createJobActivity: failed to create job for thread ${params.threadId}`);
  }

  await supabase.rpc(
    'increment_org_jobs_usage' as never,
    { p_org_id: params.orgId } as never,
  );

  log.info({ jobId: job.id, threadId: params.threadId, serviceType: params.serviceType }, 'createJob: job created with status=triaged');

  // Optional external sync (non-fatal)
  const { getDispatchProvider } = await import('../../../../packages/integrations/crm/src/registry.js');
  const provider   = getDispatchProvider();
  const syncResult = await provider.createExternalJob({
    jobId:        job.id,
    orgId:        params.orgId,
    threadId:     params.threadId,
    serviceType:  params.serviceType,
    contactEmail: params.contactEmail,
    contactName:  params.contactName,
    notes:        params.notes,
  });

  if (syncResult.externalId) {
    const updatePayload = {
      external_id: syncResult.externalId,
      ...(syncResult.externalProvider != null ? { external_provider: syncResult.externalProvider } : {}),
    };
    await supabase.from('jobs').update(updatePayload).eq('id', job.id);
  }

  return {
    jobId:            job.id,
    externalId:       syncResult.externalId,
    externalProvider: syncResult.externalProvider,
  };
}

// ============================================================
// ACTIVITY: fetchDirectIntakeMessageActivity
// ============================================================

export async function fetchDirectIntakeMessageActivity(params: { threadId: string }): Promise<{ subject: string; bodyText: string; fromEmail: string } | null> {
  // @ts-ignore
  const { data, error } = await supabase
    .from('messages')
    .select('body_text, to_address, from_address')
    .eq('thread_id', params.threadId)
    .eq('direction', 'inbound')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    log.warn({ threadId: params.threadId, error }, 'fetchDirectIntakeMessage: not found');
    return null;
  }

  // @ts-ignore
  const { data: thread } = await supabase
    .from('threads')
    .select('contact_id')
    .eq('id', params.threadId)
    .single();

  let fromEmail = 'customer@example.com';
  if (thread?.contact_id) {
    // @ts-ignore
    const { data: contact } = await supabase
      .from('contacts')
      .select('email')
      .eq('id', thread.contact_id)
      .single();
    if (contact?.email) fromEmail = contact.email;
  }

  return {
    subject:  'Direct Intake Request',
    bodyText: (data as any).body_text || '',
    fromEmail,
  };
}

