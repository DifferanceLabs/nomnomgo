# ISSUE-0031: Calendar Integration

- Title: Calendar Integration
- Epic: EPIC-004 Mobile App
- Priority: P1
- MVP: Yes
- Milestone: M2 - Private Alpha
- Story ID: MA-004

## User Story

As a user, I want calendar integration so locked plans become reminders.

## Description

Provide platform-appropriate calendar integration or handoff for locked plans. Closed beta should support explicit add-to-calendar behavior before deeper calendar sync.

## Acceptance Criteria

- Calendar handoff uses locked plan title, time, location, and notes.
- Users can trigger the handoff from the locked plan screen.
- iOS users can add locked plans to the device calendar, including Apple Calendar or other calendars configured on the device.
- Google Calendar write integration requires explicit calendar consent beyond Google sign-in.
- Missing permissions or unsupported platforms show clear fallback instructions.
- Manual QA covers supported web and mobile paths.

## Technical Notes

- Keep calendar payload generation shared with calendar export.
- Do not request native permissions before user intent is clear.
- Sign in with Apple establishes identity; it should not be treated as Apple Calendar authorization.
- Prefer one-way event creation for closed beta. Two-way sync and availability reads are out of scope.

## Dependencies

- ISSUE-0008
- ISSUE-0007

## Future Considerations

- Two-way calendar sync is out of scope for this issue.
