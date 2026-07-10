## Summary

The Hono API server (`apps/api`) has no request rate limiting. The web dev server (`apps/web/server.ts`) has global `express-rate-limit`, but the API on port 3001 is unthrottled.

## Risk

- `/intake/gmail` can be flooded to spawn Temporal workflows / DB writes (even with auth, volume attacks are costly).
- Authenticated routes can be abused for enumeration or resource exhaustion.
- No per-IP or per-org quotas at the HTTP layer (only optional `SELF_HOSTED_THREAD_LIMIT` on thread count).

## Suggested fix

- Add Hono middleware (e.g. `@hono-rate-limit` or Upstash ratelimit already in deps) scoped to:
  - `POST /intake/gmail` — strict limit (e.g. 60/min per IP)
  - `/api/*` — moderate limit per IP + optional per-org limit using JWT org resolution
- Respect `trust proxy` if deployed behind a load balancer.
- Return `429` with `Retry-After` header.

## Acceptance criteria

- [ ] Intake webhook rate limited independently of authenticated API
- [ ] Load test (k6) documents required env for auth tokens
- [ ] Tests cover 429 behavior
