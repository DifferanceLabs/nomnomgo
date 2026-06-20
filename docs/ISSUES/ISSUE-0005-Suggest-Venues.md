# ISSUE-0005: Suggest Venues

- Title: Suggest Venues
- Epic: EPIC-001 Core Planning
- Priority: P0
- MVP: Yes
- Milestone: M1 - Local MVP
- Story ID: CP-005

## User Story

As a participant, I want to suggest places so ideas come from everyone.

## Description

Allow participants to add candidate venues or manual ideas to an open planning session.

## Acceptance Criteria

- Participants can add venue candidates with provider metadata when available.
- Participants can add manual suggestions when provider results are missing or unsuitable.
- Suggestions show who added them and when.
- Duplicate suggestions are handled gracefully.

## Technical Notes

- Use a venue candidate model that supports provider-backed and manual entries.
- Suggestions should remain available when recommendations fail.

## Dependencies

- ISSUE-0001
- ISSUE-0004
- ISSUE-0027

## Future Considerations

- Business-managed venue data and sponsored recommendations should extend this candidate model.
