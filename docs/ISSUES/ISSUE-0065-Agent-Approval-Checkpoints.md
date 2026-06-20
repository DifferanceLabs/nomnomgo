# ISSUE-0065: Agent Approval Checkpoints

- Title: Agent Approval Checkpoints
- Epic: EPIC-008 Agent Layer
- Priority: P3
- MVP: No
- Milestone: M7 - Agent Platform
- Story ID: AL-007

## User Story

As a user, I want approval checkpoints so agents cannot finalize important actions silently.

## Description

Require explicit human approval before agents invite users, lock plans, contact businesses, reserve, purchase, or make commitments.

## Acceptance Criteria

- Sensitive agent actions enter a pending approval state.
- Users can approve, reject, or edit proposed actions.
- Approved and rejected actions are audited.
- Agent proposals clearly show impact before approval.

## Technical Notes

- Reuse plan state transition patterns where possible.
- Approval UI should be explicit and reversible where possible.

## Dependencies

- ISSUE-0007
- ISSUE-0063
- ISSUE-0064

## Future Considerations

- Multi-party group approvals may be needed for high-impact actions.
