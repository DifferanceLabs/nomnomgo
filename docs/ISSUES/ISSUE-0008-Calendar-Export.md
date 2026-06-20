# ISSUE-0008: Calendar Export

- Title: Calendar Export
- Epic: EPIC-001 Core Planning
- Priority: P1
- MVP: Yes
- Milestone: M2 - Private Alpha
- Story ID: CP-008

## User Story

As a participant, I want to save the event so I remember it.

## Description

Create a calendar export or handoff for locked plans so participants can save the final outcome.

## Acceptance Criteria

- A locked plan can generate a calendar-ready title, time, location, and notes.
- Calendar export is not available before a plan is locked.
- Missing time or location data is handled clearly.
- Manual testing covers at least one web and one mobile handoff path where supported.

## Technical Notes

- Keep export logic separate from the plan lock transition.
- Prefer standards-based calendar output where practical.

## Dependencies

- ISSUE-0003
- ISSUE-0007
- ISSUE-0031

## Future Considerations

- Native calendar permissions and calendar conflict checks can be added later.
