# ISSUE-0084: Recurring Pattern Detection

- Title: Recurring Pattern Detection
- Epic: EPIC-011 Relationship Graph
- Priority: P3
- MVP: No
- Milestone: M4 - Recommendation Engine
- Story ID: RG-005

## User Story

As a user, I want recurring patterns so repeated plans become easier.

## Description

Detect recurring planning patterns such as repeated groups, timing, locations, categories, and venues.

## Acceptance Criteria

- Recurrence inputs and thresholds are documented.
- Detected patterns can suggest reusable plan defaults.
- Users can reject or ignore suggested patterns.
- Pattern detection does not expose hidden private behavior.

## Technical Notes

- Start with simple deterministic recurrence rules.
- Avoid opaque prediction models in first version.

## Dependencies

- ISSUE-0082
- ISSUE-0083

## Future Considerations

- Calendar-aware recurrence and assistant automation should be separate.
