# ISSUE-0001: Create Planning Session

- Title: Create Planning Session
- Epic: EPIC-001 Core Planning
- Priority: P0
- MVP: Yes
- Milestone: M1 - Local MVP
- Story ID: CP-001

## User Story

As a user, I want to create a planning session so I can organize an outing.

## Description

Create the first usable planning session flow with enough structure to support participants, suggestions, voting, and final plan locking.

## Acceptance Criteria

- A user can create a plan with title, category, organizer, and initial open state.
- The plan can store date, time, and search area fields once those fields exist.
- Created plans can be reopened after navigation or app reload according to the current persistence layer.
- Empty, invalid, and canceled create attempts show clear user-facing states.

## Technical Notes

- Define the planning session shape before building the UI.
- Keep the model independent from Differance Labs auth.
- Add analytics hook points for create started, create failed, and create completed.

## Dependencies

- ISSUE-0036
- ISSUE-0039
- ISSUE-0043

## Future Considerations

- Reusable plan templates should build on this model, not fork it.
