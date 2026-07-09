import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

// ── Metrics ───────────────────────────────────────────────────
const successRate   = new Rate('scale_success_rate');
const httpOkRate    = new Rate('scale_http_ok_rate');
const totalStarted  = new Counter('scale_workflow_started_total');
const intakeLatency = new Trend('scale_intake_latency_ms', true);
const errorRate     = new Rate('scale_error_rate');

// ── Config ────────────────────────────────────────────────────
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const AUTH_JWT  = __ENV.AUTH_JWT  || '';
const ORG_ID    = __ENV.ORG_ID    || '00000000-0000-0000-0000-000000000001';

// Lightweight UUID for k6 compatibility
function uid() {
  return 'xxxxxxxx'.replace(/[x]/g, () => Math.floor(Math.random() * 16).toString(16));
}

// ── Stress profile: 200–300 VUs sustained ─────────────────────
export const options = {
  scenarios: {
    stress: {
      executor: 'ramping-arrival-rate',
      startRate: 50,
      timeUnit: '1s',
      preAllocatedVUs: 200,
      maxVUs: 400,
      stages: [
        { duration: '30s', target: 100 },  // warm-up ramp
        { duration: '1m',  target: 200 },  // sustained 200 VUs
        { duration: '30s', target: 300 },  // peak stress
        { duration: '30s', target: 200 },  // hold
        { duration: '30s', target: 0   },  // cool-down
      ],
    },
  },
  thresholds: {
    // Measurement-only: intentionally relaxed for stress profiling
    // We are NOT enforcing perf here — we are MEASURING system limits
    'scale_success_rate': ['rate>0.90'],
    'scale_http_ok_rate': ['rate>0.90'],
    'scale_intake_latency_ms': ['p(95)<5000'],  // stress: 5s max
  },
};

// ── Main VU ───────────────────────────────────────────────────
export default function () {
  const payload = JSON.stringify({
    org_id:     ORG_ID,
    from_email: `stress+${uid()}@loadtest.example.com`,
    from_name:  'Stress Test User',
    subject:    'Stress: AC making noise',
    body_text:  'My air conditioner is making a grinding noise and the temperature is not dropping. This is urgent as it is very hot outside.',
    channel:    'email',
  });

  const start = Date.now();
  const res = http.post(`${BASE_URL}/api/intake/direct`, payload, {
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${AUTH_JWT}`,
    },
    tags:    { name: 'stress_direct_intake' },
    timeout: '30s',
  });
  const duration = Date.now() - start;
  intakeLatency.add(duration);

  const isOk = res.status === 200 || res.status === 202;
  httpOkRate.add(isOk);
  errorRate.add(!isOk);

  let body = {};
  try { body = JSON.parse(res.body || '{}'); } catch (_) {}

  const hasThreadId = isOk && !!(body.thread_id);
  successRate.add(hasThreadId);
  if (hasThreadId) totalStarted.add(1);

  check(res, {
    'status 200/202':    (r) => isOk,
    'thread_id present': (_) => hasThreadId,
  });

  sleep(0.05);
}

export function handleSummary(data) {
  function safeVal(metric, key, fallback) {
    var m = data.metrics[metric];
    if (!m || !m.values) return fallback;
    var v = m.values[key];
    return v !== undefined ? v.toFixed(0) : fallback;
  }
  function safeRate(metric) {
    var m = data.metrics[metric];
    return m && m.values ? ((m.values.rate || 0) * 100).toFixed(2) + '%' : 'N/A';
  }
  function safeCount(metric) {
    var m = data.metrics[metric];
    return m && m.values ? (m.values.count || 0) : 0;
  }

  var report = {
    test:       'k6-scale-stress',
    timestamp:  new Date().toISOString(),
    scenario:   '100-300 VUs ramped stress',
    performance: {
      p50_ms:  safeVal('scale_intake_latency_ms', 'p(50)', 'N/A'),
      p95_ms:  safeVal('scale_intake_latency_ms', 'p(95)', 'N/A'),
      p99_ms:  safeVal('scale_intake_latency_ms', 'p(99)', 'N/A'),
      avg_ms:  safeVal('scale_intake_latency_ms', 'avg',   'N/A'),
      max_ms:  safeVal('scale_intake_latency_ms', 'max',   'N/A'),
    },
    reliability: {
      http_ok_rate:      safeRate('scale_http_ok_rate'),
      workflow_success:  safeRate('scale_success_rate'),
      workflows_started: safeCount('scale_workflow_started_total'),
    },
    verdict: (data.metrics['scale_http_ok_rate'] && (data.metrics['scale_http_ok_rate'].values.rate || 0) >= 0.90)
      ? 'STABLE_UNDER_STRESS' : 'DEGRADED_UNDER_STRESS',
  };

  var out = '\n=== SCALE STRESS TEST REPORT ===\n' + JSON.stringify(report, null, 2);
  console.log(out);
  return { stdout: out };
}


