# ISSUE-0011: Friend Connections

- Title: Friend Connections
- Epic: EPIC-002 Social Network
- Priority: P2
- MVP: No
- Milestone: M3 - Friends & Groups
- Story ID: SN-001

## User Story

As a user, I want friends so inviting repeat participants is faster.

## Description

Create accepted friend connections that make repeat planning faster without adding a public social feed.

## Acceptance Criteria

- Users can view accepted friends.
- Friend connections can be used as invite targets.
- Private planning history is not exposed through friend lists.
- Removing or blocking behavior is considered in the data model.

## Technical Notes

- Model friendship as consented relationship data.
- Keep relationship data independent from Differance Labs auth.

## Dependencies

- ISSUE-0036
- ISSUE-0037

## Future Considerations

- Friend affinity and mutual friends should extend this relationship model.
