# ISSUE-0080: Relationship Event Taxonomy

- Title: Relationship Event Taxonomy
- Epic: EPIC-011 Relationship Graph
- Priority: P3
- MVP: No
- Milestone: M4 - Recommendation Engine
- Story ID: RG-001

## User Story

As a user, I want friend affinity so the app understands who I plan with most.

## Description

Define relationship events that can later power friend affinity, group affinity, shared history, and planning predictions.

## Acceptance Criteria

- Relationship event types are documented.
- Events distinguish explicit user actions from inferred behavior.
- Privacy risks and deletion needs are identified.
- Events can be consumed by future graph models.

## Technical Notes

- Start with planning participation, invite, vote, lock, attendance, and saved place signals.
- Keep this as taxonomy work before scoring.

## Dependencies

- ISSUE-0015
- ISSUE-0041

## Future Considerations

- Raw affinity scores should not be exposed to users without transparency controls.
