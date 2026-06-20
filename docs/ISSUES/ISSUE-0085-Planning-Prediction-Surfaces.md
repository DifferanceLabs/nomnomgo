# ISSUE-0085: Planning Prediction Surfaces

- Title: Planning Prediction Surfaces
- Epic: EPIC-011 Relationship Graph
- Priority: P3
- MVP: No
- Milestone: M7 - Agent Platform
- Story ID: RG-006

## User Story

As a group, we want planning predictions so likely constraints are surfaced early.

## Description

Surface likely planning constraints or defaults based on recurring patterns and shared preferences, with user confirmation.

## Acceptance Criteria

- Predictions appear as suggestions, not automatic decisions.
- Users can accept, edit, or dismiss predictions.
- Prediction reasons are visible.
- Sensitive or low-confidence predictions are suppressed.

## Technical Notes

- Build on recurrence and explanation systems.
- Keep prediction output compatible with assistant drafting.

## Dependencies

- ISSUE-0026
- ISSUE-0084
- ISSUE-0086

## Future Considerations

- Agent assistants may propose plans from prediction surfaces after permission controls exist.
