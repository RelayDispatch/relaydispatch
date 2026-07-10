# Security follow-up issues (file via `gh issue create`)

Run from repo root after installing/authing `gh`:

```bash
gh issue create --title "security: add API-level rate limiting on intake and authenticated routes" --label "security" --body-file .github/issue-drafts/api-rate-limiting.md
gh issue create --title "security: sanitize API error responses to prevent information disclosure" --label "security" --body-file .github/issue-drafts/api-error-disclosure.md
gh issue create --title "security: reduce low-severity API info disclosure and audit gaps" --label "security" --body-file .github/issue-drafts/api-low-severity-hardening.md
```
