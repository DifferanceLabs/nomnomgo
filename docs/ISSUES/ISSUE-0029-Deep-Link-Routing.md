# ISSUE-0029: Deep Link Routing

- Title: Deep Link Routing
- Epic: EPIC-004 Mobile App
- Priority: P0
- MVP: Yes
- Milestone: M1 - Local MVP
- Story ID: MA-002

## User Story

As a user, I want deep linking so shared plans open in the right place.

## Description

Support plan links that route users directly to the correct planning session on web and mobile where supported.

## Acceptance Criteria

- Plan links resolve to the correct plan route.
- Unauthenticated or lightweight invitees are routed through the proper join flow.
- Invalid plan links show a clear not-found or unavailable state.
- Hosted web alpha access rules still apply.

## Technical Notes

- Keep route shape domain-independent.
- Avoid hard-coding Differance Labs domains into product logic.

## Dependencies

- ISSUE-0001
- ISSUE-0043
- ISSUE-0073

## Future Considerations

- Universal links and app links can build on this routing contract.
