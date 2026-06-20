# ISSUE-0044: Error Logging

- Title: Error Logging
- Epic: EPIC-006 Reliability
- Priority: P0
- MVP: Yes
- Milestone: M1 - Local MVP
- Story ID: RL-001

## User Story

As an operator, I want error logging so failures are visible.

## Description

Capture client and server errors from core planning flows with enough context to debug failures without exposing secrets.

## Acceptance Criteria

- Client-side planning errors are captured or surfaced consistently.
- Server/API errors include actionable context and redaction.
- Logs never include secret values or raw launch secrets.
- Manual testing covers at least one forced planning error.

## Technical Notes

- Add redaction before structured logs leave the app boundary.
- Keep vendor choice minimal unless explicitly approved.

## Dependencies

- ISSUE-0043

## Future Considerations

- Error grouping and alerting can follow once event volume is understood.
