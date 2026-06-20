# ISSUE-0002: Invite Participants

- Title: Invite Participants
- Epic: EPIC-001 Core Planning
- Priority: P0
- MVP: Yes
- Milestone: M1 - Local MVP
- Story ID: CP-002

## User Story

As a user, I want to invite friends so they can participate.

## Description

Allow an organizer to invite participants into an existing planning session using a link or invite object that can be shared outside the app.

## Acceptance Criteria

- A plan organizer can create or access an invite for a plan.
- Invitees can open the plan and join with a clear participant identity.
- Reused invite links do not create duplicate participants for the same user.
- Invalid or expired invites fail safely without exposing private plan data.

## Technical Notes

- Use a dedicated invite token or invite link model.
- Capture invite sent, invite opened, and invite joined events.
- Keep hosted alpha launch protection intact for web access.

## Dependencies

- ISSUE-0001
- ISSUE-0037
- ISSUE-0073
- ISSUE-0079

## Future Considerations

- Friend and group invites should reuse this foundation.
