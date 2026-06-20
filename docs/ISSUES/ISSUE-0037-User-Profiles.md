# ISSUE-0037: User Profiles

- Title: User Profiles
- Epic: EPIC-005 Platform
- Priority: P0
- MVP: Yes
- Milestone: M1 - Local MVP
- Story ID: PF-002

## User Story

As a user, I want a profile so participants know who is planning.

## Description

Create minimal user profiles with safe identity fields for planning participation.

## Acceptance Criteria

- Profiles include display name and stable user identity.
- Participants in a plan show recognizable profile information.
- Profile fields avoid unnecessary sensitive data.
- Profile creation works with the chosen auth flow.

## Technical Notes

- Separate public display data from private account data.
- Keep profile shape compatible with future friends and groups.

## Dependencies

- ISSUE-0036

## Future Considerations

- Avatars, bios, and social profile details should wait until privacy rules are clear.
