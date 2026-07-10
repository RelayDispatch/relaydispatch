# Org-scoped secrets encryption (Option B — implemented)

Shadow `*_enc` columns store AES-256-GCM ciphertext using `VAULT_ENCRYPTION_KEY`.
Plaintext columns remain during cutover and are dropped only via a **manual** script.

## Rollout

1. Apply automatic migration: `supabase/migrations/20260710120000_org_secrets_shadow_columns.sql`
2. Deploy application code (reads `*_enc` with plaintext fallback; writes `*_enc` only)
3. Run cutover: `npm run migrate:org-secrets-cutover`
4. Verify all orgs have `org_secrets_cutover_completed_at` set and plaintext columns NULL
5. Drop plaintext columns (irreversible):
   ```bash
   npm run migrate:org-secrets-drop-plaintext -- \
     --confirm-drop-plaintext-secrets I_UNDERSTAND_THIS_IS_IRREVERSIBLE
   ```
   Applies `supabase/migrations/manual/20260710120100_org_secrets_drop_plaintext_columns.sql`

## Encrypted fields

| Plaintext (deprecated) | Shadow column |
|---|---|
| `twilio_auth_token` | `twilio_auth_token_enc` |
| `mail_access_token` | `mail_access_token_enc` |
| `mail_refresh_token` | `mail_refresh_token_enc` |
| `jobber_access_token` | `jobber_access_token_enc` |
| `jobber_refresh_token` | `jobber_refresh_token_enc` |
| `servicetitan_client_secret` | `servicetitan_client_secret_enc` |
| `servicetitan_access_token` | `servicetitan_access_token_enc` |
| `housecall_access_token` | `housecall_access_token_enc` |
| `housecall_refresh_token` | `housecall_refresh_token_enc` |

## Not encrypted

- `nylas_grant_id` — OAuth grant identifier, not a bearer token (returned in admin configuration UI only; not logged in worker error paths)

## Code

- `packages/security/src/orgSecrets.ts` — crypto + read/write helpers
- `tests/security/org-secrets.test.ts` — unit tests
