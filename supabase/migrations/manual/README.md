# Manual migrations

SQL files in this directory are **not** applied automatically by Supabase CLI or CI.

| File | Purpose | How to apply |
|---|---|---|
| `20260710120100_org_secrets_drop_plaintext_columns.sql` | Drop legacy plaintext org secret columns after cutover | `node scripts/drop-org-secrets-plaintext-columns.mjs --confirm-drop-plaintext-secrets I_UNDERSTAND_THIS_IS_IRREVERSIBLE` |

Automatic migrations live in `supabase/migrations/`.
