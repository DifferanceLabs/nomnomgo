# ISSUE-0035: Dark Mode

- Title: Dark Mode
- Epic: EPIC-004 Mobile App
- Priority: P3
- MVP: No
- Milestone: M5 - Public Launch
- Story ID: MA-008

## User Story

As a user, I want dark mode so the app fits mobile expectations.

## Description

Add dark mode support for core screens without reducing readability or accessibility.

## Acceptance Criteria

- Core planning screens respond to system or user theme.
- Text, controls, and cards meet contrast expectations in dark mode.
- Maps, provider cards, and locked plan states remain legible.
- Theme switching does not resize or break layouts.

## Technical Notes

- Introduce theme tokens before broad UI changes.
- Avoid one-off colors scattered through components.

## Dependencies

- ISSUE-0034

## Future Considerations

- Business and agent dashboards will need theme coverage later.
