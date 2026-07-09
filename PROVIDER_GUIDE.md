# Provider Guide

> **RelayDispatch is built around a Bring Your Own Provider (BYOP) architecture.**
>
> Rather than locking organizations into a specific vendor, RelayDispatch separates business logic from infrastructure integrations through provider abstraction layers. Every major external dependency—including AI, CRM, Email, Telephony, Notifications, Storage, and future integrations—is designed to be replaceable with minimal changes to the core application.

---

# Table of Contents

- Provider Philosophy
- Provider Architecture
- Provider Lifecycle
- Supported Provider Categories
- Provider Registry
- Email Providers
- CRM Providers
- AI Providers
- Telephony Providers
- Notification Providers
- Storage Providers
- Authentication Providers
- Creating Custom Providers
- Provider Development Best Practices
- Security Requirements
- Testing Providers
- Version Compatibility
- Future Provider Roadmap

---

# Why Provider Abstraction?

Every organization has different requirements.

Some use:

- Google Workspace

Others use:

- Microsoft 365

Some use:

- Jobber

Others use:

- ServiceTitan
- Salesforce
- Housecall Pro

Some organizations deploy entirely on-premises.

Others deploy fully in the cloud.

Instead of tightly coupling RelayDispatch to any vendor, every external dependency is abstracted behind well-defined interfaces.

Benefits include:

- Vendor independence
- Easier migrations
- Enterprise flexibility
- Community-developed integrations
- Simplified testing
- Reduced vendor lock-in
- Long-term maintainability

---

# Provider Architecture

RelayDispatch follows a layered provider architecture.

```text
                  Business Logic
                         │
                         ▼
               Provider Interfaces
                         │
         ┌───────────────┼────────────────┐
         ▼               ▼                ▼
     Google          Microsoft        Jobber
         ▼               ▼                ▼
     OpenRouter       Twilio        Future Providers
```

Business logic never communicates directly with external vendors.

Instead, it communicates only with provider interfaces.

This design keeps workflows deterministic, testable, and modular.

---

# Provider Categories

RelayDispatch currently organizes providers into multiple categories.

| Category       | Purpose                                  |
| -------------- | ---------------------------------------- |
| Email          | Receive and send customer communications |
| CRM            | Create and synchronize jobs              |
| AI / LLM       | Classification, dispatch, summarization  |
| Telephony      | SMS notifications and alerts             |
| Notifications  | Human escalation channels                |
| Authentication | OAuth and identity providers             |
| Storage        | Object and attachment storage            |
| Observability  | Metrics, tracing, logging                |

Additional provider categories can be introduced without modifying existing workflows.

---

# Provider Lifecycle

Every provider follows the same lifecycle.

```text
Configuration

↓

Validation

↓

Initialization

↓

Registration

↓

Health Check

↓

Business Operations

↓

Monitoring

↓

Graceful Shutdown
```

This lifecycle ensures providers behave consistently regardless of vendor.

---

# Provider Registration

Providers are registered during application startup.

Initialization should:

- validate configuration
- verify credentials
- establish connections
- expose health status
- fail fast on invalid configuration

Provider initialization should **never** occur lazily during request processing unless explicitly designed to do so.

---

# Dependency Injection

Business modules depend only on interfaces.

Example:

```text
Workflow

↓

CRM Interface

↓

Selected Adapter

↓

External CRM
```

This enables:

- easier testing
- dependency mocking
- provider replacement
- enterprise customization

without modifying workflow logic.

---

# Provider Selection

Provider selection may occur at several levels.

## Global

Configured through environment variables.

Example:

```env
MAIL_PROVIDER=google
CRM_PROVIDER=jobber
AI_PROVIDER=openrouter
```

---

## Organization Level

Organizations can override provider selections within their configuration.

Example:

```
Organization A

Email → Gmail

CRM → Jobber

AI → OpenRouter

──────────────

Organization B

Email → Microsoft

CRM → Local

AI → OpenRouter
```

This enables true multi-tenant deployments where different organizations use different providers simultaneously.

---

# Configuration Philosophy

Provider configuration should always be:

- explicit
- validated
- environment driven
- documented
- secure
- reproducible

Configuration should never be hardcoded into application logic.

Sensitive values must always originate from environment variables or secure secret management systems.

---

# Provider Health

Production deployments should expose provider health independently.

Examples include:

- authentication status
- API availability
- credential expiration
- rate limiting
- connectivity
- latency
- quota usage

Health checks enable operators to detect provider failures before they impact workflows.

---

# Failover Philosophy

RelayDispatch favors graceful degradation whenever possible.

Examples include:

- CRM unavailable → create local job only
- SMS unavailable → continue email workflow
- AI unavailable → escalate to human dispatcher
- Notification failure → log and retry
- Temporary provider outage → rely on Temporal retries

Critical business workflows should continue whenever it is safe to do so.

---

# Email Providers

Email is the primary intake channel for RelayDispatch.

Every inbound message enters the workflow engine through an Email Provider Adapter.

Rather than tightly coupling the application to Gmail or Outlook APIs, RelayDispatch abstracts every provider behind a unified email interface.

```
Customer

        │

        ▼

 Email Provider

        │

        ▼

Email Adapter

        │

        ▼

RelayDispatch Workflow

        │

        ▼

Temporal
```

This architecture allows organizations to migrate providers without modifying business logic.

---

# Supported Email Providers

| Provider                     | Status                   | Recommended               |
| ---------------------------- | ------------------------ | ------------------------- |
| Google Workspace (Gmail API) | ✅ Stable                | ⭐⭐⭐⭐⭐                |
| Microsoft 365 (Graph API)    | ✅ Stable                | ⭐⭐⭐⭐⭐                |
| Sandbox Provider             | ✅ Development           | ⭐⭐⭐⭐⭐                |
| Nylas                        | ⚠ Legacy                 | Existing Deployments Only |
| IMAP/SMTP                    | 🚧 Planned               | Future Release            |
| Custom Email Providers       | ✅ Supported via Adapter | Enterprise                |

---

# Google Workspace (Recommended)

Google Workspace provides the most mature integration for RelayDispatch.

Recommended for:

- HVAC companies
- Electrical contractors
- Plumbing businesses
- Small businesses
- Medium enterprises

### Requirements

- Google Cloud Project
- Gmail API
- Pub/Sub
- OAuth 2.0
- Verified redirect URI

### Required OAuth Scopes

RelayDispatch follows the principle of least privilege.

Typical scopes include:

```
gmail.readonly

gmail.send
```

Additional scopes should only be requested when required by specific features.

---

## Environment Variables

```env
GOOGLE_CLIENT_ID=

GOOGLE_CLIENT_SECRET=

GOOGLE_REDIRECT_URI=

GMAIL_PUBSUB_TOPIC=
```

---

## OAuth Flow

```
User

↓

Google Consent Screen

↓

Authorization Code

↓

RelayDispatch API

↓

Access Token

↓

Refresh Token

↓

Encrypted Storage
```

Tokens should always be encrypted before persistent storage.

---

## Gmail Push Notifications

RelayDispatch supports Gmail Push Notifications through Google Cloud Pub/Sub.

Advantages include:

- near real-time delivery

- reduced polling

- lower API usage

- improved scalability

- reduced latency

---

## Webhook Verification

Incoming Pub/Sub messages should always verify:

- signature

- message authenticity

- timestamp

- replay protection

before entering the workflow engine.

Never trust unauthenticated webhook payloads.

---

# Microsoft 365

Microsoft Graph provides enterprise-grade email integration.

Recommended for:

- Microsoft 365 tenants

- Azure organizations

- Enterprise deployments

---

## Requirements

- Azure Tenant

- App Registration

- Microsoft Graph

- OAuth 2.0

- Delegated permissions

---

## Environment Variables

```env
MICROSOFT_CLIENT_ID=

MICROSOFT_CLIENT_SECRET=

MICROSOFT_TENANT_ID=

MICROSOFT_REDIRECT_URI=
```

---

## Recommended Graph Permissions

Typical permissions include:

```
Mail.Read

Mail.Send

offline_access
```

Organizations should periodically audit granted permissions.

---

# Sandbox Provider

Sandbox mode is intended for local development.

No external provider is contacted.

Features:

- deterministic testing

- simulated delivery

- fake inbox

- repeatable integration tests

- CI compatibility

---

Configuration:

```env
MAIL_PROVIDER=sandbox
```

No credentials are required.

---

# Nylas (Legacy)

RelayDispatch continues supporting Nylas for existing installations.

However, new deployments are encouraged to migrate to direct provider integrations.

Reasons include:

- lower latency

- fewer external dependencies

- simpler architecture

- lower operational cost

---

# Future Email Providers

The provider architecture intentionally supports future integrations.

Examples include:

- Fastmail

- Proton Mail

- Zoho Mail

- Amazon SES

- Generic IMAP

- Generic SMTP

- Exchange On-Premises

- Enterprise Mail Gateways

No workflow modifications should be required when adding new providers.

---

# CRM Providers

RelayDispatch separates CRM logic from workflow logic through provider interfaces.

```
Workflow

↓

CRM Interface

↓

Provider Adapter

↓

External CRM
```

Business logic never communicates directly with vendor SDKs.

---

# Supported CRM Providers

| Provider           | Status    |
| ------------------ | --------- |
| Jobber             | ✅ Stable |
| Local CRM          | ✅ Stable |
| ServiceTitan       | Planned   |
| Housecall Pro      | Planned   |
| Salesforce         | Planned   |
| HubSpot            | Planned   |
| Microsoft Dynamics | Planned   |
| SAP                | Planned   |
| Custom CRM         | Supported |

---

# Jobber

Jobber is the reference CRM implementation.

The adapter demonstrates:

- OAuth authentication

- Job creation

- Job updates

- Retry handling

- Error mapping

- Idempotency

---

## Environment Variables

```env
JOBBER_CLIENT_ID=

JOBBER_CLIENT_SECRET=

JOBBER_REDIRECT_URI=
```

---

## Adapter Responsibilities

The adapter should:

- authenticate

- refresh tokens

- create jobs

- update jobs

- synchronize identifiers

- map provider errors

- expose health information

Workflow logic should never depend on Jobber-specific implementation details.

---

# Local CRM

Organizations that do not use an external CRM may use the Local Provider.

Characteristics:

- no external API

- Supabase-only storage

- ideal for development

- useful for small deployments

---

# CRM Synchronization

External synchronization should always be:

- idempotent

- retry-safe

- observable

- recoverable

Temporal automatically retries transient failures.

Permanent failures should surface clearly through monitoring and operator alerts.

---

# CRM Error Handling

Provider adapters should classify failures into categories.

Examples include:

| Error Type             | Strategy            |
| ---------------------- | ------------------- |
| Network timeout        | Retry               |
| Rate limit             | Backoff             |
| Authentication failure | Refresh token       |
| Validation error       | Escalate            |
| Permission denied      | Operator action     |
| Resource not found     | Recover if possible |

This enables workflows to make intelligent retry decisions.

---

# Building New CRM Providers

A production-ready adapter should provide:

✓ OAuth handling

✓ Token refresh

✓ Job creation

✓ Job updates

✓ Idempotency

✓ Structured errors

✓ Metrics

✓ Logging

✓ Health checks

✓ Documentation

Adapters should expose a consistent interface regardless of vendor.

---

# AI Providers

RelayDispatch intentionally separates AI orchestration from model vendors.

Instead of integrating directly with multiple model APIs, RelayDispatch communicates with an AI Provider abstraction.

Current implementation:

```
Dispatcher

↓

AI Provider

↓

OpenRouter

↓

Selected Model
```

Future providers may include:

- Azure OpenAI

- Google Vertex AI

- Anthropic API

- Self-hosted inference

- Air-gapped deployments

without requiring workflow changes.

---

# AI Provider Architecture

RelayDispatch uses a provider abstraction for all AI operations.

The application never communicates directly with a specific Large Language Model (LLM). Instead, AI requests are routed through an AI Provider layer, allowing organizations to change providers or models without modifying application logic.

```text
Workflow

↓

Dispatcher

↓

AI Provider Interface

↓

OpenRouter

↓

Selected LLM
```

This architecture keeps the AI subsystem vendor-neutral and future-proof.

---

# Supported AI Providers

| Provider             | Status       | Recommended |
| -------------------- | ------------ | ----------- |
| OpenRouter           | ✅ Primary   | ⭐⭐⭐⭐⭐  |
| Azure OpenAI         | 🚧 Planned   | Enterprise  |
| Google Vertex AI     | 🚧 Planned   | Enterprise  |
| Anthropic Native API | 🚧 Planned   | Enterprise  |
| OpenAI Native API    | 🚧 Planned   | Enterprise  |
| Ollama               | 🚧 Planned   | Self-Hosted |
| vLLM                 | 🚧 Planned   | Self-Hosted |
| LM Studio            | Experimental | Development |
| Custom Provider      | Supported    | Enterprise  |

---

# Why OpenRouter?

OpenRouter acts as an intelligent routing layer instead of locking RelayDispatch to a single vendor.

Benefits include:

- Vendor independence
- Hundreds of available models
- Centralized billing
- Automatic provider failover
- Faster model experimentation
- Simplified configuration
- Consistent API surface

Changing models should never require code changes.

---

# Model Selection

Model selection is configuration-driven.

Example:

```env
OPENROUTER_MODEL=google/gemini-3.1-flash-lite-preview
```

Organizations may select different models depending on:

- cost
- latency
- reasoning capability
- context window
- regulatory requirements
- deployment location

---

# Recommended Model Strategy

Rather than using one model for every task, RelayDispatch encourages task-specific routing.

Example:

| Task                       | Suggested Model Characteristics |
| -------------------------- | ------------------------------- |
| Classification             | Small, low-latency model        |
| Conversation Summarization | Fast reasoning model            |
| Draft Reply Generation     | High-quality reasoning model    |
| Complex Escalations        | Premium reasoning model         |
| Embeddings (future)        | Embedding model                 |

This minimizes operating cost while maintaining response quality.

---

# Prompt Versioning

Production deployments should version prompts.

Example:

```
Dispatcher Prompt

Version 1

↓

Version 2

↓

Version 3
```

Prompt version identifiers should be stored alongside audit logs whenever practical.

Benefits include:

- reproducibility
- regression testing
- rollback capability
- performance comparison

---

# Structured Outputs

RelayDispatch strongly prefers structured outputs over free-form responses.

Advantages include:

- easier validation
- deterministic parsing
- lower failure rates
- simpler downstream processing

Where supported, provider-native structured output mechanisms should be preferred over prompt-only approaches.

---

# AI Fallback Strategy

Providers may become temporarily unavailable.

RelayDispatch recommends a graceful fallback chain.

Example:

```
Primary Model

↓

Secondary Model

↓

Emergency Human Escalation
```

Business continuity should always take precedence over autonomous AI responses.

---

# Cost Management

AI usage should be continuously monitored.

Recommended metrics include:

- requests
- latency
- prompt tokens
- completion tokens
- total tokens
- estimated cost
- provider
- selected model

Organizations should periodically review these metrics to optimize operational costs.

---

# Provider Observability

Every provider should emit structured telemetry.

Recommended metrics include:

| Metric        | Purpose           |
| ------------- | ----------------- |
| Request Count | Usage             |
| Success Rate  | Reliability       |
| Failure Rate  | Error Monitoring  |
| Retry Count   | Stability         |
| Latency       | Performance       |
| Rate Limits   | Capacity Planning |
| Token Usage   | AI Cost Tracking  |
| Availability  | Health Monitoring |

OpenTelemetry is recommended for production deployments.

---

# Logging

Provider logs should always be structured.

Logs should include:

- provider
- operation
- duration
- correlation ID
- workflow ID
- organization ID
- retry attempt
- result

Sensitive information must never be logged.

Never record:

- API keys
- OAuth tokens
- passwords
- customer PII
- decrypted vault contents

---

# Security Requirements

Every provider integration must satisfy minimum security requirements.

Providers should:

- use HTTPS exclusively
- validate incoming webhooks
- encrypt credentials at rest
- support token rotation
- minimize requested permissions
- implement replay protection
- validate external payloads
- sanitize inputs
- expose health status

Security should be considered a baseline requirement—not an optional enhancement.

---

# Authentication

Provider credentials should originate from secure configuration sources.

Examples include:

- environment variables
- cloud secret managers
- enterprise vaults

Credentials should never be:

- hardcoded
- committed to source control
- embedded in Docker images
- exposed through logs

---

# Implementing a Custom Provider

Every provider should follow the same implementation pattern.

```
Interface

↓

Adapter

↓

Registry

↓

Configuration

↓

Health Check

↓

Production
```

Typical steps include:

1. Create the provider interface.
2. Implement the adapter.
3. Register the adapter.
4. Validate configuration.
5. Add integration tests.
6. Add documentation.
7. Monitor production behavior.

Following this lifecycle keeps all providers consistent across the project.

---

# Provider Testing

Every production provider should include:

- Unit Tests
- Integration Tests
- Mock Providers
- Failure Simulations
- Retry Validation
- Authentication Tests
- Configuration Validation
- Health Check Tests

External services should be mocked whenever possible to ensure deterministic test execution.

---

# Version Compatibility

Providers evolve over time.

Adapters should clearly document:

- supported API versions
- deprecated endpoints
- migration requirements
- breaking changes

Maintaining compatibility documentation simplifies upgrades for both maintainers and deployers.

---

# Future Provider Ecosystem

RelayDispatch is intentionally designed as an extensible platform.

Future provider categories may include:

- Calendar Systems
- Inventory Platforms
- Payment Providers
- Accounting Software
- Fleet Management
- IoT Platforms
- Mapping Services
- Identity Providers
- Vector Databases
- Enterprise Knowledge Bases

As the ecosystem grows, new providers should integrate through the same abstraction principles described throughout this guide, ensuring that business workflows remain stable while infrastructure continues to evolve.
