# EPIC-008: Agent Layer

Status: Proposed

Primary phase: Phase 5, Agent Platform

## Mission

Make NomNomGo assistant-native.

## User Outcome

Users and groups can let AI assistants reduce coordination work while preserving clear human control over invitations, decisions, reservations, and spending.

## Stories

| ID | Story | Priority | Acceptance Signal |
| --- | --- | --- | --- |
| AL-001 | As a user, I want an AI planning assistant so I can turn rough intent into a structured plan. | Later | The assistant can draft title, timing, area, constraints, and candidate suggestions. |
| AL-002 | As a group, we want a coordination assistant so open questions and next actions are clear. | Later | The assistant can summarize status, missing votes, conflicts, and next steps. |
| AL-003 | As a business, I want a venue negotiation assistant so requests can be handled efficiently. | Later | Business-side assistant workflows require approval and audit trails. |
| AL-004 | As an external assistant, I want integrations so I can draft or update plans through approved APIs. | Later | API scopes allow controlled create, read, update, and suggestion actions. |
| AL-005 | As a developer, I want shared planning APIs so agents use stable contracts. | Later | Planning resources have documented API contracts and permission scopes. |
| AL-006 | As a user, I want agent permissions so I know what an assistant can do. | Later | Users can review, approve, revoke, and audit agent access. |
| AL-007 | As a user, I want approval checkpoints so agents cannot finalize important actions silently. | Later | Invites, locked plans, reservations, purchases, and business contact require confirmation. |

## Technical Backlog

- Assistant UX entry points.
- Planning context summarization.
- Tool/API contract for planning sessions.
- Agent identity and permissions.
- Approval workflow.
- Agent audit log.
- Prompt and model safety evaluation.
- Integration documentation.

## Definition Of Done

- Agents can draft or assist, but humans decide.
- Agent actions are explainable, reversible where possible, and auditable.
- APIs preserve NomNomGo independence and do not depend on hidden browser workflows.

## Metrics

- Assistant draft to plan creation rate.
- Agent suggestion acceptance rate.
- Human approval rate.
- Agent action rollback or correction rate.
- External integration usage.
