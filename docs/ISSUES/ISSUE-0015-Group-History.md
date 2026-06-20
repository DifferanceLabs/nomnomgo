# ISSUE-0015: Group History

- Title: Group History
- Epic: EPIC-002 Social Network
- Priority: P2
- MVP: No
- Milestone: M3 - Friends & Groups
- Story ID: SN-005

## User Story

As a group member, I want group history so we remember what we did.

## Description

Show locked and completed plans for a group so recurring groups can reuse context.

## Acceptance Criteria

- Group members can see prior locked plans for that group.
- History entries include date, final place, and relevant plan status.
- Non-members cannot access group history.
- Canceled or reopened plans display accurately.

## Technical Notes

- Use plan state and group membership permissions.
- Keep history query performance in mind before adding rich memories.

## Dependencies

- ISSUE-0007
- ISSUE-0014

## Future Considerations

- Shared memories, attendance, and relationship graph signals should build from group history.
