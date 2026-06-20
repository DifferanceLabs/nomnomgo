# ISSUE-0020: Restaurant Recommendations

- Title: Restaurant Recommendations
- Epic: EPIC-003 Recommendations
- Priority: P0
- MVP: Yes
- Milestone: M1 - Local MVP
- Story ID: RC-001

## User Story

As a participant, I want restaurant recommendations so we can find places quickly.

## Description

Show restaurant candidates for a planning session using the selected search area and current provider configuration.

## Acceptance Criteria

- A plan with a search area can request restaurant candidates.
- Recommendation cards show name, location context, and available provider metadata.
- Users can add a recommendation to plan suggestions.
- Provider failures show a usable fallback state.

## Technical Notes

- Normalize provider results before rendering.
- Keep provider keys client-visible only where current Expo constraints require it, and prepare for server proxy migration.

## Dependencies

- ISSUE-0004
- ISSUE-0039
- ISSUE-0051

## Future Considerations

- Group taste profiles and sponsored recommendations should plug into ranking later.
