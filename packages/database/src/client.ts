/**
 * packages/database/src/client.ts
 * ────────────────────────────────
 * Supabase client factories.
 *
 * Security model:
 *   createUserSupabase()    — per-request user client built from Bearer JWT.
 *                             All queries are RLS-constrained to auth.uid().
 *   createServiceSupabase() — service role client for webhook/worker contexts ONLY.
 *                             Bypasses RLS — use only where user JWT is unavailable.
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types.js';

// Cache of per-token user clients (basic cap to prevent unbounded growth)
const _userDbs = new Map<string, ReturnType<typeof createClient<Database>>>();

/**
 * Per-request user client — built from the caller's Bearer JWT.
 * - auth.uid() resolves to the caller's Supabase user UUID
 * - current_org_id() resolves via org_members RLS helper
 * - All queries fully RLS-constrained
 */
export function createUserSupabase(authHeader: string | undefined) {
  const token = authHeader?.replace('Bearer ', '').trim() || 'anon';
  if (!_userDbs.has(token)) {
    _userDbs.set(
      token,
      createClient<Database>(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!, {
        global: { headers: token !== 'anon' ? { Authorization: `Bearer ${token}` } : {} },
        auth: { persistSession: false, autoRefreshToken: false },
      }),
    );
    // Basic FIFO cap — prevents unbounded memory growth
    if (_userDbs.size > 1000) {
      const firstKey = _userDbs.keys().next().value;
      if (firstKey) _userDbs.delete(firstKey);
    }
  }
  return _userDbs.get(token)!;
}

let _serviceDb: ReturnType<typeof createClient<Database>> | null = null;

/**
 * Service-role client.
 *
 * SCOPE: Webhook and worker contexts only — where no user JWT is available.
 * Examples: /intake/gmail (Google Pub/Sub push), Temporal activity workers.
 *
 * NEVER use in user-facing /api/* route handlers.
 * NEVER return this client or its data to the browser.
 */
export function createServiceSupabase() {
  if (!_serviceDb) {
    _serviceDb = createClient<Database>(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } },
    );
  }
  return _serviceDb;
}
