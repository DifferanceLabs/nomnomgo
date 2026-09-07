# ISSUE-0011: Friend Connections

- Title: Friend Connections
- Epic: EPIC-002 Social Network
- Priority: P1 (alpha invitation slice)
- MVP: No
- Milestone: M3 - Friends & Groups
- Story ID: SN-001

## User Story

As a user, I want friends so inviting repeat participants is faster.

## Description

Create accepted friend connections that make repeat planning faster without adding a public social feed.

## Acceptance Criteria

- A new user's first verified NomNomGo login creates a mutual friendship with their alpha inviter and people who directly invited them to a plan before that login, whether the message was sent by email or text.
- Pending invitations and other plan participants do not become friends automatically. Repeated logins do not duplicate or restore removed friendships.
- Previously accepted alpha invitations receive the same friendship when the migration is activated.
- Friends refresh while the list is open and can be invited to a shared plan without retyping their email.
- Users can view accepted friends.
- Friend connections can be used as invite targets.
- Private planning history is not exposed through friend lists.
- Removing or blocking behavior is considered in the data model.

## Technical Notes

- Alpha invitations explain that first login connects inviter and invitee as friends. Either person can remove the connection; removal does not alter existing plan membership.
- Keep relationship data independent from Differance Labs auth.

## Dependencies

- ISSUE-0036
- ISSUE-0037

## Future Considerations

- Friend affinity and mutual friends should extend this relationship model.
