# ISSUE-0040: Admin Support Tools

- Title: Admin Support Tools
- Epic: EPIC-005 Platform
- Priority: P2
- MVP: No
- Milestone: M5 - Public Launch
- Story ID: PF-005

## User Story

As an operator, I want admin tools so support can inspect issues safely.

## Description

Create minimal support tooling for investigating broken plans, user reports, and operational issues without overexposing private data.

## Acceptance Criteria

- Authorized operators can locate a plan or user by safe identifiers.
- Support views redact secrets and unnecessary private data.
- Admin access is permissioned and auditable.
- Manual support actions are documented.

## Technical Notes

- Avoid building a broad admin portal before actual support needs are known.
- Use audit trails for any sensitive lookup.

## Dependencies

- ISSUE-0036
- ISSUE-0044
- ISSUE-0048

## Future Considerations

- Business support and moderation tools can extend this foundation.
