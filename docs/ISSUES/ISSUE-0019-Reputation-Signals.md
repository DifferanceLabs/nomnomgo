# ISSUE-0019: Reputation Signals

- Title: Reputation Signals
- Epic: EPIC-002 Social Network
- Priority: P3
- MVP: No
- Milestone: M5 - Public Launch
- Story ID: SN-009

## User Story

As a user, I want reputation signals so I trust suggestions and participants.

## Description

Explore explainable reputation signals that help participants understand suggestion quality without creating popularity games.

## Acceptance Criteria

- Reputation signals are defined before implementation.
- Signals are explainable and avoid hidden score-only presentation.
- Abuse and privacy risks are documented.
- No signal is exposed publicly without explicit product approval.

## Technical Notes

- Treat this as a design and data-model issue before UI work.
- Prefer small scoped signals such as prior accepted suggestions.

## Dependencies

- ISSUE-0011
- ISSUE-0015
- ISSUE-0047

## Future Considerations

- Relationship graph signals may eventually inform reputation, but should not be exposed raw.
