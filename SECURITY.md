# Security Policy

> **Version:** 1.0 (2026 Edition)
>
> This document describes the security policies, vulnerability disclosure process, supported versions, secure development practices, and defensive architecture of RelayDispatch.
>
> Security is a core design principle of RelayDispatch. Every subsystem—from AI orchestration and workflow execution to authentication, provider integrations, and data handling—is designed with defense-in-depth, least privilege, and secure-by-default principles.

---

# Table of Contents

- Security Philosophy
- Supported Versions
- Reporting Security Vulnerabilities
- Coordinated Vulnerability Disclosure
- Safe Harbor
- Security Response Process
- Severity Classification
- Security Architecture
- AI Security Model
- Authentication & Authorization
- Secrets Management
- Cryptography
- Webhook Security
- Provider Security
- Supply Chain Security
- Secure Development Lifecycle
- Logging & Auditability
- Secure Deployment Recommendations
- Known Security Limitations
- Security Roadmap
- Security Advisories
- Contact

---

# Security Philosophy

RelayDispatch follows a **Secure-by-Design** engineering philosophy.

Security controls are incorporated into the architecture rather than added as afterthoughts.

The project is designed around the following principles:

- Least Privilege
- Defense in Depth
- Zero Trust between services
- Explicit Trust Boundaries
- Fail Secure
- Privacy by Design
- Secure Defaults
- Principle of Complete Mediation
- Deterministic AI Inputs
- Auditability

Every new feature should improve or maintain the project's security posture.

Security regressions are treated as defects.

---

# Supported Versions

Only actively maintained releases receive security updates.

| Version                             | Supported | Status              |
| ----------------------------------- | --------- | ------------------- |
| Latest Stable Release               | ✅        | Fully Supported     |
| Current Development Branch (`main`) | ✅        | Best-effort         |
| Previous Major Release              | ⚠️        | Critical fixes only |
| Older Releases                      | ❌        | Unsupported         |

Users are strongly encouraged to remain on the latest stable release.

---

# Reporting a Vulnerability

**Please do NOT disclose vulnerabilities publicly.**

Instead, report them privately.

**Primary Contact**

uzair.shaikh.sec@outlook.com

Please include:

- vulnerability description
- affected component
- reproduction steps
- proof of concept (if available)
- impact assessment
- affected version
- proposed mitigation (optional)

Attachments such as screenshots, logs, packet captures, stack traces, or proof-of-concept code are appreciated when they help reproduce the issue.

Do **not** include production secrets, customer data, or personally identifiable information in your report.

---

# Expected Response Timeline

RelayDispatch aims to follow the response objectives below.

| Stage                   | Target                 |
| ----------------------- | ---------------------- |
| Initial acknowledgement | Within 48 hours        |
| Initial triage          | Within 5 business days |
| Severity assessment     | Within 7 business days |
| Remediation plan        | As soon as practical   |
| Coordinated disclosure  | After fix availability |

These are targets rather than guarantees.

Complex issues may require additional investigation.

---

# Coordinated Vulnerability Disclosure

RelayDispatch follows a Coordinated Vulnerability Disclosure (CVD) process.

Security researchers are encouraged to provide maintainers with a reasonable opportunity to investigate and remediate reported vulnerabilities before public disclosure.

During this period, maintainers may:

- request additional information;
- ask clarifying questions;
- provide testing builds;
- coordinate CVE publication;
- prepare release notes;
- coordinate disclosure timing.

Public disclosure should occur only after maintainers confirm that remediation has been released or sufficient mitigation guidance has been published.

---

# Safe Harbor for Security Researchers

RelayDispatch supports responsible security research.

Provided that your activities are conducted in good faith, we will not pursue legal action solely for:

- identifying vulnerabilities;
- privately reporting vulnerabilities;
- validating reported issues;
- responsibly documenting security findings.

Researchers are expected to:

- avoid privacy violations;
- avoid service disruption;
- avoid destructive testing;
- avoid data exfiltration;
- avoid persistence mechanisms;
- avoid social engineering;
- avoid denial-of-service attacks.

Testing must be limited to systems you own or systems for which you have explicit authorization.

---

# Security Severity Classification

Reported vulnerabilities are evaluated using industry-standard risk assessment practices.

| Severity | Description                                                                                                   |
| -------- | ------------------------------------------------------------------------------------------------------------- |
| Critical | Remote compromise, privilege escalation, authentication bypass, arbitrary code execution, major data exposure |
| High     | Significant confidentiality, integrity, or availability impact                                                |
| Medium   | Exploitable weakness requiring specific conditions                                                            |
| Low      | Limited security impact or defense-in-depth improvement                                                       |

Severity may be adjusted based on exploitability, deployment configuration, affected components, and operational impact.

---

# Security Response Process

Every reported vulnerability progresses through the following lifecycle:

1. Report received
2. Initial validation
3. Reproduction
4. Risk assessment
5. Root cause analysis
6. Patch development
7. Internal verification
8. Security review
9. Release preparation
10. Public advisory (when appropriate)

Where appropriate, security fixes may be released prior to public disclosure.

---

# Secure Development Lifecycle (SDL)

RelayDispatch follows a security-first engineering model throughout the software development lifecycle.

## Design Principles

Security controls are incorporated during:

- Architecture design
- Feature planning
- Development
- Code review
- Testing
- Release engineering
- Deployment
- Incident response

Major architectural changes should include:

- Threat analysis
- Trust boundary review
- Authentication impact review
- Authorization impact review
- Data flow review
- Abuse case analysis

---

# AI Security Architecture

RelayDispatch is designed around the principle that Large Language Models should never become trusted decision makers.

The AI system is an advisory component operating inside a deterministic workflow.

## Core Principles

### Human Authority

AI never receives unrestricted authority.

Examples include:

- Job creation
- Technician assignment
- Customer communication
- Escalation decisions
- Pricing generation

Every workflow enforces deterministic validation before irreversible actions occur.

---

### Principle of Least Context

LLMs receive only the minimum context required.

Examples:

- Redacted email body
- Structured classification data
- Required pricing records
- Technician availability
- Conversation summary

The model never receives:

- Database credentials
- API secrets
- Authentication tokens
- Internal configuration
- Service role credentials
- Infrastructure metadata

---

### Prompt Injection Protection

RelayDispatch assumes all inbound customer content is untrusted.

Mitigations include:

- XML/structured delimiters
- Strict system prompt separation
- Prompt templates stored separately from runtime input
- Structured JSON outputs
- Zod schema validation
- Confidence scoring
- Human escalation for uncertain responses

Prompt instructions originating from customer messages are treated strictly as user content.

---

### Output Validation

LLM responses are never executed directly.

Outputs are validated before use.

Validation includes:

- Schema validation
- Required field validation
- Confidence threshold checks
- Pricing verification
- Organization policy verification
- Escalation rules

Invalid responses are rejected.

---

### Hallucination Prevention

RelayDispatch minimizes hallucinations by ensuring the AI never invents business-critical information.

The Dispatcher receives authoritative data from:

- Pricing database
- Organization configuration
- Technician schedules
- CRM state
- Conversation history

Missing information results in clarification requests rather than fabricated responses.

---

# Authentication & Authorization

RelayDispatch separates authentication from authorization.

## Authentication

Supported mechanisms include:

- JWT authentication
- OAuth provider tokens
- Service account authentication
- Signed webhooks

Authentication verifies identity.

Authorization determines permissions.

---

## Authorization

Authorization is enforced using organizational boundaries.

Permissions include:

- Organization membership
- Administrative privileges
- Worker-only operations
- API route authorization
- Internal workflow permissions

Worker processes possess elevated privileges only when required.

---

## Service Separation

Different runtime components operate with different privilege levels.

| Component     | Privilege                  |
| ------------- | -------------------------- |
| Web Dashboard | User-level access          |
| API Server    | Authenticated user context |
| Worker        | Service role               |
| Scheduler     | Background automation      |
| Database      | Row Level Security         |

Administrative credentials are never exposed to browsers.

---

# Cryptography

RelayDispatch uses modern cryptographic primitives.

## Supported Algorithms

| Purpose                          | Algorithm                    |
| -------------------------------- | ---------------------------- |
| PII Vault                        | AES-256-GCM                  |
| Webhook Validation               | HMAC-SHA256                  |
| Password Hashing (if applicable) | Argon2id / Provider Managed  |
| TLS                              | TLS 1.3 Recommended          |
| Random Generation                | Cryptographically Secure RNG |

Weak cryptographic algorithms should never be introduced.

Examples include:

- MD5
- SHA-1
- DES
- RC4
- ECB encryption

---

# Secret Management

Secrets must never be stored inside source control.

Examples include:

- API Keys
- OAuth Secrets
- JWT Secrets
- Database Passwords
- Encryption Keys
- Cloud Credentials
- Signing Certificates

Recommended secret managers include:

- GitHub Actions Secrets
- Doppler
- AWS Secrets Manager
- Google Secret Manager
- Azure Key Vault
- HashiCorp Vault
- Kubernetes Secrets (with external secret providers)

Environment variables should only act as the runtime delivery mechanism.

They are not considered secure storage.

---

# Dependency Security

Third-party dependencies introduce supply chain risk.

Maintainers should routinely:

- Update dependencies
- Review changelogs
- Monitor CVEs
- Remove abandoned packages
- Prefer actively maintained projects

Recommended tooling:

- npm audit
- GitHub Dependabot
- OSV Scanner
- Trivy
- Snyk (optional)

Security updates should be prioritized over feature work whenever critical vulnerabilities are identified.

---

# Supply Chain Security

RelayDispatch encourages modern software supply chain practices.

Recommended controls include:

- Signed commits
- Protected branches
- Required reviews
- Immutable releases
- Dependency pinning
- Lockfile verification
- Provenance attestations
- SBOM generation
- Reproducible builds where feasible

Organizations deploying RelayDispatch in regulated environments should adopt additional controls aligned with their compliance requirements.

---

# API Security

RelayDispatch follows a defense-in-depth strategy for every externally accessible endpoint.

## Authentication

Every protected endpoint must require authentication before business logic executes.

Supported authentication methods include:

- JWT Bearer Tokens
- OAuth Access Tokens
- Service Tokens
- Signed Webhooks
- Internal Worker Authentication

Unauthenticated requests should fail immediately.

---

## Authorization

Authentication identifies _who_ is making the request.

Authorization determines _what_ they may do.

Authorization checks should be performed on every protected resource.

Examples include:

- Organization ownership
- Technician permissions
- Administrative privileges
- Billing access
- Workflow management
- Audit log visibility

Authorization should never rely solely on client-side state.

---

## Input Validation

All external input is considered untrusted.

RelayDispatch validates:

- Query parameters
- URL parameters
- JSON bodies
- Multipart uploads
- Webhook payloads
- AI-generated outputs

Validation should occur before business logic executes.

Recommended practices include:

- Zod schema validation
- Strict typing
- Allow-list validation
- Maximum payload limits
- MIME validation
- Character encoding validation

---

## Rate Limiting

Production deployments should enforce rate limits.

Recommended categories:

| Endpoint       | Recommendation         |
| -------------- | ---------------------- |
| Authentication | Strict                 |
| AI Generation  | Moderate               |
| Webhooks       | Provider-specific      |
| Public APIs    | Per-IP                 |
| Internal APIs  | Service Authentication |

Burst protection should be implemented independently from sustained limits.

---

## CORS

Cross-Origin Resource Sharing should be explicitly configured.

Recommended practices:

- Allow only trusted origins
- Restrict methods
- Restrict headers
- Disable wildcard origins in production
- Use HTTPS exclusively

---

## HTTP Security Headers

Production deployments should include:

- Strict-Transport-Security
- Content-Security-Policy
- X-Content-Type-Options
- Referrer-Policy
- Permissions-Policy
- X-Frame-Options

These headers significantly reduce browser-based attack vectors.

---

# Database Security

RelayDispatch assumes PostgreSQL (Supabase).

## Row Level Security

Every user-accessible table should enforce Row Level Security (RLS).

Policies should ensure:

- Organization isolation
- User ownership
- Least privilege
- Explicit deny-by-default

---

## Service Role Usage

Service role credentials must remain isolated.

Only worker processes should access:

- privileged migrations
- administrative operations
- background jobs
- webhook processing

User-facing APIs should never expose service-role capabilities.

---

## SQL Injection

RelayDispatch avoids SQL injection through:

- parameterized queries
- ORM abstractions
- query builders
- input validation

Dynamic SQL should be avoided whenever possible.

---

# Temporal Workflow Security

Temporal provides workflow durability.

Security considerations include:

## Workflow Determinism

Workflow code must remain deterministic.

Avoid:

- random values
- current timestamps
- network requests
- filesystem access

These belong inside Activities.

---

## Activity Isolation

Activities execute side effects.

Examples include:

- sending emails
- CRM updates
- SMS delivery
- AI inference
- database writes

Activities should remain idempotent whenever possible.

---

## Retry Safety

Retries should never duplicate side effects.

Examples:

✓ Duplicate-safe

- Classification
- Read operations
- Logging

Requires idempotency

- Email delivery
- Job creation
- CRM updates
- Notifications

---

## Workflow Versioning

Workflow definitions evolve over time.

Breaking changes should use Temporal versioning mechanisms.

Existing executions must remain replay-compatible.

---

# AI Threat Model

Large Language Models introduce unique security risks.

RelayDispatch addresses the following categories.

---

## Prompt Injection

Threat:

Users attempt to override system instructions.

Mitigations:

- Structured prompts
- XML delimiters
- Context separation
- Output validation
- Human escalation

---

## Data Exfiltration

Threat:

LLM attempts to reveal confidential information.

Mitigations:

- PII redaction
- Minimal context
- No secret exposure
- Output review

---

## Hallucinations

Threat:

Model invents facts.

Mitigations:

- Database-backed pricing
- Structured outputs
- Confidence scoring
- Human review

---

## Context Poisoning

Threat:

Conversation history manipulates future outputs.

Mitigations:

- Librarian summarization
- Context compaction
- Structured history
- Fresh classification

---

## Tool Abuse

Threat:

AI misuses external integrations.

Mitigations:

- Deterministic orchestration
- Permission boundaries
- Activity validation
- Explicit tool contracts

---

## Model Availability

Threat:

LLM provider outage.

Mitigations:

- Vendor abstraction
- OpenRouter routing
- Human escalation
- Retry policies

---

# Container Security

For Docker deployments:

Recommended practices include:

- Non-root containers
- Read-only filesystem where possible
- Minimal base images
- Multi-stage builds
- Regular image updates
- Image scanning
- Dropped Linux capabilities
- Resource limits

Avoid privileged containers.

---

# Infrastructure Security

Production deployments should enforce:

- HTTPS everywhere
- Private networking
- Firewall restrictions
- Least-privilege IAM
- Multi-factor authentication
- Audit logging
- Infrastructure-as-Code review
- Backup verification

Cloud provider security remains the responsibility of operators.

---

# Logging

Logs should assist investigations without exposing sensitive information.

Never log:

- Passwords
- JWTs
- API Keys
- OAuth Tokens
- Encryption Keys
- Customer PII
- Full Email Bodies

Prefer structured logging using Pino.

---

# Audit Trail

Security-relevant actions should generate audit events.

Examples:

- Authentication
- Authorization failures
- AI escalations
- Workflow failures
- Configuration changes
- Organization management
- Billing events

Audit records should be immutable whenever feasible.

---

# Monitoring

Production deployments should monitor:

- Error rates
- Authentication failures
- Worker crashes
- AI costs
- Queue latency
- Retry storms
- Webhook failures
- Database health
- Infrastructure availability

Monitoring should trigger alerts before customer impact occurs.

---

# Incident Response

A recommended incident lifecycle:

1. Detection
2. Triage
3. Containment
4. Investigation
5. Remediation
6. Recovery
7. Postmortem
8. Preventive Improvements

Every significant incident should result in documented corrective actions.

---

# Backup & Disaster Recovery

Operators should maintain:

- Database backups
- Configuration backups
- Secret recovery procedures
- Infrastructure definitions
- Migration history

Backups should be regularly tested through restoration exercises.

Recovery plans that are never tested should be considered unverified.

---

---

# Security Testing

Security is an ongoing engineering process rather than a one-time verification exercise.

RelayDispatch encourages both maintainers and community contributors to continuously evaluate the security posture of the project.

## Security Testing Philosophy

Every change should be evaluated for its potential impact on:

- Authentication
- Authorization
- Workflow integrity
- AI safety
- Privacy
- Supply-chain security
- Infrastructure security
- Operational resilience

Security regressions are treated with the same priority as functional regressions.

---

# Static Application Security Testing (SAST)

The project recommends running static analysis before every release.

Recommended tooling includes:

| Tool                  | Purpose                            |
| --------------------- | ---------------------------------- |
| ESLint Security Rules | JavaScript / TypeScript analysis   |
| Semgrep               | Security pattern detection         |
| CodeQL                | Deep code analysis                 |
| npm audit             | Dependency vulnerabilities         |
| OSV Scanner           | Open Source vulnerability database |
| Trivy                 | Container & dependency scanning    |

Maintainers should regularly review findings and prioritize remediation according to risk.

---

# Dynamic Application Security Testing (DAST)

Production deployments should be periodically evaluated using dynamic testing.

Recommended areas include:

- Authentication bypass
- Authorization bypass
- Session management
- CSRF protection
- Rate limiting
- Injection attacks
- API misuse
- File upload handling
- Webhook validation
- AI endpoints

DAST should be performed only against environments you own or have explicit authorization to test.

---

# Dependency Management

Third-party dependencies represent one of the largest attack surfaces in modern software.

Maintainers should:

- Keep dependencies up to date.
- Remove unused packages.
- Replace abandoned projects.
- Pin dependency versions where appropriate.
- Review release notes before major upgrades.

Automated dependency update services are strongly recommended.

---

# Supply Chain Integrity

RelayDispatch supports modern software supply chain security practices.

Recommended controls include:

- Protected branches
- Mandatory pull request reviews
- Signed commits
- Signed releases
- Provenance attestations
- Software Bill of Materials (SBOM)
- Verified release artifacts
- Immutable build pipelines

Organizations deploying RelayDispatch in production are encouraged to implement the
recommendations outlined in the SLSA (Supply-chain Levels for Software Artifacts) framework.

---

# Vulnerability Management

Security vulnerabilities should be addressed based on severity.

| Severity | Target Response               |
| -------- | ----------------------------- |
| Critical | Immediate investigation       |
| High     | As soon as practical          |
| Medium   | Scheduled maintenance release |
| Low      | Future maintenance cycle      |

The actual remediation timeline depends on exploitability, impact, and available mitigations.

---

# Security Patch Policy

Whenever practical, security fixes should:

- include regression tests
- avoid unnecessary breaking changes
- preserve API compatibility
- document migration requirements
- include release notes

If a breaking change is required to mitigate a critical vulnerability, maintainers may prioritize security over backward compatibility.

---

# Supported Cryptography

RelayDispatch currently relies upon modern industry-standard cryptographic primitives.

Recommended algorithms include:

| Purpose              | Recommended Algorithm        |
| -------------------- | ---------------------------- |
| Symmetric Encryption | AES-256-GCM                  |
| Password Hashing     | Argon2id                     |
| HMAC                 | SHA-256                      |
| TLS                  | TLS 1.3                      |
| Random Numbers       | Cryptographically Secure RNG |

The following algorithms should not be introduced into the codebase:

- MD5
- SHA-1
- RC4
- DES
- Triple DES (3DES)
- ECB Mode Encryption

Future algorithm upgrades may occur as cryptographic recommendations evolve.

---

# Secure Coding Guidelines

Contributors should follow these principles whenever modifying RelayDispatch.

## Authentication

Always authenticate before authorization.

Never assume identity based on client input.

---

## Authorization

Every sensitive action should verify permissions.

Do not rely on UI controls for access control.

---

## Validation

All external input should be validated before use.

Examples include:

- HTTP requests
- Webhooks
- Environment variables
- AI outputs
- Uploaded files

---

## Error Handling

Errors should be informative for developers without exposing sensitive implementation details.

Avoid returning:

- stack traces
- SQL queries
- internal paths
- secrets
- infrastructure metadata

---

## Logging

Logs should be:

- structured
- searchable
- privacy-aware
- free of secrets

Sensitive values should be masked before logging.

---

## Secrets

Never commit:

- API Keys
- OAuth Secrets
- Encryption Keys
- JWT Secrets
- Service Role Keys
- Cloud Credentials
- Production URLs containing credentials

Use environment variables or dedicated secret management systems instead.

---

# AI Safety Principles

RelayDispatch treats AI as an assistive system rather than an autonomous authority.

The AI subsystem follows several non-negotiable principles.

## Human Oversight

Critical business decisions should remain reviewable by humans.

---

## Deterministic Workflows

AI assists workflow execution.

It does not replace workflow orchestration.

Temporal remains the source of execution truth.

---

## Privacy by Design

Customer information is minimized before reaching AI systems.

PII protection is enforced before inference.

---

## Explainability

Where practical, AI decisions should include supporting metadata such as:

- confidence score
- escalation reason
- model used
- token usage
- estimated cost

These records improve transparency and operational debugging.

---

## Fail Safe Behavior

When uncertainty exceeds acceptable thresholds, the system should favor escalation rather than automation.

Safe failure is preferred over incorrect automation.

---

---

# Security Compliance & Industry Alignment

RelayDispatch is designed to align with widely adopted security frameworks and engineering best practices. While RelayDispatch does not claim formal certification, its architecture intentionally follows many of the principles found within modern security standards.

## Security Framework Alignment

| Framework                                      | Alignment                         |
| ---------------------------------------------- | --------------------------------- |
| OWASP ASVS 5.x                                 | Application Security Verification |
| OWASP API Security Top 10 (2023)               | API Design & Protection           |
| OWASP LLM Top 10                               | AI Application Security           |
| NIST AI Risk Management Framework (AI RMF 1.0) | AI Governance                     |
| NIST Cybersecurity Framework (CSF 2.0)         | Risk Management                   |
| CIS Critical Security Controls v8              | Infrastructure Security           |
| SLSA                                           | Software Supply Chain Integrity   |
| OpenSSF Scorecard                              | Open Source Security Practices    |
| SPDX                                           | Software Bill of Materials (SBOM) |
| Sigstore / Cosign                              | Artifact Signing (Recommended)    |

Implementation responsibility ultimately remains with organizations deploying RelayDispatch.

---

# AI Security Mapping

RelayDispatch was designed specifically to mitigate common risks associated with Large Language Models.

| Threat                     | Mitigation                                     |
| -------------------------- | ---------------------------------------------- |
| Prompt Injection           | Structured prompts, XML boundaries, validation |
| Data Leakage               | PII Redaction Layer                            |
| Hallucinated Pricing       | Database-backed pricing only                   |
| Unauthorized Tool Usage    | Deterministic Activities                       |
| Context Poisoning          | Librarian summarization pipeline               |
| Sensitive Context Exposure | Context minimization                           |
| Model Availability         | Vendor abstraction through OpenRouter          |
| Excessive Cost             | Organization budget guardrails                 |
| Unsafe Automation          | Human escalation path                          |

The AI subsystem intentionally operates as an advisory component rather than an autonomous authority.

---

# Privacy Principles

RelayDispatch follows Privacy-by-Design principles.

Core principles include:

- Data minimization
- Purpose limitation
- Least privilege
- Encryption in transit
- Encryption at rest (deployment dependent)
- Secure deletion where applicable
- Separation of duties
- Transparent processing

Personally identifiable information is never intentionally exposed to language models.

Organizations deploying RelayDispatch remain responsible for compliance with applicable privacy regulations.

Examples include:

- GDPR
- CCPA
- CPRA
- PIPEDA
- LGPD
- Australian Privacy Act
- Other local regulations

---

# Release Security Checklist

Every production release should complete the following verification checklist.

## Repository

- [ ] No secrets committed
- [ ] No debug code
- [ ] No development credentials
- [ ] No temporary files
- [ ] No personal information

## Dependencies

- [ ] Dependencies updated
- [ ] Security advisories reviewed
- [ ] Lockfiles committed
- [ ] Supply chain scan completed

## Code Quality

- [ ] Type checking passes
- [ ] Linting passes
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Build succeeds

## Security

- [ ] Webhooks verified
- [ ] Authentication tested
- [ ] Authorization tested
- [ ] PII redaction verified
- [ ] AI guardrails verified
- [ ] Rate limiting verified

## Documentation

- [ ] Changelog updated
- [ ] Security documentation updated
- [ ] Migration notes published
- [ ] Breaking changes documented

---

# Security Review Checklist

Major pull requests should consider the following questions.

### Authentication

- Does this introduce a new authentication mechanism?

### Authorization

- Are authorization boundaries preserved?

### Secrets

- Are any secrets introduced?

### AI

- Does this expose additional context to the LLM?

### Privacy

- Could customer information be unintentionally leaked?

### Infrastructure

- Does this require new permissions?

### Performance

- Could retries duplicate side effects?

### Monitoring

- Are new events observable?

### Logging

- Is sensitive information excluded from logs?

---

# Maintainer Responsibilities

Project maintainers are responsible for protecting the long-term security of RelayDispatch.

Responsibilities include:

- Reviewing security reports
- Coordinating vulnerability disclosure
- Publishing security advisories
- Reviewing dependency updates
- Maintaining supported versions
- Protecting release integrity
- Managing signing keys
- Reviewing privileged pull requests
- Preserving workflow compatibility
- Protecting contributor trust

Security decisions should prioritize user safety over feature velocity.

---

# Responsible Disclosure Process

RelayDispatch supports coordinated vulnerability disclosure.

Researchers acting in good faith are encouraged to privately disclose vulnerabilities.

The typical disclosure process is:

1. Private vulnerability report
2. Acknowledgement
3. Initial investigation
4. Severity assessment
5. Remediation
6. Coordinated disclosure
7. Security advisory publication
8. Credit (when desired by the reporter)

Public disclosure before a reasonable remediation opportunity may unnecessarily increase risk for downstream users.

---

# Security Roadmap

Security continuously evolves alongside the project.

Potential future improvements include:

- Hardware-backed key management
- Multi-region secret replication
- Automatic key rotation
- Confidential Computing support
- Passkey authentication
- WebAuthn administrator login
- Runtime anomaly detection
- AI abuse detection
- Continuous SBOM publication
- Artifact signing with Sigstore
- OpenSSF Scorecard automation
- Reproducible builds
- Fine-grained audit logging
- AI evaluation benchmarking
- Continuous prompt safety testing

These items are aspirational and may change as the project evolves.

---

# Security Contact

To report a vulnerability, please contact:

**uzair.shaikh.sec@outlook.com**

Please include:

- Description
- Impact
- Steps to reproduce
- Affected version
- Proof-of-concept (if available)
- Suggested remediation (optional)

Please do **not** disclose vulnerabilities publicly until maintainers have had a reasonable opportunity to investigate and prepare a coordinated response.

---

# Legal Notice

Nothing in this document constitutes a guarantee that RelayDispatch is free from vulnerabilities.

Security is a continuous process.

Operators remain responsible for:

- Secure deployment
- Infrastructure hardening
- Secret management
- Compliance obligations
- Monitoring
- Backup strategy
- Disaster recovery
- Access control
- Incident response

RelayDispatch provides the architectural foundation for secure deployments but cannot eliminate operational risk.

---

# Acknowledgements

We sincerely thank the open-source security community, researchers, contributors, and users who help improve RelayDispatch.

Responsible disclosure, constructive collaboration, and continuous improvement make open-source software more secure for everyone.

---

**Version:** 1.0

**Applies To:** All supported RelayDispatch releases

**Last Reviewed:** July 2026

**Next Scheduled Review:** Every major release or at least annually

---

---

# Appendix A — Security Architecture

## High-Level Trust Boundary

```text
                        Internet
                            │
                            ▼
                  ┌──────────────────┐
                  │ External Clients │
                  └──────────────────┘
                            │
                     HTTPS / TLS 1.3
                            │
                            ▼
                  ┌──────────────────┐
                  │    API Server    │
                  │    apps/api      │
                  └──────────────────┘
                            │
               Authenticated Requests Only
                            │
                            ▼
                  ┌──────────────────┐
                  │ Temporal Server  │
                  └──────────────────┘
                            │
                            ▼
                  ┌──────────────────┐
                  │ Worker Process   │
                  │ apps/worker      │
                  └──────────────────┘
                            │
        ┌─────────────┬──────────────┬──────────────┐
        ▼             ▼              ▼              ▼
   OpenRouter     Supabase       CRM Provider     Email
      LLM          Database        Adapters       Provider
```

---

# Appendix B — AI Data Flow

```text
Customer Email
       │
       ▼
Webhook Verification
       │
       ▼
Emergency Pre-Filter
       │
       ▼
PII Redaction
       │
       ▼
Classifier Agent
       │
       ▼
Dispatcher Agent
       │
       ▼
Librarian Agent
       │
       ▼
Output Validation
       │
       ▼
PII Rehydration
       │
       ▼
Outbound Email
```

No raw customer PII reaches an LLM at any stage of the workflow.

---

# Appendix C — Data Classification

RelayDispatch categorizes information into four sensitivity levels.

| Classification | Examples                                           | Protection Requirements                                  |
| -------------- | -------------------------------------------------- | -------------------------------------------------------- |
| Public         | Documentation, README, examples                    | No restrictions                                          |
| Internal       | Configuration, logs, metrics                       | Authenticated access                                     |
| Confidential   | Customer records, pricing, business data           | Encryption and RBAC                                      |
| Restricted     | Secrets, encryption keys, service-role credentials | Strict access controls, secret management, audit logging |

Contributors should always assume unknown information is Confidential until verified otherwise.

---

# Appendix D — STRIDE Threat Model

RelayDispatch considers the STRIDE threat model during architectural review.

| Threat                 | Mitigation                                                  |
| ---------------------- | ----------------------------------------------------------- |
| Spoofing               | JWT validation, OAuth, signed webhooks                      |
| Tampering              | HMAC verification, database integrity, workflow determinism |
| Repudiation            | Structured audit logging                                    |
| Information Disclosure | PII redaction, encryption, least privilege                  |
| Denial of Service      | Rate limiting, retries, Temporal resilience                 |
| Elevation of Privilege | RBAC, service separation, worker isolation                  |

Threat models should be revisited whenever introducing major architectural changes.

---

# Appendix E — Incident Severity Matrix

| Severity | Description                                                     | Target Response   |
| -------- | --------------------------------------------------------------- | ----------------- |
| P0       | Active exploitation, critical compromise, credential disclosure | Immediate         |
| P1       | High-impact vulnerability with realistic exploitation           | High Priority     |
| P2       | Moderate vulnerability with limited impact                      | Scheduled Fix     |
| P3       | Low-risk issue or defense-in-depth improvement                  | Maintenance Cycle |
| P4       | Informational finding                                           | Backlog           |

Severity may be adjusted based on exploitability, affected users, and operational impact.

---

# Appendix F — Security Review Checklist for Contributors

Before opening a Pull Request, contributors should verify:

## Authentication

- [ ] No authentication bypass introduced.

## Authorization

- [ ] Permissions correctly enforced.

## AI

- [ ] No additional sensitive context exposed to LLMs.

## Privacy

- [ ] PII remains protected.

## Logging

- [ ] No secrets or customer information logged.

## Infrastructure

- [ ] No privileged credentials committed.

## Dependencies

- [ ] New dependencies reviewed.

## Testing

- [ ] Security-sensitive code includes tests.

## Documentation

- [ ] Security documentation updated when behavior changes.

---

# Appendix G — Self-Hosted Deployment Checklist

Before deploying RelayDispatch into production, operators should verify:

## Infrastructure

- [ ] HTTPS enabled
- [ ] TLS certificates configured
- [ ] Firewall configured
- [ ] Backup strategy implemented
- [ ] Disaster recovery tested

## Secrets

- [ ] Secrets stored outside source control
- [ ] Encryption keys generated
- [ ] Rotation policy established

## Database

- [ ] Row Level Security enabled
- [ ] Backups scheduled
- [ ] Encryption at rest verified

## AI

- [ ] Cost guardrails configured
- [ ] Organization limits configured
- [ ] Approved models selected

## Monitoring

- [ ] Logs centralized
- [ ] Metrics exported
- [ ] Alerts configured
- [ ] Incident response documented

## Updates

- [ ] Latest supported version deployed
- [ ] Dependencies updated
- [ ] Security advisories reviewed

---

# Appendix H — References

RelayDispatch follows guidance and best practices from the following organizations and publications.

## Application Security

- OWASP Application Security Verification Standard (ASVS)
- OWASP API Security Top 10
- OWASP LLM Top 10
- OWASP Cheat Sheet Series

## AI Security

- NIST AI Risk Management Framework (AI RMF 1.0)
- MITRE ATLAS
- OWASP GenAI Security Project

## Infrastructure

- NIST Cybersecurity Framework (CSF 2.0)
- CIS Critical Security Controls v8
- SLSA Framework
- OpenSSF Best Practices
- SPDX Specification
- Sigstore Project

Organizations operating in regulated industries should evaluate additional requirements specific to their jurisdiction and compliance obligations.

---

# Document Maintenance

This document is maintained by the RelayDispatch maintainers.

Security guidance will evolve alongside:

- Project architecture
- AI capabilities
- Threat landscape
- Industry best practices
- Regulatory requirements

Contributors are encouraged to propose improvements through pull requests or GitHub Discussions.

---

© RelayDispatch Contributors.

This document is licensed under the same license as the RelayDispatch project.
