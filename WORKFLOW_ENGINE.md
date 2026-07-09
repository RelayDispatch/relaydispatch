# Workflow Engine

> **Version:** 2026 Edition
>
> **Applies To:** RelayDispatch Workflow Runtime
>
> **Primary Runtime:** Temporal
>
> **Audience:** Contributors, Backend Engineers, Platform Engineers, DevOps Engineers, AI Engineers, Self-Hosters

---

# Overview

The RelayDispatch Workflow Engine is responsible for orchestrating every business operation performed by the platform.

Unlike traditional request/response applications where business logic executes inside HTTP requests, RelayDispatch executes business logic inside **durable workflows** powered by Temporal.

Every inbound service request becomes a persistent workflow capable of surviving:

- Worker crashes
- Server restarts
- Network failures
- Cloud outages
- Deployment rollouts
- Activity failures
- Long-running customer conversations
- Human intervention

The workflow engine is the operational backbone of RelayDispatch and guarantees reliable execution across distributed infrastructure.

---

# Design Philosophy

RelayDispatch intentionally separates responsibilities into distinct layers.

```
                    User Request
                         │
                         ▼
                  HTTP API / Webhook
                         │
                         ▼
                Workflow Orchestration
                  (Temporal Runtime)
                         │
      ┌──────────────────┼──────────────────┐
      ▼                  ▼                  ▼
 AI Activities      Database        External Services
      │                  │                  │
      └──────────────────┼──────────────────┘
                         ▼
                 Final Business Outcome
```

Each layer has a single responsibility.

The Workflow Engine coordinates execution but does not perform business logic itself.

Business logic lives inside Activities.

---

# Why RelayDispatch Uses Temporal

Field service operations are inherently long-running.

A customer interaction may span:

- Minutes
- Hours
- Days
- Weeks

Traditional web servers are poorly suited for these workloads because requests eventually timeout or lose state.

Temporal solves this problem by persisting workflow execution history.

Instead of relying on server memory, workflow state is reconstructed from durable event history whenever a worker resumes execution.

This enables workflows to continue regardless of infrastructure interruptions.

---

# Problems Solved

Temporal provides guarantees that are extremely difficult to implement correctly using conventional architectures.

RelayDispatch benefits from:

- Durable execution
- Automatic retries
- Failure recovery
- Crash resilience
- Long-running workflows
- Human approvals
- Exactly-once workflow semantics
- Idempotent activity execution
- Event sourcing
- Replay-based recovery
- Workflow versioning
- Horizontal scalability

These capabilities are fundamental to reliable AI-assisted dispatch operations.

---

# Workflow Principles

Every RelayDispatch workflow follows several architectural principles.

## Deterministic

Workflow execution must always produce identical results when replayed.

---

## Durable

State survives:

- Worker crashes
- Deployments
- Infrastructure failures
- Process termination

---

## Replayable

A workflow can always reconstruct its state from event history.

---

## Observable

Execution state is visible through Temporal Visibility APIs, metrics, logs, traces, and dashboards.

---

## Recoverable

Failures never silently disappear.

Activities retry automatically according to configured policies.

---

## Human-Aware

Automation never removes human oversight.

Human operators can:

- Pause execution
- Take ownership
- Resume workflows
- Override AI decisions
- Escalate incidents

---

# High-Level Runtime Architecture

```
                 Customer
                     │
                     ▼
               Email Provider
                     │
                     ▼
               Webhook Endpoint
                (apps/api)
                     │
                     ▼
            Temporal Client SDK
                     │
                     ▼
          Start Workflow Execution
                     │
                     ▼
              Temporal Cluster
          (Workflow Event History)
                     │
                     ▼
             Worker Task Queue
                     │
                     ▼
            RelayDispatch Worker
                     │
      ┌──────────────┼──────────────┐
      ▼              ▼              ▼
 Activities      Database      AI Providers
      │              │              │
      └──────────────┼──────────────┘
                     ▼
             Workflow Completion
```

---

# Repository Structure

The Workflow Engine is distributed across several modules.

```
apps/

└── worker/
    ├── src/
    │
    ├── dispatchWorkflow.ts
    │
    ├── worker.ts
    │
    ├── activities/
    │
    ├── shared.ts
    │
    ├── email.ts
    │
    ├── ai.ts
    │
    ├── jobs.ts
    │
    ├── org.ts
    │
    ├── threads.ts
    │
    ├── notifications.ts
    │
    └── security.ts
```

Each file owns a bounded business capability.

---

# Workflow Lifecycle

Every customer request progresses through a durable lifecycle.

```
Inbound Event

↓

Validation

↓

Organization Loading

↓

Security Checks

↓

PII Protection

↓

AI Classification

↓

CRM Processing

↓

Conversation Memory

↓

AI Response Generation

↓

Customer Notification

↓

Dispatch

↓

Completion
```

Each stage becomes part of Temporal's durable event history.

---

# Workflow Execution Model

Unlike REST APIs, workflows are not executed from start to finish in one uninterrupted process.

Execution follows an event-driven model.

```
Workflow Starts

↓

Schedule Activity

↓

Worker Executes Activity

↓

Result Recorded

↓

Workflow Resumes

↓

Next Activity

↓

Repeat

↓

Completed
```

Every transition is persisted.

If the worker crashes after Activity #8, execution resumes from Activity #9 rather than restarting the workflow.

---

# Core Workflow

RelayDispatch currently uses a primary orchestration workflow.

```
relayDispatchWorkflow()
```

Location:

```
apps/worker/src/dispatchWorkflow.ts
```

This workflow coordinates all business operations required to transform an inbound customer message into a completed dispatch.

The workflow itself intentionally contains minimal business logic.

Instead, it orchestrates Activities that encapsulate domain-specific behavior.

---

# Workflow Responsibilities

The workflow coordinates:

- Organization configuration
- Customer validation
- Security enforcement
- AI orchestration
- CRM synchronization
- Technician dispatch
- Notification delivery
- Workflow state management

The workflow should **never** become a "God Object."

Its responsibility is orchestration—not implementation.

---

# Workflow State Machine

Conceptually, every workflow transitions through several states.

```
Created

↓

Validated

↓

Receiving

↓

Redacted

↓

Classified

↓

Job Created

↓

Conversation Updated

↓

Reply Generated

↓

Reply Sent

↓

Dispatched

↓

Resolved

↓

Archived
```

Exceptional paths include:

```
Escalated

Cancelled

Timed Out

Failed

Human Takeover
```

These states are reflected both within Temporal execution history and application-level thread status where appropriate.

---

# Workflow vs Activity

One of the most important architectural concepts is understanding the distinction between Workflows and Activities.

| Workflow                            | Activity                |
| ----------------------------------- | ----------------------- |
| Durable                             | Executed externally     |
| Deterministic                       | May perform I/O         |
| Coordinates execution               | Performs work           |
| Never calls APIs directly           | May call any API        |
| Cannot access current time directly | Can access current time |
| Cannot generate randomness          | Can generate randomness |
| Cannot perform network I/O          | Can perform network I/O |
| Can replay safely                   | Results are persisted   |

This separation is the foundation of RelayDispatch's reliability model.

---

# Next Section

Part 2 covers:

- Complete execution pipeline
- Detailed activity architecture
- Activity decomposition
- Retry policies
- Timeouts
- Heartbeats
- Local vs Remote Activities
- Error handling
- Compensation patterns
- Idempotency architecture

Under Development...

# Workflow Execution Pipeline

The `relayDispatchWorkflow` coordinates every business operation from the moment a webhook is received until the workflow reaches a terminal state.

Although the workflow appears sequential, execution is actually event-driven and durable.

Each Activity completion generates an event that is persisted inside Temporal's Event History before the next step begins.

```
Webhook Received
        │
        ▼
Thread Validation
        │
        ▼
Organization Configuration
        │
        ▼
Email Retrieval
        │
        ▼
Emergency Detection
        │
        ▼
PII Redaction
        │
        ▼
Contact Synchronization
        │
        ▼
AI Classification
        │
        ▼
Job Creation
        │
        ▼
Conversation Memory Update
        │
        ▼
AI Dispatch Generation
        │
        ▼
Reply Delivery
        │
        ▼
CRM Synchronization
        │
        ▼
Thread Status Update
        │
        ▼
Workflow Complete
```

Every stage is isolated so failures can be retried independently.

---

# Activity Architecture

RelayDispatch follows Domain-Driven Design.

Activities are grouped by bounded context instead of technical concerns.

```
apps/
└── worker/
    └── activities/
        ├── ai.ts
        ├── email.ts
        ├── jobs.ts
        ├── notifications.ts
        ├── org.ts
        ├── security.ts
        ├── shared.ts
        ├── threads.ts
        └── index.ts
```

Each module owns one business capability.

This greatly reduces coupling while improving maintainability.

---

# Shared Activities

```
shared.ts
```

Shared activities provide reusable infrastructure functionality.

Responsibilities include:

- Supabase client initialization
- CRM client resolution
- Vault helpers
- Cryptographic helpers
- Idempotency reservation
- OpenTelemetry helpers
- Common validation
- Shared workflow utilities

Shared activities should never contain domain-specific business logic.

---

# Organization Activities

```
org.ts
```

Organization activities load runtime configuration.

Primary responsibilities include:

- Organization lookup
- Feature flags
- Dispatch mode
- Pricing configuration
- Timezone
- Business hours
- AI settings
- Compliance settings
- Provider configuration

These activities execute near the beginning of every workflow because downstream behavior depends on organization configuration.

---

# Email Activities

```
email.ts
```

Responsible for all email communication.

Functions include:

- Email retrieval
- MIME parsing
- Thread lookup
- HTML normalization
- Plain-text extraction
- Email sending
- Reply construction
- SMS escalation notifications

External providers remain isolated inside this module.

Supported providers include:

- Gmail
- Microsoft Graph
- Sandbox provider
- Future providers

---

# Security Activities

```
security.ts
```

Security activities execute before AI processing.

Responsibilities include:

- PII detection
- Placeholder generation
- Vault encryption
- Secure storage
- Placeholder mapping
- Rehydration preparation

No downstream AI component should ever receive raw personally identifiable information.

---

# AI Activities

```
ai.ts
```

This module coordinates every AI interaction.

Responsibilities include:

- Emergency detection
- Request classification
- Dispatcher execution
- Conversation compaction
- Cost accounting
- Confidence scoring
- Escalation decisions

Only AI orchestration belongs here.

Model implementations remain inside dedicated AI packages.

---

# Thread Activities

```
threads.ts
```

Responsible for conversation lifecycle management.

Functions include:

- Thread validation
- Contact synchronization
- Status transitions
- Metadata updates
- Conversation persistence
- Thread ownership
- Escalation tracking

---

# Job Activities

```
jobs.ts
```

Job-related business operations.

Responsibilities include:

- Job creation
- CRM synchronization
- Technician assignment
- Schedule updates
- Dispatch confirmation

CRM-specific implementation details remain inside integration packages.

---

# Notification Activities

```
notifications.ts
```

Responsible for non-email communication.

Examples include:

- Human escalation
- Internal alerts
- SMS
- Push notifications
- Future integrations

Keeping notifications isolated allows providers to evolve independently.

---

# Activity Execution Lifecycle

Each activity follows a consistent lifecycle.

```
Workflow

↓

Schedule Activity

↓

Task Queue

↓

Worker Polls

↓

Execute

↓

Success

↓

Record Result

↓

Resume Workflow
```

If execution fails:

```
Execute

↓

Failure

↓

Retry Policy

↓

Backoff

↓

Retry

↓

Success

↓

Resume Workflow
```

Failures never restart the workflow itself.

Only the failed activity is retried.

---

# Retry Policies

Every activity has its own retry configuration.

Typical configuration includes:

- Initial Interval
- Maximum Interval
- Backoff Coefficient
- Maximum Attempts
- Non-Retryable Errors

Example strategy:

| Setting          | Value      |
| ---------------- | ---------- |
| Initial Retry    | 1 second   |
| Backoff          | 2x         |
| Maximum Interval | 60 seconds |
| Maximum Attempts | 5          |

Critical external APIs may use longer retry windows.

---

# Retry Philosophy

Transient failures should retry automatically.

Examples include:

- Temporary network failures
- HTTP 429
- HTTP 503
- DNS resolution failures
- Connection resets
- Temporary database unavailability

Permanent failures should not retry.

Examples include:

- Invalid configuration
- Authentication failure
- Malformed requests
- Missing organization
- Invalid workflow input

Permanent failures immediately surface to the workflow.

---

# Timeouts

Temporal supports several timeout types.

RelayDispatch uses them conservatively.

## Schedule-To-Start

Maximum queue wait time.

Protects against unavailable workers.

---

## Start-To-Close

Maximum execution duration.

Protects against hung activities.

---

## Schedule-To-Close

Maximum total lifetime including retries.

Ensures workflows never retry forever.

---

## Heartbeat Timeout

Long-running activities periodically send heartbeat signals.

If heartbeats stop unexpectedly, Temporal assumes the worker has failed.

Heartbeats are especially useful for:

- Large imports
- CRM synchronization
- File uploads
- Batch operations

---

# Local Activities

Temporal supports Local Activities.

These execute inside the worker process without server round-trips.

Advantages:

- Lower latency
- Reduced event history
- Faster execution

Suitable for:

- Lightweight validation
- Small computations
- Formatting
- Serialization

Not suitable for:

- External APIs
- Database writes
- Long-running work
- Network I/O

RelayDispatch intentionally keeps most business operations as standard Activities because durability is preferred over microsecond performance gains.

---

# Error Classification

Errors are categorized into three groups.

## Recoverable

Examples:

- API timeout
- Temporary database outage
- Rate limiting

Action:

Automatic retry.

---

## Business Errors

Examples:

- Customer not found
- Organization disabled
- Invalid configuration

Action:

Workflow handles gracefully.

---

## Fatal Errors

Examples:

- Corrupted workflow state
- Determinism violation
- Invalid deployment

Action:

Workflow fails and requires operator intervention.

---

# Compensation Pattern

Not every workflow step can simply be retried.

Some operations require compensation.

Example:

```
CRM Job Created

↓

Email Failed

↓

Retry Email

↓

Still Failed

↓

Escalate Human

↓

Cancel CRM Job (optional)
```

Future versions may implement Saga-style compensating workflows for complex multi-provider transactions.

---

# Idempotency Architecture

Every side-effecting operation must be idempotent.

RelayDispatch stores execution markers inside:

```
completed_activity_keys
```

Typical keys include:

```
sendEmail:{threadId}:{turn}

dispatchJob:{threadId}

notifyHuman:{threadId}
```

Workflow retries first consult the idempotency store.

If an operation already completed successfully, the cached result is returned immediately instead of executing the operation again.

This guarantees exactly-once business effects even though activities may execute more than once internally.

---

# Activity Design Guidelines

Every new Activity should satisfy the following principles.

✓ Single responsibility

✓ Deterministic input

✓ Serializable parameters

✓ Explicit return type

✓ Structured logging

✓ OpenTelemetry instrumentation

✓ Safe retries

✓ Idempotent side effects

✓ Clear ownership

✓ Comprehensive error handling

Activities should remain independently testable without requiring the entire workflow runtime.

---

# Next Section

Part 3 covers:

- Signals
- Workflow Updates
- Queries
- Human takeover
- Continue-As-New
- Parent/Child Workflows
- Long-running conversations
- Versioning
- Worker Build IDs
- Deployment strategies
- Replay debugging
- Safe workflow evolution

```

# Signals

Temporal Signals allow external systems to communicate with a running workflow without restarting it.

Signals are asynchronous, durable, and recorded in Workflow History.

RelayDispatch uses Signals to support real-time operational control from the dashboard.

```

Dashboard

        │

        ▼

Temporal Client

        │

        ▼

Running Workflow

        │

        ├──────────────► Human Takeover

        ├──────────────► Customer Follow-up

        ├──────────────► Cancel Dispatch

        ├──────────────► Resume AI

        └──────────────► Force Resolve

Unlike Activities, Signals never return values.

They simply notify a running workflow that something has changed.

# Current Signals

## Human Takeover

```

humanTakeover

```

Transfers ownership from AI to a human dispatcher.

Effects include:

- Stops autonomous AI replies
- Prevents future automatic sends
- Notifies dashboard
- Updates thread ownership
- Records audit event

Typical use cases:

- Customer requests manager
- Low AI confidence
- High-value customer
- Legal concerns
- Escalation request

---

## Follow-up Message

```

addFollowUpMessage

```

Injects a newly received customer message into an active workflow.

Instead of creating another workflow, the existing conversation continues.

Benefits:

- Preserves context
- Maintains history
- Avoids duplicate workflows
- Reduces AI token usage

---

## Force Resolve

```

forceResolve

```

Terminates workflow after updating state.

Common scenarios:

- Duplicate thread
- Manual completion
- Spam detection
- Customer cancellation

---

# Recommended Future Signals

Although not currently implemented, the architecture intentionally supports additional Signals.

## Pause AI

```

pauseAiDispatch

```

Temporarily suspends AI decisions while keeping the workflow active.

---

## Resume AI

```

resumeAiDispatch

```

Re-enables autonomous execution after manual intervention.

---

## Priority Upgrade

```

increasePriority

```

Immediately increases urgency.

Useful for:

- VIP customers
- SLA breaches
- Critical failures

---

## Technician Assigned

```

technicianAssigned

```

Allows external scheduling software to notify the workflow after technician assignment.

---

## External Status Update

```

crmStatusChanged

```

Receives CRM updates.

Example:

```

Job Created

↓

Technician Assigned

↓

Technician En Route

↓

Completed

```

The workflow remains synchronized without polling.

---

# Queries

Queries retrieve workflow state without modifying execution.

Queries are read-only.

```

Dashboard

↓

Temporal Query

↓

Workflow Memory

↓

Current State

```

Unlike Signals, Queries never generate new workflow events.

---

# Existing Queries

## Status

```

getStatus

```

Returns workflow execution status.

Possible values:

```

new

fetching

redacting

classifying

dispatching

waiting

human_takeover

resolved

failed

```

These values power dashboard status indicators.

---

## Conversation Summary

```

getConversationSummary

```

Returns the Librarian-generated semantic summary.

Useful when:

- Dashboard loads thread
- Supervisor reviews conversation
- Human takeover occurs

---

# Recommended Future Queries

## Cost Report

```

getCostSummary

```

Returns:

- Prompt tokens
- Completion tokens
- Cost
- Model usage
- AI calls

---

## Current Agent

```

getActiveAgent

```

Returns:

```

Classifier

Dispatcher

Librarian

Waiting

Human

```

---

## Retry Status

```

getRetryState

```

Displays:

- Retry count
- Next retry
- Failure reason

Useful during incident response.

---

# Workflow Updates (Temporal Update API)

Modern versions of Temporal introduce Workflow Updates.

Unlike Signals:

Signals

- Fire-and-forget
- No return value

Updates

- Validated
- Await completion
- Return result
- Support rollback

RelayDispatch should gradually adopt Updates for operations requiring confirmation.

Examples:

```

Approve Dispatch

↓

Workflow validates

↓

CRM updated

↓

Return Success

```

Instead of relying on asynchronous Signals.

---

# Continue-As-New

Long-running workflows accumulate event history.

Eventually replay performance degrades.

Temporal solves this using:

```

Continue-As-New

```

Instead of ending:

```

Workflow

↓

10,000 Events

↓

Continue-As-New

↓

Fresh History

↓

Continue Processing

```

Conversation state is carried forward while history resets.

Benefits:

- Faster replay
- Smaller history
- Better scalability

Highly recommended for conversations lasting weeks or months.

---

# Long-Running Conversations

Customer conversations may span:

- Days
- Weeks
- Months

RelayDispatch separates:

Conversation memory

from

Workflow history.

```

Workflow History

↓

Continue-As-New

↓

Librarian Summary

↓

Workflow Continues

```

Only essential semantic context survives.

This prevents unlimited history growth.

---

# Parent and Child Workflows

Future releases may split responsibilities into Child Workflows.

Example:

```

Parent Workflow

│

├──────── Email Workflow

├──────── Dispatch Workflow

├──────── Billing Workflow

├──────── CRM Sync Workflow

└──────── Notification Workflow

```

Advantages:

- Smaller histories

- Better isolation

- Independent retries

- Easier ownership

- Horizontal scaling

---

# Dynamic Workflow Routing

Future enterprise deployments may route work dynamically.

Example:

```

New Email

↓

Classifier

↓

Emergency?

├──► Emergency Workflow

│

No

↓

Dispatch Workflow

↓

Commercial Customer?

├──► Enterprise Workflow

│

Residential?

├──► Residential Workflow

│

Warranty?

└──► Warranty Workflow

```

Temporal enables workflow composition without increasing complexity.

---

# Human-in-the-Loop Architecture

RelayDispatch intentionally supports Human-in-the-Loop (HITL) operations.

```

AI

↓

Confidence

↓

High?

│

├──► Auto Send

│

Low?

↓

Human Review

↓

Approve

↓

Continue Workflow

```

Advantages include:

- Regulatory compliance

- Better customer experience

- Reduced hallucination risk

- AI supervision

---

# Workflow State Machine

Conceptually, every workflow behaves like a finite state machine.

```

NEW

↓

FETCHING

↓

CLASSIFYING

↓

RESPONDING

↓

DISPATCHED

↓

RESOLVED

```

Exceptional transitions:

```

↓

ESCALATED

↓

FAILED

↓

WAITING_FOR_HUMAN

```

Keeping transitions explicit greatly simplifies debugging.

---

# Determinism

Workflow code must remain deterministic.

Allowed:

✓ Conditions

✓ Loops

✓ Pure calculations

✓ Signals

✓ Queries

✓ Workflow state

Forbidden:

✗ Date.now()

✗ Math.random()

✗ HTTP requests

✗ Database access

✗ File system

✗ Environment variables

✗ Process state

All external operations belong inside Activities.

---

# Versioning Workflows

Temporal preserves running workflow histories.

Changing workflow logic incorrectly can break replay.

RelayDispatch follows these rules:

- Never delete old workflow paths immediately

- Use `patched()` when changing execution order

- Keep compatibility until old workflows complete

- Deploy workers before removing compatibility paths

Every breaking workflow modification should include version markers.

---

# Worker Build IDs

Modern Temporal deployments support Worker Versioning.

Recommended deployment:

```

Worker v1

↓

Worker v2

↓

Gradual Traffic Shift

↓

Observe

↓

Complete Migration

```

Benefits:

- Zero downtime

- Safe rollback

- Mixed-version execution

- Incremental rollout

Large production deployments should enable Build IDs instead of replacing all workers simultaneously.

---

# Replay Debugging

One of Temporal's strongest capabilities is deterministic replay.

Replay allows engineers to reproduce production failures exactly.

Typical workflow:

```

Production Failure

↓

Download History

↓

Replay Locally

↓

Breakpoint

↓

Root Cause Analysis

```

No production database is required.

No production APIs are called.

Execution is completely deterministic.

---

# Workflow Observability

Every workflow should emit structured telemetry.

Recommended metrics include:

Workflow metrics

- Started

- Running

- Completed

- Failed

- Continued-As-New

Activity metrics

- Duration

- Success

- Failure

- Retry count

AI metrics

- Token usage

- Cost

- Latency

Infrastructure metrics

- Queue depth

- Worker utilization

- Poll latency

- Task failures

---

# Workflow Design Principles

Every RelayDispatch workflow follows several architectural principles.

✓ Durable

✓ Deterministic

✓ Observable

✓ Idempotent

✓ Retry-safe

✓ Horizontally scalable

✓ Human overridable

✓ Provider agnostic

✓ Cloud portable

✓ AI model independent

These principles allow the workflow engine to remain reliable while individual integrations evolve independently.

---

# Next Section

Part 4 will cover:

- Worker architecture
- Task Queues
- Worker scaling
- Temporal Cloud vs Self-Hosted
- Scheduler architecture
- Dead Letter Queue (DLQ)
- Disaster recovery
- Operational runbooks
- Production deployment patterns
- Performance tuning
- High availability
- Multi-region considerations
- Future roadmap

# Failure Recovery & Resiliency

RelayDispatch is designed around **failure as an expected operating condition**, not an exceptional event. The workflow engine leverages Temporal's durable execution model to recover automatically from process crashes, infrastructure interruptions, and transient service failures without losing business state.

---

## Retry Strategy

Activities are categorized according to their failure characteristics.

| Activity Type          | Examples                               | Retry Policy             |
| ---------------------- | -------------------------------------- | ------------------------ |
| Network Operations     | CRM, Email Provider, OpenRouter        | Exponential Backoff      |
| Database Operations    | Reads, Writes, Upserts                 | Automatic Retry          |
| AI Inference           | Classification, Dispatcher             | Retry with Budget Limits |
| Internal Validation    | Schema Validation                      | No Retry                 |
| Business Rule Failures | Missing Pricing, Invalid Configuration | Human Escalation         |

Typical retry configuration:

```text
Initial Interval : 1 second
Backoff Coefficient : 2.0
Maximum Interval : 60 seconds
Maximum Attempts : Configurable
```

---

## Non-Retryable Failures

Some failures indicate invalid business state rather than temporary infrastructure problems.

Examples include:

- Missing organization configuration
- Invalid workflow input
- Deleted conversation thread
- Failed schema validation
- Invalid authentication
- Policy violations
- Unsupported provider configuration

These failures terminate immediately and generate structured audit events.

---

## Dead Letter Queue (DLQ)

Activities that cannot complete after their retry policy expires are transferred to the Dead Letter Queue.

```
Workflow
      │
      ▼
Activity Failure
      │
      ▼
Automatic Retries
      │
      ▼
Retry Limit Reached
      │
      ▼
Dead Letter Queue
      │
      ▼
Scheduler Replay Worker
      │
      ├── Success → Workflow Continues
      │
      └── Permanent Failure
              │
              ▼
Human Investigation
```

The replay worker operates independently from the workflow worker and safely retries failed webhook deliveries after infrastructure outages have been resolved.

---

# Human-in-the-Loop Operations

AI automation is intentionally designed to allow human intervention at any point.

## Human Takeover

When requested:

```
Dashboard
      │
      ▼
Temporal Signal
      │
      ▼
Workflow State Updated
      │
      ▼
AI Stops Sending Responses
      │
      ▼
Human Dispatcher Continues
```

Conversation history remains intact.

No workflow restart is required.

---

## Shadow Mode

Organizations operating in regulated environments may require human approval before every outbound response.

```
Customer Email
        │
        ▼
AI Generates Draft
        │
        ▼
Dashboard Review
        │
   Approve / Edit / Reject
        │
        ▼
Customer Receives Reply
```

Benefits include:

- compliance review
- pricing verification
- legal approval
- operator confidence
- AI quality monitoring

---

# Workflow Versioning

Temporal workflows are long-running.

Workflow definitions must evolve without breaking already executing workflows.

RelayDispatch follows Temporal's recommended versioning model.

When introducing behavioral changes:

- preserve existing workflow history
- use workflow patching
- maintain backward compatibility
- avoid replay-breaking changes

Once deployed:

- Patch IDs are permanent.
- Old branches should never be removed until all historical workflows have completed.

---

# Performance Considerations

## Horizontal Scaling

Every worker instance is stateless.

```
                    Task Queue
                         │
        ┌────────────────┼────────────────┐
        ▼                ▼                ▼
   Worker A         Worker B         Worker C
```

Workers automatically compete for available activities.

Adding additional workers increases throughput without code changes.

---

## Activity Parallelization

Independent activities may execute concurrently where business rules permit.

Examples include:

```
Fetch Organization
        │
        ├──────────────┐
        ▼              ▼
Fetch Pricing     Fetch Technicians
        │              │
        └──────┬───────┘
               ▼
         Dispatcher Agent
```

Parallel execution minimizes workflow latency.

---

## Workflow History Management

Temporal stores complete execution history.

To prevent excessive history growth:

- conversation compaction
- semantic summarization
- archival policies
- workflow continuation (Continue-As-New where appropriate)

Large histories negatively impact replay performance and should be periodically compacted.

---

# Observability Architecture

RelayDispatch embraces modern observability based on OpenTelemetry.

Telemetry consists of four primary pillars.

---

## Metrics

Examples include:

- workflow executions
- workflow duration
- activity latency
- retry counts
- AI token usage
- AI costs
- webhook failures
- DLQ depth
- queue latency
- worker utilization

---

## Logs

Structured JSON logging includes:

- workflow identifiers
- organization identifiers
- activity execution
- retry attempts
- AI provider
- execution duration
- correlation IDs
- trace IDs

Sensitive information is never logged.

---

## Traces

Distributed tracing spans:

```
Webhook
     │
     ▼
API
     │
     ▼
Temporal Workflow
     │
     ▼
Activities
     │
     ▼
Database
     │
     ▼
External Providers
```

This enables complete end-to-end latency analysis.

---

## Audit Events

Security-sensitive actions generate immutable audit events.

Examples:

- AI escalation
- authentication
- human takeover
- workflow cancellation
- provider failures
- policy violations
- administrative actions

---

# Disaster Recovery

Recommended production deployment should support:

- automated database backups
- encrypted backup storage
- Temporal persistence backup
- infrastructure-as-code
- immutable deployments
- rollback procedures
- health monitoring
- multi-zone deployment where possible

Recovery objectives should be defined by each deployment.

---

# Future Workflow Roadmap

The workflow engine has been intentionally designed to support additional capabilities without architectural rewrites.

Potential future workflow extensions include:

## Multi-Channel Intake

Current:

```
Email
```

Future:

```
Email
SMS
Voice
WhatsApp
Web Chat
Customer Portal
Slack
Microsoft Teams
MCP Clients
```

---

## Multi-Agent Expansion

Current architecture:

```
Classifier
        │
Dispatcher
        │
Librarian
```

Future:

```
Intent Agent
        │
Policy Agent
        │
Planner
        │
Dispatcher
        │
Scheduler
        │
Knowledge Agent
        │
QA Agent
```

---

## Autonomous Scheduling

Future scheduling workflows may include:

- technician optimization
- travel optimization
- calendar conflict resolution
- SLA optimization
- dynamic pricing
- emergency prioritization
- predictive dispatch

---

## AI Safety Enhancements

Potential future additions include:

- retrieval verification
- confidence calibration
- reasoning evaluation
- automatic hallucination detection
- policy enforcement models
- constitutional prompting
- multi-model consensus
- semantic anomaly detection

---

# Related Documentation

- `ARCHITECTURE.md`
- `AI_GUIDE.md`
- `DATABASE.md`
- `DEVELOPER_GUIDE.md`
- `SECURITY.md`
- `SELF_HOSTING.md`

---

# Summary

RelayDispatch's workflow engine is built around **Temporal Durable Execution**, enabling reliable AI-powered dispatch automation while preserving correctness, auditability, and operational resilience.

Core architectural principles include:

- Durable execution
- Deterministic workflows
- Idempotent activities
- Human-in-the-loop control
- Provider abstraction
- Secure AI orchestration
- End-to-end observability
- Fault tolerance by design
- Horizontally scalable workers
- Production-ready operational model
