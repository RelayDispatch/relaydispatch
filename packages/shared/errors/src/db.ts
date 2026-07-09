/**
 * packages/shared/errors/src/db.ts
 * ─────────────────────────────────
 * Centralized database error normalization for Hono route handlers.
 * Extracted from the monolithic api/index.ts.
 */

import type { PostgrestError } from '@supabase/supabase-js';
import type { Context } from 'hono';

/**
 * Normalizes a PostgREST error into an appropriate HTTP response.
 * Handles plan limit violations, foreign key errors, and generic DB errors.
 */
export function normalizeDbError(err: PostgrestError, contextMsg: string, c: Context) {
  if (/plan_limit_exceeded:jobs/i.test(err.message ?? '')) {
    return c.json(
      { error: 'Plan limit reached', code: 'plan_limit_exceeded', limit_type: 'jobs' },
      403,
    );
  }
  if (/plan_limit_exceeded:technicians/i.test(err.message ?? '')) {
    return c.json(
      { error: 'Plan limit reached', code: 'plan_limit_exceeded', limit_type: 'technicians' },
      403,
    );
  }
  // 23503: foreign_key_violation (e.g. invalid org_id)
  if (err.code === '23503') {
    return c.json({ error: 'Organization or related record not found' }, 404);
  }
  // 23XXX: Integrity Constraint, 22XXX: Data Exception, PGRSTXXX: PostgREST errors
  if (err.code?.startsWith('23') || err.code?.startsWith('22') || err.code?.startsWith('PGRST')) {
    return c.json({ error: 'Invalid input data violates database constraints' }, 400);
  }
  return c.json({ error: 'Internal server error' }, 500);
}
