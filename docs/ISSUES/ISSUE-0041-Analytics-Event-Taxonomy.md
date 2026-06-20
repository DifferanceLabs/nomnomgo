# ISSUE-0041: Analytics Event Taxonomy

- Title: Analytics Event Taxonomy
- Epic: EPIC-005 Platform
- Priority: P0
- MVP: Yes
- Milestone: M1 - Local MVP
- Story ID: PF-006

## User Story

As a product owner, I want analytics so roadmap decisions use real behavior.

## Description

Define and implement privacy-conscious analytics events for the core planning funnel and early retention signals.

## Acceptance Criteria

- Events cover create, invite, join, suggest, vote, lock, share, and provider failure.
- Event names and properties are documented.
- Events avoid secret values and unnecessary personal data.
- Analytics can support MVP exit criteria.

## Technical Notes

- Start with product events, not a broad data warehouse.
- Add instrumentation points alongside core issue implementation.

## Dependencies

- ISSUE-0001
- ISSUE-0044

## Future Considerations

- Business analytics and recommendation experiments should reuse this taxonomy.
