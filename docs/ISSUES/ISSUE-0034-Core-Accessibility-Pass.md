# ISSUE-0034: Core Accessibility Pass

- Title: Core Accessibility Pass
- Epic: EPIC-004 Mobile App
- Priority: P0
- MVP: Yes
- Milestone: M1 - Local MVP
- Story ID: MA-007

## User Story

As a user, I want accessibility so planning works for more people.

## Description

Audit and improve the core planning flow for readable labels, contrast, focus order, touch targets, and screen sizes.

## Acceptance Criteria

- Create, invite, suggest, vote, and lock controls have accessible labels.
- Core screens support small mobile and desktop web widths without overlap.
- Text contrast is reviewed for primary interactive surfaces.
- Manual testing notes document keyboard or screen reader checks where practical.

## Technical Notes

- Keep changes scoped to core planning surfaces.
- Use existing UI patterns unless the current pattern blocks accessibility.

## Dependencies

- ISSUE-0001
- ISSUE-0002
- ISSUE-0005
- ISSUE-0006
- ISSUE-0007

## Future Considerations

- A full accessibility test suite can follow once screens stabilize.
