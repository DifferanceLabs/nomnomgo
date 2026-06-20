# NOW

Build immediately.

The NOW backlog should stay small enough to execute. Each item should map to a GitHub issue, one primary epic, acceptance criteria, and manual testing notes.

## Priority 1: Planning MVP

- Auth.
- Planning sessions.
- User invites.
- Venue suggestions.
- Voting.
- Plan locking.

Issue-ready outcomes:

- A user can create a plan.
- A participant can join from an invite.
- Participants can suggest venues.
- Participants can vote.
- The organizer can lock a final plan.
- The locked plan can be shared or saved.

Primary epics:

- `EPIC-001-Core-Planning.md`
- `EPIC-005-Platform.md`
- `EPIC-010-Growth.md`

## Priority 2: Production Basics

- Error logging.
- Analytics.
- Rate limiting.
- Provider failure handling.
- Alpha launch gate regression coverage.

Issue-ready outcomes:

- Core planning failures are observable.
- Core funnel events are measurable.
- Sensitive endpoints have basic rate limits.
- Hosted web still requires valid launch access.
- Mobile and local Expo development remain unbroken.

Primary epic:

- `EPIC-006-Reliability.md`

## Priority 3: Mobile Polish

- Share flow polish.
- Deep link handling.
- Maps handoff.
- Calendar export or calendar handoff.
- Accessibility pass on core planning screens.

Primary epic:

- `EPIC-004-Mobile-App.md`

## Exit Criteria

NOW work can move to NEXT when:

- 10 active groups can complete a planning loop.
- Planning funnel analytics exist.
- Critical error paths are logged.
- Manual QA covers create, invite, suggest, vote, and lock.
