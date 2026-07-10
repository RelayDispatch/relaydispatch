## Summary

Several API routes return internal error details to clients, which can leak schema, constraint names, or stack fragments.

## Examples

- `apps/api/src/routes/jobs.ts`, `threads.ts`, `technicians.ts`, `pricing.ts` — `c.json({ error: error.message }, 500)` from Supabase errors
- `apps/api/src/routes/intake.ts` — DLQ fallback previously returned `error: String(err)` (partially addressed in gmail path refactor; audit all intake error paths)
- `apps/api/src/routes/threads.ts` — `c.json({ error: String(err) }, 500)` on Temporal signal failures

## Risk

Attackers learn table/column names, RLS policy failures, or internal service topology from error strings.

## Suggested fix

- Introduce `toClientError(err, logContext)` helper: log full error server-side (pino), return `{ error: 'Internal server error', code: 'internal_error' }` in production.
- In development, optionally include detail when `NODE_ENV !== 'production'`.
- Audit all `c.json({ error: ... })` call sites under `apps/api`.

## Acceptance criteria

- [ ] No raw Supabase/Temporal exception text in production responses
- [ ] Structured server logs retain debugging context
- [ ] Regression test or lint rule for `error.message` in route handlers
