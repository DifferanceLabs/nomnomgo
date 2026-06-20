# ISSUE-0036: Independent Auth Architecture

- Title: Independent Auth Architecture
- Epic: EPIC-005 Platform
- Priority: P0
- MVP: Yes
- Milestone: M1 - Local MVP
- Story ID: PF-001

## User Story

As a user, I want authentication so my plans and relationships are protected.

## Description

Define and implement the first authentication architecture for NomNomGo without making Differance Labs auth a permanent dependency.

## Acceptance Criteria

- Users can sign in and recover access through the selected auth path.
- Auth identity can be associated with plans, participants, and profiles.
- Local Expo development is not broken by hosted web alpha gating.
- Server-side secrets are never exposed to the browser.

## Technical Notes

- Keep alpha launch auth separate from product auth.
- Document environment variable names without values.

## Dependencies

- None.

## Future Considerations

- Future federated auth should be intentional and reversible.
