/**
 * apps/api/src/routes/threads.ts
 * ──────────────────────────────
 * Threads management and takeover/escalation routes.
 */
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import pino from 'pino';
import { createServiceSupabase } from '../../../../packages/database/src/client.js';
import { getTemporalClient } from '../../../../packages/workflows/temporal/src/client.js';
import {
  humanTakeoverSignal,
  resolveThreadSignal,
  getConversationHistoryQuery,
} from '../../../worker/src/dispatchWorkflow.js';
import {
  UpdateThreadSchema,
  TakeoverSchema,
  ResolveSchema,
} from '../schemas/thread.schemas.js';

const log = pino({ name: 'api-threads', level: process.env.LOG_LEVEL ?? 'info' });
export const threadsRouter = new Hono();

// List threads
threadsRouter.get('/', async (c) => {
  const db = c.get('db' as never) as ReturnType<typeof createServiceSupabase>;
  const { data, error } = await db
    .from('threads')
    .select('*, contacts(*)')
    .order('created_at', { ascending: false });

  if (error) {
    log.error({ error }, 'Failed to fetch threads');
    return c.json({ error: error.message }, 500);
  }
  return c.json(data);
});

// Retrieve thread
threadsRouter.get('/:id', async (c) => {
  const id = c.req.param('id');
  const db = c.get('db' as never) as ReturnType<typeof createServiceSupabase>;
  const { data, error } = await db
    .from('threads')
    .select('*, contacts(*), messages(*)')
    .eq('id', id)
    .single();

  if (error) {
    log.error({ id, error }, 'Failed to fetch thread');
    return c.json({ error: error.message }, 404);
  }
  return c.json(data);
});

// Patch thread
threadsRouter.get('/:id/transcript', async (c) => {
  const id = c.req.param('id');
  const db = c.get('db' as never) as ReturnType<typeof createServiceSupabase>;

  // Access check
  const { error: accessErr } = await db.from('threads').select('id').eq('id', id).single();
  if (accessErr) return c.json({ error: 'Thread not found' }, 404);

  try {
    const client = await getTemporalClient();
    const handle = client.workflow.getHandle(`relaydispatch-dispatch-${id}`);
    const history = await handle.query(getConversationHistoryQuery);
    return c.json({ history });
  } catch (err) {
    log.warn({ id, err }, 'Failed to query Temporal conversation history — falling back to database messages');
    const { data: messages, error: msgErr } = await db
      .from('messages')
      .select('*')
      .eq('thread_id', id)
      .order('created_at', { ascending: true });
    
    if (msgErr) return c.json({ error: msgErr.message }, 500);
    
    const mappedHistory = (messages ?? []).map(m => ({
      role: m.role === 'customer' ? 'customer' : (m.role === 'agent' ? 'dispatcher_ai' : 'human_agent'),
      content: m.body_text ?? '',
      timestamp: m.created_at,
      messageId: m.id,
    }));
    return c.json({ history: mappedHistory });
  }
});

// Update thread metadata
threadsRouter.patch('/:id', zValidator('json', UpdateThreadSchema), async (c) => {
  const id = c.req.param('id');
  const body = c.req.valid('json');
  const db = c.get('db' as never) as ReturnType<typeof createServiceSupabase>;

  const { data, error } = await db
    .from('threads')
    .update(body as any)
    .eq('id', id)
    .select('*, contacts(*)')
    .single();

  if (error) {
    log.error({ id, error }, 'Failed to patch thread');
    return c.json({ error: error.message }, 500);
  }
  return c.json(data);
});

// Human Takeover
threadsRouter.post('/:id/takeover', zValidator('json', TakeoverSchema), async (c) => {
  const id = c.req.param('id');
  const body = c.req.valid('json');
  const db = c.get('db' as never) as ReturnType<typeof createServiceSupabase>;

  const { error: accessErr } = await db.from('threads').select('id').eq('id', id).single();
  if (accessErr) return c.json({ error: 'Thread not found' }, 404);

  try {
    const client = await getTemporalClient();
    const handle = client.workflow.getHandle(`relaydispatch-dispatch-${id}`);
    await handle.signal(humanTakeoverSignal, {
      agentId: body.agent_id,
      agentName: body.agent_name,
      reason: body.reason,
    });

    await db.from('threads').update({ status: 'closed' }).eq('id', id);
    log.info({ id, agent: body.agent_name }, 'Thread takeover signal sent successfully');
    return c.json({ status: 'signaled' });
  } catch (err) {
    log.error({ id, err }, 'Failed to send takeover signal to Temporal');
    return c.json({ error: String(err) }, 500);
  }
});

// Resolve Thread
threadsRouter.post('/:id/resolve', zValidator('json', ResolveSchema), async (c) => {
  const id = c.req.param('id');
  const body = c.req.valid('json');
  const db = c.get('db' as never) as ReturnType<typeof createServiceSupabase>;

  const { error: accessErr } = await db.from('threads').select('id').eq('id', id).single();
  if (accessErr) return c.json({ error: 'Thread not found' }, 404);

  try {
    const client = await getTemporalClient();
    const handle = client.workflow.getHandle(`relaydispatch-dispatch-${id}`);
    await handle.signal(resolveThreadSignal, {
      resolvedBy: body.resolved_by,
      resolutionNote: body.resolution_note ?? 'Closed by agent',
    });

    await db.from('threads').update({ status: 'closed' }).eq('id', id);
    log.info({ id, agent: body.resolved_by }, 'Thread resolve signal sent successfully');
    return c.json({ status: 'signaled' });
  } catch (err) {
    log.error({ id, err }, 'Failed to send resolve signal to Temporal');
    return c.json({ error: String(err) }, 500);
  }
});
