# ISSUE-0021: Activity Recommendations

- Title: Activity Recommendations
- Epic: EPIC-003 Recommendations
- Priority: P2
- MVP: No
- Milestone: M4 - Recommendation Engine
- Story ID: RC-002

## User Story

As a participant, I want activity recommendations so plans are not limited to food.

## Description

Extend recommendation candidates beyond restaurants to activities, events, and mixed outing ideas.

## Acceptance Criteria

- Activity candidates can be requested for a plan.
- Event-like fallback results clearly show confidence or date limitations.
- Activity candidates can be added to plan suggestions.
- Provider source and category are visible enough for debugging and analytics.

## Technical Notes

- Respect the existing event discovery strategy.
- Normalize activities into the same candidate pipeline where possible.

## Dependencies

- ISSUE-0020
- ISSUE-0039
- ISSUE-0051

## Future Considerations

- Event packages and business promotions should reuse activity candidate types.
