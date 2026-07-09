/**
 * Observability constants — enum-like route names and idempotency key bucketing.
 *
 * `ApiObsRoute`: treat like a string enum — **append only**. Do not rename or remove
 * entries; downstream log parsers may depend on stable literals.
 * Keep new values in sync with SQL endpoint literals (e.g. jobs.dispatch) where relevant.
 */
export const ApiObsRoute = Object.freeze({
  JOBS_LIST:          'jobs.list',
  JOBS_GET:           'jobs.get',
  JOBS_DISPATCH:      'jobs.dispatch',
  JOBS_STATUS_PATCH:  'jobs.status_patch',
  TECHNICIANS_LIST:   'technicians.list',
  TECHNICIAN_PATCH:   'technician.patch',
  THREADS_LIST:       'threads.list',
  THREAD_TAKEOVER:    'threads.takeover',
  THREAD_RESOLVE:     'threads.resolve',
  INTAKE_DIRECT:      'intake.direct',
  BILLING_SUMMARY:    'billing.summary',
  PRICING_LIST:       'pricing.list',
} as const);

export type ApiObsRoute = (typeof ApiObsRoute)[keyof typeof ApiObsRoute];

/** Logs / background tasks not tied to an HTTP request. */
export const OBS_BACKGROUND_REQUEST_ID = 'background:no_http_request';

/** Coarse length bucket for Idempotency-Key header (no raw key in logs). */
export function idempotencyKeyLenBucket(key: string | null | undefined): string {
  if (key == null || key.length === 0) return 'none';
  const n = key.length;
  if (n <= 16) return '1-16';
  if (n <= 32) return '17-32';
  if (n <= 64) return '33-64';
  if (n <= 128) return '65-128';
  return '129-240';
}

/** Fixed low-cardinality buckets for idempotency replay age (logs use bucket only for timing cardinality). */
export function replayAgeMsBucket(ageMs: number | null | undefined): string {
  if (ageMs == null || !Number.isFinite(ageMs)) return 'unknown';
  if (ageMs < 60_000) return 'lt_1m';
  if (ageMs < 86_400_000) return 'm_to_24h';
  return 'gte_24h';
}
