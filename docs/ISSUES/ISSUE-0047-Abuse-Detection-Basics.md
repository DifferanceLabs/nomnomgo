# ISSUE-0047: Abuse Detection Basics

- Title: Abuse Detection Basics
- Epic: EPIC-006 Reliability
- Priority: P2
- MVP: No
- Milestone: M3 - Friends & Groups
- Story ID: RL-004

## User Story

As a user, I want abuse detection so invites and social features stay safe.

## Description

Define and implement first-pass controls for suspicious invites, friend requests, and spam patterns.

## Acceptance Criteria

- Invite and friend request creation have abuse-oriented limits or checks.
- Blocked users cannot keep sending unwanted requests.
- Abuse signals are logged without exposing private content.
- False-positive handling is documented.

## Technical Notes

- Start with deterministic limits before complex detection.
- Reuse rate-limit infrastructure where possible.

## Dependencies

- ISSUE-0002
- ISSUE-0012
- ISSUE-0046

## Future Considerations

- Trust and reputation signals may use abuse history, but only with clear privacy rules.
