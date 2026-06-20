# ISSUE-0046: Rate Limiting

- Title: Rate Limiting
- Epic: EPIC-006 Reliability
- Priority: P0
- MVP: Yes
- Milestone: M2 - Private Alpha
- Story ID: RL-003

## User Story

As an operator, I want rate limiting so abuse and runaway usage are controlled.

## Description

Add rate limiting to sensitive endpoints such as alpha launch validation, auth, invites, voting, and provider proxy endpoints where applicable.

## Acceptance Criteria

- Sensitive endpoints have defined limits.
- Limit failures return clear, non-leaky responses.
- Local development can still test rate-limited flows.
- Rate-limit behavior is documented for manual testing.

## Technical Notes

- Keep limits configurable by environment.
- Do not log raw tokens or secrets when limits trigger.

## Dependencies

- ISSUE-0039
- ISSUE-0043

## Future Considerations

- Abuse detection can use rate-limit signals later.
