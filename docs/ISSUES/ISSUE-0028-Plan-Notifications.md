# ISSUE-0028: Plan Notifications

- Title: Plan Notifications
- Epic: EPIC-004 Mobile App
- Priority: P1
- MVP: Yes
- Milestone: M2 - Private Alpha
- Story ID: MA-001

## User Story

As a user, I want notifications so I know when a plan needs attention.

## Description

Add push notification support for plan invites, vote prompts, locked outcomes, and changed plans.

## Acceptance Criteria

- Users can receive notifications for important plan events.
- Notification permission prompts are clear and not shown before context exists.
- Users can open a notification into the relevant plan.
- Devices can register, refresh, and revoke push tokens for the signed-in user.
- Failed notification delivery is logged without exposing private plan content.
- Notifications fail gracefully on unsupported platforms.

## Technical Notes

- Start with a minimal event set: invited, vote needed, plan locked, plan changed.
- Requires native Android and iOS beta builds, not Expo Go as the primary tester path.
- Store push tokens server-side by user and device.
- Respect user preferences and platform permission rules.

## Dependencies

- ISSUE-0002
- ISSUE-0006
- ISSUE-0007
- ISSUE-0029

## Future Considerations

- Notification preferences may eventually be per group or per plan.
