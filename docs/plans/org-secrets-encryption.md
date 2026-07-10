# Plan: Encrypt org-scoped secrets at rest

## Problem

`organizations` stores integration credentials in plaintext columns:

- `twilio_auth_token`
- `mail_access_token`, `mail_refresh_token`
- `jobber_access_token`, `jobber_refresh_token`
- `servicetitan_access_token`, `servicetitan_client_secret`
- `housecall_access_token`, `housecall_refresh_token`

A database backup leak or overly broad SELECT exposes live third-party tokens.

## Goals

1. Encrypt all org-scoped secrets at rest using the same trust boundary as the PII vault (`VAULT_ENCRYPTION_KEY`).
2. Support key rotation via optional `VAULT_ENCRYPTION_KEY_OLD` (already used by `decryptVault`).
3. Zero-downtime migration for existing deployments with plaintext rows.
4. No plaintext secrets in API responses or structured logs.

## Non-goals (this phase)

- Moving secrets to an external KMS (AWS/GCP) — can be a later hardening step.
- Encrypting non-secret config (`twilio_number`, `nylas_grant_id`, tenant IDs).

## Proposed design

### 1. Shared crypto helper (`packages/security/src/orgSecrets.ts`)

Reuse the AES-256-GCM envelope already proven in `apps/worker/src/activities/shared.ts`:

```
ciphertext format: <24-hex IV>:<32-hex tag>:<hex ciphertext>
key: VAULT_ENCRYPTION_KEY (64 hex chars)
```

API surface:

```ts
encryptOrgSecret(plaintext: string): string
decryptOrgSecret(stored: string): string  // plaintext passthrough if legacy/unencrypted
isEncryptedOrgSecret(stored: string): boolean
```

`decryptOrgSecret` mirrors vault behavior: if value does not match `ENCRYPTED_VAULT_RE`, treat as legacy plaintext and return as-is (log once at warn). This enables lazy migration.

### 2. Schema migration (single SQL file)

**Option A — in-place column reuse (recommended, smallest diff):**

No column rename. Application encrypts on write; decrypt-on-read handles mixed state.

Add a one-time backfill script (`scripts/migrate-org-secrets.mjs`) that:

1. SELECT org rows with non-null secret columns.
2. Skip values already matching encrypted format.
3. UPDATE each column with `encryptOrgSecret(plaintext)`.
4. Run with service role; idempotent.

**Option B — shadow columns (safer rollback, more schema churn):**

Add `twilio_auth_token_enc`, etc., backfill, swap readers, drop old columns in a follow-up migration. Only needed if you want DB-level distinction between legacy and encrypted during rollout.

Recommend **Option A** for community/self-hosted simplicity.

### 3. Write path changes

| Location | Change |
|---|---|
| `apps/api/src/routes/providers.ts` | `encryptOrgSecret()` before `.update(updates)` for token fields |
| `apps/web` settings PATCH handler (when implemented) | same |
| `apps/worker/src/activities/email.ts` | `encryptOrgSecret()` when persisting refreshed `mail_access_token` |

### 4. Read path changes

| Location | Change |
|---|---|
| `apps/worker/src/activities/email.ts` | `decryptOrgSecret()` before OAuth refresh / Nylas calls |
| Twilio voice routes (when enabled) | decrypt before Twilio SDK init |
| CRM adapter token reads | decrypt at adapter boundary |

Centralize through a thin `getOrgSecret(org, field)` helper to avoid scattered decrypt calls.

### 5. API response hygiene

- `GET /api/providers/configuration` already masks `twilio_auth_token`; ensure encrypted blobs are never returned — only `twilio_auth_token_configured: boolean`.
- Audit all `organizations` SELECTs in API routes; never `.select('*')` on org rows with secrets.

### 6. Rotation procedure

Document in `DEVELOPER_GUIDE.md`:

1. Set `VAULT_ENCRYPTION_KEY_OLD` to current key.
2. Set `VAULT_ENCRYPTION_KEY` to new random 64-hex value.
3. Run `node scripts/migrate-org-secrets.mjs --reencrypt` to rewrite all encrypted columns with the new key.
4. Unset `VAULT_ENCRYPTION_KEY_OLD` after verification.

Same flow as PII vault rotation.

### 7. Testing

- Unit: encrypt/decrypt round-trip, legacy plaintext passthrough, wrong key fails closed.
- Integration: provider config POST stores encrypted value in DB (assert format regex).
- Worker: mail token refresh writes encrypted, subsequent read decrypts correctly.

### 8. Rollout sequence

1. Ship `orgSecrets.ts` + decrypt-on-read (readers tolerate plaintext).
2. Ship encrypt-on-write (new values encrypted immediately).
3. Run backfill script in maintenance window (or lazy: encrypt on next token refresh).
4. Add CI check: grep for plaintext token patterns in migration snapshots (optional).

## Estimated touch points

- `packages/security/src/orgSecrets.ts` (new)
- `packages/database/schema/migrations/00X_org_secrets_note.sql` (comment-only or backfill instructions)
- `scripts/migrate-org-secrets.mjs` (new)
- `apps/api/src/routes/providers.ts`
- `apps/worker/src/activities/email.ts`
- CRM adapter modules reading org tokens
- Tests under `tests/security/org-secrets.test.ts`

## Open questions (needs review before implementation)

1. Should `nylas_grant_id` be treated as a secret? (Grant IDs are less sensitive than tokens but still identify mail access.)
2. Multi-org users: `org_members.limit(1)` pattern assumes single org — encryption work should not widen that scope issue.
3. Supabase RLS: service-role worker bypasses RLS; encryption is defense-in-depth against DB dump, not a substitute for RLS.
