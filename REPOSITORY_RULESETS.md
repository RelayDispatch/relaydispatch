# Repository Rulesets Configuration

This document defines the recommended **GitHub Repository Rulesets** configuration for RelayDispatch.

GitHub Rulesets are the modern replacement for traditional Branch Protection Rules and provide layered, auditable repository governance.

> Repository:
> https://github.com/RelayDispatch/relaydispatch

> Last Reviewed:
> 2026-07-10

---

# Purpose

The goals of these rules are to:

- Protect the default branch from accidental or malicious changes
- Ensure every contribution is reviewed
- Prevent insecure or untested code from being merged
- Preserve a clean, linear Git history
- Enforce RelayDispatch's engineering and security standards
- Provide a scalable governance model for future maintainers

---

# Ruleset Information

## Name

Protect Main Branch

## Target

Branches

Pattern:

```
main
```

## Enforcement

Active

## Bypass List

Only:

- Repository Administrators

Do not grant bypass permissions to contributors or maintainers unless absolutely necessary.

---

# Branch Rules

## Restrict Creations

Disabled

Reason:

Developers must be able to create feature branches normally.

---

## Restrict Updates

Disabled

Reason:

Updates are controlled through Pull Requests rather than direct push restrictions.

---

## Restrict Deletions

Enabled

Reason:

The default branch must never be accidentally deleted.

---

## Block Force Pushes

Enabled

Reason:

Force pushes rewrite Git history and can permanently remove reviewed commits.

---

## Require Linear History

Enabled

Reason:

RelayDispatch uses a linear Git history.

Allowed merge strategies:

- Squash Merge
- Rebase Merge

Merge commits should remain disabled.

---

## Require Signed Commits

Disabled (v1.0)

Reason:

Commit signing is encouraged but not mandatory for the initial open-source release.

This should be reconsidered after the maintainer community matures.

---

## Require Merge Queue

Disabled

Reason:

Merge Queue is intended for repositories with high pull request throughput.

Revisit after:

- 10+ active maintainers
- Frequent concurrent PRs

---

## Require Deployments

Disabled

Reason:

RelayDispatch does not currently require deployment gates before merge.

This may be enabled once staging and production deployment environments are introduced.

---

# Pull Request Requirements

Enable:

✓ Require a pull request before merging

Configure:

## Required Approvals

1

Reason:

Every code change must receive human review.

---

## Require Review from CODEOWNERS

Enabled

Reason:

The CODEOWNERS file becomes an enforced governance mechanism instead of documentation only.

---

## Dismiss Stale Reviews

Enabled

Reason:

Any new commit invalidates previous approvals and requires fresh review.

---

## Require Approval of the Most Recent Push

Enabled

Reason:

Prevents unreviewed commits from being merged after approval.

---

## Require Conversation Resolution

Enabled

Reason:

Every review discussion must be resolved before merge.

---

## Restrict Review Dismissal

Repository Administrators

Reason:

Review dismissals should be limited to repository administrators.

---

# Status Checks

## During Initial Repository Setup

GitHub does not allow an empty list of required status checks.

Therefore:

1. Leave this rule disabled initially.
2. Push the repository.
3. Allow GitHub Actions to execute once.
4. Return to Repository Rulesets.
5. Enable this rule.
6. Select all production-quality checks.

---

## Required Status Checks

After the first successful workflow execution, require the following checks:

| Check                           | Required |
| ------------------------------- | -------- |
| Quality Gate (TypeCheck + Lint) | ✅       |
| Test Suite                      | ✅       |
| Production Build                | ✅       |
| Dependency Review               | ✅       |
| CodeQL                          | ✅       |
| Secret Detection (Gitleaks)     | ✅       |

Enable:

✓ Require branches to be up to date before merging

Do not require:

- Docker Build
- Release Workflow
- Nightly Workflow
- Scheduled Security Jobs

These workflows do not execute on every Pull Request.

---

# Code Scanning

Status:

Disabled for initial release.

Enable after:

- CodeQL has completed at least one successful analysis.
- Baseline alerts have been triaged.

Recommended threshold:

High

Block merges on:

- Critical
- High

Warn on:

- Medium
- Low

---

# Code Quality

Status:

Disabled

Enable after GitHub Code Quality analysis becomes part of the CI pipeline.

---

# Code Coverage

Status:

Disabled

Reason:

Current coverage thresholds are intentionally permissive.

Enable after the project reaches stable coverage goals.

Suggested targets:

- Statements ≥ 60%
- Branches ≥ 70%
- Functions ≥ 70%
- Lines ≥ 60%

---

# Merge Strategy

Repository Settings → General

Configure:

| Setting                            | Value    |
| ---------------------------------- | -------- |
| Default Branch                     | main     |
| Allow Merge Commits                | Disabled |
| Allow Squash Merge                 | Enabled  |
| Allow Rebase Merge                 | Enabled  |
| Automatically Delete Head Branches | Enabled  |

Default squash commit message:

```
Pull Request Title + Description
```

---

# CODEOWNERS

CODEOWNERS review should be mandatory.

Repository configuration must include:

```
Require Review from CODEOWNERS
```

without exceptions.

---

# Security

Enable:

- Private Vulnerability Reporting
- Dependency Graph
- Dependabot Alerts
- Dependabot Security Updates
- Grouped Security Updates
- CodeQL
- Secret Scanning
- Copilot Autofix (optional)

Do not enable:

- Automatic Version Update PRs

Normal dependency upgrades should remain deliberate engineering decisions.

---

# GitHub Actions

Recommended Organization Settings

Actions:

Allow all actions and reusable workflows.

Workflow Permissions:

Read and Write

Fork Pull Requests:

Require approval for all external contributors.

Artifact Retention:

30 days

---

# Future Improvements

Revisit these settings after the project grows:

- Required Signed Commits
- Merge Queue
- Required Deployments
- Code Coverage Enforcement
- GitHub Code Quality Enforcement
- Push Rulesets
- Organization-wide Rulesets

---

# Review Schedule

Review this document:

- Before every major release
- After major GitHub platform updates
- When repository governance changes
- When CI/CD workflows change
- When CODEOWNERS changes

---

# References

- GitHub Rulesets Documentation
- GitHub Repository Rules
- GitHub CODEOWNERS Documentation
- RelayDispatch GOVERNANCE.md
- RelayDispatch CONTRIBUTING.md
- RelayDispatch CODEOWNERS
