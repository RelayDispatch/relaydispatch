# RelayDispatch Architecture

> **Version:** 1.0
> **Architecture Revision:** Post PTD-001
> **Target Runtime:** 2026 LTS Stack
> **Status:** Stable
> **Architecture Style:** Modular Monorepo • Domain-Oriented • Workflow-Driven • BYOP (Bring Your Own Provider)

---

# Purpose

This document explains how RelayDispatch is designed, how each subsystem interacts, and the architectural principles that guide development.

It is intended for:

- Contributors
- Maintainers
- Security auditors
- Solution architects
- Platform engineers
- Organizations deploying RelayDispatch

Unlike the README, this document serves as the architectural source of truth.

---

# Design Principles

RelayDispatch follows several core engineering principles.

## 1. Open Source First

RelayDispatch is designed as a completely self-hostable platform.

There are:

- no subscriptions
- no licensing servers
- no mandatory cloud services
- no feature paywalls
- no proprietary runtime dependencies

Organizations own their infrastructure, credentials, and data.

---

## 2. BYOP (Bring Your Own Provider)

RelayDispatch never owns external services.

Instead it connects to providers supplied by the organization.

Examples include:

- AI Providers
- CRM platforms
- Email providers
- SMS providers
- Voice providers
- Storage backends

Every provider can be replaced without changing business logic.

---

## 3. Domain Driven Organization

Business logic is grouped by responsibility instead of technology.

Examples include:

- AI
- Workflows
- CRM
- Organizations
- Authentication
- Security
- Compliance
- Telemetry

This minimizes coupling and improves long-term maintainability.

---

## 4. Workflow First

RelayDispatch is built around durable workflows.

Instead of executing everything inside HTTP requests:

```
HTTP Request
      │
      ▼
Temporal Workflow
      │
      ▼
Activities
      │
      ▼
External Systems
```

Benefits include:

- retries
- durability
- observability
- recovery
- idempotency
- replay support

---

## 5. Security by Default

Every subsystem assumes hostile input.

Built-in protections include:

- HMAC webhook validation
- PII redaction
- encrypted vault storage
- JWT authentication
- structured audit logs
- environment validation
- provider isolation
- idempotent activities

---

# High-Level System Architecture

```text
                        ┌──────────────────────┐
                        │      Customers       │
                        └──────────┬───────────┘
                                   │
                     Email / SMS / Voice / API
                                   │
                                   ▼
                    ┌────────────────────────────┐
                    │        apps/api            │
                    │      Hono HTTP Server      │
                    └──────────┬─────────────────┘
                               │
                               ▼
                     Temporal Workflow Engine
                               │
          ┌────────────────────┼────────────────────┐
          ▼                    ▼                    ▼
     AI Activities       Database Activities   Provider Activities
          │                    │                    │
          ▼                    ▼                    ▼
   packages/ai         packages/database     packages/integrations
          │                    │                    │
          └──────────────┬─────┴────────────────────┘
                         ▼
                    apps/web Dashboard
```

---

# Repository Layout

```
relaydispatch/
│
├── apps/
│   ├── api/
│   ├── scheduler/
│   ├── web/
│   └── worker/
│
├── packages/
│   ├── ai/
│   ├── auth/
│   ├── compliance/
│   ├── config/
│   ├── database/
│   ├── integrations/
│   ├── organizations/
│   ├── security/
│   ├── shared/
│   ├── telemetry/
│   ├── ui/
│   └── workflows/
│
├── docs/
├── docker/
├── examples/
├── scripts/
├── supabase/
├── tests/
└── .github/
```

---

# Application Responsibilities

| Application        | Responsibility                                         |
| ------------------ | ------------------------------------------------------ |
| **apps/api**       | HTTP API, webhook intake, authentication, routing      |
| **apps/web**       | React dashboard and administration interface           |
| **apps/worker**    | Temporal Worker executing workflows and activities     |
| **apps/scheduler** | Scheduled maintenance, retention, cleanup, replay jobs |

Applications remain intentionally thin.

Most reusable logic resides inside `packages/`.

---

# Package Responsibilities

## AI

Responsible for:

- prompt orchestration
- routing
- dispatcher
- librarian
- guardrails
- model abstraction

---

## Database

Responsible for:

- Supabase client
- generated types
- repositories
- database helpers

---

## Integrations

Responsible for:

- CRM adapters
- telephony
- email
- provider registries
- provider interfaces

No business logic belongs here.

---

## Security

Responsible for:

- PII redaction
- webhook verification
- encryption
- vault helpers
- security utilities

---

## Compliance

Responsible for:

- disclosure builders
- jurisdiction helpers
- regulatory utilities

---

## Telemetry

Responsible for:

- OpenTelemetry
- metrics
- tracing
- AI usage
- provider usage
- audit logging

---

## Shared

Contains reusable utilities that have no business-specific behavior.

Examples:

- errors
- constants
- helpers
- validation
- utility functions

---

# Layered Architecture

RelayDispatch follows a strict layered architecture.

```text
Presentation
│
├── apps/web
└── apps/api

↓

Workflow Layer

apps/worker
Temporal

↓

Domain Packages

AI
Organizations
Security
Compliance

↓

Integration Packages

CRM
Email
Voice
AI Providers

↓

Infrastructure

Database
Telemetry
Storage
```

Lower layers never import upper layers.

Dependencies always point downward.

# End-to-End Request Lifecycle

The following sequence illustrates how a customer request moves through the platform.

```text
Customer
    │
    ▼
Email / API / Webhook
    │
    ▼
apps/api
    │
    ├── Validate request
    ├── Verify HMAC
    ├── Authenticate
    ├── Rate limit
    └── Start Workflow
    │
    ▼
Temporal
    │
    ▼
Workflow Execution
    │
    ├── Validate Thread
    ├── Fetch Message
    ├── Emergency Filter
    ├── Redact PII
    ├── AI Classification
    ├── CRM Lookup
    ├── Pricing
    ├── Dispatcher
    ├── Human Escalation (if required)
    ├── Send Reply
    └── Persist Results
    │
    ▼
Dashboard Updates
```

---

# Runtime Components

## API Server (`apps/api`)

Responsibilities:

- HTTP endpoints
- webhook ingestion
- authentication
- authorization
- request validation
- provider configuration
- health checks

The API performs minimal business logic.

Its primary responsibility is orchestration.

---

## Worker (`apps/worker`)

The Worker hosts the Temporal runtime.

Responsibilities include:

- executing workflows
- running activities
- retry handling
- failure recovery
- AI orchestration
- provider coordination

The Worker is the operational heart of RelayDispatch.

---

## Scheduler (`apps/scheduler`)

Runs background jobs that do not belong inside customer workflows.

Examples:

- retry failed webhooks
- retention cleanup
- completed activity cleanup
- telemetry aggregation
- maintenance tasks

Schedulers are intentionally independent from the HTTP API.

---

## Dashboard (`apps/web`)

The React dashboard provides operational visibility.

Major capabilities include:

- Inbox
- Thread management
- Technician management
- Pricing
- Provider configuration
- Organization settings
- AI configuration
- System health
- Audit logs
- Usage telemetry

The dashboard communicates exclusively with the HTTP API.

It never accesses infrastructure directly.

---

# Workflow Architecture

RelayDispatch uses Temporal to model business processes as durable workflows.

## Why Temporal?

Traditional request-response systems fail when:

- external APIs timeout
- workers restart
- processes crash
- retries duplicate work

Temporal solves these issues through deterministic workflow execution.

Benefits include:

- durable execution
- replay
- automatic retries
- exponential backoff
- workflow history
- signal support
- long-running orchestration

---

## Workflow Structure

```text
Workflow

│

├── Validation Activities

├── AI Activities

├── CRM Activities

├── Communication Activities

├── Database Activities

└── Completion Activities
```

Activities remain small, deterministic, and independently retryable.

---

# AI Pipeline

RelayDispatch currently operates a multi-stage AI pipeline.

```text
Inbound Request
        │
        ▼
Emergency Filter
        │
        ▼
PII Redaction
        │
        ▼
Classifier
        │
        ▼
Librarian
        │
        ▼
Dispatcher
        │
        ▼
Reply Validation
        │
        ▼
PII Rehydration
        │
        ▼
Customer Response
```

Each stage has a single responsibility.

---

# AI Responsibilities

## Emergency Filter

Runs before any model invocation.

Detects:

- gas leaks
- fire
- explosions
- carbon monoxide
- electrical hazards
- other life-safety events

Emergency requests bypass automated dispatch.

---

## PII Redactor

Protects sensitive customer information.

Before an LLM receives data:

```
John Smith
↓

[[CUSTOMER_NAME_1]]
```

The original values remain encrypted inside the vault.

No provider receives raw customer identities.

---

## Classifier

Produces structured metadata.

Example:

- service category
- urgency
- sentiment
- scheduling hints
- equipment information

Classifier output drives downstream workflow decisions.

---

## Librarian

Maintains conversation continuity.

Responsibilities:

- append conversation turns
- summarize history
- compress context
- maintain semantic continuity

This allows long-running conversations without exceeding context limits.

---

## Dispatcher

Generates customer-facing responses.

Inputs include:

- classification
- organization configuration
- technician availability
- pricing rules
- historical conversation
- compliance requirements

Outputs include:

- HTML response
- plain text response
- escalation recommendation
- confidence score
- usage metadata

---

# Provider Architecture

RelayDispatch follows a provider abstraction model.

Business logic never depends directly on vendor SDKs.

```text
Business Logic
        │
        ▼
Provider Interface
        │
        ▼
Registry
        │
        ▼
Adapter
        │
        ▼
Vendor SDK
```

This enables swapping providers without changing workflow logic.

Examples include:

| Category  | Examples                        |
| --------- | ------------------------------- |
| AI        | OpenRouter-compatible providers |
| CRM       | Jobber, future CRM adapters     |
| Email     | Gmail, Microsoft Graph, Nylas   |
| Voice/SMS | Twilio and future adapters      |
| Database  | Supabase                        |

---

# Provider Registry

Each provider category exposes:

- interface
- registry
- adapters
- mock implementations
- health checks

This enables:

- dependency inversion
- testing
- future extensibility
- community-developed plugins

---

# Configuration Flow

Configuration follows a strict hierarchy.

```text
Environment Variables
        │
        ▼
Configuration Validation
        │
        ▼
Package Configuration
        │
        ▼
Workflow Configuration
        │
        ▼
Runtime Components
```

Invalid configuration prevents startup.

Fail-fast behavior is intentional.

---

# Data Persistence

RelayDispatch stores operational data in Supabase.

Major entities include:

- Organizations
- Members
- Threads
- Messages
- Contacts
- Jobs
- Technicians
- Pricing Rules
- Activity Keys
- Failed Webhooks
- AI Audit Logs
- Provider Usage

Every database mutation occurs through workflow activities.

Direct writes from presentation layers are avoided whenever possible.

---

# Event Flow

```text
Customer
    │
    ▼
API
    │
    ▼
Workflow
    │
    ├── Database
    ├── AI
    ├── CRM
    ├── Email
    ├── SMS
    └── Audit Log
    │
    ▼
Dashboard
```

This event-driven model isolates failures and improves resiliency.

---

# Failure Handling

RelayDispatch assumes failures are normal.

Each subsystem implements independent recovery strategies.

| Component  | Recovery Strategy                 |
| ---------- | --------------------------------- |
| HTTP       | Validation + retry-safe responses |
| Workflow   | Automatic Temporal retries        |
| Activities | Exponential backoff               |
| Providers  | Retry + fallback                  |
| Database   | Idempotency keys                  |
| Email      | Duplicate-send protection         |
| AI         | Human escalation                  |
| Scheduler  | Replay failed jobs                |

No workflow should fail permanently because of a transient external outage.

# Security Architecture

Security is treated as a cross-cutting concern rather than an isolated component.

Every layer participates in protecting customer data, provider credentials, and workflow integrity.

---

## Defense in Depth

RelayDispatch implements multiple independent security layers.

```text
Internet
    │
    ▼
HMAC Verification
    │
    ▼
Authentication
    │
    ▼
Authorization
    │
    ▼
Input Validation
    │
    ▼
PII Redaction
    │
    ▼
Workflow Execution
    │
    ▼
Provider Isolation
    │
    ▼
Encrypted Storage
    │
    ▼
Audit Logging
```

Each layer assumes that the previous layer may fail.

---

## Identity & Authentication

Authentication is separated from business logic.

Supported authentication mechanisms include:

- JWT bearer tokens
- Organization membership validation
- API keys (provider integrations only)
- Service Role authentication (worker-only)

The Worker and API intentionally use different trust boundaries.

| Component | Authentication             |
| --------- | -------------------------- |
| Dashboard | JWT                        |
| API       | JWT + Organization Context |
| Worker    | Service Role               |
| Scheduler | Internal Service Identity  |

---

## Authorization Model

RelayDispatch follows Organization-based authorization.

```text
User
   │
   ▼
Organization
   │
   ▼
Membership
   │
   ▼
Permissions
   │
   ▼
Accessible Resources
```

No organization can access another organization's:

- threads
- jobs
- technicians
- pricing
- AI history
- provider credentials

---

## PII Protection Pipeline

Sensitive information is never sent directly to an LLM.

```text
Inbound Email

↓

PII Detection

↓

Placeholder Replacement

↓

Encrypted Vault

↓

LLM

↓

Generated Response

↓

Rehydration

↓

Outbound Message
```

This guarantees that external AI providers never receive customer identities.

---

## Encryption

RelayDispatch currently uses:

| Purpose            | Algorithm                          |
| ------------------ | ---------------------------------- |
| Vault Encryption   | AES-256-GCM                        |
| Webhook Validation | HMAC-SHA256                        |
| HTTPS              | TLS 1.3                            |
| Password Hashing   | Managed by Supabase Authentication |

Encryption keys are supplied exclusively through environment variables.

---

## Secret Management

Secrets never reside in source code.

Supported secret locations include:

- environment variables
- Docker secrets
- Kubernetes Secrets
- external secret managers
- CI/CD secret stores

Examples:

```env
OPENROUTER_API_KEY
SUPABASE_SERVICE_ROLE_KEY
TWILIO_AUTH_TOKEN
VAULT_ENCRYPTION_KEY
```

---

# Observability Architecture

RelayDispatch is designed to be observable by default.

Every significant operation emits structured telemetry.

The platform supports:

- structured logging
- distributed tracing
- metrics
- AI cost accounting
- provider telemetry
- workflow history

---

## Logging

Production logging is structured.

Example events include:

- workflow started
- workflow completed
- workflow failed
- activity retry
- provider timeout
- AI escalation
- provider configuration changes

Sensitive information is never logged.

---

## Metrics

Operational metrics include:

- workflow latency
- workflow duration
- activity retries
- provider failures
- AI token usage
- estimated AI costs
- email throughput
- dispatch success rate
- escalation rate

Metrics are designed for systems such as Prometheus and Grafana.

---

## Distributed Tracing

OpenTelemetry spans can be emitted across:

```text
API

↓

Workflow

↓

Activities

↓

Providers

↓

Database
```

This enables end-to-end request tracing across distributed components.

---

# Reliability Architecture

RelayDispatch is designed for long-running production workloads.

---

## Retry Strategy

Temporal retries transient failures automatically.

Typical retry scenarios include:

- CRM unavailable
- email provider timeout
- temporary database failures
- AI provider rate limiting
- webhook delivery failures

Retries use exponential backoff to reduce provider pressure.

---

## Idempotency

Every side-effecting activity must be idempotent.

Examples include:

- sending emails
- creating jobs
- dispatching technicians
- updating CRM records

Duplicate executions must never create duplicate customer actions.

---

## Dead Letter Queue

Failures that cannot be recovered automatically are stored for replay.

```text
Failure

↓

Retry Policy

↓

Exceeded

↓

Dead Letter Queue

↓

Operator Review

↓

Replay
```

This prevents permanent message loss.

---

## Human Escalation

RelayDispatch intentionally avoids forcing AI decisions.

Escalation conditions include:

- low confidence
- safety concerns
- emergency keywords
- missing pricing
- provider failures
- malformed AI responses
- policy violations

Human operators remain the final authority.

---

# Scalability

The architecture is horizontally scalable.

Components may be scaled independently.

```text
          Load Balancer
                │
     ┌──────────┼──────────┐
     ▼          ▼          ▼
 API #1     API #2     API #3
     │          │          │
     └──────────┼──────────┘
                ▼
         Temporal Cluster
                │
      ┌─────────┼─────────┐
      ▼         ▼         ▼
 Worker     Worker     Worker
                │
                ▼
          Provider Layer
```

This enables independent scaling of:

- API servers
- workers
- schedulers
- dashboard
- provider adapters

---

# Architectural Decisions (ADRs)

The following architectural decisions guide RelayDispatch.

| Decision                   | Rationale                                                     |
| -------------------------- | ------------------------------------------------------------- |
| Temporal for orchestration | Durable workflows and reliable retries                        |
| Hono for API               | Lightweight, standards-compliant HTTP framework               |
| React + Vite               | Fast developer experience and modern frontend tooling         |
| Supabase                   | Managed PostgreSQL with authentication and Row Level Security |
| OpenRouter                 | Vendor-neutral access to multiple LLM providers               |
| BYOP model                 | Organizations retain ownership of provider accounts           |
| Monorepo                   | Shared packages and simplified dependency management          |
| TypeScript                 | Strong typing across the entire platform                      |

---

# Technology Stack

| Layer            | Technology                   |
| ---------------- | ---------------------------- |
| Language         | TypeScript                   |
| Runtime          | Node.js LTS                  |
| Package Manager  | npm                          |
| Frontend         | React + Vite                 |
| API              | Hono                         |
| Workflow Engine  | Temporal                     |
| Database         | PostgreSQL (Supabase)        |
| Authentication   | Supabase Auth + JWT          |
| AI Gateway       | OpenRouter                   |
| Telemetry        | OpenTelemetry                |
| Testing          | Vitest + MSW                 |
| Linting          | ESLint Flat Config           |
| Formatting       | Prettier (recommended)       |
| Containerization | Docker                       |
| CI/CD            | GitHub Actions (recommended) |

---

# Architectural Constraints

The following rules should not be violated.

## DO

- Keep packages focused on a single responsibility.
- Keep workflows deterministic.
- Keep activities independently retryable.
- Prefer interfaces over vendor-specific implementations.
- Add tests alongside new functionality.
- Protect sensitive data before external processing.
- Maintain provider neutrality.
- Preserve backward compatibility whenever practical.

---

## DON'T

- Import vendor SDKs directly into business logic.
- Embed secrets in source code.
- Perform long-running work inside HTTP handlers.
- Allow AI providers to receive raw PII.
- Create monolithic modules or "god files."
- Couple packages through circular dependencies.
- Introduce commercial licensing or feature gates into the open-source core.
- Bypass workflow orchestration for state-changing operations.

---

# Future Evolution

The architecture is intentionally extensible.

Future roadmap items include:

- Native MCP (Model Context Protocol) integration
- Additional CRM adapters
- Additional email providers
- Pluggable vector database support
- Multi-model AI routing
- Event streaming via Kafka/NATS
- Plugin SDK
- Multi-region deployments
- Kubernetes Helm charts
- Enterprise observability integrations
- Advanced policy engine
- Optional Retrieval-Augmented Generation (RAG)
- Voice-first dispatch workflows

These capabilities can be added without major architectural changes because of the existing modular package boundaries.

---

# Conclusion

RelayDispatch follows a modular, workflow-centric architecture designed for long-term maintainability, security, and extensibility.

Its core principles—**workflow orchestration, provider neutrality, strong security boundaries, and domain-oriented modularity**—allow organizations to self-host, customize, and evolve the platform while maintaining a stable and auditable foundation suitable for modern production deployments.
