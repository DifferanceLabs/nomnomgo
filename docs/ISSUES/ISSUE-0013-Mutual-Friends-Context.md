# ISSUE-0013: Mutual Friends Context

- Title: Mutual Friends Context
- Epic: EPIC-002 Social Network
- Priority: P3
- MVP: No
- Milestone: M5 - Public Launch
- Story ID: SN-003

## User Story

As a user, I want mutual friend context so I know why someone appears.

## Description

Show limited mutual friend context on profiles or invites without exposing private relationship or planning data.

## Acceptance Criteria

- Mutual friend counts or names appear only where privacy rules allow.
- Blocked or private relationships are excluded.
- The UI explains the context without implying endorsement.
- Manual QA covers private, blocked, and no-mutual cases.

## Technical Notes

- Keep this query scoped and indexed.
- Avoid leaking group membership through mutual friend context.

## Dependencies

- ISSUE-0011
- ISSUE-0012

## Future Considerations

- Relationship graph affinity should not replace explicit mutual friend context.
