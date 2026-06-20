# ISSUE-0023: Travel Aware Suggestions

- Title: Travel Aware Suggestions
- Epic: EPIC-003 Recommendations
- Priority: P2
- MVP: No
- Milestone: M4 - Recommendation Engine
- Story ID: RC-004

## User Story

As a participant, I want travel-aware suggestions so the group avoids unreasonable options.

## Description

Use search area, distance, and future travel constraints to label or rank suggestions for group convenience.

## Acceptance Criteria

- Suggestions display distance or travel context when available.
- Ranking can prefer options inside the selected search area.
- Missing travel data does not hide otherwise useful suggestions.
- Users can still manually add out-of-area options.

## Technical Notes

- Start with distance before complex routing.
- Avoid provider lock-in for travel-time calculations.

## Dependencies

- ISSUE-0004
- ISSUE-0020

## Future Considerations

- Group midpoint and multi-origin travel balancing can extend this feature.
