# ISSUE-0093: Real-user alpha invitations and accounts

- Epic: EPIC-005 Platform
- Backlog: NOW
- Priority: P0
- Status: Implemented and release approved; production backend configured, real two-phone acceptance pending

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

## Alpha feedback: organizer RSVP visibility

The first real invitee signed in and opened the plan. Production records confirm their Going RSVP was saved, but the organizer did not see an update. The shared list currently shows only the viewer's own RSVP, and the main app has no shared-plan status. Invitation composition also needs a later usability pass.

Follow-up acceptance: show member RSVP counts in the shared list and main app; show clear saved feedback to the respondent and announce changed participant responses while viewing a plan. Resume refresh on phone focus, visibility, restored connectivity and page restoration, including refreshes skipped during a write. Keep participant data member-only and preserve private drafts. Email, SMS and push delivery of RSVP notifications remain outside this repair.
