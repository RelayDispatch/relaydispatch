/**
 * apps/api/src/index.ts
 * ──────────────────────────────
 * Main entrypoint for the RelayDispatch API Server (Port 3001/3000).
 */
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import pino from 'pino';

import { validateApiEnv } from '../../../packages/shared/utils/src/validateEnv.js';
import { authMiddleware } from './middleware/auth.js';
import { quotaMiddleware } from './middleware/quotaMiddleware.js';
import { handleHealth } from './routes/health.js';
import { intakeRouter, directIntakeRouter } from './routes/intake.js';
import { threadsRouter } from './routes/threads.js';
import { jobsRouter } from './routes/jobs.js';
import { techniciansRouter } from './routes/technicians.js';
import { pricingRouter } from './routes/pricing.js';
import { providersRouter } from './routes/providers.js';

// Pre-flight environment check
validateApiEnv();

const log = pino({ name: 'api-server', level: process.env.LOG_LEVEL ?? 'info' });
const app = new Hono();

// Global middleware
app.use('*', logger());
app.use('*', secureHeaders());
app.use('*', cors({
  origin: (process.env.ALLOWED_ORIGINS ?? 'http://localhost:3000,http://localhost:3001').split(','),
  credentials: true,
}));

// Public Routes
app.get('/health', handleHealth);

// Webhook / Public Intake Routes (unauthenticated, signature checked inside)
app.route('/intake', intakeRouter);

// Authenticated API Routes
const api = new Hono();
api.use('*', authMiddleware);

// Mount Provider management routes
api.route('/providers', providersRouter);

// Authenticated manual intake (org resolved from JWT — no client-supplied org_id)
api.route('/intake', directIntakeRouter);

// Mount System management routes (capabilities, configuration)
// These are read-only system-level endpoints — separate from provider CRUD.
const systemRouter = new Hono();

/** GET /api/system/capabilities — discovers platform capabilities and enabled adapters */
systemRouter.get('/capabilities', (c) => {
  return c.json({
    capabilities: {
      gmail_intake:          true,
      ai_dispatching:        true,
      sms_outbound_alerts:   true,
      crm_synchronization:   true,
    },
    version:   '1.0.0-community',
    byop_mode: true,
  });
});

/** GET /api/system/configuration — read-only runtime configuration summary */
systemRouter.get('/configuration', (c) => {
  return c.json({
    environment:        process.env.NODE_ENV           ?? 'development',
    temporal_namespace: process.env.TEMPORAL_NAMESPACE ?? 'relaydispatch-dispatch',
    log_level:          process.env.LOG_LEVEL          ?? 'info',
    unrestricted_quotas: !process.env.SELF_HOSTED_THREAD_LIMIT,
  });
});

api.route('/system', systemRouter);

// Mount Quota / Rate-limit Gate on remaining operational routes
const gatedApi = new Hono();
gatedApi.use('*', quotaMiddleware);

gatedApi.route('/threads', threadsRouter);
gatedApi.route('/jobs', jobsRouter);
gatedApi.route('/technicians', techniciansRouter);
gatedApi.route('/pricing', pricingRouter);

api.route('/', gatedApi);

app.route('/api', api);

const PORT = parseInt(process.env.PORT ?? '3001', 10);
serve({
  fetch: app.fetch,
  port: PORT,
}, () => {
  log.info(`🚀 RelayDispatch API Server running on port ${PORT}`);
});

export default app;
