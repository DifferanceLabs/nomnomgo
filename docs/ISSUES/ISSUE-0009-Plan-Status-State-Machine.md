# ISSUE-0009: Plan Status State Machine

- Title: Plan Status State Machine
- Epic: EPIC-001 Core Planning
- Priority: P0
- MVP: Yes
- Milestone: M1 - Local MVP
- Story ID: CP-009

## User Story

As a participant, I want to see plan status so I know what action is needed.

## Description

Define and display plan states so the planning flow is predictable across create, suggestion, vote, lock, cancel, and expiration behavior.

## Acceptance Criteria

- Plans show open, voting, locked, canceled, or expired states where applicable.
- UI actions respect the current state.
- Invalid state transitions are blocked.
- State transitions are covered by tests or documented manual checks.

## Technical Notes

- Implement this as a single state model rather than scattered booleans.
- Include analytics hook points for major state transitions.

## Dependencies

- ISSUE-0001

## Future Considerations

- Reopen and agent approval workflows should use the same state transition approach.
