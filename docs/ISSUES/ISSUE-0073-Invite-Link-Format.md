# ISSUE-0073: Invite Link Format

- Title: Invite Link Format
- Epic: EPIC-010 Growth
- Priority: P0
- MVP: Yes
- Milestone: M1 - Local MVP
- Story ID: GR-001

## User Story

As a user, I want an invite system so I can bring participants into a plan.

## Description

Define the canonical invite link format and join behavior for shared planning sessions.

## Acceptance Criteria

- Invite links can identify a plan and invite context.
- Link format is domain-independent and configurable.
- Invalid links fail safely.
- Invite links work with deep linking and share flows.

## Technical Notes

- Do not expose server-side secrets in invite URLs.
- Keep launch tokens separate from plan invite tokens.

## Dependencies

- ISSUE-0001
- ISSUE-0039
- ISSUE-0043

## Future Considerations

- Group invites and referral links can extend this format.
