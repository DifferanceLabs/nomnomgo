# ISSUE-0079: Lightweight Invite Onboarding

- Title: Lightweight Invite Onboarding
- Epic: EPIC-010 Growth
- Priority: P0
- MVP: Yes
- Milestone: M1 - Local MVP
- Story ID: GR-007

## User Story

As a new user, I want lightweight onboarding so I can join a plan before creating a heavy profile.

## Description

Allow invited participants to join and contribute to a plan with the minimum identity required for safety and clarity.

## Acceptance Criteria

- Invitees can identify themselves enough to participate.
- The join path is shorter than full onboarding.
- Lightweight participants can later attach or upgrade to full accounts.
- Abuse and duplicate participant risks are considered.

## Technical Notes

- Coordinate with auth and profile models.
- Do not let lightweight identity bypass plan permissions.

## Dependencies

- ISSUE-0037
- ISSUE-0073

## Future Considerations

- Guest-to-user conversion can become a growth loop after MVP validation.
