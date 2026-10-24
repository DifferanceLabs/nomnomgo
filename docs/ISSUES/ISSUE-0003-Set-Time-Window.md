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
- Place results show operating hours for the planned date, including compact provider time formats and overnight hours.
- Availability covers the full visit; visits crossing an opening or closing boundary show a warning and the actual hours.
- Reopened shared-plan stops reload missing hours without changing the shared plan. Missing provider hours remain explicitly unverified.

## Manual Testing

- Search a future dinner plan and verify the date's hours appear beside availability, including a listing such as `4:00–10:00 PM`.
- Add a stop near closing, adjust its arrival/duration, and verify the closing warning updates. Check an overnight visit and a split lunch/dinner schedule.
- Reopen a saved/shared plan and verify Google-backed stops reload their hours; manual stops and events retain their existing behavior.
- Verify create, invite, suggest, vote, and lock flows, and confirm the hosted alpha gate still protects the app.

## Technical Notes

- Store time values in a format that can support time zones later.
- Do not couple date and time fields to calendar export implementation.

## Dependencies

- ISSUE-0001

## Future Considerations

- Availability polling and calendar conflict checks may extend this model.
