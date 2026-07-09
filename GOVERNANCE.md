# Governance

> **Version:** 1.0.0 | **Last reviewed:** 2026-07-09 | **Type:** Open-Source Project Governance

This document defines how RelayDispatch is governed: who makes decisions, how contributions are evaluated, how the project is sustained, and how the community is protected.

---

## Table of Contents

1. [Project Mission](#1-project-mission)
2. [Governance Structure](#2-governance-structure)
3. [Roles and Responsibilities](#3-roles-and-responsibilities)
4. [Decision-Making Process](#4-decision-making-process)
5. [Contribution Evaluation](#5-contribution-evaluation)
6. [Versioning and Release Policy](#6-versioning-and-release-policy)
7. [Security and Disclosure Policy](#7-security-and-disclosure-policy)
8. [Commercial Use and Licensing](#8-commercial-use-and-licensing)
9. [Community Standards](#9-community-standards)
10. [Conflict Resolution](#10-conflict-resolution)
11. [Project Sustainability](#11-project-sustainability)
12. [Amendment Process](#12-amendment-process)

---

## 1. Project Mission

RelayDispatch exists to provide **open, self-hostable, AI-powered field service dispatch tooling** that organizations of all sizes can deploy without vendor lock-in or per-seat pricing.

### Core Values

| Value | What it means in practice |
|---|---|
| **Openness** | All decisions, roadmaps, and security disclosures are documented publicly |
| **Self-hostability** | Every feature must work in a self-hosted Docker deployment with no external dependency on the maintainers |
| **Data sovereignty** | Customer PII never leaves the operator's infrastructure |
| **Incremental quality** | We prefer hardening and completing over rewriting |
| **Minimalism** | We do not add features that cannot be maintained; we do not add dependencies that are not essential |

---

## 2. Governance Structure

RelayDispatch uses a **Benevolent Dictator For Now (BDFN)** model with a path to a multi-maintainer steering model as the project matures.

```
┌─────────────────────────────────────────┐
│           Project Lead (BDFN)           │
│   Final authority on direction & scope  │
└─────────────────────────────────────────┘
                     │
        ┌────────────┴────────────┐
        ▼                         ▼
┌──────────────┐         ┌─────────────────┐
│  Maintainers │         │  Security Lead  │
│ (Core Team)  │         │ (Veto on STRIDE │
│              │         │  regressions)   │
└──────────────┘         └─────────────────┘
        │
        ▼
┌──────────────┐
│ Contributors │
│   (Anyone)   │
└──────────────┘
        │
        ▼
┌──────────────┐
│   Community  │
│   (Users,    │
│  Adopters)   │
└──────────────┘
```

---

## 3. Roles and Responsibilities

### 3.1 Project Lead

- Has final decision authority on architecture, roadmap, and governance changes
- Must review and approve all changes to core security infrastructure (`packages/security`)
- May delegate day-to-day merge authority to Maintainers
- Is responsible for the commercial relationship with hosting providers and sponsors
- Commits to publishing a quarterly State of the Project post

### 3.2 Maintainers

Maintainers are trusted contributors with merge access. They are responsible for:

- Reviewing and merging PRs within their area of expertise
- Enforcing the Code of Conduct
- Triaging and labelling issues
- Participating in security disclosures under embargo
- Running the weekly triage meeting (async, in Discussions)

**Current Maintainers:** See [CODEOWNERS](.github/CODEOWNERS).

**Path to Maintainership:**
1. Sustained, high-quality contributions over at least 3 months
2. Demonstrated understanding of the architecture and threat model
3. Nomination by an existing Maintainer
4. Consensus approval from the Project Lead and all current Maintainers (no objections within 14 days)

**Inactive Maintainer Policy:** A Maintainer who is unresponsive for 6 months may be moved to Emeritus status by the Project Lead after a documented attempt to contact them.

### 3.3 Security Lead

The Security Lead is a Maintainer with additional responsibilities:

- Owns `THREAT_MODEL.md` and reviews all STRIDE-relevant changes
- Coordinates responsible disclosure with reporters
- Has veto power over any change that introduces a new STRIDE threat without a documented mitigation
- Runs the quarterly security review

### 3.4 Contributors

Anyone who submits a PR or opens an issue is a contributor. Contributors must:

- Agree to the [Contributor License Agreement](CLA.md)
- Follow the [Code of Conduct](CODE_OF_CONDUCT.md)
- Follow the [Contributing Guide](CONTRIBUTING.md)

Contributors do not require any prior relationship with the project.

### 3.5 Community

Community members are users, adopters, and anyone participating in Discussions or Issues. They:

- Provide valuable feedback on real-world usage
- May propose features via the RFC process
- Are protected by the Code of Conduct

---

## 4. Decision-Making Process

### 4.1 Routine Changes

Changes that do not affect public APIs, architecture, or security controls are merged by a single Maintainer with a passing CI gate and one approving review.

Examples: bug fixes, test improvements, documentation typos, dependency patches.

### 4.2 Significant Changes

Changes that affect public APIs, architecture decisions, or security controls require:

1. A PR with a detailed description of motivation and trade-offs
2. Review and approval from at least **2 Maintainers** (including the Security Lead if STRIDE-relevant)
3. A 72-hour comment window for community input on PRs marked `review: community`
4. Final merge by the Project Lead or a delegated Maintainer

Examples: new API endpoints, schema changes, new external dependencies, changes to the AI pipeline, new LLM providers.

### 4.3 Major Architectural Changes (RFCs)

Changes that affect the fundamental architecture of the system (e.g., replacing Temporal with a different workflow engine, adding a new multi-tenancy layer, changing the data model significantly) must go through the RFC process:

1. Open a GitHub Discussion with the `RFC` label
2. Provide: motivation, proposed design, alternatives considered, compatibility impact
3. 14-day community comment period
4. Maintainer vote (simple majority, minimum 2 votes)
5. Project Lead approval
6. Implementation PR with reference to the RFC Discussion

### 4.4 Security Changes

Security changes (new controls, CVE mitigations, threat model updates) bypass the 72-hour comment window and go through the accelerated security PR process defined in [SECURITY.md](.github/SECURITY.md).

---

## 5. Contribution Evaluation

All contributions are evaluated against these criteria:

| Criterion | Description |
|---|---|
| **Correctness** | Does it work as described? Are edge cases handled? |
| **Test coverage** | All new logic must have vitest unit or integration tests |
| **Security** | Does it introduce a new STRIDE threat? If so, is it mitigated? |
| **Documentation** | Public APIs, config options, and architectural changes must be documented |
| **Backward compatibility** | Breaking changes require a major version bump and migration guide |
| **Simplicity** | We prefer fewer moving parts. Complexity must be justified. |
| **Scope** | Does the change belong in the core project, or is it better as a plugin/fork? |

### Non-Negotiable Requirements

These requirements are **never waived**:

- All existing tests must pass (`npm test`)
- TypeScript compilation must succeed (`npm run typecheck`)
- No new critical/high CVEs introduced (enforced by dependency-review.yml)
- CLA must be signed for non-trivial contributions

---

## 6. Versioning and Release Policy

RelayDispatch follows [Semantic Versioning 2.0.0](https://semver.org/):

```
MAJOR.MINOR.PATCH

MAJOR → breaking API or database schema changes
MINOR → new backwards-compatible features
PATCH → backwards-compatible bug fixes and security patches
```

### Release Channels

| Channel | Tag Pattern | Purpose |
|---|---|---|
| Stable | `v1.2.3` | Production deployments |
| Release Candidate | `v1.2.3-rc.1` | Pre-release testing |
| Nightly | built from `develop` | Development testing only — not for production |

### Release Process

1. Maintainer runs release checklist (see [CONTRIBUTING.md](CONTRIBUTING.md#releasing))
2. All tests pass on `main`
3. `CHANGELOG.md` updated with all changes since last release
4. Tag pushed: `git tag v1.2.3 && git push origin v1.2.3`
5. Release pipeline (`release.yml`) builds, signs, and publishes automatically
6. GitHub Release created with SBOM and SLSA provenance attestation

### Supported Versions

| Version | Status | Security patches |
|---|---|---|
| 1.x (current) | ✅ Active | Yes |
| 0.x | ⚠️ Legacy | Critical only (until 2026-12-31) |

---

## 7. Security and Disclosure Policy

See [`.github/SECURITY.md`](.github/SECURITY.md) for the full security policy.

### Summary

- **Reporting:** GitHub Security Advisories (preferred) or `[SECURITY]` via Discussions
- **Response SLA:** 72h acknowledgement, 7 days triage
- **Coordinated disclosure:** Fix first, then public disclosure with CVE assignment
- **Bug bounty:** No monetary bounty program at this time. Reporter credited in CHANGELOG and release notes.
- **CVSS scoring:** All CVEs are scored with CVSS v3.1. Score is published alongside the advisory.

---

## 8. Commercial Use and Licensing

RelayDispatch is licensed under the **MIT License** (see [LICENSE](LICENSE)).

### Permitted Use

- Self-hosted commercial deployments ✅
- SaaS offerings built on RelayDispatch ✅
- White-labelling ✅
- Modification without contribution ✅ (but contributions are appreciated)

### Conditions

- License and copyright notice must be preserved in all copies
- No trademark rights are granted — the name "RelayDispatch" may not be used to imply endorsement of derived products without permission

### Commercial Support

Commercial support, enterprise SLAs, and managed cloud hosting are available from the maintainers. Contact details in the README.

### CLA Requirement

All non-trivial contributions require signing the [Contributor License Agreement](CLA.md). The CLA:

- Grants the project a perpetual, worldwide, non-exclusive license to use the contribution
- Does **not** transfer copyright ownership — contributors retain their copyright
- Allows the project to relicense in the future (e.g., to a more restrictive license to sustain the project)

---

## 9. Community Standards

All participants in the RelayDispatch community must follow the [Code of Conduct](CODE_OF_CONDUCT.md), which is based on the [Contributor Covenant v2.1](https://www.contributor-covenant.org/).

### Enforcement

| Severity | Example | Response |
|---|---|---|
| 1 — Warning | Mildly inappropriate comment | Private written warning |
| 2 — Temporary Ban | Harassment, sustained disruption | 7-day ban from all community spaces |
| 3 — Permanent Ban | Threats, doxxing, sustained violation | Permanent ban |

Reports are handled by the Project Lead or a designated Code of Conduct contact. All reports are treated confidentially.

---

## 10. Conflict Resolution

### Technical Disputes

When Maintainers disagree on a technical approach:
1. Both sides document their position in the PR or Discussion
2. A 48-hour community comment period opens
3. Maintainers vote (simple majority)
4. In case of a tie, the Project Lead has the casting vote

### Code of Conduct Disputes

Code of Conduct enforcement decisions are made by the Project Lead with input from at least one other Maintainer. The reporter and the subject of the report are informed of the outcome.

### Governance Disputes

Disputes about this governance document itself are resolved via the amendment process (Section 12).

---

## 11. Project Sustainability

RelayDispatch is committed to long-term sustainability through:

| Mechanism | Description |
|---|---|
| **Commercial support** | Revenue from enterprise support contracts funds maintainer time |
| **Sponsorships** | GitHub Sponsors accepted for individual and organizational sponsors |
| **Managed hosting** | Optional managed cloud hosting from the maintainers |
| **Grants** | We will apply for OSS sustainability grants (e.g., NLNET, Sovereign Tech Fund) where eligible |

### Decision on Revenue

Revenue generated from commercial support and hosting funds:
1. Maintainer compensation (priority)
2. Infrastructure costs (CI, domain, tooling)
3. Security audits

Revenue decisions are made transparently by the Project Lead with a quarterly financial summary published in Discussions.

---

## 12. Amendment Process

This document may be amended by:

1. Opening a GitHub Discussion with the `governance` label
2. 14-day community comment period
3. Approval by the Project Lead and majority of current Maintainers
4. Changes merged to `main` with a descriptive commit message

Minor edits (typos, link updates, clarifications that do not change intent) may be merged by any Maintainer without the full amendment process.

---

*This governance document is maintained under the same version control as the source code. All changes are tracked in git history.*
