# ISSUE-0091: Core UX Release Pass

- Epic: EPIC-004 Mobile App
- Priority: P0
- Backlog: NOW — Mobile Polish
- Milestone: M2 — Private Alpha
- Status: Implemented; local release checks passed

## Scope

Exercise active Now, Later, plan editing, discovery, saved plans, local participants, profile, and handoff flows on desktop and mobile web. Fix reproducible responsiveness, navigation, feedback, and layout problems while preserving current product intent and the hosted alpha gate. Use a representative combination matrix; unbounded provider data and physical native integrations cannot be exhaustively exercised in a browser.

## Acceptance Criteria

- Search results and loading state belong to the latest user request; changing category, location, or search text cannot restore older results.
- Discovery does not serialize independent requests unnecessarily or continue unnecessary work after the user leaves.
- Empty/error states offer clear recovery without claiming an admin was notified before the incident service exists.
- Local tester sign-out persists across reload, and tested plan edits/save/lock flows remain usable.
- Manual entry and primary controls work on small screens and with keyboard input.
- Significant scope/architecture changes are raised with the user before implementation.
- Verification, web export, Android/iOS exports, and Expo compatibility checks pass before publication.
- Production is verified through GitHub, Vercel, and an unauthenticated gate probe.

## Validation

See [UX release review](../UX_RELEASE_REVIEW_2026-09-04.md) for tested combinations, changes, and limitations. Production completion additionally requires successful GitHub/Vercel checks and an unauthenticated launch-gate probe.
