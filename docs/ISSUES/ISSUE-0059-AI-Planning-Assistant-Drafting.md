# ISSUE-0059: AI Planning Assistant Drafting

- Title: AI Planning Assistant Drafting
- Epic: EPIC-008 Agent Layer
- Priority: P3
- MVP: No
- Milestone: M7 - Agent Platform
- Story ID: AL-001

## User Story

As a user, I want an AI planning assistant so I can turn rough intent into a structured plan.

## Description

Add an assistant workflow that can draft a structured plan from user intent while requiring user confirmation before creation.

## Acceptance Criteria

- Assistant can draft title, category, time window, search area, and constraints.
- Drafts are editable before becoming plans.
- The user explicitly confirms plan creation.
- Assistant output is logged or evaluated without storing unnecessary sensitive text.

## Technical Notes

- Use planning API contracts instead of hidden UI automation.
- Keep model/provider selection separate from product logic.

## Dependencies

- ISSUE-0039
- ISSUE-0026
- ISSUE-0085

## Future Considerations

- Personal assistant integrations can reuse this draft contract.
