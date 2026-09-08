# ISSUE-0091: Core UX Release Pass

- Epic: EPIC-004 Mobile App
- Priority: P0
- Backlog: NOW — Mobile Polish
- Milestone: M2 — Private Alpha
- Status: Implemented; local release checks passed

## Scope

Exercise active Now, Later, plan editing, discovery, saved plans, local participants, profile, and handoff flows on desktop and mobile web. Fix reproducible responsiveness, navigation, feedback, and layout problems while preserving current product intent and the hosted alpha gate. Use a representative combination matrix; unbounded provider data and physical native integrations cannot be exhaustively exercised in a browser.

## Acceptance Criteria

- September alpha follow-up: Going is green, Maybe yellow and Not going red in all RSVP controls, participant labels and plan summaries; labels/selection also communicate status without color.
- Audit every screen family and interaction category in the source; exercise active phone flows with representative empty, busy, error and populated states and distinguish runtime evidence from source review.
- Shared plans provide consistent navigation, compact Plan/People sections and clear recovery. Invitations, profile/friends, saves and discovery minimize repeated instructions and unnecessary steps.
- Search results and loading state belong to the latest user request; changing category, location, or search text cannot restore older results.
- Discovery does not serialize independent requests unnecessarily or continue unnecessary work after the user leaves.
- Empty/error states offer clear recovery without claiming an admin was notified before the incident service exists.
- Local tester sign-out persists across reload, and tested plan edits/save/lock flows remain usable.
- Manual entry and primary controls work on small screens and with keyboard input.
- Significant scope/architecture changes are raised with the user before implementation.
- Verification, web export, Android/iOS exports, and Expo compatibility checks pass before publication.
- Production is verified through GitHub, Vercel, and an unauthenticated gate probe.

## Validation

See the [September 7 alpha audit](../UX_AUDIT_2026-09-07.md) for the screen inventory, RSVP/shared-plan improvements, current runtime coverage and remaining physical-device/beta checks. The earlier [UX release review](../UX_RELEASE_REVIEW_2026-09-04.md) records the wider discovery/preset matrix. Production completion additionally requires successful GitHub/Vercel checks and an unauthenticated launch-gate probe.
