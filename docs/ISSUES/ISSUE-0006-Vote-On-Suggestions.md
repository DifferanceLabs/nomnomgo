# ISSUE-0006: Vote On Suggestions

- Title: Vote On Suggestions
- Epic: EPIC-001 Core Planning
- Priority: P0
- MVP: Yes
- Milestone: M1 - Local MVP
- Story ID: CP-006

## User Story

As a participant, I want to vote so the group can reach consensus.

## Description

Add voting behavior to candidate suggestions so the group can signal preferences and converge on a final plan.

## Acceptance Criteria

- Participants can cast, change, and remove votes while the plan is open.
- Vote totals are visible to participants.
- A participant cannot accidentally create duplicate votes on the same option.
- Voting is disabled when a plan is locked or canceled.

## Technical Notes

- Define vote conflict rules before implementation.
- Capture vote created, changed, and removed analytics events.

## Dependencies

- ISSUE-0005
- ISSUE-0009

## Future Considerations

- Weighted voting, ranked choice, and anonymous votes should be separate future issues.
