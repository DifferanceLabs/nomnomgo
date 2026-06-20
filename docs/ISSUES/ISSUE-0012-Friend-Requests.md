# ISSUE-0012: Friend Requests

- Title: Friend Requests
- Epic: EPIC-002 Social Network
- Priority: P2
- MVP: No
- Milestone: M3 - Friends & Groups
- Story ID: SN-002

## User Story

As a user, I want friend requests so relationships require consent.

## Description

Add a consent-based friend request lifecycle so users control who becomes a friend.

## Acceptance Criteria

- Users can send, accept, decline, and cancel friend requests.
- Duplicate pending requests are prevented.
- Declined or blocked relationships cannot be immediately spammed.
- Request state is visible to both parties where appropriate.

## Technical Notes

- Include abuse and rate-limit hooks for request creation.
- Do not expose private contact or plan data in request previews.

## Dependencies

- ISSUE-0011
- ISSUE-0047

## Future Considerations

- Contact import and suggested friends should be separate, opt-in issues.
