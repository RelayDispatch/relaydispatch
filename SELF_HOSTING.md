# Self-Hosting Guide

> **Audience:** System Administrators • DevOps Engineers • Platform Engineers • Infrastructure Teams • Managed Service Providers (MSPs)

RelayDispatch is designed as a **Bring Your Own Infrastructure (BYOI)** platform. Every core component can be self-hosted, audited, replaced, or scaled independently. The project intentionally avoids vendor lock-in and supports deployment ranging from a single virtual machine to globally distributed, high-availability clusters.

Unlike traditional SaaS products, RelayDispatch does **not** require proprietary cloud infrastructure. You maintain ownership of your infrastructure, AI providers, databases, credentials, customer data, and operational policies.

---

# Philosophy

RelayDispatch follows several architectural principles:

- **Open Source First** — Core functionality is fully self-hostable.
- **Vendor Neutral** — Infrastructure providers can be replaced without modifying business logic.
- **Bring Your Own Provider (BYOP)** — Email, AI, CRM, SMS, databases, storage, and observability providers are pluggable.
- **Security by Default** — Sensitive information is minimized, compartmentalized, encrypted, and validated throughout the processing pipeline.
- **Horizontal Scalability** — Stateless services can be scaled independently behind load balancers.
- **Workflow Reliability** — Durable execution is provided through Temporal, enabling retries, resumability, and idempotent workflows.

---

# Deployment Models

RelayDispatch supports multiple deployment topologies depending on operational requirements.

| Deployment     | Recommended For                     | Production Ready |
| -------------- | ----------------------------------- | ---------------- |
| Docker Compose | Local development, evaluation       | ⚠️ Limited       |
| Single VM      | Small businesses                    | ✅               |
| Multi-VM       | Medium deployments                  | ✅               |
| Kubernetes     | Enterprise                          | ✅               |
| Managed Cloud  | Cloud-native deployments            | ✅               |
| Air-Gapped     | Government / Regulated environments | ✅               |

Each topology shares the same application architecture while differing only in infrastructure orchestration.

---

# Reference Architecture

```text
                        Internet
                            │
                            ▼
                  ┌─────────────────────┐
                  │ Reverse Proxy / WAF │
                  │ NGINX • Caddy •     │
                  │ Traefik • Cloudflare│
                  └──────────┬──────────┘
                             │
          ┌──────────────────┴──────────────────┐
          │                                     │
          ▼                                     ▼
 ┌─────────────────┐                   ┌─────────────────┐
 │   Web Dashboard │                   │     API Server  │
 │ React + Vite    │                   │ Hono Runtime    │
 └─────────────────┘                   └─────────────────┘
                                               │
                                               ▼
                                   ┌────────────────────┐
                                   │ Temporal Frontend  │
                                   └─────────┬──────────┘
                                             │
                           ┌─────────────────┴─────────────────┐
                           ▼                                   ▼
               ┌────────────────────┐              ┌────────────────────┐
               │ Worker Processes   │              │ Scheduler Services │
               │ Activities         │              │ Cleanup / DLQ      │
               └─────────┬──────────┘              └─────────┬──────────┘
                         │                                   │
                         └──────────────┬────────────────────┘
                                        ▼
                           ┌──────────────────────────┐
                           │ PostgreSQL / Supabase    │
                           └──────────────────────────┘
                                        │
      ┌─────────────────────────────────┼────────────────────────────────┐
      ▼                                 ▼                                ▼
 OpenRouter                     Email Provider                     CRM Provider
 Gemini / Claude               Gmail / Microsoft                 Jobber / Custom
```

---

# Supported Infrastructure

RelayDispatch is intentionally infrastructure agnostic.

## Operating Systems

| Platform              | Supported           |
| --------------------- | ------------------- |
| Ubuntu LTS            | ✅ Recommended      |
| Debian                | ✅                  |
| Rocky Linux           | ✅                  |
| AlmaLinux             | ✅                  |
| RHEL                  | ✅                  |
| Fedora Server         | ✅                  |
| Windows Server (WSL2) | ⚠️ Development Only |
| macOS                 | ✅ Development      |

Ubuntu LTS remains the recommended production operating system due to ecosystem maturity and long-term support.

---

# Hardware Recommendations

## Development

| Resource | Minimum   |
| -------- | --------- |
| CPU      | 4 vCPU    |
| Memory   | 8 GB      |
| Storage  | 20 GB SSD |

---

## Small Production

Suitable for:

- HVAC companies
- Local contractors
- Single organization deployments

| Resource | Recommended        |
| -------- | ------------------ |
| CPU      | 4–8 vCPU           |
| Memory   | 16 GB              |
| Storage  | 100 GB SSD         |
| Database | Managed PostgreSQL |

Supports approximately:

- 5–20 users
- Hundreds of daily conversations
- Single Temporal worker

---

## Medium Production

Suitable for MSPs and regional service providers.

| Resource | Recommended   |
| -------- | ------------- |
| CPU      | 8–16 vCPU     |
| Memory   | 32 GB         |
| Storage  | 500 GB NVMe   |
| Database | HA PostgreSQL |

Recommended architecture:

- 2 API servers
- 2 Web instances
- 3+ Worker instances
- Dedicated Scheduler node

---

## Enterprise

Recommended deployment:

- Kubernetes
- Multiple Availability Zones
- Managed PostgreSQL
- Managed Redis
- Object Storage
- External Secret Manager
- Prometheus
- Grafana
- OpenTelemetry Collector

RelayDispatch has no architectural limitation preventing deployments handling millions of workflow executions provided the surrounding infrastructure is appropriately sized.

---

# Supported External Services

Every integration is replaceable through interfaces.

| Category        | Default          | Alternatives                                   |
| --------------- | ---------------- | ---------------------------------------------- |
| Database        | Supabase         | PostgreSQL                                     |
| Workflow Engine | Temporal         | Self-hosted Temporal                           |
| AI Gateway      | OpenRouter       | Self-hosted gateway compatible with OpenAI API |
| Email           | Gmail            | Microsoft Graph, custom providers              |
| CRM             | Jobber           | Custom adapters                                |
| SMS             | Twilio           | Custom adapter                                 |
| Object Storage  | Supabase Storage | S3-compatible providers                        |
| Authentication  | Supabase Auth    | Custom implementation                          |

No proprietary SaaS dependency is required by the application architecture.

---

# Before You Begin

Verify that you have:

- Administrative access to your infrastructure
- Docker or container runtime (recommended)
- Git
- Node.js LTS
- PostgreSQL or Supabase
- Temporal Server (Cloud or Self-hosted)
- DNS records configured (production)
- TLS certificates
- AI provider credentials
- Email provider credentials
- CRM credentials (optional)

The remainder of this guide walks through provisioning, configuration, deployment, hardening, scaling, monitoring, backup, recovery, and ongoing operations for production-grade RelayDispatch environments.

---

# Installation

RelayDispatch supports multiple installation methods depending on your operational requirements.

| Method              | Recommended For               | Difficulty |
| ------------------- | ----------------------------- | ---------- |
| Docker Compose      | Local development, testing    | ⭐         |
| Manual Installation | Learning, custom environments | ⭐⭐       |
| Production VM       | Small & Medium deployments    | ⭐⭐⭐     |
| Kubernetes          | Enterprise deployments        | ⭐⭐⭐⭐⭐ |

Regardless of the installation method, the application architecture remains identical.

---

# Prerequisites

## Required Software

| Software       | Recommended Version | Required                 |
| -------------- | ------------------- | ------------------------ |
| Node.js        | 24.x LTS            | ✅                       |
| npm            | 11.x+               | ✅                       |
| Git            | Latest Stable       | ✅                       |
| Docker         | 28.x+               | Recommended              |
| Docker Compose | Latest              | Recommended              |
| PostgreSQL     | 16+                 | If self-hosting database |
| Temporal       | 1.30+               | ✅                       |
| OpenSSL        | Latest              | Recommended              |

Verify your environment:

```bash
node --version
npm --version
docker --version
docker compose version
git --version
```

---

# Clone Repository

Clone the official repository.

```bash
git clone https://github.com/relaydispatch/relaydispatch.git

cd relaydispatch
```

For contributors:

```bash
git clone https://github.com/<your-account>/relaydispatch.git
```

---

# Install Dependencies

Install all workspace dependencies.

```bash
npm install
```

For clean reproducible installations in CI:

```bash
npm ci
```

---

# Verify Workspace

Ensure all packages are installed correctly.

```bash
npm run typecheck

npm run lint

npm run test

npm run build
```

All commands should complete successfully before deployment.

---

# Environment Configuration

RelayDispatch validates its environment during startup.

Missing or invalid configuration immediately terminates startup to prevent partially configured deployments.

Create the configuration file.

```bash
cp .env.example .env
```

---

# Minimum Required Variables

```env
##############################
# Database
##############################

SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

##############################
# AI
##############################

OPENROUTER_API_KEY=
OPENROUTER_MODEL=google/gemini-3.1-flash-lite-preview

##############################
# Encryption
##############################

VAULT_ENCRYPTION_KEY=

##############################
# Workflow Engine
##############################

TEMPORAL_ADDRESS=localhost:7233

##############################
# Email
##############################

MAIL_PROVIDER=sandbox
```

Every required variable is validated during startup by:

```
packages/shared/utils/src/validateEnv.ts
```

---

# Generate Encryption Keys

The vault encryption key protects the encrypted PII vault.

Generate a secure key.

Node.js:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

OpenSSL:

```bash
openssl rand -hex 32
```

Example:

```env
VAULT_ENCRYPTION_KEY=<generated 64-character hex value>
```

> Never reuse encryption keys across unrelated deployments.

---

# Secret Management

Production deployments should avoid storing secrets directly inside `.env` files whenever possible.

Recommended secret providers include:

| Provider              | Recommended |
| --------------------- | ----------- |
| HashiCorp Vault       | ⭐⭐⭐⭐⭐  |
| Doppler               | ⭐⭐⭐⭐⭐  |
| AWS Secrets Manager   | ⭐⭐⭐⭐⭐  |
| Azure Key Vault       | ⭐⭐⭐⭐⭐  |
| Google Secret Manager | ⭐⭐⭐⭐⭐  |
| Kubernetes Secrets    | ⭐⭐⭐⭐    |
| Docker Secrets        | ⭐⭐⭐⭐    |

For local development, `.env` remains acceptable.

---

# Database Setup

RelayDispatch officially supports:

- Managed Supabase
- Self-hosted Supabase
- PostgreSQL (advanced deployments)

---

## Managed Supabase

Create a new project.

Copy:

- URL
- Anonymous Key
- Service Role Key

into `.env`.

Run migrations.

```bash
npx supabase db push
```

---

## Self-Hosted Supabase

Deploy Supabase following the official documentation.

After deployment:

1. Obtain project URL.
2. Generate service keys.
3. Apply migrations.
4. Generate TypeScript types.

---

## PostgreSQL

If using raw PostgreSQL:

- PostgreSQL 16+
- TLS recommended
- Daily backups
- Connection pooling
- Logical replication optional

RelayDispatch expects the generated schema to match the included migrations.

---

# Running Database Migrations

Apply every migration in chronological order.

```bash
npx supabase db push
```

For CI/CD:

```bash
npx supabase migration up
```

Never edit historical migrations after production deployment.

Always create a new migration.

---

# Docker Compose Deployment

For evaluation and development:

```bash
docker compose up
```

Detached mode:

```bash
docker compose up -d
```

Rebuild images:

```bash
docker compose up --build
```

Stop services:

```bash
docker compose down
```

Remove persistent volumes:

```bash
docker compose down -v
```

---

# Manual Development Startup

Start individual services.

API + Dashboard

```bash
npm run dev
```

Worker

```bash
npm run worker
```

Scheduler

```bash
npm run scheduler
```

Depending on your workspace configuration, individual package scripts may also be available.

---

# Startup Verification

After startup verify:

✓ Dashboard loads

```
http://localhost:3000
```

✓ API responds

```
http://localhost:3001/health
```

✓ Temporal Worker connected

✓ Database migrations completed

✓ Worker polling task queue

✓ Scheduler running

✓ OpenRouter authentication successful

✓ No startup validation errors

---

# Initial Health Checks

Recommended validation sequence:

```bash
npm run typecheck

npm run lint

npm run test

npm run build
```

Then perform:

- Send a sandbox email
- Verify workflow execution
- Verify AI response generation
- Verify database persistence
- Verify webhook verification
- Verify telemetry collection
- Verify structured logging
- Verify idempotency protection

A deployment should not be considered production-ready until every validation passes successfully.

---

# Directory Expectations

After installation the repository should resemble:

```
relaydispatch/

apps/
packages/
docs/
tests/
scripts/
supabase/
docker/

package.json
package-lock.json
turbo.json
.env
```

No generated artifacts should be committed unless explicitly required by the project.

---

# Next Steps

With the platform installed, the next stage is configuring production infrastructure:

- Reverse proxies
- TLS certificates
- Domain names
- Firewalls
- Temporal clustering
- Worker scaling
- High Availability
- Object storage
- Observability
- Production hardening

The following sections cover enterprise deployment practices suitable for production environments.

---

# Production Deployment

This section covers production-grade deployment recommendations for RelayDispatch. While the platform can run on a single server, production environments should prioritize security, redundancy, observability, and fault tolerance.

---

# Production Architecture

A typical production deployment separates application responsibilities into independent services.

```text
                        Internet
                            │
                            ▼
                 CDN / DNS / DDoS Protection
                            │
                            ▼
                Reverse Proxy / Load Balancer
                 (NGINX / Traefik / Caddy)
                            │
        ┌───────────────────┴───────────────────┐
        ▼                                       ▼
 API Instances (Stateless)             Web Dashboard
        │                                       │
        └───────────────┬───────────────────────┘
                        ▼
               Temporal Frontend Service
                        │
        ┌───────────────┴─────────────────┐
        ▼                                 ▼
 Worker Pool A                     Worker Pool B
 AI Activities                     CRM / Email Activities
        │                                 │
        └───────────────┬─────────────────┘
                        ▼
                 PostgreSQL / Supabase
                        │
        ┌───────────────┼────────────────┐
        ▼               ▼                ▼
 Object Storage    Redis (Optional)   Observability
```

Each layer can be scaled independently without modifying application code.

---

# Recommended Production Components

| Component       | Recommendation                   |
| --------------- | -------------------------------- |
| Reverse Proxy   | NGINX, Caddy, Traefik            |
| TLS             | Let's Encrypt or Enterprise PKI  |
| Database        | Managed PostgreSQL / Supabase    |
| Workflow Engine | Temporal Cloud or HA Self-Hosted |
| Object Storage  | S3-compatible storage            |
| Metrics         | Prometheus                       |
| Visualization   | Grafana                          |
| Logs            | Loki / ELK / OpenSearch          |
| Tracing         | OpenTelemetry Collector          |
| Secrets         | Vault / Secret Manager           |

---

# Reverse Proxy

RelayDispatch should never be directly exposed to the public Internet.

Instead:

```text
Internet

↓

Cloudflare

↓

NGINX / Traefik

↓

RelayDispatch API
```

Responsibilities include:

- TLS termination
- HTTP compression
- Rate limiting
- Security headers
- Request logging
- Reverse proxying
- WebSocket support
- HTTP/2 and HTTP/3
- Request buffering
- Basic DDoS mitigation

---

# TLS

All production deployments should use HTTPS exclusively.

Minimum recommendations:

- TLS 1.3 preferred
- TLS 1.2 fallback
- Strong cipher suites
- Automatic certificate renewal
- HSTS enabled
- OCSP stapling enabled

Never expose:

```
http://
```

to the public Internet.

---

# Domain Structure

Example deployment:

```text
dashboard.example.com

api.example.com

worker.example.com (internal)

temporal.example.com (optional)

grafana.example.com

prometheus.example.com
```

Internal services should remain inaccessible from public networks whenever possible.

---

# Firewall Recommendations

Only expose required ports.

Example:

| Port | Purpose           | Public       |
| ---- | ----------------- | ------------ |
| 80   | Redirect to HTTPS | Optional     |
| 443  | HTTPS             | Yes          |
| 7233 | Temporal Frontend | Internal     |
| 5432 | PostgreSQL        | Internal     |
| 3000 | Dashboard         | Behind Proxy |
| 3001 | API               | Behind Proxy |

Everything else should remain blocked.

---

# Network Segmentation

A production deployment should isolate infrastructure into separate security zones.

Example:

```text
Public Network

↓

Load Balancer

↓

Application Network

↓

Worker Network

↓

Database Network
```

The database should never be reachable directly from the Internet.

---

# High Availability

RelayDispatch services are largely stateless.

Recommended redundancy:

| Component     | Instances  |
| ------------- | ---------- |
| API           | 2+         |
| Dashboard     | 2+         |
| Worker        | 3+         |
| Scheduler     | 2          |
| Reverse Proxy | 2          |
| Database      | HA Cluster |

This allows rolling upgrades without downtime.

---

# Horizontal Scaling

Workers are designed to scale horizontally.

Example:

```text
Task Queue

↓

Worker 1

Worker 2

Worker 3

Worker 4

Worker N
```

Temporal distributes work automatically.

Scaling typically requires no application changes.

---

# Scheduler Deployment

Schedulers should generally remain singleton services.

Recommended jobs include:

- Dead Letter Queue replay
- Retention cleanup
- Billing cleanup
- Idempotency cleanup
- Metrics aggregation

Running multiple scheduler instances requires leader election or distributed locking.

---

# Object Storage

RelayDispatch does not require a specific storage provider.

Supported options include:

- Amazon S3
- Cloudflare R2
- MinIO
- Supabase Storage
- Backblaze B2
- DigitalOcean Spaces

Store:

- Attachments
- Logs
- Backups
- Generated exports

Avoid storing large binary assets directly inside PostgreSQL.

---

# Redis

Redis is optional but recommended.

Potential use cases:

- Distributed rate limiting
- Session caching
- Temporary workflow caches
- Queue metadata
- API throttling

Redis should not be treated as the primary source of truth.

---

# AI Provider Configuration

RelayDispatch communicates through OpenRouter by default.

```env
OPENROUTER_API_KEY=

OPENROUTER_MODEL=google/gemini-3.1-flash-lite-preview
```

Changing models typically requires only updating:

```
OPENROUTER_MODEL
```

No application code changes are required.

Organizations may choose different models according to latency, reasoning capability, cost, or compliance requirements.

---

# Email Infrastructure

Supported providers include:

- Gmail
- Microsoft Graph
- Sandbox mode

Production recommendations:

- SPF configured
- DKIM enabled
- DMARC enforced
- TLS required
- OAuth tokens securely stored
- Automatic token refresh enabled

---

# CRM Integrations

Current adapters include:

- Jobber
- Local Adapter

Future integrations can implement the CRM interface without modifying workflow logic.

Examples:

- ServiceTitan
- Housecall Pro
- Salesforce
- HubSpot
- Custom ERP systems

---

# Deployment Strategies

Recommended release strategies:

### Rolling Deployment

```
Old

↓

New

↓

Remove Old
```

No downtime.

---

### Blue-Green Deployment

Maintain two identical environments.

```
Blue

↓

Green

↓

Switch Traffic
```

Provides fast rollback.

---

### Canary Deployment

Deploy gradually.

```
5%

↓

20%

↓

50%

↓

100%
```

Useful for validating new releases under production traffic.

---

# Zero-Downtime Updates

Before upgrading:

- Complete database backups
- Verify migrations
- Drain worker queues if necessary
- Validate health checks
- Monitor logs

Upgrade order:

1. Database migrations
2. API
3. Dashboard
4. Workers
5. Scheduler

Avoid deploying incompatible worker and workflow versions simultaneously unless explicitly supported by your workflow compatibility strategy.

---

# Production Validation Checklist

Before accepting production traffic, verify:

- TLS certificates valid
- DNS configured
- Reverse proxy operational
- Database healthy
- Temporal healthy
- Workers polling successfully
- Scheduler active
- Secrets loaded
- AI provider authenticated
- Email provider authenticated
- Structured logging enabled
- Metrics exported
- Traces collected
- Rate limiting active
- Firewall configured
- Health endpoints responding

Only after every item has been validated should the deployment be considered production-ready.

---

# Next Steps

The following section focuses on operational excellence, including:

- Observability
- OpenTelemetry
- Prometheus
- Grafana
- Centralized logging
- Backup and disaster recovery
- Security hardening
- Air-gapped deployments
- Performance tuning
- Troubleshooting
- Upgrade strategies
- Long-term maintenance

---

# Observability & Monitoring

Operating RelayDispatch in production requires visibility into application health, workflow execution, AI usage, infrastructure utilization, and security events.

The platform is designed around **OpenTelemetry-first observability**, allowing organizations to integrate with nearly any modern monitoring stack.

---

# Observability Architecture

```text
                RelayDispatch Services
                        │
        ┌───────────────┼────────────────┐
        ▼               ▼                ▼
   Structured Logs    Metrics         Distributed Traces
        │               │                │
        └───────────────┼────────────────┘
                        ▼
            OpenTelemetry Collector
                        │
      ┌─────────────────┼──────────────────┐
      ▼                 ▼                  ▼
   Prometheus        Grafana             Loki
                                          │
                                          ▼
                                   Long-term Storage
```

Organizations may replace any component with an equivalent observability platform.

---

# Metrics

RelayDispatch exports operational metrics covering:

- API requests
- Workflow executions
- Worker throughput
- AI usage
- Cost tracking
- Database performance
- Scheduler activity
- Queue depth
- Retry counts
- Error rates

Example metric families:

```text
relaydispatch_api_requests_total

relaydispatch_workflow_duration_seconds

relaydispatch_worker_jobs_total

relaydispatch_llm_tokens_total

relaydispatch_llm_cost_usd

relaydispatch_email_sent_total

relaydispatch_webhook_failures_total
```

Metrics should be retained long enough to identify operational trends and support capacity planning.

---

# Distributed Tracing

RelayDispatch supports distributed tracing through OpenTelemetry.

Recommended trace spans include:

- HTTP requests
- Workflow execution
- Activity execution
- AI provider requests
- Database queries
- CRM synchronization
- Email delivery
- Authentication
- Scheduler jobs

Tracing enables engineers to understand end-to-end request execution across multiple services.

---

# Structured Logging

Production deployments should emit structured JSON logs.

Recommended fields include:

```json
{
  "timestamp": "...",
  "level": "info",
  "service": "worker",
  "workflowId": "...",
  "activity": "...",
  "organizationId": "...",
  "traceId": "...",
  "durationMs": 123
}
```

Avoid unstructured log output in production.

Never log:

- Passwords
- OAuth tokens
- JWTs
- API keys
- Encryption keys
- Raw PII
- Unredacted email bodies

---

# Dashboards

At minimum, production dashboards should visualize:

## Infrastructure

- CPU
- Memory
- Disk
- Network
- Container health

---

## Application

- API latency
- Error rates
- Active workflows
- Queue depth
- Worker utilization

---

## AI

- Token consumption
- Daily spend
- Monthly spend
- Average prompt latency
- Model utilization
- Escalation rates

---

## Database

- Active connections
- Slow queries
- Replication lag
- Storage growth
- Index usage

---

## Temporal

- Workflow executions
- Activity retries
- Failed workflows
- Queue backlog
- Namespace health

---

# Alerting

Alerts should prioritize actionable operational issues.

Examples include:

| Condition              | Severity |
| ---------------------- | -------- |
| Worker offline         | Critical |
| Database unavailable   | Critical |
| Workflow retry storm   | High     |
| Queue backlog growing  | High     |
| AI cost limit exceeded | Medium   |
| High API latency       | Medium   |
| Disk nearing capacity  | Medium   |
| Failed login spikes    | Medium   |

Alert destinations may include:

- PagerDuty
- Opsgenie
- Slack
- Microsoft Teams
- Email
- SMS

---

# Health Endpoints

Every externally accessible service should expose lightweight health endpoints.

Typical checks include:

```text
/health

/ready

/live
```

Recommended probes:

- Database connectivity
- Temporal connectivity
- AI provider availability
- Queue availability
- Configuration validation

---

# Backup Strategy

A production deployment must implement regular backups.

Recommended schedule:

| Resource       | Frequency                          |
| -------------- | ---------------------------------- |
| PostgreSQL     | Daily                              |
| Object Storage | Daily                              |
| Configuration  | After changes                      |
| Secrets        | According to organizational policy |
| Dashboards     | Weekly                             |

Critical systems should follow the **3-2-1 Backup Rule**:

- Three copies of data
- Two different storage media
- One off-site copy

---

# Disaster Recovery

Document recovery procedures before production deployment.

Recovery plans should include:

- Database restoration
- Secret recovery
- Worker redeployment
- API restoration
- Dashboard restoration
- DNS recovery
- TLS certificate restoration

Recovery procedures should be periodically tested instead of assumed to function.

---

# Recovery Objectives

Organizations should define operational objectives.

Example:

| Metric                         | Target       |
| ------------------------------ | ------------ |
| Recovery Time Objective (RTO)  | < 60 minutes |
| Recovery Point Objective (RPO) | < 15 minutes |

Mission-critical deployments may require stricter objectives.

---

# Security Hardening

Production environments should implement layered defenses.

Recommended controls include:

- HTTPS everywhere
- Web Application Firewall (WAF)
- Least privilege access
- Multi-factor authentication
- Secret rotation
- Regular dependency updates
- Network segmentation
- Container isolation
- Immutable infrastructure where practical
- Continuous vulnerability scanning

---

# Air-Gapped Deployments

RelayDispatch can operate within restricted environments where Internet connectivity is limited or unavailable.

Typical requirements include:

- Self-hosted Temporal
- Self-hosted PostgreSQL
- Internal object storage
- Internal identity provider
- Internal container registry
- Approved AI gateway or on-premises model endpoint compatible with the configured API interface

External services must be replaced with organization-approved equivalents before deployment.

---

# Capacity Planning

Monitor long-term trends for:

- Workflow growth
- Email volume
- AI token usage
- Storage consumption
- Database size
- Worker utilization
- Queue latency

Capacity should be increased before sustained resource saturation occurs.

---

# Performance Tuning

Operational improvements may include:

- Increasing worker concurrency
- Database connection pooling
- Optimizing indexes
- Caching frequently accessed configuration
- Horizontal API scaling
- Horizontal worker scaling
- Reducing unnecessary LLM calls
- Prompt optimization
- Appropriate batching of background jobs

Performance optimizations should be validated with representative workloads.

---

# Maintenance

Routine maintenance should include:

- Updating dependencies
- Rotating secrets
- Renewing TLS certificates
- Reviewing audit logs
- Testing backups
- Validating disaster recovery procedures
- Reviewing monitoring dashboards
- Removing unused credentials
- Applying operating system security updates

Establish a regular maintenance schedule appropriate for the deployment's risk profile.

---

# Operational Runbooks

Production environments benefit from documented runbooks covering common incidents, including:

- Worker failures
- Database outages
- AI provider unavailability
- Email delivery failures
- CRM synchronization failures
- Queue congestion
- Secret rotation
- Certificate renewal
- Emergency rollback

Runbooks reduce recovery time and improve operational consistency.

---

# Next Steps

The final section of this guide covers:

- Troubleshooting
- Upgrade procedures
- Version compatibility
- Migration guidance
- Production checklists
- Frequently encountered deployment issues
- Long-term operational recommendations

---

# Troubleshooting

This section documents common operational issues and recommended diagnostic procedures.

Always begin troubleshooting by reviewing:

- Application logs
- Worker logs
- Scheduler logs
- Reverse proxy logs
- Database logs
- Temporal Web UI
- Infrastructure metrics
- OpenTelemetry traces

Avoid restarting services before determining the root cause.

---

# Startup Failures

## Environment Validation Failed

### Symptoms

- Application exits immediately.
- Startup validation errors.
- Missing environment variable messages.

### Possible Causes

- Missing required variables.
- Invalid variable format.
- Incorrect encryption key length.
- Incorrect Temporal endpoint.

### Resolution

Verify:

```bash
cp .env.example .env
```

Ensure every required variable is present.

Run:

```bash
npm run typecheck

npm run build
```

Review:

```
packages/shared/utils/src/validateEnv.ts
```

for the complete validation rules.

---

# Worker Cannot Connect to Temporal

### Symptoms

- Worker repeatedly reconnects.
- Activities never execute.
- Queue depth continuously increases.

### Verify

```text
TEMPORAL_ADDRESS
```

Confirm:

- Temporal Server is running.
- Firewall allows communication.
- Namespace exists.
- TLS configuration is correct.

---

# Database Connection Errors

### Symptoms

- API returns 500 responses.
- Worker activity failures.
- Migration failures.

Verify:

- Database credentials
- Connection pool limits
- TLS configuration
- Firewall rules
- PostgreSQL availability

Recommended tools:

```bash
psql

supabase status
```

---

# AI Provider Failures

### Symptoms

- AI replies missing.
- Dispatcher activities fail.
- High retry counts.

Verify:

- API key
- Selected model
- Network connectivity
- Account quotas
- Daily spending limits

Review worker logs for:

```
LLM Authentication

Model unavailable

Rate limit exceeded

Budget exceeded
```

---

# Email Delivery Problems

Common causes include:

- Expired OAuth tokens
- Incorrect redirect URI
- SPF failure
- DKIM failure
- DMARC rejection
- SMTP provider outage
- Provider rate limits

Validate:

- OAuth authorization
- Mail provider configuration
- DNS records
- Delivery logs

---

# Workflow Stuck

Symptoms:

- Workflow remains running.
- No progress.
- Activity timeout.

Inspect:

Temporal Web UI

Look for:

- Pending Activities
- Retry State
- Heartbeat Timeouts
- Workflow History

Avoid terminating workflows until investigation is complete.

---

# High Queue Depth

Possible causes:

- Worker shortage
- Slow AI responses
- Database bottlenecks
- CRM latency
- Email provider delays

Mitigation:

- Increase worker replicas.
- Scale infrastructure.
- Optimize database indexes.
- Review AI latency.
- Monitor activity execution times.

---

# High Memory Usage

Potential causes:

- Excessive concurrent workflows
- Memory leaks
- Large prompt context
- Oversized attachments

Recommended actions:

- Review heap usage.
- Enable profiling.
- Increase worker count.
- Reduce worker concurrency if required.

---

# Upgrade Guide

RelayDispatch follows semantic versioning.

```
MAJOR.MINOR.PATCH
```

Example:

```
2.3.1
```

Major versions may introduce breaking changes.

---

# Upgrade Procedure

Before upgrading:

✔ Backup database

✔ Backup secrets

✔ Export dashboards

✔ Verify rollback plan

✔ Review release notes

✔ Test in staging

Upgrade process:

```bash
git pull

npm install

npm run build

npx supabase db push

npm run worker

npm run scheduler
```

Validate:

- Health endpoints
- Workflow execution
- Email processing
- AI generation
- Dashboard functionality

---

# Rollback Procedure

If deployment issues occur:

1. Stop new deployments.
2. Restore previous application version.
3. Restore compatible database backup if required.
4. Restart workers.
5. Validate system health.

Always document rollback reasons before redeployment.

---

# Version Compatibility

| Component      | Recommended                 |
| -------------- | --------------------------- |
| Node.js        | 24.x LTS                    |
| npm            | 11.x                        |
| PostgreSQL     | 16+                         |
| Temporal       | 1.30+                       |
| Docker         | 28+                         |
| Docker Compose | Latest                      |
| TypeScript     | Latest supported by project |

Older versions may continue functioning but are not actively tested.

---

# Production Readiness Checklist

Infrastructure

- [ ] Reverse proxy configured
- [ ] HTTPS enforced
- [ ] Firewall configured
- [ ] DNS configured
- [ ] Monitoring enabled

Database

- [ ] Migrations applied
- [ ] Backups scheduled
- [ ] Connection pooling enabled

Application

- [ ] Environment validated
- [ ] Workers running
- [ ] Scheduler operational
- [ ] Health endpoints available

Security

- [ ] Secrets externalized
- [ ] Encryption keys rotated
- [ ] TLS certificates valid
- [ ] OAuth configured
- [ ] Principle of least privilege enforced

Observability

- [ ] Metrics exported
- [ ] Logs centralized
- [ ] Traces collected
- [ ] Alerts configured

Disaster Recovery

- [ ] Backup verified
- [ ] Restore procedure tested
- [ ] Incident runbooks documented

---

# Long-Term Operations

Recommended operational cadence:

| Task                       | Frequency                        |
| -------------------------- | -------------------------------- |
| Dependency updates         | Monthly                          |
| Security review            | Quarterly                        |
| Secret rotation            | Per organizational policy        |
| Backup validation          | Monthly                          |
| Disaster recovery exercise | Quarterly                        |
| Capacity review            | Quarterly                        |
| Performance benchmarking   | Semi-annually                    |
| Penetration testing        | Annually or after major releases |

Organizations operating regulated environments should align maintenance activities with applicable compliance requirements and internal governance policies.

---

# Additional Resources

Refer to the following project documentation for more information:

- `README.md`
- `ARCHITECTURE.md`
- `AI_GUIDE.md`
- `DEVELOPER_GUIDE.md`
- `SECURITY.md`
- `CONTRIBUTING.md`
- `ICCLA.md`
- `CODE_OF_CONDUCT.md`

Each document focuses on a specific aspect of the platform and should be used together as the authoritative project documentation set.

---

# Conclusion

RelayDispatch is designed to be a modular, secure, and production-ready platform for AI-assisted field service dispatch. By combining durable workflow orchestration, provider abstraction, secure handling of sensitive information, and comprehensive observability, organizations can deploy the platform across a wide range of environments—from local development to highly regulated enterprise infrastructure.

Successful production deployments depend not only on correct installation but also on disciplined operational practices, including continuous monitoring, routine maintenance, regular backups, security reviews, and tested disaster recovery procedures. Following the recommendations in this guide will help ensure reliable, maintainable, and scalable deployments over the long term.

As the project evolves, always consult the release notes and migration guides before upgrading, and validate changes in a staging environment before promoting them to production.
