# ISSUE-0039: Core Planning API Contracts

- Title: Core Planning API Contracts
- Epic: EPIC-005 Platform
- Priority: P0
- MVP: Yes
- Milestone: M1 - Local MVP
- Story ID: PF-004

## User Story

As a developer, I want APIs so planning behavior can move beyond local client state.

## Description

Define API boundaries for core planning operations before the product grows into social, business, and agent workflows.

## Acceptance Criteria

- API contracts exist for plan create, read, update, invite, suggest, vote, and lock.
- Contracts describe request, response, error, and permission expectations.
- Client code uses the contracts rather than ad hoc local-only behavior where persistence is required.
- Contracts do not hard-code Differance Labs deployment assumptions.

## Technical Notes

- Keep APIs resource-oriented and stable enough for future agent integration.
- Add tests or contract examples for important error cases.

## Dependencies

- ISSUE-0036
- ISSUE-0043

## Future Considerations

- Public APIs should add scopes, audit trails, and versioning before external use.
