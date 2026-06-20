# ISSUE-0048: Audit Trails

- Title: Audit Trails
- Epic: EPIC-006 Reliability
- Priority: P2
- MVP: No
- Milestone: M2 - Private Alpha
- Story ID: RL-005

## User Story

As an operator, I want audit trails so important actions can be investigated.

## Description

Record important state-changing actions for plans, auth, admin tools, and future agents.

## Acceptance Criteria

- Plan lock, reopen, cancel, invite, and admin lookup actions can emit audit events.
- Audit events include actor, target, action, and timestamp where available.
- Audit logs avoid secrets and unnecessary private content.
- Audit events can support support and incident investigation.

## Technical Notes

- Keep audit event schema stable enough for agent permissions later.
- Separate audit logs from product analytics.

## Dependencies

- ISSUE-0007
- ISSUE-0039
- ISSUE-0044

## Future Considerations

- Agent actions and business tools should use the same audit layer.
