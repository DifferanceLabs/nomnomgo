# ISSUE-0074: Invite Preview Metadata

- Title: Invite Preview Metadata
- Epic: EPIC-010 Growth
- Priority: P1
- MVP: Yes
- Milestone: M2 - Private Alpha
- Story ID: GR-004

## User Story

As a participant, I want shareable plans so I can send the outcome to others.

## Description

Add safe preview metadata for plan links so shared invites and locked plans are understandable before opening.

## Acceptance Criteria

- Shared plan links have concise title and description metadata where supported.
- Private or unavailable plans do not leak sensitive details in previews.
- Locked plan previews differ from open invite previews.
- Preview behavior is tested on at least one web share path.

## Technical Notes

- Keep preview content minimal and privacy-aware.
- Use canonical plan share data rather than duplicating copy.

## Dependencies

- ISSUE-0029
- ISSUE-0073
- ISSUE-0076

## Future Considerations

- Rich previews for business packages or events can follow public launch.
