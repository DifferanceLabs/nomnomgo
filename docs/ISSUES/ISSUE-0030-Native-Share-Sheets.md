# ISSUE-0030: Native Share Sheets

- Title: Native Share Sheets
- Epic: EPIC-004 Mobile App
- Priority: P0
- MVP: Yes
- Milestone: M1 - Local MVP
- Story ID: MA-003

## User Story

As a user, I want share sheets so I can invite through existing channels.

## Description

Add share behavior for plans using native share sheets where available and web sharing or copy fallback elsewhere.

## Acceptance Criteria

- Users can share an open plan invite.
- Users can share a locked plan outcome.
- Unsupported share APIs fall back to copyable links.
- Shared text is concise and does not include secrets or private tokens beyond the invite link.

## Technical Notes

- Use the canonical invite/share link format.
- Keep message copy outside provider-specific code.

## Dependencies

- ISSUE-0002
- ISSUE-0073
- ISSUE-0076

## Future Considerations

- Share copy can later be personalized by plan type or group.
