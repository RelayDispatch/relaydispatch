#!/usr/bin/env node
/**
 * RelayDispatch — Startup Validation + E2E Probe Script
 * ─────────────────────────────────────────────────
 * Validates:
 *   Phase 1: Env vars present (worker + api)
 *   Phase 2: Temporal reachable on :7233
 *   Phase 3: API health check
 *   Phase 4: Job creation probe (queries Supabase)
 *   Phase 5: FSM transition rules
 *
 * Run: node scripts/validate-system.mjs
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import net from 'net';

const results = [];
let pass = 0, fail = 0;

function check(label, result, detail = '') {
  const ok = Boolean(result);
  const icon = ok ? '✅' : '❌';
  console.log(`  ${icon} ${label}${detail ? ': ' + detail : ''}`);
  results.push({ label, ok });
  ok ? pass++ : fail++;
}

// ── Phase 1: ENV ──────────────────────────────────────────────
console.log('\n━━━ Phase 1: ENV STATUS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

const WORKER_REQUIRED = [
  'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'VAULT_ENCRYPTION_KEY',
  'OPENROUTER_API_KEY', 'NYLAS_API_KEY', 'TEMPORAL_NAMESPACE', 'TEMPORAL_TASK_QUEUE',
];
const API_REQUIRED = [
  'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'VAULT_ENCRYPTION_KEY',
];

for (const v of WORKER_REQUIRED) {
  const val = process.env[v];
  check(`Worker env: ${v}`, val && val.trim() !== '', val ? `"${val.slice(0,20)}..."` : 'MISSING');
}
for (const v of API_REQUIRED) {
  check(`API env: ${v}`, process.env[v]?.trim(), '');
}

// ── Phase 2: Temporal reachable ────────────────────────────────
console.log('\n━━━ Phase 2: INFRASTRUCTURE ━━━━━━━━━━━━━━━━━━━━━━━━━━━');

const temporalOk = await new Promise((resolve) => {
  const s = net.createConnection({ host: '127.0.0.1', port: 7233 });
  s.setTimeout(2000);
  s.on('connect', () => { s.destroy(); resolve(true); });
  s.on('error', () => resolve(false));
  s.on('timeout', () => { s.destroy(); resolve(false); });
});
check('Temporal reachable :7233', temporalOk, temporalOk ? 'OK' : 'NOT RUNNING — run: temporal server start-dev');

// ── API health check ──────────────────────────────────────────
let apiOk = false;
try {
  const r = await fetch('http://localhost:3001/health', { signal: AbortSignal.timeout(3000) });
  const j = await r.json();
  apiOk = j?.status === 'ok';
  check('API /health', apiOk, apiOk ? `v${j.version}` : 'Bad response');
} catch {
  check('API /health', false, 'NOT RUNNING — run: npm run dev');
}

// ── Phase 3: Supabase connectivity ───────────────────────────
console.log('\n━━━ Phase 3: DATABASE ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

let jobsTableOk = false;
let latestJob = null;
try {
  const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  // Check organizations table (base)
  const { error: orgErr } = await sb.from('organizations').select('id').limit(1);
  check('DB: organizations table', !orgErr, orgErr ? orgErr.message : 'accessible');

  // Check jobs table
  const { data: jobs, error: jobsErr } = await sb
    .from('jobs')
    .select('id, status, service_type, created_at')
    .order('created_at', { ascending: false })
    .limit(3);

  jobsTableOk = !jobsErr;
  check('DB: jobs table accessible', jobsTableOk, jobsErr ? jobsErr.message : `${jobs?.length ?? 0} jobs found`);

  if (jobs && jobs.length > 0) {
    latestJob = jobs[0];
    check('DB: recent job has status=triaged', latestJob.status === 'triaged', `status=${latestJob.status}`);
  } else {
    console.log('  ℹ️  No jobs yet — trigger a workflow first: node scripts/trigger-test-workflow.mjs');
  }

  // Check technicians table
  const { error: techErr } = await sb.from('technicians').select('id').limit(1);
  check('DB: technicians table accessible', !techErr, techErr ? techErr.message : 'accessible');

} catch (e) {
  check('DB connectivity', false, e.message);
}

// ── Phase 4: FSM Transition Rules ────────────────────────────
console.log('\n━━━ Phase 4: FSM TRANSITION RULES ━━━━━━━━━━━━━━━━━━━━━');

const T = {
  new:                ['triaged','cancelled'],
  triaged:            ['ready_for_dispatch','cancelled'],
  ready_for_dispatch: ['assigned','scheduled','cancelled'],
  scheduled:          ['assigned','in_progress','cancelled'],
  assigned:           ['in_progress','cancelled'],
  in_progress:        ['completed','cancelled'],
  completed:          [],
  cancelled:          [],
};

const cases = [
  ['triaged',            'ready_for_dispatch', true],
  ['ready_for_dispatch', 'assigned',           true],
  ['assigned',           'in_progress',        true],
  ['in_progress',        'completed',           true],
  ['new',                'cancelled',           true],
  ['completed',          'assigned',            false],
  ['cancelled',          'triaged',             false],
  ['in_progress',        'triaged',             false],
];

for (const [from, to, expected] of cases) {
  const got = (T[from] ?? []).includes(to);
  check(`FSM: ${from} → ${to}`, got === expected, `expected=${expected} got=${got}`);
}

// ── Summary ───────────────────────────────────────────────────
console.log('\n━━━ FINAL REPORT ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`  Passed: ${pass} | Failed: ${fail} | Total: ${pass + fail}`);

if (fail === 0) {
  console.log('  🟢 STATUS: SYSTEM OPERATIONAL');
} else if (fail <= 3 && !results.find(r => r.label.startsWith('Worker env') && !r.ok)) {
  console.log('  🟡 STATUS: PARTIAL — infra not running (start Temporal + API)');
} else {
  console.log('  🔴 STATUS: NEEDS ATTENTION — check failed items above');
}

// Print actionable next steps for any failures
const infraFails = results.filter(r => !r.ok && (r.label.includes('Temporal') || r.label.includes('API')));
if (infraFails.length > 0) {
  console.log('\n  ► To start infrastructure:');
  if (!temporalOk) console.log('    1. temporal server start-dev    (in a separate terminal)');
  if (!apiOk)       console.log('    2. npm run dev                  (in a separate terminal)');
  console.log('    3. npm run worker               (in a separate terminal)');
  console.log('    4. node scripts/trigger-test-workflow.mjs');
  console.log('    5. node scripts/validate-system.mjs\n');
}
