# Support

> **RelayDispatch is more than an open-source repository—it is a community-driven platform.**
>
> Whether you discover a bug, have an architectural improvement, want to build a new integration, or simply have an ambitious idea that could improve field service automation, we'd love to hear from you.
>
> Community collaboration is one of the primary goals of this project.

---

# Welcome

Thank you for using RelayDispatch.

Whether you're:

- deploying RelayDispatch for your own business,
- evaluating the architecture,
- building a new integration,
- improving documentation,
- researching AI workflows,
- contributing code,
- fixing bugs,
- proposing new features,

you are an important part of this project's future.

Open-source software improves because of community collaboration—not only through code contributions, but also through discussions, reviews, research, testing, documentation, and new ideas.

Every contribution matters.

---

# Community Philosophy

RelayDispatch follows several community principles.

## Open Collaboration

Everyone is welcome to participate.

You do not need to be an experienced engineer to contribute.

Documentation improvements, design feedback, testing, translations, and architectural discussions are all valuable contributions.

---

## Respectful Communication

Constructive discussion produces better software.

Please assume good intentions, remain respectful, and focus discussions on solving problems rather than winning arguments.

See:

- `CODE_OF_CONDUCT.md`

for community expectations.

---

## Transparency

Major architectural decisions should be discussed publicly whenever possible.

Feature discussions, design proposals, and roadmap planning are encouraged through GitHub Discussions before implementation.

---

## Long-Term Maintainability

RelayDispatch prioritizes:

- clean architecture
- modular design
- maintainability
- security
- reliability
- documentation
- production readiness

Rather than implementing every requested feature immediately, proposals are evaluated according to long-term project goals.

---

# Before Requesting Support

Many questions are already answered in the documentation.

Please check the following resources first.

| Document             | Purpose              |
| -------------------- | -------------------- |
| `README.md`          | Project overview     |
| `SELF_HOSTING.md`    | Deployment           |
| `DEVELOPER_GUIDE.md` | Local development    |
| `ARCHITECTURE.md`    | System architecture  |
| `WORKFLOW_ENGINE.md` | Temporal workflows   |
| `AI_GUIDE.md`        | AI subsystem         |
| `DATABASE.md`        | Database reference   |
| `SECURITY.md`        | Security policies    |
| `CONTRIBUTING.md`    | Contribution process |

Searching existing GitHub Issues and Discussions before opening a new request helps reduce duplicate work.

---

# Support Channels

Different questions belong in different places.

| Topic                    | Recommended Channel                      |
| ------------------------ | ---------------------------------------- |
| Bug reports              | GitHub Issues                            |
| Feature requests         | GitHub Discussions                       |
| Architecture proposals   | GitHub Discussions                       |
| Questions                | GitHub Discussions (Q&A)                 |
| Documentation            | Pull Request or Discussion               |
| Security vulnerabilities | Private disclosure (see `SECURITY.md`)   |
| Large design proposals   | GitHub Discussions before implementation |

Using the appropriate channel helps maintainers respond more efficiently.

---

# Community Discussions

GitHub Discussions serve as the project's primary collaboration hub.

Examples include:

- deployment questions
- architectural discussions
- design reviews
- roadmap suggestions
- showcase projects
- implementation ideas
- AI research
- provider integrations
- workflow improvements
- operational experiences
- benchmarking

Discussions are intentionally broader than GitHub Issues.

Issues track work.

Discussions explore ideas.

---

# Asking Good Questions

When requesting help, please include as much context as possible.

Helpful information includes:

- RelayDispatch version
- operating system
- Node.js version
- deployment method
- provider configuration
- relevant logs
- reproduction steps
- screenshots
- expected behavior
- actual behavior

Avoid sharing:

- API keys
- access tokens
- customer data
- personally identifiable information
- secrets
- production credentials

If necessary, replace sensitive information with placeholders.

Example:

```
OPENROUTER_API_KEY=********
SUPABASE_SERVICE_ROLE_KEY=********
```

instead of posting actual credentials.

---

# Reporting Bugs

Reliable bug reports help improve RelayDispatch for everyone.

Before opening a new issue:

- Search existing GitHub Issues.
- Search GitHub Discussions.
- Verify you're using the latest supported release.
- Check whether the behavior is expected according to the documentation.

If the issue already exists, consider adding additional information instead of opening a duplicate.

---

## What Makes a Great Bug Report?

Please include:

### Environment

- RelayDispatch version
- Operating System
- Node.js version
- Database version
- Browser (if applicable)
- Deployment type
  - Docker
  - Kubernetes
  - Self-hosted
  - Cloud VM
  - Development

---

### Steps to Reproduce

Provide a deterministic sequence whenever possible.

Example:

```
1. Login
2. Connect Gmail
3. Receive customer email
4. AI begins classification
5. Worker crashes
```

---

### Expected Behavior

Describe what should have happened.

---

### Actual Behavior

Describe what actually happened.

---

### Supporting Information

Helpful information includes:

- Logs
- Screenshots
- Error messages
- Stack traces
- Workflow IDs
- Correlation IDs
- Trace IDs

Please remove:

- secrets
- API keys
- tokens
- passwords
- customer PII

before posting publicly.

---

## Reproducibility

Issues that include reproducible examples are significantly easier to investigate.

Whenever possible include:

- sample payloads
- configuration
- workflow history
- failing requests
- mocked datasets

The easier it is to reproduce the issue, the faster it can usually be resolved.

---

# Feature Requests

RelayDispatch is actively evolving.

Feature requests are encouraged.

Before submitting one, consider:

- Does it solve a real-world operational problem?
- Would multiple organizations benefit?
- Does it align with RelayDispatch's architecture?
- Can it remain optional instead of mandatory?

The strongest feature requests explain:

- current limitation
- desired outcome
- business value
- implementation ideas (optional)

---

## Helpful Feature Request Template

Consider including:

```
Problem

↓

Current Workflow

↓

Desired Workflow

↓

Benefits

↓

Possible Implementation
```

This helps maintainers understand the motivation behind the request rather than only the proposed solution.

---

# Enhancement Proposals

Not every contribution is a brand-new feature.

Many valuable contributions improve existing functionality.

Examples include:

- performance optimizations
- better error handling
- cleaner architecture
- improved observability
- accessibility improvements
- deployment simplification
- testing improvements
- documentation updates
- developer experience
- monitoring improvements

Small enhancements often produce significant long-term benefits.

---

# Expansion Ideas

One of RelayDispatch's long-term goals is to become a flexible automation platform for field service businesses.

If you have ideas that expand the platform, we'd genuinely like to hear them.

Examples include:

## New CRM Integrations

- ServiceTitan
- Housecall Pro
- Salesforce
- HubSpot
- Zoho CRM
- Microsoft Dynamics
- Custom ERP systems

---

## Additional Communication Channels

Examples:

- SMS
- WhatsApp
- RCS
- Apple Messages
- Slack
- Microsoft Teams
- Discord
- Live Chat
- Voice Assistants

---

## AI Improvements

Ideas may include:

- better prompts
- reasoning improvements
- evaluation frameworks
- guardrails
- hallucination reduction
- model routing
- multi-model orchestration
- cost optimization
- offline inference
- local models

---

## Workflow Improvements

Suggestions may involve:

- scheduling
- dispatch optimization
- technician routing
- SLA automation
- calendar synchronization
- predictive maintenance
- inventory workflows
- billing automation

Even if an idea is outside the current roadmap, discussing it publicly helps shape future versions of RelayDispatch.

---

# Architecture Discussions

Large architectural changes should begin as discussions rather than pull requests.

Examples include:

- package restructuring
- workflow redesign
- database schema evolution
- API versioning
- plugin systems
- event-driven architecture
- distributed deployments
- authentication redesign

Early discussion reduces duplicated work and often produces stronger solutions through community feedback.

---

# AI & Prompt Improvements

RelayDispatch includes multiple AI agents.

Community expertise is especially valuable in areas such as:

- prompt engineering
- evaluation benchmarks
- model comparisons
- retrieval strategies
- context management
- memory optimization
- token efficiency
- safety improvements
- structured outputs
- confidence scoring
- routing policies

We welcome research-backed improvements and practical production experience from the community.

---

# Research Contributions

Academic and industry research can directly influence future releases.

Interesting topics include:

- Agentic AI
- Temporal workflows
- AI orchestration
- Multi-agent systems
- Human-in-the-loop systems
- AI safety
- Prompt injection defense
- LLM benchmarking
- Field service optimization
- Scheduling algorithms
- Operational AI

Research papers, benchmarks, and experimental prototypes are all welcome discussion topics.

---

# Documentation Contributions

Excellent documentation is one of the most valuable contributions to any open-source project.

Documentation improvements include:

- tutorials
- diagrams
- API references
- deployment guides
- troubleshooting
- translations
- architecture explanations
- code examples
- migration guides
- FAQs

You don't need to write code to make RelayDispatch better.

Improving documentation helps every future contributor.

---

# Contributing Beyond Code

Open-source communities thrive because contributors bring diverse skills.

You do **not** need to write code to make RelayDispatch better.

Valuable contributions include:

- Technical writing
- UI/UX improvements
- Documentation
- Accessibility improvements
- Internationalization (i18n)
- Testing
- Security reviews
- Infrastructure recommendations
- AI benchmarking
- Performance profiling
- Architecture reviews
- Community moderation
- Example projects
- Educational content
- Conference talks
- Video tutorials

Every contribution strengthens the ecosystem.

---

# Plugin & Integration Proposals

RelayDispatch is designed around modular packages and provider abstraction.

If you'd like to build a new integration, start a GitHub Discussion before implementation.

Examples include:

## CRM

- ServiceTitan
- Housecall Pro
- Salesforce
- HubSpot
- Zoho CRM
- Dynamics 365

---

## Email

- Fastmail
- Proton Mail
- Zoho Mail
- Amazon SES
- Custom IMAP providers

---

## Telephony

- Twilio
- Vonage
- Plivo
- Amazon Connect
- RingCentral

---

## AI Providers

RelayDispatch intentionally supports provider-agnostic AI routing.

Ideas include:

- Additional OpenRouter routing strategies
- Local LLM deployments
- Enterprise inference gateways
- Air-gapped inference
- Hybrid routing
- Cost-aware routing
- Latency-aware routing
- Multi-model consensus

---

## Infrastructure

Potential integrations include:

- Redis
- Kafka
- RabbitMQ
- NATS
- AWS
- Azure
- Google Cloud
- Kubernetes Operators

---

# Becoming a Long-Term Contributor

Many successful maintainers began by fixing a typo.

A typical contributor journey looks like this:

```
Documentation

↓

Small Bug Fix

↓

Feature Improvement

↓

Package Ownership

↓

Trusted Reviewer

↓

Maintainer
```

There is no minimum contribution size.

Consistency matters more than volume.

---

# Good First Contributions

If you're new to RelayDispatch, consider starting with:

- Documentation improvements
- Typographical fixes
- Unit tests
- Error messages
- Developer tooling
- Examples
- Tutorials
- Missing comments
- Small refactors
- New diagrams

These are excellent ways to become familiar with the codebase.

---

# Code Reviews

Every Pull Request is reviewed before merging.

Reviews focus on:

- correctness
- maintainability
- readability
- testing
- documentation
- security
- architectural consistency

Review feedback is intended to improve the project—not criticize contributors.

Healthy technical discussion is encouraged.

---

# Pull Request Expectations

Well-prepared Pull Requests generally include:

✓ Clear description

✓ Linked issue or discussion

✓ Tests

✓ Updated documentation

✓ Passing CI

✓ No unrelated changes

✓ Meaningful commit history

Smaller focused PRs are usually reviewed much faster than large monolithic changes.

---

# Community Recognition

RelayDispatch appreciates every contributor.

Contributors may be recognized through:

- GitHub contributor graphs
- Release notes
- Documentation acknowledgements
- Community showcases
- Special project mentions

Meaningful contributions are not measured only by lines of code.

Documentation, research, reviews, testing, and thoughtful discussions all deserve recognition.

---

# Maintainer Response Expectations

While maintainers are volunteers, we strive to respond as quickly as practical.

Typical goals are:

| Request Type        | Target Response                               |
| ------------------- | --------------------------------------------- |
| Security Reports    | Within 48 hours                               |
| Critical Bugs       | As soon as practical                          |
| General Bugs        | Several business days                         |
| Feature Discussions | Ongoing community discussion                  |
| Pull Requests       | Based on complexity and reviewer availability |

These targets are goals rather than guaranteed service-level agreements.

---

# Communication Guidelines

Please help keep discussions productive.

We encourage:

- curiosity
- patience
- constructive feedback
- evidence-based discussions
- respectful disagreement
- collaborative problem solving

We discourage:

- personal attacks
- harassment
- inflammatory language
- repeated duplicate requests
- demands for unpaid support
- intentionally disruptive behavior

See `CODE_OF_CONDUCT.md` for the complete community standards.

---

# Commercial Support

RelayDispatch itself is released as open-source software.

The project maintainers do not currently provide guaranteed commercial support.

Organizations deploying RelayDispatch in production are responsible for:

- operating their own infrastructure
- backups
- monitoring
- compliance
- security operations
- maintenance

Third-party companies or consultants may choose to offer commercial services built around RelayDispatch independently.

---

# Roadmap Discussions

Community feedback plays a significant role in shaping future releases.

Roadmap discussions are welcome for topics such as:

- new providers
- workflow improvements
- AI capabilities
- scheduling algorithms
- reporting
- observability
- plugin architecture
- enterprise deployments
- mobile applications
- field technician experiences

Well-researched proposals with clear use cases are especially valuable.

---

# Frequently Asked Questions

## Can I suggest features?

Absolutely.

Feature proposals are encouraged through GitHub Discussions.

---

## Can I contribute documentation only?

Yes.

Documentation is one of the most valuable forms of contribution.

---

## Can I build commercial software using RelayDispatch?

Please refer to the project's LICENSE and contributor agreements for licensing terms.

---

## Can I create plugins?

Yes.

Provider integrations and optional packages are encouraged whenever they align with the project's architecture.

---

## I'm unsure where my question belongs.

If you're uncertain:

- use GitHub Discussions first
- maintainers or community members can help direct you to the appropriate place

---

# Thank You

Every bug report, pull request, idea, documentation improvement, discussion, benchmark, architectural proposal, and security review helps make RelayDispatch better.

Whether your contribution is one line or one thousand, your time and expertise are genuinely appreciated.

We look forward to building the future of AI-powered field service automation together.

Happy building!
