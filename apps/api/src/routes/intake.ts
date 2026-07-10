/**
 * apps/api/src/routes/intake.ts
 * ──────────────────────────────
 * Webhook and direct email intake routes.
 */
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import pino from 'pino';
import { authorizeGmailPubSubPush } from '../../../../packages/security/src/hmac.js';
import { createServiceSupabase } from '../../../../packages/database/src/client.js';
import { getTemporalClient } from '../../../../packages/workflows/temporal/src/client.js';
import { DISPATCH_WORKFLOW_NAME } from '../../../worker/src/dispatchWorkflow.js';
import { GmailPubSubSchema, DirectIntakeSchema } from '../schemas/intake.schemas.js';

const log = pino({ name: 'api-intake', level: process.env.LOG_LEVEL ?? 'info' });
export const intakeRouter = new Hono();

async function startIntakeWorkflow(
  workflowInput: Record<string, unknown>,
  meta: { orgId: string; emailAddress: string; historyId: string | null; source: 'gmail' | 'direct' },
) {
  const sb = createServiceSupabase();
  try {
    const client = await getTemporalClient();
    const workflowId = `relaydispatch-dispatch-${workflowInput.threadId}`;
    const handle = await client.workflow.start(DISPATCH_WORKFLOW_NAME, {
      taskQueue: process.env.TEMPORAL_TASK_QUEUE ?? 'relaydispatch-dispatch',
      workflowId,
      args: [workflowInput],
    });
    log.info({ workflowId, runId: handle.firstExecutionRunId }, 'Temporal workflow started successfully');
    return { threadId: workflowInput.threadId as string, status: 'started' as const };
  } catch (err) {
    log.error({ err, workflowInput }, 'Failed to start Temporal workflow — writing to DLQ');

    const { error: dlqErr } = await sb
      .from('failed_webhooks')
      .insert({
        org_id: meta.orgId,
        raw_payload: workflowInput as any,
        retry_count: 0,
        resolved: false,
        failure_reason: String(err),
        email_address: meta.emailAddress,
        history_id: meta.historyId,
        source: meta.source,
      });

    if (dlqErr) {
      log.error({ dlqErr }, 'FATAL: Failed to write webhook to DLQ database');
    }

    return {
      threadId: workflowInput.threadId as string,
      status: 'queued' as const,
      queued_for_retry: true,
    };
  }
}

// Public Webhook Intake (Gmail Pub/Sub push)
intakeRouter.post('/gmail', async (c) => {
  const rawBody = await c.req.text();
  const signature = c.req.header('X-Goog-Signature');
  const token = c.req.query('token');

  const authorized = await authorizeGmailPubSubPush(rawBody, signature, token);
  if (!authorized) {
    log.warn('Unauthorized webhook intake request');
    return c.json({ error: 'Unauthorized' }, 401);
  }

  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400);
  }

  const parsed = GmailPubSubSchema.safeParse(payload);
  if (!parsed.success) {
    log.warn({ errors: parsed.error.format() }, 'Invalid Gmail Pub/Sub payload structure');
    return c.json({ error: 'Invalid payload' }, 400);
  }

  let notification: { emailAddress: string; historyId: string };
  try {
    const dataStr = Buffer.from(parsed.data.message.data, 'base64').toString('utf8');
    notification = JSON.parse(dataStr);
  } catch (err) {
    log.error({ err }, 'Failed to decode or parse base64 Gmail notification data');
    return c.json({ error: 'Failed to decode data' }, 400);
  }

  const emailAddress = notification.emailAddress;
  const historyId = notification.historyId;

  log.info({ emailAddress, historyId }, 'Processing Gmail intake webhook');

  const sb = createServiceSupabase();
  const { data: org, error: orgErr } = await sb
    .from('organizations')
    .select('id, sb243_footer, timezone, nylas_grant_id')
    .eq('intake_email_address', emailAddress)
    .single();

  if (orgErr || !org) {
    log.warn({ emailAddress, orgErr }, 'Organization not found for intake email address');
    return c.json({ status: 'ignored', reason: 'org_not_found' }, 202);
  }

  const threadId = crypto.randomUUID();
  const { error: threadErr } = await sb
    .from('threads')
    .insert({
      id: threadId,
      org_id: org.id,
      channel: 'email',
      external_thread_id: historyId,
      status: 'new',
    })
    .select('id')
    .single();

  let finalThreadId = threadId as any;
  if (threadErr) {
    const { data: existing } = await sb
      .from('threads')
      .select('id')
      .eq('org_id', org.id)
      .eq('external_thread_id', historyId)
      .single();
    if (existing) {
      finalThreadId = existing.id;
      log.info({ finalThreadId }, 'Reusing existing thread for intake');
    } else {
      log.error({ threadErr }, 'Failed to insert thread row during intake');
    }
  }

  const workflowInput = {
    threadId: finalThreadId,
    orgId: org.id,
    emailAddress,
    historyId,
    nylasGrantId: org.nylas_grant_id,
    sb243Footer: org.sb243_footer ?? 'Dispatch is an AI Service Coordinator — Powered by RelayDispatch',
    timezone: org.timezone ?? 'America/Chicago',
  };

  const result = await startIntakeWorkflow(workflowInput, {
    orgId: org.id,
    emailAddress,
    historyId,
    source: 'gmail',
  });

  return c.json({ thread_id: result.threadId, status: result.status, ...(result.queued_for_retry ? { queued_for_retry: true } : {}) }, 202);
});

/** Authenticated direct intake — mounted at POST /api/intake/direct */
export const directIntakeRouter = new Hono();

directIntakeRouter.post('/direct', zValidator('json', DirectIntakeSchema), async (c) => {
  const body = c.req.valid('json');
  const db = c.get('db' as never) as ReturnType<typeof createServiceSupabase>;

  const { data: member, error: memberErr } = await db
    .from('org_members')
    .select('org_id')
    .limit(1)
    .single();

  if (memberErr || !member) {
    log.warn({ memberErr }, 'Direct intake rejected — caller is not a member of any organization');
    return c.json({ error: 'Forbidden' }, 403);
  }

  log.info({ org_id: member.org_id, channel: body.channel }, 'Processing direct intake request');

  const { data: org, error: orgErr } = await db
    .from('organizations')
    .select('id, sb243_footer, timezone, nylas_grant_id')
    .eq('id', member.org_id)
    .single();

  if (orgErr || !org) {
    log.warn({ org_id: member.org_id, orgErr }, 'Organization not found for direct intake');
    return c.json({ error: 'Organization not found' }, 404);
  }

  const threadId = crypto.randomUUID();
  const { error: threadErr } = await db
    .from('threads')
    .insert({
      id: threadId,
      org_id: org.id,
      channel: body.channel,
      subject: body.subject,
      status: 'new',
    });

  if (threadErr) {
    log.error({ threadErr }, 'Failed to insert thread for direct intake');
    return c.json({ error: 'Failed to create thread' }, 500);
  }

  const { error: messageErr } = await db
    .from('messages')
    .insert({
      org_id: org.id,
      thread_id: threadId,
      role: 'customer',
      direction: 'inbound',
      body_text: body.body_text,
      body_html: body.body_html || null,
      from_address: body.from_email,
    });

  if (messageErr) {
    log.error({ messageErr }, 'Failed to insert customer message for direct intake');
    return c.json({ error: 'Failed to insert message' }, 500);
  }

  const workflowInput = {
    threadId,
    orgId: org.id,
    emailAddress: body.from_email,
    historyId: null,
    nylasGrantId: org.nylas_grant_id,
    sb243Footer: org.sb243_footer ?? 'Dispatch is an AI Service Coordinator — Powered by RelayDispatch',
    timezone: org.timezone ?? 'America/Chicago',
  };

  const result = await startIntakeWorkflow(workflowInput, {
    orgId: org.id,
    emailAddress: body.from_email,
    historyId: null,
    source: 'direct',
  });

  return c.json({
    thread_id: result.threadId,
    status: result.status,
    ...(result.queued_for_retry ? { queued_for_retry: true } : {}),
  }, 202);
});
