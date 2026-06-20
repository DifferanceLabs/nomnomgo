# ISSUE-0082: Shared History Signals

- Title: Shared History Signals
- Epic: EPIC-011 Relationship Graph
- Priority: P3
- MVP: No
- Milestone: M4 - Recommendation Engine
- Story ID: RG-003

## User Story

As a user, I want shared history so past plans reduce future planning effort.

## Description

Extract useful, privacy-aware shared history signals from completed plans and attendance records.

## Acceptance Criteria

- Completed plans can contribute history signals.
- Attendance and locked destination are treated as distinct signals.
- Signals can be used by recommendations with explanation support.
- Users are not shown hidden sensitive inference.

## Technical Notes

- Build on group history and attendance tracking.
- Keep signal names clear and auditable.

## Dependencies

- ISSUE-0015
- ISSUE-0017
- ISSUE-0080

## Future Considerations

- Shared memories may add richer context later but should not be required.
