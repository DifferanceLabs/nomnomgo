# ISSUE-0063: Shared Planning API Docs

- Title: Shared Planning API Docs
- Epic: EPIC-008 Agent Layer
- Priority: P3
- MVP: No
- Milestone: M7 - Agent Platform
- Story ID: AL-005

## User Story

As a developer, I want shared planning APIs so agents use stable contracts.

## Description

Document planning API resources, scopes, permission expectations, and audit behavior for future agent access.

## Acceptance Criteria

- API docs cover planning sessions, participants, suggestions, votes, and locks.
- Docs identify which actions require human approval.
- Error responses and rate limits are documented.
- API docs preserve NomNomGo independence from Differance Labs infrastructure.

## Technical Notes

- Build on internal API contracts before externalizing them.
- Include examples but no secret values.

## Dependencies

- ISSUE-0039
- ISSUE-0048

## Future Considerations

- API versioning and SDKs can follow once external integrations are active.
