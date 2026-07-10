## Summary

Low-severity findings from the `apps/` security audit (Jul 2026) deferred from the CI remediation PR.

## Items

### Info disclosure
- `GET /api/system/configuration` exposes `temporal_namespace`, `log_level`, quota mode — consider restricting to admin role or removing from production builds.

### Provider test endpoint
- `POST /api/providers/test` always returns `success: true` without validating connectivity — misleading for operators (not directly exploitable).

### Client/API drift
- `apps/web/src/lib/apiClient.ts` references routes (`/api/org/*`, `/api/calls/*`, `/api/alerts/*`, `/api/contacts/*`) not implemented in `apps/api` — document or remove dead client methods to reduce confusion about auth surface.

### JWT client cache
- `createUserSupabase` caches up to 1000 JWT strings in memory — acceptable for single-tenant but document memory bounds for multi-tenant deployments.

### k6 load scripts
- `tests/load/k6-scale.js`, `k6-clean-valid.js` may still reference old intake paths or default tokens — align with `authorizeGmailPubSubPush` policy.

## Acceptance criteria

- [ ] Triage each item with severity label
- [ ] Fix or document intentional behavior
- [ ] No new security regressions in intake auth
