/**
 * One-shot / cron: TTL purge for api_idempotency_responses.
 * Run hourly/daily via platform scheduler:
 *   npx tsx src/workers/idempotencyPurgeWorker.ts
 *
 * Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import pino from 'pino';

const log = pino({ name: 'idempotency-purge', level: process.env.LOG_LEVEL ?? 'info' });

const ttlHours = Math.max(1, parseInt(process.env.IDEMPOTENCY_TTL_HOURS ?? '168', 10));

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    log.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
    process.exitCode = 1;
    return;
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const { data, error } = await supabase.rpc('api_purge_expired_idempotency_keys' as never, {
    ttl_hours: ttlHours,
  } as never);

  if (error) {
    log.error({ error }, 'api_purge_expired_idempotency_keys failed');
    process.exitCode = 1;
    return;
  }

  log.info({ deletedApprox: data }, 'idempotency TTL purge finished');
}

void main();
