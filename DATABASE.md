# Database Reference

> **Version:** 2026 Edition
>
> RelayDispatch uses **Supabase PostgreSQL** as its primary transactional database while leveraging PostgreSQL's enterprise capabilities—including Row Level Security (RLS), ACID-compliant transactions, JSONB storage, indexing, and extensibility—to provide a secure, scalable, multi-tenant platform.
>
> This document serves as the authoritative technical reference for the RelayDispatch database architecture, schema design, security model, operational guidelines, and development workflow.

---

# Table of Contents

- Database Philosophy
- Design Goals
- High-Level Architecture
- Multi-Tenant Model
- Database Components
- Entity Relationship Overview
- Data Lifecycle
- Transaction Model
- Security Architecture
- Core Schema Reference
- Operational Tables
- AI Data Storage
- Database Migrations
- Row Level Security
- Performance & Indexing
- Backup & Disaster Recovery
- Development Workflow
- Future Roadmap

---

# Database Philosophy

RelayDispatch is designed around several core database principles:

- **Multi-tenant by default**
- **Security-first architecture**
- **PII minimization**
- **AI-safe data handling**
- **Deterministic workflows**
- **Operational auditability**
- **Cloud-native scalability**
- **Schema evolution through migrations**
- **Strong typing across the application**

Unlike many CRUD applications, RelayDispatch's database is the **operational source of truth** for workflows, AI decisions, CRM synchronization, dispatch state, compliance records, and organizational configuration.

Every workflow executed by Temporal ultimately persists its state through PostgreSQL.

---

# Design Goals

The schema has been designed to satisfy several architectural objectives.

## Security

Protect customer information using:

- Row Level Security
- Service-role isolation
- Encrypted PII storage
- Least-privilege access
- Immutable audit records

---

## Scalability

The schema supports:

- thousands of organizations

- millions of conversations

- millions of workflow executions

- horizontal worker scaling

- long-running Temporal workflows

without requiring architectural changes.

---

## Maintainability

The schema favors:

- explicit foreign keys

- normalized data

- predictable naming

- migration-driven evolution

- generated TypeScript types

instead of hidden ORM behavior.

---

## AI Compatibility

RelayDispatch is designed specifically for AI-powered workflows.

Therefore the database intentionally separates:

- customer identity

- workflow state

- AI prompts

- AI outputs

- pricing rules

- compliance metadata

This separation allows AI agents to operate without unrestricted database access.

---

# High-Level Database Architecture

```

                        +----------------------+
                        |     Applications     |
                        +----------+-----------+
                                   |
                     JWT           |          Service Role
                (RLS Enabled)      |         (Bypasses RLS)
                                   |
        +--------------------------+--------------------------+
        |                                                     |
        ▼                                                     ▼
+----------------------+                               +----------------------+
|      API Server      |                               |   Temporal Worker    |
|       apps/api       |                               |     apps/worker      |
+----------+-----------+                               +----------+-----------+
           |                                                      |
           +---------------------------+--------------------------+
                                       |
                                       ▼
                         +---------------------------+
                         |         Supabase          |
                         |  PostgreSQL + Auth + RLS  |
                         +-------------+-------------+
                                       |
         +-----------------------------+-----------------------------+
         |                             |                             |
         ▼                             ▼                             ▼
+------------------+         +------------------+          +------------------+
| Transaction Data |         |  Authentication  |          |  Object Storage  |
+------------------+         +------------------+          +------------------+

```

---

# Architectural Principles

The database intentionally separates responsibilities into distinct domains.

| Domain        | Responsibility                 |
| ------------- | ------------------------------ |
| Organizations | Multi-tenancy                  |
| Contacts      | Customer identities            |
| Threads       | Conversation state             |
| Messages      | Communication history          |
| Jobs          | Dispatch lifecycle             |
| Pricing       | Business rules                 |
| AI            | AI metadata and auditability   |
| Security      | Authentication & authorization |
| Billing       | Commercial functionality       |
| System        | Operational metadata           |

Each domain owns its own tables and relationships.

Cross-domain communication occurs only through foreign keys.

---

# Multi-Tenant Architecture

RelayDispatch is built as a **shared-database, shared-schema multi-tenant platform**.

Every business using RelayDispatch is represented by exactly one row in the `organizations` table.

```

Organization A
├── Contacts
├── Threads
├── Jobs
├── Pricing
└── Technicians

Organization B
├── Contacts
├── Threads
├── Jobs
├── Pricing
└── Technicians

```

No organization can access another organization's records through the public API.

Isolation is enforced by:

- Row Level Security
- JWT claims
- organization_id ownership
- backend authorization
- worker-side validation

---

# Tenant Isolation Model

Every business-owned table contains:

```

organization_id UUID NOT NULL

```

Examples include:

- contacts
- threads
- jobs
- technicians
- pricing_rules
- messages
- memberships
- audit_logs

This provides:

- efficient filtering

- predictable indexing

- straightforward RLS policies

- simplified authorization

---

# Entity Relationship Overview

At a high level, the database follows this relationship model.

```

Organization
│
├── Members
│
├── Contacts
│ │
│ └── Threads
│ │
│ ├── Messages
│ │
│ ├── Jobs
│ │
│ └── AI Audit Logs
│
├── Technicians
│
├── Pricing Rules
│
└── Billing Records

```

The schema is intentionally normalized.

Large duplicated records are avoided whenever possible.

---

# Database Components

The RelayDispatch database can be viewed as several logical subsystems.

## Business Data

Stores operational records.

Examples:

- organizations
- contacts
- technicians
- pricing
- jobs

---

## Workflow Data

Stores workflow execution state.

Examples:

- threads
- messages
- activity keys
- failed webhooks

---

## AI Metadata

Stores AI-specific operational information.

Examples:

- token usage
- model identifiers
- latency
- confidence
- costs

No prompt history containing raw customer PII is stored.

---

## Authentication

Managed through Supabase Auth.

Application tables reference authenticated users through UUID foreign keys.

Authentication metadata remains separate from business records.

---

## Compliance

Stores legally required operational metadata including:

- disclosure acknowledgements

- audit timestamps

- escalation reasons

- compliance events

- AI decision records

---

# Data Lifecycle

Every inbound customer request follows a deterministic lifecycle.

```

Inbound Email

↓

Webhook Verification

↓

PII Redaction

↓

Thread Creation

↓

Message Storage

↓

AI Classification

↓

Job Creation

↓

Dispatcher Response

↓

Outbound Delivery

↓

Audit Logging

↓

Workflow Completion

```

Each stage persists only the information necessary for its responsibility.

This minimizes accidental data exposure while preserving complete operational traceability.

---

# ACID Transaction Philosophy

RelayDispatch relies on PostgreSQL's ACID guarantees for all critical business operations.

Critical operations include:

- creating jobs

- updating workflow state

- dispatching technicians

- recording billing events

- writing audit records

Operations that modify multiple business entities should execute within a single database transaction whenever possible.

Long-running orchestration is delegated to Temporal, while PostgreSQL remains the authoritative persistence layer.

---

# Design Constraints

The database intentionally avoids:

- Shared mutable global state
- Hidden ORM magic
- Cross-tenant joins without authorization
- AI-generated database writes
- Raw customer PII in AI-accessible tables
- Circular foreign key relationships
- Duplicate workflow state

These constraints simplify maintenance, improve security, and reduce operational complexity.

---

The following sections document every production table, relationship, migration strategy, operational subsystem, and security mechanism in detail.

---

# Core Production Schema

The following tables form the operational backbone of RelayDispatch.

Each table serves a single business responsibility and is intentionally designed to minimize coupling while maximizing auditability, security, and scalability.

> **Design Principle**
>
> All business entities belong to an organization. Unless explicitly documented otherwise, every production table contains an `organization_id` foreign key and is protected by Row Level Security (RLS).

---

# organizations

The **organizations** table is the root entity of the RelayDispatch platform.

Every tenant, workflow, AI interaction, technician, pricing rule, billing record, and customer ultimately belongs to one organization.

## Purpose

Stores tenant configuration, business metadata, operational preferences, licensing information, compliance settings, and feature configuration.

Every authenticated user operates within the scope of one or more organizations.

---

## Relationships

```
organizations
│
├── contacts
├── threads
├── messages
├── jobs
├── technicians
├── pricing_rules
├── memberships
├── billing_events
├── ai_audit_logs
└── failed_webhooks
```

---

## Primary Fields

| Column          | Type        | Description               |
| --------------- | ----------- | ------------------------- |
| `id`            | UUID        | Primary key               |
| `name`          | TEXT        | Organization display name |
| `slug`          | TEXT        | Unique URL identifier     |
| `plan`          | TEXT        | Subscription plan         |
| `dispatch_mode` | TEXT        | `shadow` or `autonomous`  |
| `mail_provider` | TEXT        | Connected email provider  |
| `timezone`      | TEXT        | IANA timezone             |
| `locale`        | TEXT        | Default locale            |
| `currency`      | TEXT        | Billing currency          |
| `is_active`     | BOOLEAN     | Organization enabled      |
| `created_at`    | TIMESTAMPTZ | Creation timestamp        |
| `updated_at`    | TIMESTAMPTZ | Last modification         |

---

## Configuration

Organization configuration includes:

- AI preferences
- dispatch behavior
- business hours
- compliance configuration
- notification preferences
- provider selection
- regional settings
- feature flags

Business logic should always reference organization configuration rather than hardcoded values.

---

## Best Practices

✅ Store configuration here

✅ Store organization metadata

❌ Never store user information

❌ Never store workflow state

❌ Never store customer conversations

---

# memberships

The memberships table defines which authenticated users belong to an organization.

RelayDispatch supports users belonging to multiple organizations simultaneously.

---

## Purpose

Provides organization-level authorization.

Authentication answers:

> Who is this user?

Membership answers:

> What may this user access?

---

## Example

```
User A

├── HVAC Company
└── Plumbing Company

User B

└── Electrical Company
```

---

## Common Fields

| Column          | Description         |
| --------------- | ------------------- |
| user_id         | Auth user           |
| organization_id | Tenant              |
| role            | Member role         |
| invited_by      | Inviter             |
| created_at      | Membership creation |

---

## Typical Roles

Examples include:

- Owner
- Administrator
- Dispatcher
- Technician
- Read Only

Projects may extend this model with custom roles.

---

# contacts

Contacts represent customers.

Each customer exists independently from conversations.

This prevents duplicate customer records.

---

## Purpose

Stores customer identity.

A contact may participate in many conversations.

```
Customer

↓

Many Threads

↓

Many Messages
```

---

## Relationships

```
Organization

↓

Contact

↓

Threads

↓

Messages
```

---

## Important Security Note

Contacts intentionally store **minimal information**.

Examples:

- email

- redacted names

- phone (optional)

- metadata

Sensitive customer information should not be duplicated across the database.

---

## Primary Fields

| Column          | Description    |
| --------------- | -------------- |
| id              | UUID           |
| organization_id | Tenant         |
| email           | Customer email |
| first_name      | Redacted       |
| last_name       | Redacted       |
| phone           | Optional       |
| created_at      | Timestamp      |

---

## Design Notes

RelayDispatch intentionally separates:

Identity

↓

Conversation

↓

Workflow

↓

AI

This improves normalization and simplifies GDPR deletion requests.

---

# threads

Threads represent customer conversations.

Every inbound email begins exactly one workflow thread.

---

## Purpose

Represents the lifecycle of a customer request.

Examples include:

- AC repair

- Furnace replacement

- Maintenance

- Emergency dispatch

---

## Lifecycle

```
NEW

↓

CLASSIFIED

↓

RESPONDING

↓

DISPATCHED

↓

RESOLVED
```

Alternative paths:

```
↓

ESCALATED

↓

MANUAL REVIEW
```

---

## Important Fields

| Column            | Description       |
| ----------------- | ----------------- |
| id                | UUID              |
| organization_id   | Tenant            |
| contact_id        | Customer          |
| workflow_id       | Temporal workflow |
| status            | Current state     |
| urgency_score     | AI generated      |
| sentiment_score   | AI generated      |
| escalation_reason | Human escalation  |
| service_category  | AI classification |

---

## AI Metadata

Threads intentionally store only summarized AI information.

Examples:

- urgency

- sentiment

- category

- escalation

Prompt history belongs elsewhere.

---

# messages

Messages store every communication event.

Each thread contains one or more messages.

---

## Message Types

Inbound

↓

Customer

Outbound

↓

AI

↓

Human Dispatcher

↓

Automated Notifications

---

## Purpose

Provides complete conversation history.

Supports:

- replay

- auditing

- search

- analytics

- AI context

---

## Security Model

Messages never contain unrestricted customer data.

Instead:

```
Customer:

John Smith

↓

Stored:

[[CUSTOMER_NAME_1]]
```

Actual values remain inside the encrypted vault.

---

## Important Fields

| Column            | Description           |
| ----------------- | --------------------- |
| id                | UUID                  |
| thread_id         | Parent thread         |
| direction         | Inbound / Outbound    |
| role              | Customer / AI / Human |
| body_text         | Redacted              |
| body_html         | Redacted              |
| model_used        | AI model              |
| latency_ms        | AI latency            |
| prompt_tokens     | Token count           |
| completion_tokens | Token count           |
| delivered_at      | Delivery timestamp    |

---

## Storage Philosophy

Messages are immutable.

Editing historical messages should never occur.

Corrections are represented by additional messages instead of updates.

This preserves a complete audit trail.

---

# jobs

Jobs represent real-world dispatch work.

Unlike conversations, jobs correspond to actual field service operations.

---

## Purpose

Tracks work from triage through completion.

```
Customer Email

↓

Thread

↓

AI Classification

↓

Job

↓

Technician

↓

Completion
```

---

## Important Fields

| Column            | Description         |
| ----------------- | ------------------- |
| id                | UUID                |
| organization_id   | Tenant              |
| thread_id         | Conversation        |
| contact_id        | Customer            |
| service_type      | Requested service   |
| technician_id     | Assigned technician |
| status            | Job state           |
| scheduled_at      | Appointment         |
| completed_at      | Completion          |
| external_provider | CRM                 |
| external_id       | CRM identifier      |

---

## Typical Lifecycle

```
TRIAGED

↓

PENDING

↓

ASSIGNED

↓

DISPATCHED

↓

IN_PROGRESS

↓

COMPLETED
```

Alternative paths:

```
↓

CANCELLED

↓

FAILED

↓

ESCALATED
```

---

## CRM Synchronization

Jobs remain provider-independent.

Provider-specific identifiers are isolated into:

- external_provider

- external_id

This allows switching CRM providers without redesigning the schema.

---

# technicians

Technicians represent dispatch resources.

AI never invents technicians.

It selects only from available database records.

---

## Stored Information

- display name

- certifications

- skills

- service regions

- availability

- active status

- provider mapping

---

## Typical Fields

| Column               | Description  |
| -------------------- | ------------ |
| id                   | UUID         |
| organization_id      | Tenant       |
| name                 | Display name |
| skills               | Array        |
| location_zone        | Coverage     |
| is_active            | Availability |
| external_provider_id | CRM mapping  |

---

## Design Goal

Technician availability is always treated as authoritative operational data.

AI consumes this information but does not modify it directly.

---

# Business Rules & Pricing

RelayDispatch intentionally separates **business configuration** from **AI reasoning**.

Rather than allowing AI models to infer pricing, labor rates, or dispatch policies, these values are stored in structured database tables and supplied to AI as deterministic context.

This guarantees predictable, auditable, and organization-specific decisions.

---

# pricing_rules

The `pricing_rules` table defines the pricing catalog for each organization.

The Dispatcher agent references these records when generating customer quotations, estimates, and pricing explanations.

> **AI Safety Principle**
>
> The AI **must never invent pricing**. Every quoted amount must originate from a valid pricing rule or the workflow must request additional information or escalate to a human.

---

## Purpose

This table centralizes pricing logic for:

- Service calls
- Diagnostics
- Repairs
- Maintenance
- Emergency visits
- Installation labor
- Flat-rate services
- Organization-specific pricing

---

## Relationships

```
Organization
      │
      ▼
Pricing Rules
      │
      ▼
Dispatcher Agent
      │
      ▼
Customer Quote
```

---

## Primary Fields

| Column               | Description           |
| -------------------- | --------------------- |
| id                   | Primary key           |
| organization_id      | Tenant owner          |
| service_code         | AI service category   |
| base_price           | Base service price    |
| currency             | ISO currency code     |
| labor_rate           | Optional hourly labor |
| emergency_multiplier | Emergency surcharge   |
| active               | Rule enabled          |
| effective_from       | Rule activation       |
| expires_at           | Optional expiration   |

---

## Example

```
Service:
AC_DIAGNOSTIC

↓

Database

↓

$129.00

↓

Dispatcher Prompt

↓

Customer Reply
```

The Dispatcher cannot produce a different price unless explicitly configured.

---

# Business Configuration

Organization-specific business rules are intentionally stored separately from workflow state.

Examples include:

- Dispatch mode
- Business hours
- Working days
- Holiday calendars
- Timezone
- Supported services
- SLA configuration
- Compliance notices

Keeping configuration outside workflow tables simplifies upgrades and reduces duplication.

---

# Technician Scheduling

Technician availability is operational data.

AI reads scheduling information but does not become the source of truth.

Scheduling systems may synchronize from:

- CRM
- Internal scheduler
- Calendar provider
- Workforce management software

The database stores the canonical state used during workflow execution.

---

# Billing Events

> **Optional Commercial Module**

RelayDispatch supports commercial deployments while remaining open-source.

Billing information is isolated into dedicated tables.

Typical records include:

- Subscription changes
- Usage events
- Token consumption
- Payment events
- Invoice generation
- Seat allocation
- Plan upgrades

---

## Example Fields

| Column             | Description          |
| ------------------ | -------------------- |
| id                 | Primary key          |
| organization_id    | Tenant               |
| event_type         | Billing event        |
| amount             | Monetary amount      |
| currency           | ISO code             |
| provider           | Stripe, Paddle, etc. |
| provider_reference | External identifier  |
| created_at         | Timestamp            |

---

## Separation Principle

Business operations never depend directly upon payment providers.

Instead:

```
Billing Provider

↓

Billing Adapter

↓

Billing Events

↓

Business Logic
```

This architecture allows billing providers to be replaced with minimal application changes.

---

# AI Operational Metadata

RelayDispatch records AI execution metadata for observability, auditing, and cost management.

No raw prompts containing customer PII are persisted.

---

## Stored Metadata

Typical information includes:

- Model identifier
- Prompt token count
- Completion token count
- Estimated cost
- Latency
- Confidence score
- Escalation decision
- Processing timestamp

---

## Example Flow

```
Dispatcher

↓

OpenRouter

↓

Model

↓

Metadata

↓

Database
```

The metadata enables performance analysis without exposing sensitive conversation data.

---

# AI Audit Logs

Large deployments often require traceability for automated decisions.

The optional `ai_audit_log` table provides this capability.

---

## Typical Contents

- Workflow ID
- Thread ID
- Organization
- Model used
- Cost
- Confidence
- Escalation flag
- Decision summary
- Processing duration

---

## Benefits

Supports:

- Internal investigations
- Cost reporting
- AI governance
- Compliance reviews
- Model comparison
- Regression analysis

---

# failed_webhooks

Webhook delivery failures are persisted rather than discarded.

This table functions as a Dead Letter Queue (DLQ).

---

## Purpose

Provides reliable recovery for failed webhook processing.

Typical failures include:

- Network outages
- Temporary provider failures
- Validation errors
- Database contention
- Worker downtime

---

## Workflow

```
Webhook

↓

Processing Failure

↓

failed_webhooks

↓

Scheduler Replay

↓

Success

↓

Archived
```

---

## Example Fields

| Column          | Description      |
| --------------- | ---------------- |
| id              | Primary key      |
| organization_id | Tenant           |
| payload         | Original payload |
| retry_count     | Attempts         |
| failure_reason  | Latest error     |
| next_retry_at   | Scheduled retry  |
| resolved        | Replay completed |

---

# completed_activity_keys

Temporal Activities may retry after transient failures.

Side effects must therefore be idempotent.

The `completed_activity_keys` table prevents duplicate execution.

---

## Example

Without idempotency:

```
Retry

↓

Email Sent Twice
```

With idempotency:

```
Retry

↓

Duplicate Detected

↓

Skipped
```

---

## Typical Fields

| Column     | Description                   |
| ---------- | ----------------------------- |
| key        | Unique activity identifier    |
| status     | Reserved / Completed / Failed |
| metadata   | Optional JSON payload         |
| expires_at | Cleanup timestamp             |

---

# System Metadata

RelayDispatch stores operational metadata separately from business records.

Examples include:

- Scheduler checkpoints
- Background worker status
- Cleanup progress
- Migration versions
- Feature flags
- Internal metrics

Keeping operational metadata isolated prevents accidental coupling between infrastructure and business workflows.

---

# Constraints

The schema relies heavily on relational constraints.

Common constraints include:

- Primary keys
- Foreign keys
- Unique indexes
- Check constraints
- Default values
- Cascading deletes (where appropriate)
- Restricted deletes for critical records

Database constraints serve as the final integrity layer beyond application validation.

---

# Indexing Strategy

Indexes are designed around common production access patterns.

Frequently indexed columns include:

- organization_id
- thread_id
- contact_id
- created_at
- updated_at
- workflow_id
- external_id
- service_category
- status

Composite indexes are preferred for high-frequency multi-column queries.

Example:

```
(organization_id, created_at)

(organization_id, status)

(thread_id, created_at)
```

These significantly improve dashboard queries, workflow lookups, and reporting performance.

---

# Data Integrity Principles

RelayDispatch follows several non-negotiable integrity rules:

- Every business record belongs to exactly one organization.
- Foreign keys are preferred over application-managed relationships.
- Immutable history is favored over destructive updates.
- AI metadata never replaces business state.
- Business rules originate from structured configuration—not AI inference.
- Operational failures must always be recoverable through persisted state.

---

# Database Security Architecture

Security is a foundational design principle of RelayDispatch.

Rather than relying on a single protection mechanism, the platform applies a **defense-in-depth** strategy across authentication, authorization, encryption, data isolation, workflow execution, AI processing, and infrastructure.

Every layer assumes that another layer may eventually fail.

---

# Security Design Principles

The database follows several core principles:

- Multi-tenant isolation by default
- Least-privilege access
- Zero hardcoded secrets
- Defense in depth
- Immutable auditability
- Encryption for sensitive information
- Secure-by-default schema design
- Explicit trust boundaries
- AI-safe data architecture

Every table, relationship, and access path should be evaluated against these principles before implementation.

---

# Trust Boundary Model

RelayDispatch separates responsibilities into clearly defined trust zones.

```
                 Internet
                     │
                     ▼
             Reverse Proxy / CDN
                     │
                     ▼
             API Authentication
                     │
        ┌────────────┴────────────┐
        ▼                         ▼
   Authenticated API        Worker Process
   (User JWT)              (Service Role)
        │                         │
        ▼                         ▼
PostgreSQL + RLS              PostgreSQL
        │                    (Bypass RLS)
        └────────────┬────────────┘
                     ▼
               Business Data
```

Every transition between trust boundaries requires explicit authorization.

---

# Authentication

RelayDispatch delegates authentication to **Supabase Auth**.

The application does **not** implement its own password management system.

Authentication responsibilities include:

- User identity
- Session management
- OAuth providers
- Password reset
- Multi-factor authentication (if enabled)
- JWT issuance
- Session expiration

Application code should never attempt to replace these capabilities.

---

# Authorization

Authentication answers:

> Who are you?

Authorization answers:

> What are you allowed to access?

RelayDispatch performs authorization at multiple layers:

- JWT validation
- Organization membership
- Role validation
- Row Level Security
- API middleware
- Worker-side verification

Authorization decisions should never rely solely on client-provided identifiers.

---

# Row Level Security (RLS)

Every business-owned table enables PostgreSQL Row Level Security.

This is the primary tenant isolation mechanism.

Example:

```
organizations

↓

contacts

↓

threads

↓

messages

↓

jobs
```

Every query executed through the public API automatically filters records according to the authenticated user's organization membership.

---

## Why RLS?

Without RLS:

```
SELECT * FROM jobs;
```

could expose data from every customer.

With RLS:

```
SELECT * FROM jobs;
```

returns only rows belonging to the authenticated organization.

Application developers do not need to manually add tenant filters to every query.

---

# Service Role Access

The Temporal Worker uses the Supabase **Service Role Key**.

This intentionally bypasses RLS because background workflows must operate across internal system functions.

However, this capability is tightly constrained.

The Service Role is used only by trusted backend processes.

It must **never** be exposed to:

- browsers
- mobile applications
- public APIs
- frontend bundles
- client-side JavaScript

---

# Principle of Least Privilege

Every component receives only the permissions necessary for its responsibilities.

| Component     | Permissions           |
| ------------- | --------------------- |
| Web Dashboard | User JWT              |
| API Server    | User JWT              |
| Worker        | Service Role          |
| Scheduler     | Service Role          |
| AI Agent      | Structured input only |

This minimizes blast radius in the event of compromise.

---

# Encryption Strategy

RelayDispatch employs encryption at multiple layers.

## Encryption in Transit

All communication should occur over TLS.

Examples include:

- Browser ↔ API
- API ↔ Database
- API ↔ OpenRouter
- API ↔ CRM
- API ↔ Email Provider

Plain HTTP should never be used in production.

---

## Encryption at Rest

Production deployments should rely on encrypted storage.

Examples include:

- PostgreSQL disk encryption
- Managed database encryption
- Cloud volume encryption
- Encrypted backups

RelayDispatch assumes encryption-at-rest is provided by the hosting platform.

---

## Application-Level Encryption

Certain information receives additional encryption before storage.

Examples include:

- Vault contents
- Sensitive workflow metadata
- OAuth refresh tokens
- API credentials

Application-level encryption protects sensitive information even if database storage is compromised.

---

# PII Lifecycle

RelayDispatch intentionally minimizes exposure of Personally Identifiable Information (PII).

The lifecycle is deterministic.

```
Inbound Email

↓

PII Detection

↓

Placeholder Replacement

↓

Encrypted Vault Storage

↓

AI Processing

↓

Response Generation

↓

PII Rehydration

↓

Outbound Delivery
```

Raw customer information should never enter AI prompts.

---

# PII Vault

Sensitive customer information is stored separately from conversational content.

Typical records include:

- Customer names
- Phone numbers
- Addresses
- Account identifiers
- Email aliases

Vault contents are encrypted using AES-256-GCM before persistence.

The encryption key is deployment-specific.

---

# Secrets Management

Secrets should never exist inside:

- source code
- Git history
- configuration examples
- documentation
- screenshots
- test fixtures

Instead, secrets are supplied through secure runtime configuration.

Examples include:

- Environment variables
- Cloud secret managers
- Kubernetes Secrets
- Docker Secrets
- HashiCorp Vault
- AWS Secrets Manager
- Azure Key Vault
- Google Secret Manager

---

# Audit Logging

Every security-sensitive operation should produce an audit record.

Examples include:

- Login events
- Organization membership changes
- Permission updates
- AI escalations
- Workflow overrides
- Manual dispatch actions
- Administrative operations

Audit logs should be append-only whenever possible.

---

# AI Data Security

AI components never receive unrestricted database access.

Instead, they operate on structured context assembled by backend activities.

AI receives:

- Redacted customer messages
- Technician summaries
- Pricing rules
- Organization configuration
- Conversation summaries

AI does **not** receive:

- Database credentials
- JWTs
- OAuth tokens
- Service role keys
- Internal configuration
- Complete customer datasets

This significantly reduces the impact of prompt injection attacks.

---

# Prompt Injection Resistance

The database architecture supports prompt injection mitigation by ensuring:

- Customer input remains isolated.
- Business rules originate from trusted tables.
- Pricing comes from structured records.
- AI outputs require validation.
- Unsafe outputs may be escalated instead of executed.

No customer-controlled text should ever influence authorization or database queries.

---

# Compliance Considerations

RelayDispatch is designed to support organizations operating under various regulatory environments.

Examples include:

- GDPR
- CCPA / CPRA
- SOC 2
- ISO/IEC 27001
- NIST Cybersecurity Framework
- NIST AI RMF
- OWASP ASVS
- OWASP Top 10
- CSA Cloud Controls Matrix

Compliance ultimately depends on deployment configuration and organizational processes.

---

# Backup Strategy

Every production deployment should implement automated backups.

Recommended practices include:

- Daily full backups
- Continuous WAL archiving
- Point-in-time recovery
- Encrypted backup storage
- Geographic redundancy
- Periodic restore testing

Backups are only useful if they can be successfully restored.

Restore procedures should be tested regularly.

---

# Disaster Recovery

A disaster recovery plan should address:

- Database corruption
- Region outages
- Credential compromise
- Accidental deletion
- Infrastructure failure
- Provider outages
- Ransomware scenarios

Recovery objectives should be documented before production deployment.

---

# Production Hardening Checklist

Before deploying RelayDispatch to production:

- Enable TLS everywhere.
- Enable PostgreSQL backups.
- Rotate secrets regularly.
- Enforce MFA for administrators.
- Enable RLS on every tenant table.
- Restrict Service Role usage.
- Encrypt backups.
- Monitor failed login attempts.
- Monitor AI cost anomalies.
- Monitor webhook failures.
- Test disaster recovery procedures.
- Review database permissions periodically.

---

Part 5 concludes the document with migrations, schema evolution, performance optimization, indexing strategies, observability, developer workflows, troubleshooting, future roadmap, and operational best practices.

---

# Database Migrations

RelayDispatch follows a **migration-first** development workflow.

The database schema should never be modified manually in production.

All structural changes must be introduced through version-controlled migration files.

```
supabase/
└── migrations/
    ├── 202601010001_initial_schema.sql
    ├── 202601140001_add_jobs.sql
    ├── 202602020001_add_ai_audit.sql
    └── ...
```

Every migration should be:

- Deterministic
- Idempotent where practical
- Peer reviewed
- Version controlled
- Tested before deployment

---

# Migration Best Practices

When creating a migration:

✓ Add new tables before referencing them

✓ Create indexes after large imports

✓ Backfill data before enabling constraints

✓ Add foreign keys after validating existing data

✓ Document destructive migrations

Avoid:

- Editing previously committed migrations
- Force-dropping production tables
- Renaming columns without compatibility planning
- Large blocking migrations during peak traffic

---

# Schema Evolution

RelayDispatch favors **backwards-compatible schema evolution**.

Recommended process:

```
Deploy New Column

↓

Write Both Columns

↓

Read New Column

↓

Backfill

↓

Remove Old Column

↓

Cleanup
```

This minimizes downtime and enables zero-downtime deployments.

---

# Type Generation

RelayDispatch generates strongly typed database models directly from Supabase.

```
Supabase Schema

↓

Supabase CLI

↓

database.types.ts

↓

TypeScript Application
```

Example:

```bash
npx supabase gen types typescript \
  --project-id your-project-id \
  > packages/database/src/database.types.ts
```

Generated types should always be committed alongside schema changes.

---

# Performance Strategy

The database is optimized around common production workloads.

Typical operations include:

- Fetching conversation threads
- Loading recent messages
- Creating jobs
- AI context retrieval
- Technician lookup
- Pricing lookup
- Dashboard analytics

Indexes should reflect actual production query patterns rather than theoretical use cases.

---

# Query Optimization

Recommended practices include:

- Prefer indexed lookups
- Avoid `SELECT *`
- Paginate large datasets
- Batch related queries
- Minimize N+1 query patterns
- Use prepared statements where appropriate
- Profile slow queries regularly

Always validate query performance using PostgreSQL's execution plans (`EXPLAIN ANALYZE`) before optimizing prematurely.

---

# Recommended Indexes

Typical production indexes include:

### Tenant Isolation

```
organization_id
```

---

### Thread Lookup

```
organization_id
created_at DESC
```

---

### Job Dashboard

```
organization_id
status
scheduled_at
```

---

### Conversation Loading

```
thread_id
created_at
```

---

### CRM Synchronization

```
external_provider
external_id
```

---

### Workflow Recovery

```
workflow_id
```

---

### AI Reporting

```
model_used
created_at
```

Composite indexes should be evaluated using production telemetry before implementation.

---

# Data Retention

Organizations may have different legal and operational retention requirements.

Examples include:

| Data Type               | Suggested Retention   |
| ----------------------- | --------------------- |
| Workflow Logs           | 30–180 days           |
| AI Metadata             | 90–365 days           |
| Audit Logs              | 1–7 years             |
| Billing Records         | Per local regulations |
| Webhook Failures        | Until resolved        |
| Completed Activity Keys | TTL-based cleanup     |

Retention policies should be configurable rather than hardcoded.

---

# Archiving Strategy

Historical operational data should eventually transition from transactional storage into archival storage.

```
Production Database

↓

Retention Worker

↓

Archive Storage

↓

Long-Term Backup
```

Archived data should remain searchable when required for compliance or investigations.

---

# Observability

Database health should be continuously monitored.

Recommended metrics include:

- Query latency
- Active connections
- Deadlocks
- Lock contention
- WAL generation
- Replication lag
- Cache hit ratio
- Index utilization
- Storage growth
- Failed transactions

Application-level metrics should complement database metrics.

---

# Database Monitoring

Production monitoring should include alerts for:

- Slow queries
- Failed migrations
- Connection pool exhaustion
- Disk utilization
- Replication failures
- Backup failures
- RLS policy violations
- Authentication anomalies
- Excessive retry rates

Early detection significantly reduces operational risk.

---

# Backup Verification

Backups should not only exist—they should be periodically validated.

Recommended practices:

- Scheduled restore testing
- Integrity verification
- Recovery time measurements
- Encrypted backup validation
- Cross-region restore testing

A backup that has never been restored should not be assumed to be recoverable.

---

# Local Development Workflow

Typical development flow:

```bash
git pull

↓

npm install

↓

cp .env.example .env

↓

npx supabase start

↓

npx supabase db push

↓

Generate Types

↓

npm run dev
```

Developers should avoid modifying production databases directly.

---

# Troubleshooting

## Migration Failed

Check:

- Migration ordering
- Existing constraints
- Duplicate object names
- Dependency chain

---

## RLS Blocking Queries

Verify:

- JWT claims
- Membership records
- Organization ownership
- Policy definitions

---

## Slow Queries

Inspect:

- Missing indexes
- Sequential scans
- Large joins
- Inefficient filters
- Execution plans

---

## Type Mismatch

Regenerate database types:

```bash
npx supabase gen types typescript \
> packages/database/src/database.types.ts
```

---

## Foreign Key Errors

Common causes include:

- Missing parent records
- Incorrect migration order
- Invalid UUIDs
- Soft-deleted references

---

# Future Database Roadmap

Potential future enhancements include:

- PostgreSQL table partitioning
- Read replicas
- Automatic query optimization
- AI vector search support
- Native PostgreSQL logical replication
- Distributed job scheduling
- Multi-region deployments
- Advanced analytics warehouse
- Event sourcing integrations
- Database sharding (if required)

These features are intentionally deferred until operational demand justifies additional complexity.

---

# Architecture Summary

The RelayDispatch database is designed around several guiding principles:

- Multi-tenant by design
- Secure by default
- AI-aware without exposing sensitive data
- Strongly typed across the application
- Migration-driven schema evolution
- Deterministic workflow persistence
- Observable and auditable operations
- Provider-agnostic integrations
- Operational resilience through PostgreSQL and Temporal

The database serves as the authoritative system of record for customer interactions, workflow execution, AI orchestration, technician dispatch, compliance, and operational reporting.

Its architecture emphasizes long-term maintainability, predictable evolution, and production-grade reliability while remaining approachable for contributors and organizations self-hosting RelayDispatch.

---

**Related Documentation**

- `ARCHITECTURE.md`
- `AI_GUIDE.md`
- `DEVELOPER_GUIDE.md`
- `SELF_HOSTING.md`
- `SECURITY.md`
- `CONTRIBUTING.md`
- `README.md`
- `supabase/schema.sql`
- `supabase/migrations/`
- `packages/database/src/database.types.ts`
