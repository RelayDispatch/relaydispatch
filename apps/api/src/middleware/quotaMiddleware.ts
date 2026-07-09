/**
 * apps/api/src/middleware/quotaMiddleware.ts
 * ──────────────────────────────────────────
 * Vendor-neutral, configuration-driven quota middleware.
 * Permissive by default for self-hosted instances.
 */
import type { Context, Next } from 'hono';
import pino from 'pino';

const log = pino({ name: 'quota-middleware', level: process.env.LOG_LEVEL ?? 'info' });

export async function quotaMiddleware(c: Context, next: Next) {
  const maxThreads = process.env.SELF_HOSTED_THREAD_LIMIT;
  
  if (maxThreads) {
    const limit = parseInt(maxThreads, 10);
    if (!isNaN(limit)) {
      const db = c.get('db' as never) as any;
      if (db) {
        const { count, error } = await db
          .from('threads')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'new');
        
        if (!error && count !== null && count >= limit) {
          log.warn({ count, limit }, 'Operational thread limit reached');
          return c.json({
            error: 'Operational quota exceeded',
            message: `The self-hosted instance thread limit of ${limit} has been reached. Please contact your system administrator or update SELF_HOSTED_THREAD_LIMIT.`,
          }, 429);
        }
      }
    }
  }

  return await next();
}
