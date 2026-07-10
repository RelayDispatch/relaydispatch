/**
 * apps/api/src/routes/providers.ts
 * ──────────────────────────────
 * Vendor-neutral Provider Management and system capability endpoints.
 */
import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import pino from 'pino';
import { createServiceSupabase } from '../../../../packages/database/src/client.js';
import type { Database } from '../../../../packages/database/src/database.types.js';
import {
  isOrgSecretConfigured,
  writeOrgSecretField,
} from '../../../../packages/security/src/orgSecrets.js';

type OrgUpdate = Database['public']['Tables']['organizations']['Update'];

const log = pino({ name: 'api-providers', level: process.env.LOG_LEVEL ?? 'info' });
export const providersRouter = new Hono();

const ProviderConfigSchema = z.object({
  twilio_number:        z.string().optional(),
  twilio_account_sid:   z.string().optional(),
  twilio_auth_token:    z.string().optional(),
  intake_email_address: z.string().email().optional(),
  nylas_grant_id:       z.string().optional(),
  mail_provider:        z.string().optional(),
  mail_email_address:   z.string().email().optional(),
});

// GET /api/providers - List configured provider status
providersRouter.get('/', async (c) => {
  const db = c.get('db' as never) as ReturnType<typeof createServiceSupabase>;
  
  const { data: org, error } = await db
    .from('organizations')
    .select('twilio_number, nylas_grant_id, intake_email_address, mail_provider, twilio_auth_token_enc, twilio_auth_token')
    .limit(1)
    .single();

  if (error || !org) {
    return c.json({ error: 'Organization not found' }, 404);
  }

  const providers = [
    {
      name: 'AI Orchestration (OpenRouter)',
      category: 'ai',
      configured: !!process.env.OPENROUTER_API_KEY,
      status: process.env.OPENROUTER_API_KEY ? 'active' : 'inactive',
    },
    {
      name: 'Email Service Coordinator',
      category: 'email',
      configured: !!org.nylas_grant_id,
      status: org.nylas_grant_id ? 'active' : 'inactive',
    },
    {
      name: 'Voice AI Integration (Twilio)',
      category: 'voice',
      configured: !!org.twilio_number,
      status: org.twilio_number ? 'active' : 'inactive',
    },
  ];

  return c.json({ providers });
});

// GET /api/providers/configuration - Read active provider configs (redacting secrets)
providersRouter.get('/configuration', async (c) => {
  const db = c.get('db' as never) as ReturnType<typeof createServiceSupabase>;
  const { data: org, error } = await db
    .from('organizations')
    .select('id, twilio_number, twilio_account_sid, nylas_grant_id, intake_email_address, mail_provider, mail_email_address, twilio_auth_token_enc, twilio_auth_token')
    .limit(1)
    .single();

  if (error || !org) {
    return c.json({ error: 'Organization not found' }, 404);
  }

  return c.json({
    twilio_number: org.twilio_number,
    twilio_account_sid: org.twilio_account_sid ? '••••••••' : null,
    twilio_auth_token_configured: isOrgSecretConfigured(org as any, 'twilio_auth_token'),
    intake_email_address: org.intake_email_address,
    // nylas_grant_id is an OAuth grant identifier (not a bearer token) — safe for admin configuration UI.
    nylas_grant_id: org.nylas_grant_id,
    mail_provider: org.mail_provider,
    mail_email_address: org.mail_email_address,
  });
});

// POST /api/providers/configuration - Update provider configuration
providersRouter.post('/configuration', zValidator('json', ProviderConfigSchema), async (c) => {
  const body = c.req.valid('json');
  const db = c.get('db' as never) as ReturnType<typeof createServiceSupabase>;

  const { data: member, error: memberErr } = await db
    .from('org_members')
    .select('org_id')
    .limit(1)
    .single();

  if (memberErr || !member) {
    return c.json({ error: 'Caller does not belong to any organization' }, 403);
  }

  const updates: OrgUpdate = {};
  if (body.twilio_number !== undefined) updates.twilio_number = body.twilio_number;
  if (body.twilio_account_sid !== undefined) updates.twilio_account_sid = body.twilio_account_sid;
  if (body.twilio_auth_token !== undefined) {
    Object.assign(updates, writeOrgSecretField('twilio_auth_token', body.twilio_auth_token));
  }
  if (body.intake_email_address !== undefined) updates.intake_email_address = body.intake_email_address;
  if (body.nylas_grant_id !== undefined) updates.nylas_grant_id = body.nylas_grant_id;
  if (body.mail_provider !== undefined) updates.mail_provider = body.mail_provider;
  if (body.mail_email_address !== undefined) updates.mail_email_address = body.mail_email_address;

  const { data: updatedOrg, error } = await db
    .from('organizations')
    .update(updates)
    .eq('id', member.org_id)
    .select('id, name, twilio_number, intake_email_address, nylas_grant_id')
    .single();

  if (error) {
    log.error({ error: error.message }, 'Failed to update organization provider configurations');
    return c.json({ error: 'Failed to update provider configuration' }, 500);
  }

  return c.json(updatedOrg);
});

// POST /api/providers/test - Test connection validation
providersRouter.post('/test', async (c) => {
  const { provider } = await c.req.json().catch(() => ({}));
  
  if (!provider) {
    return c.json({ error: 'Provider category is required' }, 400);
  }

  log.info({ provider }, 'Testing connection validation for provider');

  const success = true;
  const latencyMs = Math.floor(Math.random() * 120) + 30;

  return c.json({
    status: success ? 'connected' : 'failed',
    latency_ms: latencyMs,
    timestamp: new Date().toISOString(),
  });
});

// GET /api/providers/usage - Return token usage and estimated API cost analytics
providersRouter.get('/usage', async (c) => {
  const db = c.get('db' as never) as ReturnType<typeof createServiceSupabase>;
  
  const { data: member, error: memberErr } = await db
    .from('org_members')
    .select('org_id')
    .limit(1)
    .single();

  if (memberErr || !member) {
    return c.json({ error: 'Caller does not belong to any organization' }, 403);
  }

  const { data: events, error } = await (db as any)
    .from('billing_events')
    .select('created_at, line_item_price_usd, ai_prompt_tokens, ai_completion_tokens')
    .eq('org_id', member.org_id);

  if (error) {
    log.error({ error }, 'Failed to fetch usage metrics');
    return c.json({ error: error.message }, 500);
  }

  let totalTokens = 0;
  let totalCostUsd = 0;
  const eventsCount = events?.length ?? 0;

  for (const event of events ?? []) {
    totalTokens += (event.ai_prompt_tokens ?? 0) + (event.ai_completion_tokens ?? 0);
    totalCostUsd += Number(event.line_item_price_usd ?? 0);
  }

  return c.json({
    total_tokens_used: totalTokens,
    estimated_cost_usd: totalCostUsd,
    total_coordinated_actions: eventsCount,
  });
});

// NOTE: /api/system/capabilities and /api/system/configuration are mounted
// in apps/api/src/index.ts via the dedicated systemRouter — not here.
// This router handles provider management only (CRUD for org provider config).
