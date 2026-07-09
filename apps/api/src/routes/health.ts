/**
 * apps/api/src/routes/health.ts
 * ──────────────────────────────
 * GET /health — Public health check endpoint.
 * No authentication required.
 */

import type { Context } from 'hono';
import { buildComplianceFooter } from '../../../../packages/compliance/src/index.js';

export async function handleHealth(c: Context) {
  return c.json({
    status:     'ok',
    service:    'relaydispatch-core',
    version:    '1.0.0',
    timestamp:  new Date().toISOString(),
    disclosure: buildComplianceFooter(),
  });
}
