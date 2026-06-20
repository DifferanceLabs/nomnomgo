# ISSUE-0026: Recommendation Explanations

- Title: Recommendation Explanations
- Epic: EPIC-003 Recommendations
- Priority: P2
- MVP: No
- Milestone: M4 - Recommendation Engine
- Story ID: RC-007

## User Story

As a user, I want transparent explanations so I understand why options appear.

## Description

Add visible reason labels to recommendation cards so users can trust and correct suggestions.

## Acceptance Criteria

- Recommendation cards can show reason labels such as nearby, saved place, cuisine match, group fit, or popular with this group.
- Labels are based on real available signals.
- Missing explanation data does not break the card.
- Sponsored or partner reasons are visibly distinct when monetization launches.

## Technical Notes

- Treat explanations as part of the recommendation payload.
- Avoid vague labels that cannot be traced to an input signal.

## Dependencies

- ISSUE-0020
- ISSUE-0023
- ISSUE-0025

## Future Considerations

- Agent assistants should reuse explanation text when summarizing recommendations.
