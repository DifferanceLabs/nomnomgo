# ISSUE-0060: Group Coordination Assistant

- Title: Group Coordination Assistant
- Epic: EPIC-008 Agent Layer
- Priority: P3
- MVP: No
- Milestone: M7 - Agent Platform
- Story ID: AL-002

## User Story

As a group, we want a coordination assistant so open questions and next actions are clear.

## Description

Use plan state, votes, suggestions, and group history to summarize what the group still needs to decide.

## Acceptance Criteria

- Assistant can summarize current plan status and missing actions.
- Assistant does not lock plans or invite people without confirmation.
- Summary references visible plan data only.
- Users can distinguish assistant suggestions from human decisions.

## Technical Notes

- Build on plan status and audit trails.
- Keep summaries deterministic enough for manual verification at first.

## Dependencies

- ISSUE-0009
- ISSUE-0015
- ISSUE-0048

## Future Considerations

- Proactive reminders and negotiation workflows should require permission controls.
