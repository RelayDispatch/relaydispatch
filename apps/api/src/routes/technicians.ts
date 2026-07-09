/**
 * apps/api/src/routes/technicians.ts
 * ──────────────────────────────
 * Technician roster management.
 */
import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import pino from 'pino';
import { createServiceSupabase } from '../../../../packages/database/src/client.js';

const log = pino({ name: 'api-technicians', level: process.env.LOG_LEVEL ?? 'info' });
export const techniciansRouter = new Hono();

const CreateTechnicianSchema = z.object({
  name:   z.string().min(1).max(100),
  skills: z.array(z.string()).default([]),
});

const ToggleTechnicianSchema = z.object({
  is_active: z.boolean(),
});

// List technicians
techniciansRouter.get('/', async (c) => {
  const db = c.get('db' as never) as ReturnType<typeof createServiceSupabase>;
  const { data, error } = await db
    .from('technicians')
    .select('*')
    .order('name', { ascending: true });

  if (error) {
    log.error({ error }, 'Failed to fetch technicians');
    return c.json({ error: error.message }, 500);
  }
  return c.json(data);
});

// Create technician
techniciansRouter.post('/', zValidator('json', CreateTechnicianSchema), async (c) => {
  const body = c.req.valid('json');
  const db = c.get('db' as never) as ReturnType<typeof createServiceSupabase>;

  // Insert tech with default org_id (RLS automatically scopes it if using RLS or we let DB resolve it via policy)
  // Let's first query organization membership to resolve default org_id:
  const { data: member, error: memberErr } = await db
    .from('org_members')
    .select('org_id')
    .limit(1)
    .single();

  if (memberErr || !member) {
    return c.json({ error: 'Caller does not belong to any organization' }, 403);
  }

  const { data, error } = await db
    .from('technicians')
    .insert({
      org_id:    member.org_id,
      name:      body.name,
      skills:    body.skills,
      is_active: true,
    })
    .select('*')
    .single();

  if (error) {
    log.error({ error }, 'Failed to create technician');
    return c.json({ error: error.message }, 500);
  }
  return c.json(data, 201);
});

// Toggle Active/Inactive status
techniciansRouter.patch('/:id', zValidator('json', ToggleTechnicianSchema), async (c) => {
  const techId = c.req.param('id');
  const body = c.req.valid('json');
  const db = c.get('db' as never) as ReturnType<typeof createServiceSupabase>;

  // If deactivating, detach the technician from all open jobs first
  if (body.is_active === false) {
    const activeJobStatuses = ['new', 'triaged', 'ready_for_dispatch', 'scheduled', 'assigned'] as const;
    
    // Clear assignee on open/scheduled/assigned jobs
    const { error: detachErr } = await db
      .from('jobs')
      .update({
        assigned_to: null,
        status:      'ready_for_dispatch',
      })
      .eq('assigned_to', techId)
      .in('status', activeJobStatuses);

    if (detachErr) {
      log.error({ techId, detachErr }, 'Failed to detach open jobs before deactivating technician');
      return c.json({ error: 'Could not clear open bookings before deactivation' }, 500);
    }
  }

  const { data: tech, error } = await db
    .from('technicians')
    .update({ is_active: body.is_active })
    .eq('id', techId)
    .select('*')
    .single();

  if (error) {
    log.error({ techId, error }, 'Failed to toggle technician active status');
    return c.json({ error: error.message }, 500);
  }

  log.info({ techId, active: body.is_active }, 'Technician roster status updated');
  return c.json(tech);
});
