# ISSUE-0007: Lock Final Plan

- Title: Lock Final Plan
- Epic: EPIC-001 Core Planning
- Priority: P0
- MVP: Yes
- Milestone: M1 - Local MVP
- Story ID: CP-007

## User Story

As an organizer, I want to finalize the plan so everyone knows the outcome.

## Description

Allow the organizer to choose one final suggestion and move the planning session into a locked state.

## Acceptance Criteria

- The organizer can lock one final option from the plan suggestions.
- Locked plans show the final venue or activity clearly.
- Voting and suggestion edits are disabled or controlled after lock.
- The locked state survives reloads according to the selected persistence layer.

## Technical Notes

- Treat locking as a state transition with analytics and audit hook points.
- Avoid destructive changes to suggestions or votes during lock.

## Dependencies

- ISSUE-0006
- ISSUE-0009
- ISSUE-0048

## Future Considerations

- Reopen, reservation handoff, and calendar export should build on the locked state.
