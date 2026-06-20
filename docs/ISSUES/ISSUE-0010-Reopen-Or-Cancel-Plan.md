# ISSUE-0010: Reopen Or Cancel Plan

- Title: Reopen Or Cancel Plan
- Epic: EPIC-001 Core Planning
- Priority: P2
- MVP: No
- Milestone: M3 - Friends & Groups
- Story ID: CP-010

## User Story

As an organizer, I want to reopen or cancel a plan so changes are manageable.

## Description

Add controlled reopen and cancel actions for organizers when plans change after voting or locking.

## Acceptance Criteria

- Organizers can cancel open or locked plans with a visible reason.
- Reopen behavior is controlled and does not silently erase prior votes.
- Participants can see that a plan changed state.
- Invalid or unauthorized reopen and cancel attempts are blocked.

## Technical Notes

- Use the plan state machine and audit trail.
- Avoid deleting historical suggestions or votes.

## Dependencies

- ISSUE-0007
- ISSUE-0009
- ISSUE-0048

## Future Considerations

- Notifications should alert participants when a locked plan changes.
