/**
 * apps/api/src/routes/jobs.ts
 * ──────────────────────────────
 * Service jobs management and manual dispatching.
 */
import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import pino from 'pino';
import { createServiceSupabase } from '../../../../packages/database/src/client.js';

const log = pino({ name: 'api-jobs', level: process.env.LOG_LEVEL ?? 'info' });
export const jobsRouter = new Hono();

const CreateJobSchema = z.object({
  thread_id:    z.string().uuid(),
  contact_id:   z.string().uuid().optional(),
  service_type: z.string().min(1).max(100),
  status:       z.enum(['new', 'triaged', 'ready_for_dispatch', 'scheduled', 'assigned', 'in_progress', 'completed', 'cancelled']).default('new'),
  notes:        z.string().max(2000).optional(),
});

const UpdateJobStatusSchema = z.object({
  status: z.enum(['new', 'triaged', 'ready_for_dispatch', 'scheduled', 'assigned', 'in_progress', 'completed', 'cancelled']),
  notes:  z.string().max(2000).optional(),
});

const DispatchJobSchema = z.object({
  technician_id: z.string().uuid(),
  scheduled_at:  z.string().datetime().optional(),
});

// List jobs
jobsRouter.get('/', async (c) => {
  const db = c.get('db' as never) as ReturnType<typeof createServiceSupabase>;
  const { data, error } = await db
    .from('jobs')
    .select('*, contacts(*), technicians(*)')
    .order('created_at', { ascending: false });

  if (error) {
    log.error({ error }, 'Failed to fetch jobs');
    return c.json({ error: error.message }, 500);
  }
  return c.json(data);
});

// Create job (manual override)
jobsRouter.post('/', zValidator('json', CreateJobSchema), async (c) => {
  const body = c.req.valid('json');
  const db = c.get('db' as never) as ReturnType<typeof createServiceSupabase>;

  // Resolve org from RLS
  const { data: thread, error: threadErr } = await db
    .from('threads')
    .select('org_id')
    .eq('id', body.thread_id)
    .single();

  if (threadErr || !thread) {
    return c.json({ error: 'Thread not found' }, 404);
  }

  const { data, error } = await db
    .from('jobs')
    .insert({
      org_id:       thread.org_id,
      thread_id:    body.thread_id,
      contact_id:   body.contact_id ?? null,
      service_type: body.service_type,
      status:       body.status,
      notes:        body.notes ?? null,
    })
    .select('*, contacts(*)')
    .single();

  if (error) {
    log.error({ error }, 'Failed to create job');
    return c.json({ error: error.message }, 500);
  }
  return c.json(data, 201);
});

// Retrieve job
jobsRouter.get('/:id', async (c) => {
  const id = c.req.param('id');
  const db = c.get('db' as never) as ReturnType<typeof createServiceSupabase>;
  const { data, error } = await db
    .from('jobs')
    .select('*, contacts(*), technicians(*), threads(*)')
    .eq('id', id)
    .single();

  if (error) {
    log.error({ id, error }, 'Failed to fetch job');
    return c.json({ error: error.message }, 404);
  }
  return c.json(data);
});

// Manual Job Dispatch
jobsRouter.post('/:id/dispatch', zValidator('json', DispatchJobSchema), async (c) => {
  const jobId = c.req.param('id');
  const body = c.req.valid('json');
  const db = c.get('db' as never) as ReturnType<typeof createServiceSupabase>;
  
  // 1. Fetch job
  const { data: job, error: jobErr } = await db
    .from('jobs')
    .select('id, org_id, status')
    .eq('id', jobId)
    .single();

  if (jobErr || !job) {
    log.warn({ jobId, jobErr }, 'Job not found for dispatch');
    return c.json({ error: 'Job not found' }, 404);
  }

  // 2. Fetch tech and verify organization ownership and active roster status
  const { data: tech, error: techErr } = await db
    .from('technicians')
    .select('id, name, is_active')
    .eq('id', body.technician_id)
    .eq('org_id', job.org_id)
    .single();

  if (techErr || !tech) {
    log.warn({ techId: body.technician_id, orgId: job.org_id, techErr }, 'Technician not found or mismatch');
    return c.json({ error: 'Technician not found or does not belong to organization' }, 400);
  }

  if (!tech.is_active) {
    return c.json({ error: 'Cannot dispatch to an inactive technician' }, 400);
  }

  // 3. Update job assignments
  const { data: updatedJob, error: updateErr } = await db
    .from('jobs')
    .update({
      assigned_to:  tech.id,
      scheduled_at: body.scheduled_at || new Date().toISOString(),
      status:       'assigned',
    })
    .eq('id', jobId)
    .select('*, technicians(*)')
    .single();

  if (updateErr) {
    log.error({ jobId, updateErr }, 'Failed to update job for dispatch');
    return c.json({ error: updateErr.message }, 500);
  }

  // 4. Update thread status associated with job
  await db.from('threads').update({ status: 'closed' }).eq('id', updatedJob.thread_id);

  log.info({ jobId, tech: tech.name }, 'Job dispatched successfully');
  return c.json(updatedJob);
});

// Update Job Status
jobsRouter.patch('/:id/status', zValidator('json', UpdateJobStatusSchema), async (c) => {
  const id = c.req.param('id');
  const body = c.req.valid('json');
  const db = c.get('db' as never) as ReturnType<typeof createServiceSupabase>;

  const { data, error } = await db
    .from('jobs')
    .update({
      status: body.status,
      notes:  body.notes ?? null,
    })
    .eq('id', id)
    .select('*, technicians(*)')
    .single();

  if (error) {
    log.error({ id, error }, 'Failed to update job status');
    return c.json({ error: error.message }, 500);
  }
  return c.json(data);
});
