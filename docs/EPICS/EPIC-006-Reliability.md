# EPIC-006: Reliability

Status: Proposed

Primary phase: Phase 1 through Phase 5

## Mission

Operate like a production platform.

This should be one of the first completed epics because planning is a trust product. Broken invites, missing votes, failed locks, or invisible access errors directly damage the core user promise.

## User Outcome

Users can rely on NomNomGo during time-sensitive planning moments, and the team can detect, diagnose, and recover from failures quickly.

## Stories

| ID | Story | Priority | Acceptance Signal |
| --- | --- | --- | --- |
| RL-001 | As an operator, I want error logging so failures are visible. | Now | Client and server errors are captured with actionable context and no secrets. |
| RL-002 | As an operator, I want monitoring so availability and performance are visible. | Now | Core routes, APIs, and planning flows have health indicators. |
| RL-003 | As an operator, I want rate limiting so abuse and runaway usage are controlled. | Now | Sensitive endpoints have rate limits and clear failure behavior. |
| RL-004 | As a user, I want abuse detection so invites and social features stay safe. | Next | Suspicious invitation, friend request, and spam patterns can be detected or limited. |
| RL-005 | As an operator, I want audit trails so important actions can be investigated. | Next | Plan lock, invite, auth, admin, and agent actions are auditable. |
| RL-006 | As an operator, I want a backup strategy so product data can be recovered. | Next | Data backup and restore expectations are documented and tested. |
| RL-007 | As an operator, I want incident dashboards so production issues have a single view. | Later | Critical app health and planning funnel health are visible in one place. |
| RL-008 | As a developer, I want graceful degradation so provider failures do not break plans. | Now | Provider errors show usable fallback states. |

## Technical Backlog

- Error boundary and client logging.
- Server/API error logging.
- Health checks.
- Rate limits on alpha launch, auth, invite, vote, and provider proxy endpoints.
- Structured logs with redaction.
- Audit event model.
- Backup and restore runbook.
- Incident checklist.
- Provider timeout and retry behavior.

## Definition Of Done

- Core planning failures can be observed without user reports being the first signal.
- Logs do not print secrets or environment values.
- Provider or network failures show controlled UI states.
- Manual verification covers error states for invite, recommendation, vote, and lock flows.

## Metrics

- Error-free session rate.
- Invite failure rate.
- Vote failure rate.
- Lock failure rate.
- Provider timeout rate.
- Mean time to detect critical incidents.
- Mean time to recover from critical incidents.
