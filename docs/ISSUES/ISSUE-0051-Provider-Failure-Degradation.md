# ISSUE-0051: Provider Failure Degradation

- Title: Provider Failure Degradation
- Epic: EPIC-006 Reliability
- Priority: P0
- MVP: Yes
- Milestone: M1 - Local MVP
- Story ID: RL-008

## User Story

As a developer, I want graceful degradation so provider failures do not break plans.

## Description

Make provider errors visible and recoverable while preserving manual planning behavior.

## Acceptance Criteria

- Recommendation provider timeouts or errors show controlled UI states.
- Manual suggestions remain available when provider calls fail.
- Provider failures are logged with redaction.
- Retry or fallback behavior is documented.

## Technical Notes

- Use provider timeouts and normalized error types.
- Do not expose provider credentials or raw error payloads to users.

## Dependencies

- ISSUE-0020
- ISSUE-0027
- ISSUE-0044

## Future Considerations

- Server-side provider proxy work should centralize provider failure handling.
