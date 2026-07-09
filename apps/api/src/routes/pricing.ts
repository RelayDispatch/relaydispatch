/**
 * apps/api/src/routes/pricing.ts
 * ──────────────────────────────
 * Pricing rules management endpoints (preventing AI hallucinations).
 */
import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import pino from 'pino';
import { createServiceSupabase } from '../../../../packages/database/src/client.js';

const log = pino({ name: 'api-pricing', level: process.env.LOG_LEVEL ?? 'info' });
export const pricingRouter = new Hono();

const PricingRuleSchema = z.object({
  service_code:   z.string().min(1).max(50),
  service_label:  z.string().min(1).max(100),
  category:       z.string().min(1).max(50),
  pricing_type:   z.enum(['flat', 'per_unit', 'hourly', 'diagnostic']).default('flat'),
  base_price_usd: z.number().nonnegative(),
  min_price_usd:  z.number().nonnegative().optional(),
  max_price_usd:  z.number().nonnegative().optional(),
  unit_label:     z.string().max(20).optional(),
});

// List pricing rules
pricingRouter.get('/', async (c) => {
  const db = c.get('db' as never) as ReturnType<typeof createServiceSupabase>;
  const { data, error } = await db
    .from('pricing_rules')
    .select('*')
    .eq('is_active', true)
    .order('service_code', { ascending: true });

  if (error) {
    log.error({ error }, 'Failed to fetch pricing rules');
    return c.json({ error: error.message }, 500);
  }
  return c.json(data);
});

// Set pricing rule (Upsert logic: ON CONFLICT(org_id, service_code) DO UPDATE)
pricingRouter.post('/', zValidator('json', PricingRuleSchema), async (c) => {
  const body = c.req.valid('json');
  const db = c.get('db' as never) as ReturnType<typeof createServiceSupabase>;

  // Resolve default org_id for auth caller
  const { data: member, error: memberErr } = await db
    .from('org_members')
    .select('org_id')
    .limit(1)
    .single();

  if (memberErr || !member) {
    return c.json({ error: 'Caller does not belong to any organization' }, 403);
  }

  const { data, error } = await db
    .from('pricing_rules')
    .upsert({
      org_id:         member.org_id,
      service_code:   body.service_code,
      service_label:  body.service_label,
      category:       body.category,
      pricing_type:   body.pricing_type,
      base_price_usd: body.base_price_usd,
      min_price_usd:  body.min_price_usd ?? null,
      max_price_usd:  body.max_price_usd ?? null,
      unit_label:     body.unit_label ?? null,
      is_active:      true,
    }, {
      onConflict: 'org_id,service_code'
    })
    .select('*')
    .single();

  if (error) {
    log.error({ error }, 'Failed to upsert pricing rule');
    return c.json({ error: error.message }, 500);
  }

  log.info({ serviceCode: body.service_code }, 'Pricing rule configured successfully');
  return c.json(data);
});

// Delete pricing rule (mark inactive)
pricingRouter.delete('/:serviceCode', async (c) => {
  const serviceCode = c.req.param('serviceCode');
  const db = c.get('db' as never) as ReturnType<typeof createServiceSupabase>;

  // Resolve default org_id for auth caller
  const { data: member, error: memberErr } = await db
    .from('org_members')
    .select('org_id')
    .limit(1)
    .single();

  if (memberErr || !member) {
    return c.json({ error: 'Caller does not belong to any organization' }, 403);
  }

  // Soft delete pricing rules by marking them is_active = false
  const { data, error } = await db
    .from('pricing_rules')
    .update({ is_active: false })
    .eq('org_id', member.org_id)
    .eq('service_code', serviceCode)
    .select('*');

  if (error) {
    log.error({ serviceCode, error }, 'Failed to deactivate pricing rule');
    return c.json({ error: error.message }, 500);
  }

  log.info({ serviceCode }, 'Pricing rule deactivated');
  return c.json({ status: 'deactivated', service_code: serviceCode });
});
