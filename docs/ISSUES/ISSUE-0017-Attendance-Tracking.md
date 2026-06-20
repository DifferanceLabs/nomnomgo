# ISSUE-0017: Attendance Tracking

- Title: Attendance Tracking
- Epic: EPIC-002 Social Network
- Priority: P3
- MVP: No
- Milestone: M4 - Recommendation Engine
- Story ID: SN-007

## User Story

As a group member, I want attendance tracking so recommendations reflect who actually went.

## Description

Record actual attendance for completed plans so future recommendations and group history reflect reality.

## Acceptance Criteria

- A completed plan can record who attended.
- Attendance can differ from invite or vote participation.
- Attendance changes are permissioned and auditable.
- Recommendation and graph systems can consume attendance as an explicit signal.

## Technical Notes

- Keep attendance separate from participant membership.
- Avoid inferring attendance without user confirmation.

## Dependencies

- ISSUE-0015
- ISSUE-0048

## Future Considerations

- Check-ins, location proof, and automated attendance should remain out of MVP.
