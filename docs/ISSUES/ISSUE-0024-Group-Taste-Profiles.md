# ISSUE-0024: Group Taste Profiles

- Title: Group Taste Profiles
- Epic: EPIC-003 Recommendations
- Priority: P3
- MVP: No
- Milestone: M4 - Recommendation Engine
- Story ID: RC-005

## User Story

As a group, we want taste profiles so recommendations fit us over time.

## Description

Create early group taste profile logic from explicit preferences, saved places, feedback, and prior locked plans.

## Acceptance Criteria

- Taste profile inputs are documented before ranking changes ship.
- Group profiles can influence ranking in a transparent way.
- Users can understand which broad preferences were used.
- Profiles avoid sensitive inference without explicit approval.

## Technical Notes

- Use explicit feedback before hidden inference.
- Keep group profile data separable from individual profile data.

## Dependencies

- ISSUE-0015
- ISSUE-0018
- ISSUE-0025
- ISSUE-0083

## Future Considerations

- Relationship graph affinity may improve group taste profiles later.
