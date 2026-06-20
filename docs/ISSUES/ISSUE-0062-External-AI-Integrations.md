# ISSUE-0062: External AI Integrations

- Title: External AI Integrations
- Epic: EPIC-008 Agent Layer
- Priority: P3
- MVP: No
- Milestone: M7 - Agent Platform
- Story ID: AL-004

## User Story

As an external assistant, I want integrations so I can draft or update plans through approved APIs.

## Description

Define the first external assistant integration path for creating or updating plans through permissioned APIs.

## Acceptance Criteria

- External assistants can be identified separately from human users.
- Allowed actions are scoped and documented.
- Human approval is required for sensitive actions.
- Integration errors are auditable and recoverable.

## Technical Notes

- Build only after API contracts, permissions, and audit trails exist.
- Do not support browser scraping or hidden UI automation.

## Dependencies

- ISSUE-0063
- ISSUE-0064
- ISSUE-0065

## Future Considerations

- Marketplace-style agent integrations require governance and review.
