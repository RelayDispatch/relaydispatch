# Contributing to RelayDispatch

> Thank you for your interest in contributing to RelayDispatch.
>
> Whether you're fixing a typo, improving documentation, reporting bugs, reviewing pull requests, or implementing a new feature—we appreciate your time and expertise.
>
> RelayDispatch is built as an open-source, community-driven platform, and every contribution helps improve the project.

---

# Table of Contents

- Philosophy
- Ways to Contribute
- Before You Start
- Code of Conduct
- Reporting Bugs
- Suggesting Features
- Security Vulnerabilities
- Development Environment
- Branching Strategy
- Commit Guidelines
- Pull Request Process
- Coding Standards
- Architecture Rules
- Testing Requirements
- Documentation Standards
- Community Guidelines

---

# Project Philosophy

RelayDispatch follows several engineering principles that every contributor should understand before making changes.

## Open Source First

The project must remain:

- self-hostable
- vendor-neutral
- transparent
- auditable
- modular

No contribution should introduce mandatory commercial dependencies or proprietary lock-in.

---

## Quality Over Quantity

A single well-tested improvement is far more valuable than a large pull request with uncertain behavior.

We strongly prefer:

- focused PRs
- small commits
- incremental improvements
- comprehensive tests
- updated documentation

---

## Architecture Before Features

Before implementing new functionality, ask:

- Does this already exist?
- Does this belong in an existing package?
- Can this be implemented as an interface?
- Will this increase coupling?
- Will this make future maintenance easier?

Architectural consistency is prioritized over feature velocity.

---

# Ways to Contribute

We welcome contributions in many forms.

## Code

Examples include:

- bug fixes
- performance improvements
- new provider adapters
- workflow enhancements
- accessibility improvements
- security improvements
- developer tooling

---

## Documentation

Documentation is treated as production code.

Examples:

- tutorials
- API documentation
- architecture diagrams
- deployment guides
- troubleshooting
- examples
- diagrams
- code comments

---

## Testing

Testing contributions are highly valued.

Examples:

- additional unit tests
- integration tests
- regression tests
- edge-case validation
- performance benchmarks

---

## Design

Help improve:

- UI consistency
- accessibility
- icons
- diagrams
- workflow visualizations
- onboarding experience

---

## Community

You can also contribute by:

- answering discussions
- helping new contributors
- reviewing pull requests
- improving issue reports
- proposing architectural improvements

---

# Before You Start

Please complete the following checklist before opening an issue or pull request.

- Search existing issues.
- Search existing discussions.
- Read the README.
- Read the Architecture documentation.
- Read this CONTRIBUTING guide.
- Ensure the issue has not already been solved on the current branch.

GitHub automatically surfaces the repository's contribution guidelines when creating issues and pull requests. Following these guidelines helps maintain a healthy review process. :contentReference[oaicite:0]{index=0}

---

# Code of Conduct

We expect every contributor to help maintain a welcoming and professional community.

Be:

- respectful
- constructive
- patient
- inclusive
- collaborative

Unacceptable behavior includes:

- harassment
- discrimination
- personal attacks
- trolling
- intimidation
- abusive language
- intentionally disruptive behavior

Maintainers reserve the right to remove comments or contributions that violate these standards.

---

# Reporting Bugs

Before creating a bug report:

1. Verify you're using the latest supported version.
2. Search existing issues.
3. Reproduce the issue consistently.
4. Collect logs and screenshots if applicable.

A high-quality bug report should include:

- operating system
- Node.js version
- deployment method
- browser (if applicable)
- expected behavior
- actual behavior
- reproduction steps
- logs
- screenshots
- stack traces

The easier an issue is to reproduce, the faster it can usually be resolved.

---

# Requesting Features

Feature requests should explain:

- the problem
- why it matters
- proposed solution
- alternative approaches
- expected impact

Avoid submitting implementation-only ideas without describing the underlying problem.

Good feature requests focus on outcomes rather than implementation details.

---

# Security Vulnerabilities

**Do NOT report security vulnerabilities through public GitHub Issues.**

Instead:

1. Follow the process described in `SECURITY.md`.
2. Provide enough information for maintainers to reproduce the issue.
3. Allow reasonable time for remediation before public disclosure.

Responsible disclosure protects users while allowing fixes to be prepared.

---

# Development Environment

Minimum supported tooling:

| Tool       | Recommended Version       |
| ---------- | ------------------------- |
| Node.js    | Current LTS               |
| npm        | Latest supported          |
| Docker     | Current stable            |
| Git        | Latest stable             |
| TypeScript | Repository-managed        |
| Temporal   | Current supported release |

---

## Local Setup

Clone your fork:

```bash
git clone https://github.com/YOUR_USERNAME/relaydispatch.git

cd relaydispatch
```

Install dependencies:

```bash
npm install
```

Create environment configuration:

```bash
cp .env.example .env
```

Configure:

- Supabase
- OpenRouter
- Temporal
- encryption keys
- provider credentials

Start the local Temporal server (required for workflow testing):

```bash
docker compose -f docker/docker-compose.dev.yml up -d
```

This starts Temporal at `localhost:7233` and the Temporal Web UI at `http://localhost:8080`.

Start the development environment:

```bash
npm run dev
```

Run the worker separately (connects to your local Temporal):

```bash
npm run dev:worker
```

For complete environment configuration, refer to `DEVELOPER_GUIDE.md`.

---

# 🏗️ Architecture & Design Principles

RelayDispatch follows a **modular monorepo architecture** centered around clear domain boundaries, dependency inversion, and provider abstraction.

Contributors should follow these architectural principles when adding or modifying code.

## Core Principles

- **Single Responsibility Principle (SRP)** — Every module should solve one problem well.
- **Dependency Inversion** — Business logic depends on interfaces, never vendor SDKs.
- **Composition over Inheritance** — Prefer small composable modules.
- **Explicit Contracts** — All public interfaces should be strongly typed.
- **Security by Default** — Secure defaults are preferred over convenience.
- **Open Source First** — Avoid organization-specific assumptions.

---

## Package Boundaries

When contributing:

✅ Place code inside the appropriate package.

❌ Do not add unrelated utilities to existing packages.

Example:

```
packages/
├── ai/
├── compliance/
├── database/
├── integrations/
├── security/
├── telemetry/
└── workflows/
```

Each package should expose a minimal public API through:

```
src/index.ts
```

Avoid importing deep internal files across packages.

---

## Import Rules

Preferred:

```ts
import { redactPII } from "@relaydispatch/security";
```

Avoid:

```ts
import "../../../packages/security/src/redactor";
```

Public APIs exist for long-term compatibility.

---

# 🤖 AI Contribution Guidelines

RelayDispatch contains multiple AI components.

When modifying AI behavior:

- Keep prompts deterministic.
- Never embed secrets.
- Never expose customer PII.
- Never hardcode provider-specific logic.
- Preserve structured output schemas.
- Update documentation whenever prompts change.

Prompt changes should always include:

- reasoning
- expected behavior
- compatibility notes
- migration impact (if applicable)

---

## Prompt Engineering Standards

Prompts should:

- clearly define the AI role
- specify output format
- define constraints
- specify escalation behavior
- avoid ambiguous wording
- minimize hallucination opportunities

Whenever possible:

- prefer structured JSON outputs
- validate with Zod
- fail safely

---

# 🔐 Security Requirements

Security is considered part of feature development—not a separate stage.

Every pull request should consider:

## Authentication

- JWT validation
- session integrity
- organization isolation

## Authorization

- RBAC enforcement
- organization ownership
- resource permissions

## AI Safety

- Prompt Injection
- Context Poisoning
- Tool Abuse
- Data Leakage
- Jailbreak attempts

## Secrets

Never commit:

- API keys
- OAuth credentials
- JWT secrets
- certificates
- database passwords
- webhook secrets

Use:

```
.env
```

or supported secret managers.

---

# 🧪 Writing Good Tests

A feature is not considered complete without appropriate testing.

Recommended coverage:

| Component | Tests                 |
| --------- | --------------------- |
| Utility   | Unit                  |
| API Route | Integration           |
| Workflow  | Workflow Replay       |
| Activity  | Activity Test         |
| AI Prompt | Snapshot + Validation |
| UI        | Component Test        |

Where practical, include:

- success path
- validation failures
- edge cases
- authorization failures
- retry scenarios
- timeout handling

---

## Testing Philosophy

Tests should be:

- deterministic
- isolated
- repeatable
- fast

Avoid:

- network dependencies
- external APIs
- time-sensitive assertions
- shared mutable state

---

# 📚 Documentation Expectations

Documentation is treated as part of the codebase.

When changing:

- APIs
- workflows
- environment variables
- package structure
- deployment
- provider interfaces

please update the relevant documentation.

Potential documents include:

- Architecture
- API Reference
- AI Guide
- Deployment Guide
- Developer Guide
- Configuration Reference
- Changelog

---

# 🚀 Performance Guidelines

Contributors should avoid introducing unnecessary overhead.

Examples:

- unnecessary database queries
- repeated serialization
- excessive object allocations
- blocking filesystem operations
- duplicated LLM requests
- large bundle regressions

Measure before optimizing.

Document significant performance changes.

---

# 🌍 Provider-Agnostic Philosophy

RelayDispatch follows a **Bring Your Own Provider (BYOP)** model.

The project should never require a specific commercial provider.

Examples:

AI

- OpenRouter
- OpenAI-compatible APIs
- self-hosted gateways

CRM

- Jobber
- ServiceTitan
- Housecall Pro
- custom adapters

Email

- Gmail
- Microsoft Graph
- SMTP
- IMAP

Voice

- Twilio
- Plivo
- Telnyx
- SIP providers

Storage

- Supabase
- PostgreSQL
- compatible implementations

New providers should be implemented through interfaces rather than modifying business logic.

---

# 🎯 Good First Contributions

If you're new to RelayDispatch, consider starting with:

- documentation improvements
- test coverage
- accessibility
- UI polish
- logging improvements
- performance optimizations
- new provider adapters
- bug fixes
- developer tooling

These contributions help improve the project while providing familiarity with the architecture.

---

# ❤️ Thank You

Every contribution—whether code, documentation, testing, design, or community support—helps improve RelayDispatch.

We appreciate your time and effort in making the project more secure, maintainable, and useful for everyone.

Welcome to the community!
