# NomNomGo Roadmap

## Planning Horizon

This roadmap covers the next 12 to 24 months. Dates should be assigned in project issues or release plans once team capacity is known. The order matters more than the exact calendar.

Reliability work should begin immediately and continue through every phase.

## Phase 0: Product Operating System

Goal: Turn product direction into a maintainable execution framework.

Features:

- Vision, principles, roadmap, epics, and backlog tiers.
- Issue-ready epic structure.
- Agent working rules.
- Launch, monetization, and platform milestone map.

Success:

- Product work can be created from documented epics.
- Roadmap updates happen in the same pull requests as meaningful scope changes.

Primary documents:

- `docs/VISION.md`
- `docs/PRINCIPLES.md`
- `docs/ROADMAP.md`
- `docs/UNIFIED_PLAN_MODEL.md`
- `docs/EPICS/`
- `docs/BACKLOG/`
- `docs/AGENTS.md`

## Phase 1: Planning MVP

Goal: Small groups can create plans and decide where to go.

Features:

- Create plans.
- Invite users.
- Set date, time window, and search area.
- Venue suggestions.
- Voting.
- Lock final plan.
- Calendar export.
- Basic analytics and error logging.
- Alpha launch gate preserved for hosted web.

Success:

- 10 active groups.
- At least 50 percent of created plans receive participation from more than one person.
- At least 30 percent of participated plans reach a locked outcome.

Primary epics:

- `EPIC-001-Core-Planning.md`
- `EPIC-005-Platform.md`
- `EPIC-006-Reliability.md`
- `EPIC-010-Growth.md`

## Phase 2: Social Planning

Goal: Groups naturally return to NomNomGo.

Features:

- Friends.
- Group history.
- Saved places.
- Shared preferences.
- Reusable plans.
- Notifications.
- Shareable plan links.

Success:

- 100 recurring users.
- 25 recurring groups.
- Repeat plans from the same group within 30 days.

Primary epics:

- `EPIC-002-Social-Network.md`
- `EPIC-004-Mobile-App.md`
- `EPIC-010-Growth.md`

## Phase 3: Recommendation Intelligence

Goal: NomNomGo understands group preferences well enough to reduce search.

Features:

- Preference graph.
- Group recommendations.
- Historical behavior.
- Taste profiles.
- Recommendation feedback.
- Weather-aware, travel-aware, and time-aware suggestions.

Success:

- Users choose recommendations without leaving the app.
- Recommendation selections outperform manual suggestions for core planning sessions.
- Users give explicit feedback that improves later plans.

Primary epics:

- `EPIC-003-Recommendations.md`
- `EPIC-011-Relationship-Graph.md`
- `EPIC-006-Reliability.md`

## Phase 4: Business Platform

Goal: Businesses benefit from planning activity without compromising user trust.

Features:

- Venue profiles.
- Promotions.
- Reservations or reservation handoff.
- Referral tracking.
- Business dashboards.
- Campaign tracking.

Success:

- First revenue.
- First venue partners.
- Attribution proves that NomNomGo influenced real-world visits or bookings.

Primary epics:

- `EPIC-007-Monetization.md`
- `EPIC-009-Business-Tools.md`
- `EPIC-003-Recommendations.md`

## Phase 5: Agent Platform

Goal: NomNomGo becomes coordination infrastructure.

Features:

- Planning agents.
- Business agents.
- Personal assistant integrations.
- Shared planning APIs.
- Agent permissions and audit trails.

Success:

- External integrations create or update plans through approved APIs.
- Users can understand and approve agent actions.
- Businesses can respond to planning intent through controlled workflows.

Primary epics:

- `EPIC-008-Agent-Layer.md`
- `EPIC-011-Relationship-Graph.md`
- `EPIC-005-Platform.md`
- `EPIC-006-Reliability.md`

## Launch Milestones

### Alpha MVP

- Hosted web remains protected by the Differance Labs alpha launch gate.
- Local web and Expo development remain unblocked.
- Users can create, invite, suggest, vote, lock, and share a plan.
- Error logging exists for core planning flows.

### Private Beta

- Android and iOS apps are the primary tester experience, distributed through Play testing and TestFlight.
- NomNomGo-owned auth works on Android, iOS, and web without depending permanently on Differance Labs auth.
- Google sign-in is supported for beta users, with Sign in with Apple available on iOS where required by the auth mix.
- Invite flow supports non-technical users and routes correctly through mobile deep links.
- Mobile experience supports share sheets, maps handoff, push notifications for core plan events, and calendar handoff for locked plans.
- Calendar integration starts with explicit add-to-calendar behavior; deeper Google Calendar sync requires separate calendar consent beyond login.
- Analytics show plan creation, invite acceptance, vote participation, and locked outcomes.
- Support workflow exists for broken plans and user reports.

Primary document:

- `docs/CLOSED_BETA_ROADMAP.md`

### Public Launch

- Provider calls that require private credentials are moved behind a server-side proxy.
- Abuse, rate limiting, and monitoring are production-ready.
- Onboarding explains the planning loop quickly.
- NomNomGo can be deployed independently of Differance Labs architecture.

## Monetization Milestones

### Validation

- Track venue clicks, map opens, share events, and locked plan destinations.
- Identify venue categories where group planning intent is strongest.
- Interview users and venues before adding paid products.

### First Revenue

- Launch referral attribution or venue partner pilots.
- Keep sponsored recommendations clearly labeled.
- Avoid permanent paid service dependencies without approval.

### Repeatable Revenue

- Package business dashboards, offer management, campaign tracking, and premium planning.
- Define gross revenue, retention, and trust metrics before scaling ads or sponsorship.

## Agent Platform Milestones

### Internal Assistant

- Add an AI planning assistant that can summarize constraints and suggest next actions.
- Require human approval for invitations, locked plans, reservations, purchases, or business contact.

### Integration Preview

- Define planning session APIs, agent scopes, and audit logs.
- Allow approved external assistants to draft plans.

### Coordination Platform

- Support personal assistants, business agents, and group coordination agents.
- Use the relationship graph to improve context while preserving user control.
