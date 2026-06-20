# NomNomGo Closed Beta Roadmap

## Goal

Get non-technical test users planning successfully on native Android and iOS apps, with hosted web kept as a protected fallback through the temporary Differance Labs alpha gate.

Closed beta should prove that real groups can create, join, suggest, vote, lock, share, and save plans across devices without relying on local tester selection or Differance Labs authentication as permanent product auth.

## Product Posture

- Android and iOS apps are the primary beta experience.
- Hosted web remains available behind the Differance Labs alpha launch gate.
- Expo Go remains a development path, not the tester distribution path.
- NomNomGo product auth is independent from Differance Labs auth.
- DL launch auth stays web-only and temporary.
- Push notifications are required for closed beta plan coordination.
- Calendar handoff is required for locked plans, starting with add-to-calendar behavior.
- Server-side secrets never reach the browser or native client.

## Phase 1: Beta Foundation

Outcome: The team knows exactly who can enter beta, what they can test, and which platforms are supported.

Required work:

- Define the first beta cohort and tester allowlist.
- Confirm beta success metrics: plan creation, invite acceptance, suggestion participation, voting, locked outcomes, map opens, and feedback volume.
- Decide which features are in beta scope and which are deferred.
- Keep web alpha launch gating documented and tested.
- Create a simple tester support and feedback path.

Exit criteria:

- Beta scope is documented.
- Testers can be added or removed without code changes.
- Support contact and feedback expectations are ready for store review and tester onboarding.

## Phase 2: Independent Auth And Identity

Outcome: Testers sign in as real NomNomGo users across Android, iOS, and web.

Required work:

- Implement NomNomGo-owned auth separate from the DL web launch gate.
- Support Google sign-in across Android, iOS, and web.
- Support Sign in with Apple on iOS if Google sign-in is offered there.
- Add beta allowlist or invite-code access after identity is established.
- Replace the local tester selector with real user profiles.
- Add secure session persistence, refresh, expiry handling, and sign-out.
- Associate users with plans, invites, suggestions, votes, and locked outcomes.

Exit criteria:

- A tester can sign in on Android and iOS.
- Sessions survive normal app restarts.
- Expired or revoked sessions return to a clear auth state.
- Hosted web can require both DL launch access and NomNomGo product auth without mixing those responsibilities.

## Phase 3: Shared Backend And Data

Outcome: Plans work across users and devices instead of living only in local app storage.

Required work:

- Define API contracts for create plan, invite, join, suggest, vote, lock, share, and load.
- Persist users, profiles, planning sessions, participants, suggestions, votes, saved plans, and locked outcomes.
- Persist user devices and push notification tokens with clear ownership and revocation rules.
- Keep AsyncStorage as local cache only.
- Use invite tokens that are separate from DL launch tokens.
- Add basic authorization checks for plan reads and writes.
- Add provider failure handling so manual planning still works when Google Places or Ticketmaster fails.

Exit criteria:

- Two signed-in testers on different devices can complete one shared planning loop.
- A signed-in user's registered devices can be targeted for relevant plan notifications.
- Unauthorized users cannot read or mutate private plans.
- Provider failure does not block manual suggestions, voting, or locking.

## Phase 4: Native Mobile Distribution

Outcome: Beta testers install real app builds through expected Android and iOS channels.

Required work:

- Add complete iOS app config: bundle identifier, permissions, associated domains or URL scheme, and Apple sign-in capability.
- Expand EAS profiles for development, internal testing, closed beta, and production-ready builds.
- Configure push notification credentials for Android and iOS beta builds.
- Ship Android through Google Play internal testing first, then closed testing.
- Ship iOS through TestFlight.
- Prepare required store metadata: privacy policy, support contact, test notes, app description, screenshots where needed, and reviewer/demo access.
- Keep Expo Go usable for local development where possible, while auth-sensitive native behavior runs in development or preview builds.

Exit criteria:

- Android testers can install from Play testing.
- iOS testers can install from TestFlight.
- Android and iOS beta builds can request notification permissions and register push tokens.
- Store review paths have valid credentials or instructions.
- Build signing and environment configuration are reproducible.

## Phase 5: Mobile Planning Experience

Outcome: The core planning loop feels native enough for real-world tester use.

Required work:

- Deep links route invite links into the correct plan on Android, iOS, and web.
- Native share sheets can send invites and locked plans.
- Maps handoff opens the selected venue or route correctly.
- Calendar handoff or export works for locked plans, using the user's platform calendar where possible.
- Google-auth users can add locked plans to Google Calendar only after explicit calendar consent.
- iOS users can add locked plans to their device calendar, including Apple Calendar or other calendars configured on the device.
- Location permission states are clear and recoverable.
- Core screens pass an accessibility and small-screen layout review.
- Push notifications cover the closed beta event set: invited, vote needed, plan changed, and plan locked.
- Notification taps route to the relevant plan.

Exit criteria:

- A tester can join from a shared link on Android or iOS.
- A tester receives and opens relevant invite, vote, changed-plan, and locked-plan notifications.
- A locked plan can be opened in maps and saved or handed off to calendar.
- Calendar permissions are requested only after user intent, and unsupported paths have a clear fallback.
- The app is usable without desktop-only assumptions.

## Phase 6: Reliability, Safety, And Measurement

Outcome: The beta can be operated without guessing what broke.

Required work:

- Add privacy-conscious analytics for the planning funnel.
- Add client and server error logging for auth, invites, recommendations, voting, locking, push delivery, and calendar handoff.
- Add basic rate limits to auth, invite, vote, push registration, provider proxy, and launch-gate endpoints.
- Add health checks for core API dependencies.
- Add audit logs for sensitive state changes: auth, invite, vote, lock, admin, and support actions.
- Document backup, restore, and incident response basics.

Exit criteria:

- Core beta failures are observable.
- Planning conversion can be measured by platform.
- Abuse or runaway endpoint usage has basic protection.
- Support can investigate broken plans without exposing unnecessary private data.

## Phase 7: Closed Beta Launch And Learning

Outcome: A controlled group of testers uses NomNomGo in real planning situations and produces actionable product signals.

Required work:

- Start with a small trusted cohort, then expand only after Android and iOS install/auth issues are stable.
- Run structured test missions: create a plan, invite a friend, vote, lock a plan, open maps, save to calendar, and report friction.
- Include notification and calendar missions: receive an invite notification, receive a locked-plan notification, add the locked plan to calendar, and confirm the calendar event details.
- Track platform-specific issues separately for Android, iOS, and web.
- Review analytics and feedback weekly.
- Promote fixes through internal builds before widening the cohort.

Exit criteria:

- At least 10 active groups can complete the planning loop.
- At least 50 percent of created plans receive participation from more than one person.
- At least 30 percent of participated plans reach a locked outcome.
- The team can name the top beta blockers and next product bets from actual usage.

## Not Beta Blockers

- Full social graph.
- Business monetization.
- Agent platform.
- Advanced recommendation intelligence.
- Two-way calendar sync.
- Reading users' calendars to infer availability.
- Public launch provider hardening beyond what is needed for safe closed beta.

## Beta Readiness Summary

Closed beta is ready when Android and iOS users can authenticate with NomNomGo-owned identity, join shared plans from links, participate in the planning loop across devices, and give feedback through a supported distribution channel. Hosted web can remain useful, but it should not be the primary beta assumption.
