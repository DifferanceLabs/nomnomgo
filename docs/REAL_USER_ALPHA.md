# Real-user alpha activation and testing

Implementation: ISSUE-0093, EPIC-005, NOW. Production backend configured under the approved release; real Google/two-phone acceptance remains to be completed.

## What this release supports

- A verified Google account through the existing Differance Labs launcher, carried into a host-only, HTTP-only NomNomGo session lasting 12 hours.
- NomNomGo-owned account UUIDs and personal cloud favorites, saved plans and planning records. A fresh browser loads the same account's saved data. Existing local tester data is not imported.
- Shared plans use separate, normalized server records for membership, suggestions, votes and audit events. Every person changes only their own RSVP/vote. All members can suggest places and invite others; only the organizer changes details/itinerary, removes members, locks or reopens a plan. Locking stops itinerary edits, suggestions and votes, but keeps RSVPs available.
- Open shared plans refresh every five seconds, pause polling when hidden, and refresh on focus. Late poll responses cannot overwrite newer revisions. Manual refresh and connection/error states are visible; unavailable memberships clear the displayed plan.
- From **Include Someone**, **Shared plans & RSVPs** in the account menu/profile, or **Share/Invite** on an existing personal plan, open the shared workspace. Sharing a personal draft creates a central plan once; repeated sharing reopens that plan. Subsequent group edits belong in the shared workspace, not the original personal draft.
- Each signed-in account can invite a Google account email. The server creates only a NomNomGo grant, records the inviter, and reserves an alpha place. The sender then opens their email or SMS composer or copies the message. No email/SMS vendor is needed, and creating the invitation does not send a message.
- Invitations grant access until revoked. They are email-bound, not bearer links; using another Google account does not redeem the invitation. They do not expire automatically. Repeating your own existing invitation reuses it without counting again. Revoked invitation grants are not automatically restored.
- 10 new invitations per account per rolling 24 hours, 500 total account/invitation places, and 120 account API requests per account per minute. Database transactions enforce these limits.
- Admin-only aggregate counts: accounts, active accounts in seven days, invitations created/accepted, account loads, cloud saves, account API requests, retained planning records, saved plan copies, favorites, and client-reported Places searches this month.
- Shared-plan metrics also include distinct shared plans, locked plans, memberships, answered RSVPs, RSVP changes, suggestions, votes and plan invitations. A shared plan permits 30 members/30 itinerary stops/100 suggestions; each organizer can create 100 shared plans. Plan invitations are capped at 30 per member per rolling day, while new alpha accounts still use the stricter 10/day admission limit.

## Activation approval

This release needs a migration in the existing Differance Labs Supabase project because the alpha invitation adapter creates DL app grants. DL's `AGENTS.md` requires approval before applying production schema changes. NNG's `AGENTS.md` requires an explicit request before pushing to production.

All approvals must be requested in this conversation so the user can respond from mobile while away from the computer. A chat approval authorizes the described migration/deployment; it does not substitute for external service authentication. If service authentication is needed, provide a mobile-accessible login/device authorization link when available. Never require a desktop-only approval dialog or ask for secrets in chat.

Approval received in the mobile conversation on 2026-09-05 for both migrations, server configuration and the alpha production release. GitHub, Vercel and Supabase authentication are available. Both migrations have been applied to the existing Differance Labs database; all three server account variables, including the user-confirmed operator account, are configured in NomNomGo's production environment. Publishing follows the GitHub-to-Vercel runbook below; check both commit statuses before declaring a release live. Do not request deployment approval again for this unchanged scope.

1. Review and approve both `supabase/migrations/001_real_user_alpha.sql` and `002_shared_alpha_plans.sql`. Together they add eight NNG tables, indexes and service-only functions for accounts and shared planning. They do not alter existing DL tables or Google OAuth. Inviting a person later inserts their email into DL `users` if absent and grants only the `nomnomgo` app.
2. Both migrations were applied in order to the existing DL project on 2026-09-05. The `nomnomgo` app is active. Each migration is transactional and intended to be applied once; do not reapply them. All eight NNG tables have RLS enabled and deny reads to `anon` and `authenticated` roles.
3. Configure these **server-only** environment variable names on the NomNomGo Vercel project:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `NNG_ADMIN_EMAILS` (comma-separated approved operator Google emails; include the current DL operator)
   - Existing `DL_APP_LAUNCH_SECRET` must still match the DL launcher.
   Never prefix these with `EXPO_PUBLIC_`, print their values, or commit them.
4. Follow the root `AGENTS.md` production release runbook. Preserve unrelated worktree changes. Monitor GitHub verification and Vercel deployment, then check that unauthenticated access still displays the private-alpha gate.
5. Re-enter through Differance Labs after release. Old identity-free alpha cookies cannot open account data and require a fresh launch.

The approved activation has applied the production schema and configured server database access. No real person has been invited or sent a message by this release process.

## Two-phone acceptance test

1. On the organizer's phone, launch NomNomGo through DL with Google. The account menu should show the Google account email and no mock tester selector.
2. Choose **Include Someone → Create shared plan**, enter a title/date/time/location and save. Alternatively, create a plan using Now/Later and choose **Open shared plan & RSVPs** or **Share** to publish its itinerary into the shared workspace.
3. Under **Invite someone to this plan**, enter the other person's Google account email and choose **Prepare plan invitation**. Tap **Email invitation**, **Text invitation**, or **Share / copy invitation** and send it yourself. The link contains only a plan ID; forwarding it does not grant membership.
4. On the other phone, open the link, choose **Open with Differance Labs**, sign in with that Google account, then open NomNomGo in the DL launcher. Existing Google OAuth and launcher behavior are unchanged.
5. The invited plan should open after the DL round trip. If the browser did not retain redirect state, reopen the original invitation or use **Shared plans & RSVPs**. The invitee selects **Maybe**, adds a suggestion and votes for it. Without reloading, the organizer sees those changes within the next successful five-second refresh. Change RSVP again and verify it updates rather than adding a duplicate response.
6. The organizer adds the suggestion to the itinerary and locks the plan. The invitee sees the final itinerary and cannot edit or lock it, but can still RSVP. Reopen and verify suggestions/votes work again. Each member can invite another person using the same workflow. Admin refreshes usage and sees shared-plan activity.
7. Open the same account in two browsers, change the same saved collection in both, and verify the stale browser shows a save-conflict recovery screen. Reload intentionally restores the latest cloud state; unsaved edits are not merged.
8. Each person saves a private plan and favorites a place. A second browser signed into the same account sees those saves; a different account does not. Personal save conflicts require an intentional reload. Shared metadata conflicts preserve the edit form and ask the organizer to review/use the latest version.
9. Remove a plan participant and verify their next refresh clears the shared plan and further reads/RSVPs fail. Their separate alpha account remains available. Remove their NomNomGo grant in DL admin and verify all account/shared API access fails. Previously rendered data cannot be remotely erased from screenshots or other copies.
10. Test a fresh/incognito browser without a grant: it must remain gated. An alpha account without membership must not see the plan. Test local Expo separately: the original local tester workflow must still work.

The automated suite exercises the SQL in an isolated PostgreSQL-compatible runtime and tests API authentication, CSRF, scope, isolation, quotas, privilege revocation, concurrent RSVPs, idempotent votes, organizer permissions, locked-plan behavior and stale writes. The two-account browser test uses the actual API and migrations with a local database and synthetic signed identities, not Google or production Supabase. The real Google/two-phone test remains a post-activation check.

Browser verification: organizer created a plan and invited a second account; invitee joined, submitted Maybe and a voted suggestion; organizer received both automatically, added the stop and locked the plan; invitee saw the locked itinerary and changed RSVP to Can't make it. The invitee UI was inspected at 390px width.

Production database verification also exercised account creation, admission grants, shared plans, RSVP propagation, suggestions, votes and organizer locking as `service_role`, inside one transaction that was rolled back. No synthetic accounts, grants or plans were retained. Both RPCs are reachable through Supabase REST and reject an ungranted identity.

Local release checks passed: `npm run verify` (99 tests, type checking, lint with 17 existing warnings and no errors), web build, Android export, iOS export and `expo install --check`. All 27 alpha/account/shared-plan tests also passed after the final database locking adjustment. These checks do not replace production Google sign-in and the real two-phone acceptance test.

## Limits before wider beta

- New shared-plan links are live member-protected records. Legacy `#shared_plan` links remain labeled personal snapshots; they are not used for new shared invitations. Personal draft edits do not overwrite an already published group plan. Use its shared workspace for further changes.
- Existing collections retain up to 40 saved plans and 40 planning records per account. Cloud migration preserves these prototype caps. Counts represent retained copies, not unique group plans or lifetime plan creations.
- Personal cloud collections refresh on app load. Shared plans refresh automatically while open. There is no offline mutation queue or automatic merge. Personal save failures pause editing; shared failures show errors and keep the last confirmed state/drafts for retry. Manual suggestion IDs and plan source keys make ordinary retries idempotent.
- Account-load counts include reloads, not distinct Google authentications. Activity means a successful authenticated account request, not proof of planning activity. Failed unauthenticated requests are not included in account API totals.
- Places search counts are client-reported and incomplete. They exclude Ticketmaster, details calls and other request types and can be manipulated by a client. Complete authoritative provider counts, failures, latency and cost controls require the server proxy in ISSUE-0088. Vercel request counts are separate.
- Before hundreds of testers: provider proxy/metering, incident reporting, backups/restore, load tests and environment separation are still required. Measure five-second polling load and switch to push/subscriptions if needed. The 500-place guard is an admission limit, not a load-test result. Shared lists currently show the latest 200 memberships.
- A native app is not required for this phone-browser alpha. Native builds and app-store distribution can follow the product's mobile needs. HTTPS browsers can offer native sharing where supported; email and copy remain fallbacks ([MDN Web Share API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Share_API)).
- The temporary federation adapter is isolated in `api/_accountStore.js`, auth helpers, and the RPC grant/admission sections. NNG data uses its own UUIDs, tables and same-origin endpoints. A separate database/auth provider will require migrating this adapter, preserving account IDs and verifying identities; it is not a DNS-only migration.

## Rollback

Revert the NNG application release through the normal GitHub deployment flow. Retain NNG tables and saved data. Remove unwanted NomNomGo grants through existing DL admin controls; reverting code does not revoke grants already created. Do not drop data as part of rollback.
