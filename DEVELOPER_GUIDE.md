# Developer Guide

> **Audience:** Contributors, maintainers, plugin developers, and organizations deploying RelayDispatch.
>
> **Scope:** This document explains the development workflow, repository architecture, coding standards, package organization, and engineering principles used throughout RelayDispatch.
>
> **Target Platforms:** Linux, macOS, Windows (WSL2 recommended)
>
> **Supported Node.js Version:** 24 LTS+
>
> **Repository Status:** Stable Open Source (BYOP Architecture)

---

# Table of Contents

1. Development Philosophy
2. Repository Architecture
3. Prerequisites
4. Local Development Setup
5. Environment Configuration
6. Repository Structure
7. Development Workflow
8. Package Architecture
9. Dependency Rules
10. Coding Standards
11. Testing
12. Security Requirements
13. AI Development
14. Workflow Development
15. Provider Development
16. Performance Guidelines
17. Release Checklist
18. Troubleshooting

---

# Development Philosophy

RelayDispatch follows several core engineering principles that guide every architectural decision.

## Design Goals

- Vendor Neutral
- AI Provider Agnostic
- Self-Hostable
- Privacy First
- Human-in-the-Loop
- Event Driven
- Modular
- Observable
- Testable
- Contributor Friendly

The repository intentionally avoids coupling business logic to any particular AI provider, CRM platform, cloud vendor, or infrastructure provider.

Instead, every external dependency should be isolated behind interfaces and adapters.

---

# Engineering Principles

Every contribution should preserve these principles.

## Single Responsibility

Every package should solve one problem.

Avoid creating packages that combine unrelated responsibilities.

Good:

```
packages/security
packages/database
packages/telemetry
```

Bad:

```
packages/helpers
packages/common
packages/utils
packages/misc
```

---

## Dependency Direction

Dependencies always flow inward.

```
Applications
      │
      ▼
Business Packages
      │
      ▼
Shared Infrastructure
      │
      ▼
External Providers
```

Business logic should never directly depend on vendor SDKs.

---

## Interface First

Whenever integrating a third-party service:

```
Interface

↓

Adapter

↓

Vendor SDK
```

Example:

```
CRM Interface
      │
      ├──────────────┐
      ▼              ▼
 Jobber         Housecall Pro
 Adapter            Adapter
```

This allows providers to be replaced without modifying business logic.

---

## Deterministic Workflows

Temporal workflows must remain deterministic.

Never place inside a workflow:

- current timestamps
- random numbers
- HTTP requests
- database calls
- filesystem access

Those belong inside Activities.

---

## Privacy First

RelayDispatch assumes customer communications may contain sensitive information.

PII must always be:

- detected
- redacted
- encrypted
- restored only when required

No raw customer information should ever be transmitted to AI providers.

---

# Repository Architecture

The repository follows a modular monorepo architecture.

```text
                    RelayDispatch

                         │
        ┌────────────────┼────────────────┐
        │                │                │
        ▼                ▼                ▼

      apps/          packages/       infrastructure

        │                │

        ▼                ▼

   API • Worker     AI • Security
   Web • Scheduler  Database
                    Providers
                    Shared Libraries
                    Telemetry
```

Each package owns a clearly defined responsibility.

Cross-package coupling should remain minimal.

---

# Prerequisites

| Software       | Recommended                       |
| -------------- | --------------------------------- |
| Node.js        | 24 LTS or newer                   |
| npm            | 11+                               |
| TypeScript     | Installed automatically           |
| Git            | Latest stable                     |
| Docker Desktop | Latest                            |
| Docker Compose | v2                                |
| Supabase CLI   | Latest                            |
| Temporal CLI   | Latest (optional but recommended) |

Package managers such as **pnpm** or **bun** may work, but the primary supported environment uses **npm**.

---

# Local Development Setup

Clone the repository:

```bash
git clone https://github.com/relaydispatch/relaydispatch

cd relaydispatch
```

Install dependencies:

```bash
npm install
```

Copy the example environment:

```bash
cp .env.example .env
```

Configure the required variables.

Then start development:

```bash
npm run dev
```

This launches the frontend development server.

Run the worker separately:

```bash
npm run dev:worker
```

Run scheduled background services:

```bash
npm run dev:scheduler
```

---

# First-Time Verification

A clean repository should successfully execute:

```bash
npm run typecheck

npm run lint

npm run test

npm run build
```

Every Pull Request is expected to satisfy these four verification gates.

---

# Environment Configuration

RelayDispatch validates configuration during startup.

If required variables are missing, startup fails immediately.

Required variables include:

```env
SUPABASE_URL=

SUPABASE_ANON_KEY=

SUPABASE_SERVICE_ROLE_KEY=

OPENROUTER_API_KEY=

VAULT_ENCRYPTION_KEY=

TEMPORAL_ADDRESS=

MAIL_PROVIDER=
```

Secrets should never be committed to source control.

The repository intentionally fails fast rather than attempting unsafe defaults.

---

# Recommended Development Tools

Recommended editor:

- Visual Studio Code

Recommended extensions:

- ESLint
- TypeScript
- EditorConfig
- GitLens
- Docker
- Error Lens
- Markdown All in One
- Mermaid Preview
- YAML
- Prettier (optional)

---

# Repository Layout

```
apps/
│
├── api/
├── web/
├── worker/
└── scheduler/

packages/
│
├── ai/
├── auth/
├── compliance/
├── config/
├── database/
├── integrations/
├── organizations/
├── security/
├── shared/
├── telemetry/
└── workflows/

tests/

docs/

scripts/

supabase/
```

Every directory exists for a specific architectural purpose.

Avoid introducing new top-level directories without maintainer approval.

---

# Understanding the Applications

## apps/api

Responsible for:

- HTTP API
- Authentication
- Routing
- Webhooks
- Request validation
- Middleware

The API should remain thin.

Business logic belongs inside packages.

---

## apps/web

Contains:

- Dashboard
- Administration UI
- Settings
- Provider configuration
- Manual dispatch interface

Frontend components should avoid embedding business rules.

---

## apps/worker

Responsible for:

- Temporal Activities
- AI execution
- Provider communication
- Email processing
- CRM synchronization

Workers execute the majority of long-running operations.

---

## apps/scheduler

Responsible for recurring background jobs including:

- Dead-letter queue processing
- Cleanup
- Retention
- Retry scheduling
- Maintenance operations

Schedulers should never duplicate worker logic.

---

# Development Workflow

RelayDispatch follows a predictable engineering workflow designed to minimize regressions while keeping the codebase approachable for contributors.

```text
Issue / Feature
       │
       ▼
Create Feature Branch
       │
       ▼
Implement Changes
       │
       ▼
Run Local Verification
(Typecheck → Lint → Tests → Build)
       │
       ▼
Update Documentation
       │
       ▼
Submit Pull Request
       │
       ▼
Code Review
       │
       ▼
Merge
```

Every contribution—whether documentation, bug fix, or new feature—should complete the same verification pipeline.

---

# Branching Strategy

Recommended branch naming:

```
feature/<name>

bugfix/<name>

docs/<name>

refactor/<name>

security/<name>

provider/<provider-name>

release/<version>
```

Examples:

```
feature/provider-registry

bugfix/email-timeout

docs/architecture

refactor/activity-split

provider/housecallpro
```

Avoid committing directly to the default branch.

---

# Repository Standards

Every contribution should satisfy these standards.

## Required

- TypeScript Strict Mode
- Zero build errors
- Zero lint errors
- Passing tests
- No hardcoded secrets
- No proprietary branding
- Documentation updated when required

## Strongly Recommended

- Small commits
- Clear commit messages
- Modular implementations
- Unit tests for new functionality
- Integration tests for workflow changes

---

# Package Architecture

RelayDispatch follows a package-oriented architecture.

```
packages/

├── ai/
├── auth/
├── compliance/
├── config/
├── database/
├── integrations/
├── organizations/
├── security/
├── shared/
├── telemetry/
└── workflows/
```

Each package owns one responsibility.

Packages should communicate through exported interfaces—not internal implementation details.

---

# Package Structure Standard

Each package should follow a predictable structure.

```
package-name/

src/
│
├── index.ts
├── interface.ts
├── types.ts
├── schemas.ts
├── constants.ts
├── errors.ts
├── utils.ts
└── adapters/

README.md

tests/
```

Smaller packages may omit unnecessary files.

Consistency is preferred over cleverness.

---

# Dependency Rules

Dependency direction is intentionally restrictive.

```text
apps/
    │
    ▼
packages/
    │
    ▼
shared/
```

Allowed:

```
apps/api
        │
        ▼
packages/database

packages/ai
        │
        ▼
packages/shared
```

Not allowed:

```
shared
   │
   ▼
apps/web
```

Nor:

```
packages/security

imports

packages/ai/internal/*
```

Packages should only consume public exports.

---

# Import Rules

Prefer package boundaries.

Good:

```typescript
import { createClient } from "@relaydispatch/database";
```

Acceptable (inside same package):

```typescript
import { helper } from "./utils";
```

Avoid deep relative imports:

```typescript
../../../../../../database/client
```

Deep imports create brittle dependencies.

---

# Creating a New Package

Example:

```bash
mkdir -p packages/example/src
```

Minimum structure:

```
packages/example/

src/
    index.ts

README.md
```

As functionality grows, add:

```
types.ts

schemas.ts

interface.ts

tests/
```

Each package should expose a clean public API through `index.ts`.

---

# Coding Standards

RelayDispatch favors readable code over clever abstractions.

Preferred characteristics:

- Small functions
- Descriptive names
- Pure functions where practical
- Explicit typing
- Minimal side effects
- Deterministic behavior

Avoid:

- Huge classes
- God functions
- Global mutable state
- Hidden side effects
- Excessive inheritance

---

# TypeScript Standards

The repository uses strict compiler settings.

Avoid:

```typescript
any;
```

Prefer:

```typescript
unknown;
```

or explicit interfaces.

Example:

```typescript
interface DispatchResult {
  reply: string;
  confidence: number;
}
```

Types should describe intent rather than implementation.

---

# Error Handling

Errors should be classified.

Example categories:

```
ValidationError

ConfigurationError

AuthenticationError

AuthorizationError

ProviderError

DatabaseError

WorkflowError
```

Avoid throwing generic strings.

Prefer structured errors with meaningful context.

---

# Logging Standards

Production code should use structured logging.

Recommended fields:

```
timestamp

workflowId

organizationId

threadId

activity

severity

provider

duration

errorCode
```

Avoid logging:

- API keys
- OAuth tokens
- Customer PII
- Access tokens
- Encryption keys

Logs should aid debugging without exposing sensitive information.

---

# Configuration Guidelines

All runtime configuration belongs in environment variables.

Never hardcode:

- API endpoints
- Secrets
- Encryption keys
- Provider credentials
- Organization identifiers

Configuration should be validated during startup.

Fail fast when required values are missing.

---

# Database Development

Database changes must be migration-driven.

Every schema change should include:

- Migration
- Rollback consideration
- Updated generated types
- Relevant tests

Avoid modifying production tables manually.

---

# Database Guidelines

Recommended practices:

- Explicit transactions
- Parameterized queries
- Typed clients
- Indexed lookup columns
- Soft deletes where appropriate
- Optimistic concurrency where applicable

Avoid:

- SELECT \*
- Long-running transactions
- Hidden schema mutations

---

# API Development

New endpoints should include:

- Request validation
- Authentication
- Authorization
- Typed responses
- Error handling
- Logging
- Tests
- Documentation

Business logic should remain inside packages—not route handlers.

---

# Middleware Guidelines

Middleware should remain lightweight.

Typical responsibilities:

- Authentication
- Request IDs
- Logging
- Rate limiting
- Validation
- Security headers

Avoid embedding business rules inside middleware.

---

# Documentation Requirements

Major changes should update documentation when applicable.

Examples:

- README
- API documentation
- Architecture diagrams
- Configuration reference
- Migration guides
- Package README files

Documentation is treated as part of the codebase—not an afterthought.

---

# Testing Strategy

Testing is a first-class engineering requirement.

Every production feature should be verifiable through automated tests whenever practical.

RelayDispatch adopts a layered testing strategy.

```text
                End-to-End Tests
                       ▲
                       │
              Integration Tests
                       ▲
                       │
                 Contract Tests
                       ▲
                       │
                  Unit Tests
```

Each layer validates a different aspect of the system.

---

# Unit Testing

Unit tests validate isolated functions and small modules.

Examples:

- Utility functions
- Provider adapters
- Validators
- Redactors
- Prompt builders
- Cost calculators
- Configuration parsing

Recommended location:

```
tests/unit/
```

Unit tests should:

- Execute quickly
- Avoid network access
- Avoid database access
- Avoid filesystem dependencies

---

# Integration Testing

Integration tests verify multiple components working together.

Typical scenarios include:

- Email intake
- Workflow execution
- AI orchestration
- CRM synchronization
- Provider communication
- Database persistence

Recommended location:

```
tests/integration/
```

External systems should be mocked where practical.

---

# Contract Testing

Provider interfaces should be tested independently from provider implementations.

Example:

```
CRM Interface

        ▲

   Jobber Adapter

        ▲

Housecall Adapter
```

Every adapter should satisfy the same interface contract.

This enables providers to be replaced without modifying business logic.

---

# End-to-End Testing

End-to-end tests validate complete user workflows.

Typical scenarios include:

- Customer sends email
- Workflow starts
- AI classifies request
- Technician assigned
- Reply generated
- CRM updated
- Customer notified

These tests verify that the complete platform behaves correctly.

---

# Mocking Strategy

RelayDispatch prefers deterministic testing.

Recommended mocks include:

- HTTP providers
- AI providers
- Email providers
- CRM APIs
- SMS providers
- Storage providers

Avoid calling live production services during automated tests.

---

# Running Tests

Common commands:

```bash
npm run test

npm run test:watch

npm run test:coverage
```

Recommended verification before every Pull Request:

```bash
npm run typecheck

npm run lint

npm run test

npm run build
```

---

# AI Development Guidelines

AI modules should remain predictable, auditable, and replaceable.

AI should never become the source of truth.

The source of truth remains:

- Database
- Business rules
- Configuration
- Human operators

The AI assists decision making—it does not replace deterministic application logic.

---

# Prompt Development

Prompt templates belong inside dedicated prompt modules.

Avoid embedding prompts directly inside application logic.

Preferred:

```
packages/

ai/

dispatcher/

prompts/
```

Avoid:

```
dispatcher.ts

const prompt = `...`
```

Prompt versioning should be tracked alongside source control.

---

# Model Independence

Business logic should never depend on a specific LLM.

Avoid:

```typescript
if (model === "gemini") {
```

Prefer provider abstractions capable of supporting multiple models.

Switching providers should require configuration changes—not code changes.

---

# AI Safety Principles

All AI output should be treated as untrusted input.

Recommended safeguards include:

- Schema validation
- Confidence thresholds
- Human escalation
- Prompt injection protection
- Cost controls
- Audit logging

Never execute AI-generated instructions directly.

---

# Provider Development

RelayDispatch follows a Ports and Adapters architecture.

Business logic communicates with interfaces.

Interfaces communicate with adapters.

Adapters communicate with vendors.

```text
Business Logic

      │

      ▼

Provider Interface

      │

      ▼

Provider Adapter

      │

      ▼

Vendor SDK
```

This architecture minimizes vendor lock-in.

---

# Adding a New Provider

Typical steps:

1. Create adapter package
2. Implement provider interface
3. Register provider
4. Add configuration
5. Add tests
6. Update documentation

Business logic should not require modification.

---

# Temporal Workflow Development

Temporal workflows coordinate execution.

Activities perform work.

Keep this separation strict.

Workflow:

- orchestration
- branching
- retries
- timers
- signals

Activities:

- API calls
- database
- email
- AI
- filesystem
- encryption

Violating this separation breaks workflow determinism.

---

# Activity Design

Activities should:

- perform one responsibility
- remain idempotent
- log meaningful events
- return typed responses
- classify failures

Avoid oversized activity files.

Split activities by domain whenever practical.

---

# Performance Guidelines

Preferred:

- asynchronous operations
- batching
- pagination
- streaming
- connection pooling

Avoid:

- unnecessary serialization
- repeated database queries
- excessive prompt sizes
- synchronous blocking operations

Performance improvements should not reduce readability.

---

# Security Requirements

Every contribution should preserve the platform's security posture.

Required practices:

- Validate inputs
- Encode outputs
- Protect secrets
- Redact PII
- Use parameterized queries
- Validate AI responses
- Encrypt sensitive data
- Log responsibly

Never disable security checks for convenience.

---

# Dependency Management

Before introducing a dependency, evaluate:

- Maintenance activity
- License compatibility
- Security history
- Bundle impact
- Community adoption
- Long-term viability

Prefer existing platform capabilities over introducing new libraries.

Every dependency increases long-term maintenance cost.

---

# Release Verification Checklist

Before merging significant changes:

- TypeScript passes
- ESLint passes
- Tests pass
- Production build succeeds
- Documentation updated
- New functionality documented
- No secrets committed
- No proprietary branding introduced
- No broken package boundaries
- No unused dependencies added

Release quality is everyone's responsibility.

---

# Contributor Best Practices

Successful contributions typically share common characteristics.

- Keep pull requests focused.
- Prefer incremental improvements.
- Write readable code.
- Explain architectural decisions.
- Update documentation.
- Add meaningful tests.
- Preserve package boundaries.
- Avoid premature optimization.
- Respect existing conventions.
- Leave the codebase cleaner than you found it.

---

# Engineering Philosophy

RelayDispatch is intentionally designed as a long-lived open-source project.

The objective is not simply to build software that works today.

The objective is to build software that contributors can confidently understand, maintain, extend, and evolve for years to come.

Architectural clarity, deterministic behavior, modular design, and contributor experience are valued as highly as functionality itself.

---

# Troubleshooting

## `validateEnv()` Fails During Startup

### Symptoms

```text
Error: Missing required environment variable: OPENROUTER_API_KEY
```

### Resolution

1. Verify `.env` exists in the repository root.
2. Compare against `.env.example`.
3. Restart the development server after updating variables.

```bash
cp .env.example .env
```

---

## Worker Not Polling Tasks

### Symptoms

- Temporal Worker starts successfully.
- No Activities execute.
- Workflow remains pending.

### Verify

```bash
npm run dev:worker
```

Confirm:

- Namespace matches configuration
- Task Queue names match
- Worker process is running
- Temporal Server is reachable

---

## API Returns Unauthorized

Verify:

- JWT secret configured correctly
- Session cookie present
- Membership exists
- Organization is active
- RBAC permissions allow requested action

---

## AI Requests Failing

Check:

- OpenRouter API Key
- Model identifier
- Provider availability
- Daily/monthly cost limits
- Provider quota exhaustion

Enable debug logging:

```bash
LOG_LEVEL=debug npm run dev
```

---

## Database Connection Issues

Verify:

- Supabase project URL
- Service Role Key
- Network connectivity
- Applied migrations
- Row Level Security policies

---

## Webhook Verification Failures

Check:

- HMAC signing secret
- Reverse proxy headers
- Request body integrity
- Timestamp validation
- Replay protection configuration

---

# Migration Guide

## Updating from Earlier Versions

Review:

- `CHANGELOG.md`
- Migration notes
- Database migration order
- Environment variable additions
- Breaking API changes

Always:

1. Backup database
2. Export environment variables
3. Apply migrations
4. Run verification gate
5. Deploy

---

# Documentation Index

| Document           | Purpose                   |
| ------------------ | ------------------------- |
| README.md          | Project overview          |
| CONTRIBUTING.md    | Contribution workflow     |
| ARCHITECTURE.md    | System architecture       |
| API.md             | REST API reference        |
| AI_GUIDE.md        | AI subsystem              |
| SECURITY.md        | Security policy           |
| DEPLOYMENT.md      | Production deployment     |
| CONFIGURATION.md   | Environment configuration |
| TROUBLESHOOTING.md | Operational diagnostics   |
| CHANGELOG.md       | Release history           |

---

# Recommended Reading Order

For new contributors:

1. README.md
2. ARCHITECTURE.md
3. AI_GUIDE.md
4. API.md
5. SECURITY.md
6. CONTRIBUTING.md
7. This Developer Guide

---

# Release Verification Checklist

Before merging:

- [ ] Repository builds successfully
- [ ] TypeScript passes
- [ ] ESLint passes
- [ ] Tests pass
- [ ] Documentation updated
- [ ] New configuration documented
- [ ] Security review completed
- [ ] Public interfaces documented
- [ ] Breaking changes noted
- [ ] Changelog updated

---

# Long-Term Engineering Principles

RelayDispatch follows several engineering principles intended to keep the project maintainable as it grows:

- Modular packages over monolithic files.
- Interface-first architecture.
- Provider-neutral integrations.
- Configuration over hardcoded behavior.
- Explicit dependency boundaries.
- Small, composable modules.
- Secure-by-default development.
- AI systems designed with human oversight.
- Deterministic workflows.
- Comprehensive automated testing.
- Documentation treated as part of the codebase.

These principles guide architectural decisions and help ensure RelayDispatch remains maintainable, extensible, and community-friendly as an open-source project.

---

# License Notice

RelayDispatch is designed as a vendor-neutral, Bring-Your-Own-Provider (BYOP) platform.

Third-party providers (for example AI, email, telephony, CRM, and database services) are governed by their own terms of service, pricing models, and privacy policies.

Project contributors should ensure that integrations comply with the licensing and acceptable-use requirements of the external services they configure.

---

# Support

Community support:

- GitHub Issues
- GitHub Discussions

Security reports:

- Follow `SECURITY.md`

Feature proposals:

- GitHub Discussions
- Enhancement Requests

---

_End of Developer Guide_
