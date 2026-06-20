# ISSUE-0032: Maps Handoff

- Title: Maps Handoff
- Epic: EPIC-004 Mobile App
- Priority: P0
- MVP: Yes
- Milestone: M1 - Local MVP
- Story ID: MA-005

## User Story

As a user, I want maps integration so I can navigate to the selected place.

## Description

Allow users to open a suggested or locked destination in their maps app or browser maps.

## Acceptance Criteria

- Venue and locked plan cards expose a maps action when location data exists.
- Manual suggestions with only a text address can still attempt a maps handoff.
- Missing location data hides or disables the maps action clearly.
- Links work on web and mobile-supported environments.

## Technical Notes

- Build a small maps URL helper with provider-neutral inputs.
- Do not assume one maps provider for all platforms.

## Dependencies

- ISSUE-0005
- ISSUE-0007
- ISSUE-0020

## Future Considerations

- Travel time and group route planning should be separate issues.
