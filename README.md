<p align="center">
  <img src="docs/assets/logo.svg" width="140" alt="RelayDispatch Logo"/>
</p>

<h1 align="center">RelayDispatch</h1>

<p align="center">
  <strong>
    Enterprise-grade, AI-powered, self-hosted field service dispatch platform built for the modern service business.
  </strong>
</p>

<p align="center">
From customer inquiry to technician dispatch — securely, autonomously, and transparently.
</p>

<p align="center">

<a href="LICENSE">
<img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="MIT License"/>
</a>

<a href="https://github.com/relaydispatch/relaydispatch/actions">
<img src="https://github.com/relaydispatch/relaydispatch/actions/workflows/ci.yml/badge.svg" alt="Build Status"/>
</a>

<img src="https://img.shields.io/badge/TypeScript-5.x-blue" alt="TypeScript"/>

<img src="https://img.shields.io/badge/Node.js-24_LTS-green" alt="Node"/>

<img src="https://img.shields.io/badge/Temporal-Workflow_Engine-purple" alt="Temporal"/>

<img src="https://img.shields.io/badge/Supabase-PostgreSQL-success" alt="Supabase"/>

<img src="https://img.shields.io/badge/OpenRouter-Multi_LLM-orange" alt="OpenRouter"/>

<img src="https://img.shields.io/badge/OpenTelemetry-Enabled-informational" alt="OpenTelemetry"/>

<img src="https://img.shields.io/badge/Security-Privacy_First-red" alt="Security"/>

</p>

<p align="center">

<a href="CONTRIBUTING.md">Contributing</a>
•
<a href="SECURITY.md">Security</a>
•
<a href="SELF_HOSTING.md">Self Hosting</a>
•
<a href="AI_GUIDE.md">AI Guide</a>
•
<a href="ARCHITECTURE.md">Architecture</a>
•
<a href="DATABASE.md">Database</a>

</p>

---

# RelayDispatch

RelayDispatch is an **enterprise-grade, open-source, privacy-first AI dispatch platform** that automates customer communication, service triage, technician scheduling, CRM synchronization, and workflow orchestration for field service businesses.

Unlike traditional automation tools, RelayDispatch was designed from the ground up around **durable workflows, privacy-preserving AI, deterministic execution, and production-grade reliability**.

Every customer request travels through a secure AI pipeline that:

- understands customer intent,
- protects sensitive information,
- determines urgency,
- prepares professional responses,
- creates jobs,
- dispatches technicians,
- synchronizes external systems,
- and maintains a complete audit trail.

All without exposing raw customer information to Large Language Models.

---

# Why RelayDispatch?

Field service companies receive hundreds or thousands of customer requests every day.

These requests arrive through:

- Email
- Contact forms
- CRM integrations
- Internal dispatch systems
- Future messaging platforms

Every request requires someone to:

- Read the message
- Understand the issue
- Determine urgency
- Extract customer details
- Estimate pricing
- Check technician availability
- Create jobs
- Respond professionally
- Keep records synchronized

Most companies still perform these tasks manually.

This leads to:

- Slow response times
- Missed emergencies
- Human error
- High operational cost
- Inconsistent customer communication
- Difficult scaling
- Limited visibility
- Burnout for dispatch teams

RelayDispatch automates this entire workflow while ensuring that humans always remain in control whenever necessary.

---

# What Makes RelayDispatch Different?

RelayDispatch was never designed to be "just another AI chatbot."

It is a **workflow automation platform** where AI is only one component.

Every decision is backed by deterministic software engineering principles.

Core architectural principles include:

- Durable workflow execution
- Human override at every stage
- Privacy-first AI architecture
- Vendor-neutral infrastructure
- Bring Your Own Provider (BYOP)
- Zero-trust security
- Database-backed business logic
- Explainable AI decisions
- Enterprise observability
- Open-source transparency

The result is a platform capable of running production dispatch operations while remaining fully auditable and extensible.

---

# Core Capabilities

✅ AI-powered customer request classification

✅ Automated email response generation

✅ Technician dispatch assistance

✅ CRM synchronization

✅ Conversation memory management

✅ Multi-provider email integration

✅ Multi-model AI support

✅ Privacy-preserving AI pipeline

✅ Durable workflow execution

✅ Human approval workflows

✅ Multi-tenant architecture

✅ Enterprise audit logging

✅ AI cost guardrails

✅ OpenTelemetry monitoring

✅ Disaster recovery support

✅ Dead-letter queue replay

✅ Idempotent execution

✅ Role-based access control

✅ Provider abstraction layer

✅ Self-hosted deployment

---

# Designed for Modern Field Service Businesses

RelayDispatch is suitable for organizations including:

- HVAC
- Electrical
- Plumbing
- Appliance Repair
- Property Maintenance
- Commercial Maintenance
- Facility Management
- Solar Installation
- Security System Installation
- Industrial Maintenance
- Managed Service Providers
- Telecommunications Field Operations
- Municipal Service Operations

The platform is intentionally provider-agnostic, making it adaptable to many dispatch-driven industries.

---

# Platform Highlights

| Capability          | RelayDispatch |
| ------------------- | ------------- |
| Open Source         | ✅            |
| Self Hosted         | ✅            |
| AI Powered          | ✅            |
| Multi-Tenant        | ✅            |
| Privacy First       | ✅            |
| Temporal Workflows  | ✅            |
| Human Override      | ✅            |
| Vendor Neutral      | ✅            |
| Multi-LLM Support   | ✅            |
| OpenTelemetry       | ✅            |
| CRM Integration     | ✅            |
| Email Automation    | ✅            |
| Zero Trust Security | ✅            |
| Enterprise Ready    | ✅            |

---

# Project Philosophy

RelayDispatch follows several guiding principles that influence every architectural decision.

## Privacy by Design

Customer information belongs to the customer—not the AI provider.

Personally identifiable information is redacted before any AI interaction.

## Human-Centric Automation

AI assists people.

It does not replace operational oversight.

Humans can intervene at any point during workflow execution.

## Reliability Before Intelligence

An accurate workflow that executes reliably is more valuable than an advanced AI system that cannot guarantee execution.

Temporal workflows ensure operational reliability independent of model behavior.

## Vendor Independence

Organizations should never become locked into:

- AI providers
- CRM vendors
- Email providers
- Infrastructure providers

RelayDispatch allows each deployment to choose the providers that best fit its operational requirements.

---

# Built Around Five Pillars

1. Enterprise Reliability

2. Privacy & Security

3. AI Transparency

4. Operational Flexibility

5. Open Source Collaboration

These principles guide both technical architecture and community development.

---

# System Architecture

RelayDispatch is built as a collection of loosely coupled services communicating through durable workflows.

Instead of relying on long-running backend processes or chained HTTP requests, every customer interaction becomes a **Temporal Workflow Execution** that persists its own state and survives failures automatically.

```
                        Customer
                           │
                           ▼
                   Email / API Intake
                           │
                           ▼
                  Hono API (apps/api)
                           │
                           ▼
                 Temporal Workflow Engine
                           │
       ┌───────────────────┼────────────────────┐
       │                   │                    │
       ▼                   ▼                    ▼
 Emergency Filter    AI Classification     Contact Lookup
       │                   │                    │
       └──────────────┬────┴────────────────────┐
                      ▼                         ▼
               PII Redaction          Conversation Memory
                      │                         │
                      └────────────┬────────────┘
                                   ▼
                        AI Dispatcher Agent
                                   │
                    ┌──────────────┼──────────────┐
                    ▼              ▼              ▼
              Pricing DB     Technician DB     CRM
                    │              │              │
                    └──────────────┼──────────────┘
                                   ▼
                           Email Response
                                   │
                                   ▼
                            Customer Inbox
```

Every component operates independently while remaining orchestrated by the workflow engine.

This architecture provides fault tolerance, replay capability, deterministic execution, and horizontal scalability.

---

# AI Pipeline

RelayDispatch implements a multi-stage AI pipeline designed around security, determinism, and explainability.

```
Inbound Email
      │
      ▼
Emergency Detection
      │
      ▼
PII Redaction
      │
      ▼
Classification Agent
      │
      ▼
Conversation Librarian
      │
      ▼
Dispatcher Agent
      │
      ▼
Policy Validation
      │
      ▼
PII Rehydration
      │
      ▼
Outbound Email
```

Each stage has one responsibility.

Rather than asking one large prompt to perform every task, RelayDispatch separates reasoning into specialized agents.

This dramatically improves:

- reliability
- auditability
- explainability
- security
- maintainability

---

# Privacy-First AI

One of RelayDispatch's defining characteristics is that **raw customer information is never intentionally provided to an LLM.**

Before any AI model processes customer content:

- names are replaced
- phone numbers are replaced
- addresses are replaced
- email addresses are replaced
- account numbers are replaced
- identifiers are replaced

Example:

Original

```
John Smith

Phone: (555) 123-4567

123 Main Street
```

Becomes

```
[[CUSTOMER_NAME_1]]

[[PHONE_1]]

[[ADDRESS_1]]
```

Only placeholders are visible to AI models.

The original values remain encrypted inside the deployment using AES-256-GCM until the response is ready to send.

This privacy model significantly reduces the exposure of sensitive customer information.

---

# Enterprise Workflow Engine

RelayDispatch uses **Temporal** to guarantee reliable execution.

Traditional automation systems often fail when:

- servers restart
- APIs timeout
- network connectivity is interrupted
- processes crash
- deployments occur mid-execution

Temporal solves these problems by persisting workflow state.

Benefits include:

- Automatic retries
- Durable execution
- Workflow replay
- Human intervention
- Signals
- Queries
- Long-running workflows
- Scheduled execution
- State persistence
- Activity isolation

Every customer request is tracked independently.

Failures affect only the activities that require retry—not the entire workflow.

---

# Multi-Agent AI Architecture

RelayDispatch separates AI responsibilities into independent agents.

| Agent            | Responsibility                   |
| ---------------- | -------------------------------- |
| Classifier       | Understands customer intent      |
| Dispatcher       | Generates professional responses |
| Librarian        | Maintains conversation memory    |
| Guardrails       | Validates AI behavior            |
| Emergency Filter | Detects life-safety situations   |
| Redaction Engine | Removes sensitive information    |

This separation allows each agent to be upgraded independently without affecting the remainder of the platform.

---

# Technology Stack

RelayDispatch intentionally relies on mature, production-proven technologies.

| Layer            | Technology            |
| ---------------- | --------------------- |
| Language         | TypeScript            |
| Runtime          | Node.js               |
| API Framework    | Hono                  |
| Frontend         | React + Vite          |
| Workflow Engine  | Temporal              |
| Database         | PostgreSQL (Supabase) |
| Authentication   | Supabase Auth         |
| AI Gateway       | OpenRouter            |
| Validation       | Zod                   |
| Logging          | Pino                  |
| Telemetry        | OpenTelemetry         |
| Testing          | Vitest                |
| Mocking          | MSW                   |
| Containerization | Docker                |
| CI/CD            | GitHub Actions        |

Every dependency has been selected to balance reliability, maintainability, and long-term sustainability.

---

# Bring Your Own Provider (BYOP)

RelayDispatch avoids vendor lock-in.

Every major integration uses an abstraction layer.

Supported provider categories include:

| Category   | Examples                     |
| ---------- | ---------------------------- |
| AI Models  | OpenRouter compatible models |
| Email      | Gmail, Microsoft, Sandbox    |
| CRM        | Jobber, Local, Custom        |
| SMS        | Twilio                       |
| Database   | Supabase                     |
| Monitoring | OpenTelemetry backends       |

Organizations remain free to migrate providers without redesigning the application.

---

# Enterprise Security

Security is integrated into every layer of the platform.

Major protections include:

- Zero-trust architecture
- AES-256-GCM encrypted vault
- Role-based access control
- Row-Level Security
- Webhook signature verification
- Prompt injection mitigation
- Output validation
- Structured audit logs
- Idempotent execution
- Least-privilege credentials
- Secure environment validation
- Provider isolation

RelayDispatch assumes that external systems may fail or become compromised and is designed accordingly.

---

# Human-in-the-Loop

Automation should increase operator efficiency—not remove operator control.

RelayDispatch supports multiple operating modes.

### Autonomous Mode

AI performs the complete dispatch workflow automatically.

Ideal for:

- high-volume operations
- after-hours requests
- repetitive service calls

---

### Shadow Mode

AI prepares recommendations while humans remain responsible for approval.

Perfect for organizations introducing AI gradually.

---

### Manual Override

Human operators can interrupt any running workflow through Temporal signals.

This allows:

- customer escalation
- supervisor review
- manual dispatch
- emergency handling
- workflow cancellation

without restarting or recreating workflow state.

---

# Core Features

RelayDispatch has been designed as a production-ready platform rather than a simple AI demo. Every feature has been built with reliability, security, observability, and extensibility in mind.

## Intelligent Email Intake

Automatically ingests customer requests from multiple email providers.

Supported providers include:

- Google Gmail
- Microsoft 365 / Outlook
- Sandbox (development)
- Additional providers via adapters

Features include:

- OAuth authentication
- webhook validation
- duplicate detection
- thread reconstruction
- attachment metadata support
- conversation tracking

---

## AI-Powered Dispatch

Every customer email passes through a structured AI pipeline.

Capabilities include:

- intent classification
- urgency scoring
- sentiment analysis
- service identification
- equipment extraction
- scheduling preference extraction
- technician recommendation
- professional reply generation

Unlike generic chatbots, RelayDispatch never allows models to invent pricing or unsupported services.

---

## Conversation Memory

The Librarian Agent maintains long-running customer conversations.

It provides:

- semantic summarization
- token budget optimization
- context preservation
- conversation continuity
- long-thread compression

This allows conversations containing dozens of customer replies to remain within model context windows.

---

## Durable Workflow Execution

Powered by Temporal.

Features include:

- automatic retries
- durable execution
- activity replay
- workflow replay
- state persistence
- signal support
- query support
- workflow versioning
- graceful upgrades

If a worker crashes midway through dispatching a customer request, processing resumes automatically from the exact point of interruption.

---

## Human-in-the-Loop Automation

Organizations choose how much autonomy AI receives.

Supported modes:

- Fully Autonomous
- Shadow Review
- Manual Approval

Operators can intervene at any point without restarting workflows.

---

## Built-in Compliance

RelayDispatch includes support for operational compliance requirements.

Current capabilities include:

- configurable AI disclosure footer
- audit logging
- activity traceability
- structured AI decisions
- billing transparency
- configurable data retention

Future compliance modules are designed to be added as packages rather than modifying the core system.

---

## Multi-Tenant by Design

Every organization operates in complete isolation.

Isolation is enforced through:

- organization identifiers
- Row-Level Security
- scoped authentication
- scoped workflows
- scoped AI budgets
- scoped telemetry
- scoped audit logs

Organizations never share data.

---

## AI Cost Management

AI costs remain predictable through configurable guardrails.

Features include:

- daily budgets
- monthly budgets
- organization quotas
- model tracking
- token accounting
- estimated cost recording
- cost alerts
- usage telemetry

Organizations can safely experiment with different models without risking unexpected spending.

---

## Security First

Security is treated as a platform feature.

Highlights include:

- encrypted PII vault
- prompt injection resistance
- webhook verification
- HMAC validation
- encrypted secrets
- JWT authentication
- least privilege access
- deterministic workflows
- structured logging
- audit trails

See **SECURITY.md** for complete security documentation.

---

# Supported Integrations

RelayDispatch intentionally separates providers from business logic.

## AI Providers

Supported through OpenRouter.

Examples include:

- Google Gemini
- Anthropic Claude
- OpenAI GPT
- DeepSeek
- Mistral
- Qwen
- Meta Llama
- xAI Grok
- future OpenRouter providers

Changing models typically requires only a configuration update.

---

## Email Providers

Supported:

- Google Gmail
- Microsoft Outlook
- Microsoft Exchange Online
- Sandbox provider

Future adapters can be added independently.

---

## CRM Providers

Current adapters:

- Jobber
- Local CRM
- Custom adapters

Planned adapters include:

- ServiceTitan
- Housecall Pro
- FieldPulse
- Service Fusion
- ServiceM8
- SimPRO

---

## Communication Providers

Current support:

- Email
- Twilio SMS

Planned:

- WhatsApp Business
- Microsoft Teams
- Slack
- Voice providers
- Push notifications

---

# Quick Start

## Docker

```bash
git clone https://github.com/relaydispatch/relaydispatch.git

cd relaydispatch

cp .env.example .env

docker compose up
```

---

## Manual Installation

```bash
git clone https://github.com/relaydispatch/relaydispatch.git

cd relaydispatch

npm install

cp .env.example .env

npm run dev
```

Detailed deployment instructions are available in:

- SELF_HOSTING.md
- DATABASE.md
- WORKFLOW_ENGINE.md
- PROVIDER_GUIDE.md

---

# Project Structure

```
apps/
    api/
    web/
    worker/
    scheduler/

packages/
    ai/
    auth/
    compliance/
    config/
    database/
    integrations/
    organizations/
    security/
    shared/
    telemetry/
    workflows/

docs/

tests/

examples/

scripts/

docker/

supabase/
```

The repository follows a modular monorepo architecture where every package has a clearly defined responsibility.

---

# Documentation

Complete documentation is available inside the repository.

| Document           | Purpose                       |
| ------------------ | ----------------------------- |
| AI_GUIDE.md        | AI architecture               |
| ARCHITECTURE.md    | System architecture           |
| DATABASE.md        | Database schema               |
| WORKFLOW_ENGINE.md | Temporal workflows            |
| PROVIDER_GUIDE.md  | Provider integrations         |
| SELF_HOSTING.md    | Deployment guide              |
| SECURITY.md        | Security architecture         |
| CONTRIBUTING.md    | Contribution process          |
| ICCLA.md           | Contributor License Agreement |
| CODE_OF_CONDUCT.md | Community guidelines          |
| SUPPORT.md         | Support resources             |
| DEVELOPER_GUIDE.md | Developer onboarding          |

We recommend reading **ARCHITECTURE.md** before contributing.

---

# Why RelayDispatch?

Most AI automation products focus on generating responses.

RelayDispatch focuses on running **an entire business workflow** safely.

Key design principles include:

- Security before intelligence
- Reliability before automation
- Human override before autonomy
- Explainability before complexity
- Vendor neutrality over lock-in
- Extensibility over hardcoding
- Privacy by design
- Open architecture

This philosophy allows organizations to adopt AI without sacrificing operational control.

---

# Designed for Production

RelayDispatch is intended for real-world deployments.

Production capabilities include:

- horizontal scaling
- durable workflows
- fault tolerance
- structured telemetry
- distributed tracing
- audit logging
- secure secret handling
- provider abstraction
- deterministic execution
- disaster recovery support

The platform is suitable for organizations requiring dependable customer communication and operational automation.

---

# Roadmap

RelayDispatch has been designed with a long-term roadmap focused on building a complete AI-native operating system for field service businesses.

## Near-Term

- Full Microsoft 365 production support
- Expanded CRM integrations
- AI scheduling optimization
- Technician recommendation engine
- Customer portal
- Mobile dashboard improvements
- Workflow templates
- AI analytics dashboard
- Better reporting
- Enhanced observability

---

## Medium-Term

- Voice call intake
- WhatsApp Business integration
- Native SMS conversations
- AI phone assistant
- Multi-language conversations
- Predictive technician assignment
- AI SLA monitoring
- Automated follow-up campaigns
- Customer satisfaction analysis
- Knowledge base generation

---

## Long-Term Vision

RelayDispatch aims to become a complete operational intelligence platform.

Future capabilities may include:

- AI Operations Center
- Multi-agent orchestration
- Predictive maintenance intelligence
- Inventory forecasting
- Fleet optimization
- AI scheduling optimization
- Autonomous dispatch planning
- Regional dispatch balancing
- Workforce optimization
- Business intelligence dashboards
- AI-assisted compliance auditing

The project roadmap will continue evolving alongside community feedback and real-world deployments.

---

# Community

RelayDispatch is community-driven.

Whether you're a:

- software engineer
- HVAC technician
- electrician
- plumber
- security researcher
- DevOps engineer
- product designer
- technical writer
- AI researcher
- field service business owner

your experience can help improve the platform.

Community contributions extend far beyond writing code.

Examples include:

- documentation improvements
- architecture reviews
- bug reports
- UX feedback
- provider integrations
- workflow ideas
- AI prompt improvements
- localization
- accessibility
- performance optimization
- security reviews
- production deployment experiences

Every contribution helps make RelayDispatch more reliable.

---

# Contributing

We welcome contributions of every size.

Before opening a Pull Request, please review:

- CONTRIBUTING.md
- CODE_OF_CONDUCT.md
- SECURITY.md
- ICCLA.md

All contributors are expected to follow the project standards.

The project uses:

- Conventional Commits
- mandatory code review
- automated CI validation
- strict TypeScript
- reproducible builds
- deterministic workflows

Large architectural proposals are encouraged through GitHub Discussions before implementation.

---

# Reporting Issues

Bug reports are always appreciated.

Helpful reports generally include:

- reproduction steps
- environment information
- relevant logs
- screenshots (when applicable)
- expected behavior
- actual behavior

Security vulnerabilities should **never** be reported publicly.

Please follow the process described in **SECURITY.md**.

---

# Discussions & Ideas

RelayDispatch actively encourages architectural discussions and new ideas.

Not every valuable contribution starts as code.

Some of the most impactful community contributions include:

- proposing new provider adapters
- improving workflow design
- identifying operational bottlenecks
- suggesting AI guardrails
- recommending compliance improvements
- proposing performance optimizations
- sharing production deployment lessons
- identifying edge cases

If you have an idea that could improve RelayDispatch—even if you're unsure how to implement it—we encourage you to open a GitHub Discussion.

---

# Philosophy

RelayDispatch is built around several core engineering principles.

## Reliability

Business workflows should continue operating even when infrastructure fails.

---

## Privacy

Customer information belongs to the customer.

Sensitive data should never be exposed to AI models unnecessarily.

---

## Transparency

AI decisions should be explainable, reviewable, and auditable.

Operators should always understand why a decision was made.

---

## Extensibility

Organizations should never be locked into:

- one AI model
- one CRM
- one email provider
- one cloud vendor

Every major subsystem is designed to be replaceable.

---

## Human Control

Automation should empower people—not replace operational oversight.

Humans should always be able to intervene.

---

## Open Collaboration

Great software is built by communities.

RelayDispatch welcomes engineers, researchers, security professionals, business operators, and contributors from around the world.

---

# Project Status

RelayDispatch is under active development.

The architecture is designed for long-term stability while allowing rapid iteration on new capabilities.

Interfaces are stabilized wherever practical, but some APIs and providers may continue to evolve before the first stable release.

Please refer to release notes and migration guides when upgrading between major versions.

---

# License

RelayDispatch is released under the MIT License.

See the **LICENSE** file for complete licensing terms.

Contributions are governed by the **ICCLA (Individual & Corporate Contributor License Agreement)**.

By contributing, you agree to the terms described in **ICCLA.md**.

---

# Acknowledgements

RelayDispatch builds upon an incredible open-source ecosystem.

Special thanks to the maintainers and contributors behind projects such as:

- TypeScript
- Node.js
- React
- Hono
- Temporal
- Supabase
- OpenTelemetry
- Vitest
- Zod
- Pino
- OpenRouter
- Docker

Their work makes projects like RelayDispatch possible.

---

# Star the Project ⭐

If RelayDispatch helps your business, research, or development workflow, consider giving the repository a ⭐ on GitHub.

Stars help:

- increase project visibility
- attract contributors
- encourage ecosystem growth
- prioritize future development

---

# Build the Future of AI-Powered Field Service

RelayDispatch is more than an AI email responder.

It is an open, secure, extensible, and production-ready platform for intelligent field service operations.

Whether you're deploying it for your own organization, integrating a new provider, improving the AI pipeline, strengthening security, or contributing new ideas, you're helping shape the future of AI-assisted operations.

**Thank you for being part of the RelayDispatch community.**

---

<p align="center">
Built with ❤️ by the RelayDispatch community.
</p>
