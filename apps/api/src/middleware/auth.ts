/**
 * apps/api/src/middleware/auth.ts
 * ────────────────────────────────
 * JWT authentication middleware for all /api/* routes.
 * Attaches the user-scoped Supabase client to Hono context.
 *
 * Routes excluded (Supabase Auth or public routes):
 *   - /api/pilot/apply (public — intentionally unauthenticated, archived)
 */

import type { Context, Next } from 'hono';
import { createUserSupabase } from '../../../../packages/database/src/client.js';

export async function authMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization');

  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Missing or invalid Authorization header' }, 401);
  }

  // Attach the user-scoped RLS client. Downstream routes pull it from context.
  c.set('db' as never, createUserSupabase(authHeader));
  return next();
}
