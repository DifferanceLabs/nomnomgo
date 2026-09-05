# ISSUE-0093: Real-user alpha invitations and accounts

- Epic: EPIC-005 Platform
- Backlog: NOW
- Priority: P0
- Status: Implemented and release approved; Supabase authentication and production activation pending

## Acceptance criteria

- Organizer creates a shared plan, invites another Google account, and both phones read the same server-owned plan.
- Each participant can change only their own RSVP and vote; participants can suggest places and invite others. Only the organizer edits the itinerary, removes participants, locks or reopens the plan.
- Updates refresh automatically while the shared plan is open, with connection failures visible and stale edits rejected. Locked plans still accept RSVPs.
- Plan links survive the DL login round trip and reveal nothing to nonmembers. Admin metrics count distinct shared plans, memberships, RSVPs, suggestions and votes.

- Hosted alpha retains the verified Differance Labs identity in an HTTP-only session; local Expo keeps the tester workflow.
- Accounts have isolated, durable personal favorites and plans, with conflict detection across devices.
- A signed-in tester can grant NomNomGo alpha access to a Google account email and compose an invitation in their own email or text app.
- Invitations have transactional per-inviter limits and a global alpha cap. Admins can inspect account, invitation, save and activity totals.
- A missing backend or failed save is visible and never presented as a successful cloud save.
- No changes to Google OAuth, DNS, or production database occur as part of implementation.

## Alpha scope

Phone browser testing includes real shared planning and synchronized RSVPs. Legacy personal drafts and old snapshot links remain separate from the shared-plan workspace. Client-reported Places usage is diagnostic, not a billing counter. Authoritative provider metering requires ISSUE-0088 before wider beta. All production approvals must be answerable from the user's mobile conversation; do not depend on desktop approval dialogs.

## Manual verification

See `docs/REAL_USER_ALPHA.md` for setup and the two-phone test.
