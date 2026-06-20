# ISSUE-0003: Set Time Window

- Title: Set Time Window
- Epic: EPIC-001 Core Planning
- Priority: P0
- MVP: Yes
- Milestone: M1 - Local MVP
- Story ID: CP-003

## User Story

As a user, I want to define a date and time range so recommendations are relevant.

## Description

Add date and time constraints to planning sessions so participants and recommendation logic understand when the outing may happen.

## Acceptance Criteria

- A plan can store and display date, start time, end time, and flexible time notes.
- Users can edit the time window before a plan is locked.
- Invalid time ranges are blocked with a clear message.
- Time fields display consistently across web and mobile surfaces.

## Technical Notes

- Store time values in a format that can support time zones later.
- Do not couple date and time fields to calendar export implementation.

## Dependencies

- ISSUE-0001

## Future Considerations

- Availability polling and calendar conflict checks may extend this model.
