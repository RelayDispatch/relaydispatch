/**
 * packages/shared/utils/src/validateEnv.ts
 * ─────────────────────────────────────────────────────────────
 * Startup environment variable validation.
 *
 * Call validateWorkerEnv() / validateApiEnv() at the very top of
 * any process entry point before any code uses process.env.VAR!
 *
 * PRODUCTION behaviour:
 *   - Missing required var → logs [FATAL] and process.exit(1)
 *   - Never uses fallbacks
 *
 * DEVELOPMENT behaviour (NODE_ENV !== 'production'):
 *   - Missing var WITH a defined fallback → sets the fallback and
 *     logs [DEV] warning so the process boots for local dev/testing
 *   - Missing var WITHOUT a fallback → still fatal (same as prod)
 *
 * This replaces the implicit TypeScript `!` non-null assertion
 * pattern that causes silent runtime crashes instead of early
 * startup failures.
 */

import pino from 'pino';

const log    = pino({ name: 'env-validator', level: 'info' });
const isProd = process.env.NODE_ENV === 'production';

// ── Dev-safe fallback applier ─────────────────────────────────────────────────

/**
 * Ensures an env var is set. In dev, applies a fallback if provided.
 * In production, any missing var is fatal regardless of fallback.
 */
function ensure(name: string, fallback?: string): void {
  const current = process.env[name];
  if (current && current.trim() !== '') return;   // already set — nothing to do

  if (!isProd && fallback !== undefined) {
    process.env[name] = fallback;
    console.warn(`[DEV] ${name} not set — using dev fallback: "${fallback}". Set a real value for production.`);
    return;
  }

  // Missing with no fallback (or in production) — caught by validateEnv below
}

// ── Fallback application (DEV ONLY) ──────────────────────────────────────────

function applyWorkerDevFallbacks(): void {
  if (isProd) return;
  // Supabase — no fallback: must always be real (even in dev)
  // Vault key — no fallback: must always be real (even in dev)
  ensure('OPENROUTER_API_KEY', 'sk-dev-placeholder-openrouter');
  ensure('NYLAS_API_KEY',      'nylas-dev-placeholder');
  ensure('TEMPORAL_NAMESPACE', 'relaydispatch-dispatch');
  ensure('TEMPORAL_TASK_QUEUE','relaydispatch-dispatch');
}

function applyApiDevFallbacks(): void {
  if (isProd) return;
  ensure('SUPABASE_ANON_KEY', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dev-placeholder');
}

// ── Core validator ────────────────────────────────────────────────────────────

/**
 * Validates that all required environment variables are set and non-empty.
 * Logs each missing variable clearly and exits the process with code 1
 * if ANY variable is absent.
 */
export function validateEnv(vars: readonly string[], context = 'Process'): void {
  const missing: string[] = [];

  for (const name of vars) {
    const value = process.env[name];
    if (!value || value.trim() === '') {
      missing.push(name);
    }
  }

  if (missing.length > 0) {
    for (const name of missing) {
      console.error(`[FATAL] ${context}: Missing required env var: ${name}`);
    }
    console.error(
      `[FATAL] ${context}: ${missing.length} required environment variable(s) are not set. ` +
      `Copy .env.example to .env and fill in all values. Exiting.`,
    );
    process.exit(1);
  }

  log.info({ context, validated: vars.length }, `${context}: all ${vars.length} required env vars present`);
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Validates all env vars required by the Temporal worker process. */
export function validateWorkerEnv(): void {
  applyWorkerDevFallbacks();
  validateEnv([
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'VAULT_ENCRYPTION_KEY',
    'OPENROUTER_API_KEY',
    'NYLAS_API_KEY',
    'TEMPORAL_NAMESPACE',
    'TEMPORAL_TASK_QUEUE',
  ], 'Worker');
}

/** Validates all env vars required by the Hono API server. */
export function validateApiEnv(): void {
  applyApiDevFallbacks();
  const baseVars = [
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'VAULT_ENCRYPTION_KEY',
    'SUPABASE_ANON_KEY',
    'APP_BASE_URL',
  ] as const;

  const outreachEnabled = (process.env.OUTREACH_ENABLED ?? '').toLowerCase() === 'true';
  const outreachVars = outreachEnabled
    ? ([
        'OUTREACH_EMAIL_FROM',
        'EMAIL_HOST',
        'EMAIL_PORT',
        'EMAIL_USER',
        'EMAIL_PASS',
        'IMAP_HOST',
        'IMAP_PORT',
        'IMAP_USER',
        'IMAP_PASS',
      ] as const)
    : ([] as const);

  validateEnv([...baseVars, ...outreachVars], 'API');
}

/** Validates env vars required by outreach automation worker only. */
export function validateOutreachEnv(): void {
  validateEnv([
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'OUTREACH_EMAIL_FROM',
    'EMAIL_HOST',
    'EMAIL_PORT',
    'EMAIL_USER',
    'EMAIL_PASS',
    'IMAP_HOST',
    'IMAP_PORT',
    'IMAP_USER',
    'IMAP_PASS',
  ], 'Outreach');
}
