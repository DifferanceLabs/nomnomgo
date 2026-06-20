# ISSUE-0088: Server-Side Provider Proxy

- Title: Server-Side Provider Proxy
- Epic: EPIC-005 Platform
- Priority: P1
- MVP: No
- Milestone: M5 - Public Launch
- Story ID: PF-004A

## User Story

As a developer, I want provider calls to move behind a server-side API proxy so public production does not expose private provider credentials.

## Description

Create a NomNomGo-owned server-side proxy path for provider calls before serious public production use.

## Acceptance Criteria

- Google Places and Ticketmaster calls can be routed through server-side endpoints where private credentials are required.
- Client code does not receive server-side provider secrets.
- Proxy endpoints include rate limiting and provider failure handling.
- Local and Expo development workflows remain documented and usable.

## Technical Notes

- Keep proxy architecture independently deployable from Differance Labs.
- Preserve existing `EXPO_PUBLIC_` behavior only where it is intentionally client-visible.

## Dependencies

- ISSUE-0020
- ISSUE-0021
- ISSUE-0039
- ISSUE-0046
- ISSUE-0051

## Future Considerations

- Provider caching, quota management, and partner-specific provider access can be added after public launch.
