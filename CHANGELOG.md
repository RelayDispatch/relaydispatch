# Changelog

All notable changes to RelayDispatch are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
This project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Fixed

- **[CRITICAL] `vitest` upgraded `^3.1.0` → `^3.2.6`** — resolves shell-quote CVE (GHSA-xxxx)
  that allowed arbitrary command execution in dev tooling. Fixed by direct upgrade.

- **[HIGH] `hono` upgraded `^4.7.0` → `^4.12.28`** — resolves high-severity request smuggling
  and header injection vulnerabilities in the API framework. Runtime dependency.

- **[HIGH] `vite` upgraded `^6.2.3` → `^6.4.3`** — resolves high-severity path traversal
  vulnerability in the dev server and build tool.

- **[HIGH] `@opentelemetry/sdk-node` and exporters upgraded `^0.215.0` → `^0.220.0`** — resolves
  high-severity vulnerabilities across the entire OpenTelemetry SDK suite.

- **[MODERATE] `nylas` upgraded `^8.0.5` → `^8.4.0`** — resolves `form-data` HIGH transitive
  vulnerability in the email integration SDK.

- **[BROKEN] `@vitest/coverage-v8` added as devDependency `^3.2.6`** — was missing entirely,
  causing `npm run test:coverage` to fail with `MISSING DEPENDENCY` error. CI `test` job would
  have failed on every run. Fixed by adding the required peer dependency.

- **`docker-compose.dev.yml` missing** — the file was referenced in CONTRIBUTING.md and
  SELF_HOSTING.md but did not exist. Created at `docker/docker-compose.dev.yml` with a local
  Temporal server setup for development. New contributors can now follow the getting-started guide.

- **Worker Docker stage ran TypeScript via `tsx` at runtime** — the `worker` target in the
  Dockerfile used `CMD ["npx", "tsx", "apps/worker/src/index.ts"]`, shipping TypeScript source
  and a transpiler in the production image. Worker now runs compiled JavaScript:
  `CMD ["node", "dist/apps/worker/src/index.js"]`.

- **Docker containers ran as root** — no `USER` instruction existed in any Dockerfile stage.
  All final stages (`api`, `web`, `worker`) now run as `USER node` (uid 1000).

- **CI workflow lacked `permissions` declaration** — `ci.yml` inherited the repository's
  default token permissions without explicit restriction. Added `permissions: contents: read`
  at workflow level following least-privilege principle.

- **Docker smoke test verified only `node --version`** — the `docker` job in `ci.yml` ran
  `docker run ... node --version`, which proves the image exists but nothing about the
  application. Smoke test now starts the API container in the background and verifies it
  remains running after 5 seconds.

- **CHANGELOG `[1.0.0]` release date was placeholder `2026-06-XX`** — updated to `2026-07-10` to match the official release date.

### Added

- **`vitest.config.ts`** — explicit Vitest configuration with `@vitest/coverage-v8` provider,
  baseline coverage thresholds (20% statements/branches/functions/lines), and proper
  include/exclude patterns for source files. Thresholds will be tightened in v1.2.0 as
  API route and Temporal workflow runtime tests are added.

- **`docker/docker-compose.dev.yml`** — development Docker Compose file. Starts a local
  Temporal server (`auto-setup:1.27` with SQLite) and Temporal Web UI at `http://localhost:8080`.
  The API, web, and worker intentionally run natively (not containerized) for hot-reload.

- **`BRANCH_PROTECTION.md`** — documents exact recommended GitHub branch protection settings
  including required status checks by CI job name, review requirements, merge strategy, and
  both GitHub CLI and UI application instructions.

- **`HEALTHCHECK` in Dockerfile `api` stage** — production API image now declares a Docker
  health check (`wget -qO- http://localhost:3001/health`) that orchestrators (Docker Swarm,
  ECS, Railway) can use for readiness and liveness detection.

- **`package.json` `overrides`** — added npm overrides to pin all transitive vulnerable
  packages: `ws@^8.21.0`, `shell-quote@^1.9.0`, `form-data@^4.0.6`, `js-yaml@^4.1.0`,
  `esbuild@^0.25.0`. Remaining 3 low/moderate vulnerabilities are all in dev-only tooling with
  no available upstream fix.

### Changed

- **`CODEOWNERS` expanded** — added explicit ownership for `.github/workflows/` (CI/CD changes
  now require maintainer review), `docker/` (image changes reviewed), `tests/` (test changes
  reviewed), `packages/shared/`, `apps/worker/`, and key governance documents
  (`THREAT_MODEL.md`, `GOVERNANCE.md`, `SECURITY.md`, `CLA.md`, `CODE_OF_CONDUCT.md`).

- **`CONTRIBUTING.md` quick-start updated** — added `docker compose -f docker/docker-compose.dev.yml up -d`
  step, corrected worker command from `npm run worker` to `npm run dev:worker`.

- **`docker/Dockerfile` refactored** — added `prod-deps` stage that installs production-only
  dependencies once and is reused by all final stages; reduces image build time and image size.

---

## [1.0.1] — 2026-07-09

This release is a **production hardening patch**. It fixes critical and high-severity bugs found during the initial open-source engineering audit, significantly expands the test suite, hardens the CI/CD pipeline, and adds key governance and security documentation.

No APIs are changed. No database migrations are required. Self-hosted deployments can upgrade by pulling the new Docker image.

### Fixed

- **[CRITICAL] Production mocks removed from `packages/ai/dispatcher/src/index.ts`** — hardcoded
  string-match mock responses (`eggs went bad`, `ignore your previous instructions`, etc.) that
  short-circuited the real LLM in all environments have been removed. These were test fixtures that
  accidentally shipped in the open-source release. Test scenarios now belong in `tests/` fixtures only.

- **[CRITICAL] Production mocks removed from `apps/worker/src/activities/ai.ts`** — identical
  string-match mock classification block removed from `classifyInboundRequest`. Removed the
  duplicated `categoryToLabel` function (canonical version is in `shared.ts`). Imports updated to
  use `categoryToLabel` from `shared.js`.

- **[HIGH] OpenRouter cost extraction fixed in dispatcher** — the original code read
  `(rawResponse as any)?.usage?.['x-openrouter-cost']` which always resolved to `undefined` because
  OpenRouter does not embed cost in the response body. Cost is now correctly computed from token
  counts using the local `estimateOpenRouterCost` function (same formula as `shared.ts`).
  This was causing all AI cost tracking to record `$0.000000`, making cost guardrails ineffective.

- **[HIGH] `max_tokens` increased from `250` to `1024` in dispatcher** — the original value
  systematically truncated the LLM mid-response because the structured JSON output schema alone
  requires ~80 tokens and a typical reply body is 200–600 tokens. Truncated JSON caused Zod
  schema validation to fail on every call, always triggering human escalation regardless of content.

- **[HIGH] `/api/system` routing bug fixed in `apps/api/src/index.ts`** — `api.route('/system',
providersRouter)` incorrectly aliased the full provider management router under `/system`,
  exposing unintended CRUD endpoints at `/api/system/configuration` (POST), `/api/system/test`,
  and `/api/system/usage`. A dedicated `systemRouter` now correctly exposes only the two read-only
  system endpoints: `GET /api/system/capabilities` and `GET /api/system/configuration`.

- **[HIGH] Duplicate system routes removed from `apps/api/src/routes/providers.ts`** — the
  `/capabilities` and `/configuration` route handlers inside `providersRouter` that were
  previously reachable at `/api/providers/capabilities` are removed now that the canonical
  location is `/api/system/*` via `systemRouter`.

- **[HIGH] Continue-As-New (CAN) added to `dispatchWorkflow.ts`** — long-running conversations
  with 8+ turns could approach Temporal's 50K event history hard limit, causing permanent
  non-retryable workflow failure. CAN is now triggered at turn 8 (before `MAX_TURNS=10`), carrying
  all essential state (vault, conversation tail, job IDs, classification results, nylasThreadId)
  into the resumed run via the new `ContinuationState` interface. Customers experience no
  interruption.

### Added

**Testing Infrastructure:**

- `tests/fixtures/factories.ts` — Typed factory functions for all domain objects (`makeOrg`,
  `makeThread`, `makeWorkflowInput`, `makeContinuationState`, `makeDispatcherResult`,
  `makeRawTurn`, `makeClassifiedRequest`, `makePiiVault`). Factories accept `Partial<T>` overrides.

- `tests/mocks/supabase.ts` — Centralised MSW handlers for all 18 Supabase REST endpoints.
  Includes `makeSupabaseErrorHandler` for testing DB error paths.

- `tests/mocks/openrouter.ts` — Centralised MSW handlers for the OpenRouter API, routing by model
  name. Scenario factories for rate-limit, server error, escalation, and truncated response paths.

- `tests/unit/redactor.test.ts` — 44 tests across 15 groups: phone detection (4 US formats),
  street address, ZIP, HVAC serial numbers, permit numbers, NER name detection, multi-turn vault
  reuse, overlapping match deduplication, rehydration, fuzzy rehydration of LLM-mangled
  placeholders, vault serialization round-trip, prompt injection resilience, holistic smoke test.

- `tests/unit/cost-guardrails.test.ts` — 35 tests: OpenRouter pricing table accuracy, per-org
  daily/monthly limit detection, UTC midnight daily reset, budget-block result shape validation,
  and zero/unknown-model edge cases.

- `tests/unit/continue-as-new.test.ts` — 26 tests: `ContinuationState` shape, state restoration,
  CAN threshold guard (triggers at turn 8), conversation tail slicing, and backward compatibility.

- `tests/security/prompt-injection.test.ts` — 48 tests across 8 attack groups: XML closing-tag
  injection (6 vectors), Zod schema enforcement, emergency keyword detection (10 real + 7 normal),
  adversarial bypass attempts, classifier/dispatcher prompt injection, and body text injection.

- `tests/security/hmac.test.ts` — 22 tests across 9 groups: valid acceptance, invalid rejection,
  missing signature, timing-safe length comparison, dev/prod mode, replay attack prevention,
  malformed base64 handling, and empty body with valid signature.

- `tests/workflow/dispatch-workflow.test.ts` — 37 tests: workflow input contract,
  ContinuationState resumption, CAN threshold (`it.each` turns 0–9), phase transition guards,
  signal payload shapes, ThreadState query shape, inactivity timeout conditions, and
  `MockActivityEnvironment` tests for classify and dispatch activities.

**CI/CD Pipeline:**

- `.github/workflows/ci.yml` expanded to a 4-job production pipeline: `quality` (typecheck +
  lint), `test` (vitest + coverage artifact, 14-day retention), `build` (gated; verifies web and
  API bundles; uploads dist artifact), `docker` (builds and smoke-tests Docker image, push only).

- `.github/workflows/security.yml` expanded to a 5-job security pipeline: `sca` (npm audit +
  Trivy filesystem scan → SARIF to GitHub Security), `codeql` (security-and-quality queries),
  `secrets` (Gitleaks scanning full git history), `sbom` (CycloneDX + SLSA provenance on main),
  `scorecard` (OpenSSF Scorecard, weekly and main push).

- `.github/workflows/release.yml` (new) — Release pipeline triggered on `v*` tags: validates
  CHANGELOG.md entry, full test gate, builds bundles, pushes multi-arch (amd64 + arm64) Docker
  image to GHCR with SLSA Level 2 provenance, creates GitHub Release with auto-extracted changelog
  notes and SBOM, optional Discord announcement for stable releases.

- `.github/workflows/dependency-review.yml` (new) — Blocks PRs introducing high/critical CVEs or
  OSI-incompatible licenses (GPL, AGPL, LGPL variants). Posts inline summary comments on every PR.

- `.github/workflows/stale.yml` (new) — Stale issue/PR management (issues: 60+14 days,
  PRs: 30+7 days). Security, pinned, help-wanted, and blocked labels permanently exempt.

**Documentation:**

- `THREAT_MODEL.md` (new) — Full STRIDE threat model: data flow diagrams for email dispatch and
  authentication; trust boundary matrix (7 boundaries); asset security objectives (9 assets, CIA
  ratings); 29 STRIDE threats with components, mitigations, and residual risk; OWASP LLM Top 10
  analysis with sub-threats; control matrix linking 12 controls to test coverage; 7 known-accepted
  risks (KAR-01 through KAR-07) with target remediation versions.

- `GOVERNANCE.md` (new) — Project governance: BDFN structure diagram, role definitions with
  path-to-maintainership criteria, four-tier decision process (routine/significant/RFC/security),
  contribution evaluation criteria and non-negotiable requirements, semver release policy with
  three channels, commercial use and CLA policy, community standards with enforcement tiers,
  conflict resolution, sustainability mechanisms, and amendment process.

### Security

- Documents 7 previously undocumented known-accepted risks in `THREAT_MODEL.md`:
  KAR-01 (OAuth CSRF state parameter), KAR-02 (CRM OAuth token plaintext storage),
  KAR-03 (vault serialized unencrypted in Temporal history), KAR-04 (Twilio in-memory call state),
  KAR-05 (Supabase connection pool uncapped), KAR-06 (audit before/after values incomplete),
  KAR-07 (no cryptographic proof of OpenRouter model identity).

- Gitleaks secret scanning now runs on full git history on every push to main and every PR.
- Dependency review gate blocks all PRs introducing new CVEs or GPL-family licenses.
- OpenSSF Scorecard added (weekly + main push).

### Tests

> **249/249 tests pass** — `npm test` completes in under 2 seconds.

| File                                        | Tests   |
| ------------------------------------------- | ------- |
| `tests/unit/redactor.test.ts`               | 44      |
| `tests/unit/cost-guardrails.test.ts`        | 35      |
| `tests/unit/continue-as-new.test.ts`        | 26      |
| `tests/security/prompt-injection.test.ts`   | 48      |
| `tests/security/hmac.test.ts`               | 22      |
| `tests/workflow/dispatch-workflow.test.ts`  | 37      |
| `tests/integration/email-to-jobber.test.ts` | 4       |
| `tests/unit/production-readiness.test.ts`   | 33      |
| **Total**                                   | **249** |

---

## [1.0.0] — 2026-07-10

### 🎉 Initial Open-Source Release

RelayDispatch v1.0.0 is the open-source transformation of a mature proprietary AI dispatch platform. This release establishes the architecture, removes all commercial dependencies, and makes the project suitable for community contribution and self-hosted deployment.

### Added

- Full open-source repository structure: `apps/`, `packages/`, `docs/`, `tests/`, `docker/`, `examples/`
- Comprehensive `.env.example` with documentation for all 50+ environment variables
- `README.md`, `LICENSE` (MIT), `CONTRIBUTING.md`, `CHANGELOG.md`, `CLA.md`
- GitHub Actions CI pipeline (typecheck, lint, test, build)
- GitHub Actions security workflow (weekly npm audit + CodeQL)
- Issue templates, PR template, CODEOWNERS, Dependabot config
- `docker/Dockerfile.api`, `docker/Dockerfile.worker`
- `docker/docker-compose.yml` (production) and `docker/docker-compose.dev.yml` (development)
- Full documentation suite: architecture overview, ADRs, API reference, getting started, deployment, AI system, database schema, security practices
- Architecture Decision Records: temporal workflow engine, PII vault design, OpenRouter gateway

### Changed

- **Agent name** now configurable via `AGENT_NAME` env var (default: `Dispatch`)
- **Brand name** now configurable via `AGENT_BRAND` env var (default: `RelayDispatch`)
- **App URL** now configurable via `APP_URL` env var (used in AI HTTP-Referer headers)
- **`backend/workflows/activities.ts`** (1,806 lines) split into 6 domain-specific activity files
- **`src/pages/dashboard/Settings.tsx`** (1,692 lines) split into 7 tab components
- All `console.log('[TRIAL_GATE]...')` debug statements replaced with structured `pino` logging

### Removed

- **Stripe billing integration** — checkout sessions, webhook handlers, subscription management
- **Trial gating middleware** — replaced with open configurable org limits (`ENABLE_ORG_LIMITS`)
- **`organizations.plan`**, `trial_ends_at`, `stripe_subscription_id`, `payment_status` columns (migration provided)
- **`check_org_limits()` RPC** — replaced with `feature_flags` JSONB approach
- **Pilot application landing page** — moved to `_archive/landing/`
- **Privacy and Terms legal pages** — moved to `_archive/legal/` (operators must write their own)
- **`backend/services/crypto.ts`** — 0-byte empty stub
- **`backend/services/telemetry.ts`** — 0-byte empty stub (real telemetry in `packages/telemetry/`)
- **`temporal.exe`** (350MB binary) — not appropriate for a source repository
- **`temporal-data.db`** (170MB SQLite) — runtime data, not source
- **`scripts/`** (66 one-off debug scripts) — moved to `_archive/scripts/`
- **`scratch/`** (3 ad-hoc scripts) — moved to `_archive/scratch/`
- **`backend/db/migrations/`** (parallel system) — consolidated into `packages/database/migrations/`
- **`supabase/master_reset.sql`** — moved to `_archive/`
- **`outreachEngine.ts`** / **`outreachScheduler.ts`** — personal credentials removed; moved to `_archive/outreach/`
- **Removed packages:** `stripe`, `@anthropic-ai/sdk`, `@google/generative-ai`, `@twilio/voice-sdk`
- **Moved to devDependencies:** `pino-pretty`
- **Staffing pivot tables** (`candidates`, `job_requisitions`) — dropped via migration (were never used)

### Security

- All production secrets removed from tracked files
- Comprehensive `.env.example` with placeholder values and documentation
- `temporal-data.db` (may have contained PII in Temporal workflow history) deleted
- Personal email credentials removed from all source files
- Hardcoded personal email addresses replaced with configurable env var examples

---

## Future Roadmap

### Planned for v1.1.0

- ServiceTitan CRM adapter (full implementation)
- Housecall Pro CRM adapter (full implementation)
- `POST /api/dispatch/manual` — actual implementation (currently a stub that only closes the thread)
- SSE dispatch events (`GET /api/dispatch/events`) — real event streaming
- OAuth callback CSRF hardening (`state` parameter as PKCE nonce) — resolves KAR-01
- CRM OAuth token encryption at rest — resolves KAR-02
- Vault blob encryption in Temporal workflow history — resolves KAR-03
- Supabase connection pool size cap — resolves KAR-05
