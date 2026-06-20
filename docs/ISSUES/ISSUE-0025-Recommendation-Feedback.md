# ISSUE-0025: Recommendation Feedback

- Title: Recommendation Feedback
- Epic: EPIC-003 Recommendations
- Priority: P2
- MVP: No
- Milestone: M4 - Recommendation Engine
- Story ID: RC-006

## User Story

As a user, I want recommendation feedback so the app learns what did and did not work.

## Description

Allow users to provide explicit feedback on recommendations that can improve future ranking and explanations.

## Acceptance Criteria

- Users can mark a recommendation as liked, disliked, skipped, or not relevant.
- Feedback can optionally capture a simple reason.
- Feedback events are stored for analytics and future ranking.
- Feedback controls do not block voting or manual suggestions.

## Technical Notes

- Keep the first feedback vocabulary small.
- Avoid applying feedback to hidden personalization until transparency controls exist.

## Dependencies

- ISSUE-0020
- ISSUE-0041

## Future Considerations

- Feedback should eventually feed taste profiles and relationship graph signals.
