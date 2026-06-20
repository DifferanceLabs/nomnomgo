# ISSUE-0027: Manual Recommendation Override

- Title: Manual Recommendation Override
- Epic: EPIC-003 Recommendations
- Priority: P0
- MVP: Yes
- Milestone: M1 - Local MVP
- Story ID: RC-008

## User Story

As a user, I want manual override so recommendations do not trap the group.

## Description

Ensure participants can add manual suggestions even when provider recommendations are unavailable, irrelevant, or wrong.

## Acceptance Criteria

- Manual suggestions can be created without provider metadata.
- Manual suggestions can be voted on and locked like provider-backed suggestions.
- Manual entry is available from recommendation and suggestion surfaces.
- Provider failures make manual entry more visible, not less.

## Technical Notes

- Keep manual candidates in the same suggestion model as provider candidates.
- Include validation for name and optional location fields.

## Dependencies

- ISSUE-0001
- ISSUE-0005

## Future Considerations

- Manual suggestions can later be matched to provider venues in the background.
