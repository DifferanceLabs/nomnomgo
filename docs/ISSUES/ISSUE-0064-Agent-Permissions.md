# ISSUE-0064: Agent Permissions

- Title: Agent Permissions
- Epic: EPIC-008 Agent Layer
- Priority: P3
- MVP: No
- Milestone: M7 - Agent Platform
- Story ID: AL-006

## User Story

As a user, I want agent permissions so I know what an assistant can do.

## Description

Create permission concepts for agent access to plans, groups, businesses, and actions.

## Acceptance Criteria

- Agent permissions are visible and revocable by authorized users.
- Permissions distinguish read, draft, suggest, update, invite, and lock actions.
- Permission grants and revocations are audited.
- Agents cannot bypass normal user or business permissions.

## Technical Notes

- Build on auth sessions and audit trails.
- Keep permission scopes human-readable.

## Dependencies

- ISSUE-0036
- ISSUE-0038
- ISSUE-0048

## Future Considerations

- Enterprise or business-level agent permissions may need separate governance.
