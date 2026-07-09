import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

// ── Metrics ───────────────────────────────────────────────────
const validIntakeSuccessRate = new Rate('valid_intake_success_rate');
const validHttpOkRate        = new Rate('valid_http_ok_rate');
const workflowStartedTotal   = new Counter('workflow_started_total');
const intakeLatency          = new Trend('intake_latency_ms', true);

// ── Env config ────────────────────────────────────────────────
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const AUTH_JWT = __ENV.AUTH_JWT || '';
const ORG_ID   = __ENV.ORG_ID   || '00000000-0000-0000-0000-000000000001';

// Custom simple UUID generator for test compatibility
function randomUUID() {
  return 'xxxx-xxxx-xxxx-xxxx'.replace(/[x]/g, () => Math.floor(Math.random() * 16).toString(16));
}

// ── Options ───────────────────────────────────────────────────
export const options = {
  scenarios: {
    ramping_load: {
      executor: 'ramping-arrival-rate',
      startRate: 10,
      timeUnit: '1s',
      preAllocatedVUs: 50,
      maxVUs: 150,
      stages: [
        { duration: '30s', target: 50 },
        { duration: '30s', target: 100 },
        { duration: '30s', target: 50 },
      ],
    },
  },
  thresholds: {
    'valid_intake_success_rate': ['rate>0.98'],
    'valid_http_ok_rate':        ['rate>0.99'],
    'intake_latency_ms':         ['p(95)<500', 'p(99)<900'],
  },
};

// ── Main VU function ──────────────────────────────────────────
export default function () {
  const payload = JSON.stringify({
    org_id:      ORG_ID,
    from_email:  `test+${randomUUID().slice(0, 8)}@example.com`,
    from_name:   'Load Test User',
    subject:     'AC not cooling',
    body_text:   'Hello, my AC is blowing warm air and making a strange sound. Can you help?',
    channel:     'email',
  });

  const start = Date.now();
  const res = http.post(`${BASE_URL}/api/intake/direct`, payload, {
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${AUTH_JWT}`,
    },
    tags: { name: 'direct_intake' },
  });
  
  intakeLatency.add(Date.now() - start);

  const isOk = res.status === 200 || res.status === 202;
  validHttpOkRate.add(isOk);

  let body = {};
  try {
    body = JSON.parse(res.body || '{}');
  } catch (e) {}

  const hasThreadId = !!body.thread_id;
  validIntakeSuccessRate.add(hasThreadId);

  if (hasThreadId) {
    workflowStartedTotal.add(1);
  }

  check(res, {
    'status is 200 or 202': (r) => isOk,
    'thread_id is present': (r) => hasThreadId,
  });

  sleep(0.1);
}
