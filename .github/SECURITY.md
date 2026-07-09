# Security Policy

## Supported Versions

| Version | Supported |
|---|---|
| 1.x (latest) | ✅ Active |

---

## Reporting a Vulnerability

**Please do not open a public GitHub issue for security vulnerabilities.**

If you discover a security vulnerability in RelayDispatch, please disclose it responsibly:

1. **Email:** Open a [GitHub Security Advisory](https://github.com/relaydispatch/relaydispatch/security/advisories/new) (preferred) or contact the maintainers via [GitHub Discussions](https://github.com/relaydispatch/relaydispatch/discussions) with the subject line `[SECURITY]`.

2. **Include in your report:**
   - A description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Any suggested fix (optional but appreciated)

3. **Response timeline:**
   - We will acknowledge receipt within 72 hours
   - We aim to triage and confirm within 7 days
   - Coordinated disclosure after a fix is available

---

## Security Architecture Notes

RelayDispatch has the following security properties that reviewers should be aware of:

- **PII vault:** Customer PII is redacted before any LLM call and stored encrypted. Raw PII never leaves your database.
- **Row-Level Security:** Every database table is protected by Supabase RLS policies. Cross-tenant data access is prevented at the database layer.
- **HMAC verification:** Gmail Pub/Sub webhook payloads are verified with HMAC-SHA256.
- **JWT per request:** All `/api/*` routes use per-request user JWTs — no session state.
- **Service role isolation:** The Supabase service role key is only used in webhook and worker contexts, never in user-facing routes.

---

## Known Limitations

The following items are documented known gaps (see CHANGELOG for planned fixes):

- OAuth callback state parameter used for org_id routing rather than as a CSRF nonce
- Twilio Voice AI call state stored in-memory (not safe for multi-process deployment)
- CRM OAuth tokens stored as plaintext in the `organizations` table (encryption planned)
