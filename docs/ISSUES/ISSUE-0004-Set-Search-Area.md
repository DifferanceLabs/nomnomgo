# ISSUE-0004: Set Search Area

- Title: Set Search Area
- Epic: EPIC-001 Core Planning
- Priority: P0
- MVP: Yes
- Milestone: M1 - Local MVP
- Story ID: CP-004

## User Story

As a user, I want to define where we are meeting so travel is reasonable.

## Description

Add a searchable or manually entered meeting area to a plan so suggestions can be constrained to a useful geography.

## Acceptance Criteria

- A plan can store a search area label and location data where available.
- Users can set or edit the search area before the plan is locked.
- Venue suggestions can read the selected search area.
- Missing location permissions do not block manual area entry.

## Technical Notes

- Preserve a provider-neutral location shape.
- Support future radius or travel-time constraints without changing the plan model.

## Dependencies

- ISSUE-0001

## Future Considerations

- Group midpoint or travel-balanced search can build on this area model.
