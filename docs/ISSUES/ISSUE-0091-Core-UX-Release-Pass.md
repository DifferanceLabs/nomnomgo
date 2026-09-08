# ISSUE-0091: Core UX Release Pass

- Epic: EPIC-004 Mobile App
- Priority: P0
- Backlog: NOW — Mobile Polish
- Milestone: M2 — Private Alpha
- Status: Implemented; local release checks passed

## Scope

Exercise active Now, Later, plan editing, discovery, saved plans, local participants, profile, and handoff flows on desktop and mobile web. Fix reproducible responsiveness, navigation, feedback, and layout problems while preserving current product intent and the hosted alpha gate. Use a representative combination matrix; unbounded provider data and physical native integrations cannot be exhaustively exercised in a browser.

## Acceptance Criteria

- Plan header follow-up: one shared, scrollable plan heading contains its name, date/time, location, stop count, lock state and RSVP summary above the Plan/Friends tabs. Remove repeated identity/details cards below both tabs; names and metadata wrap on small screens. Keep title editing, timing pickers, lock permissions and existing tab content. Use the same header width and typography across both views, following [NN/g's in-page tab guidance](https://www.nngroup.com/articles/tabs-used-right/) for stable context and consistent tab behavior.
- September 8 navigation follow-up: Plan and Friends use one consistent full-width tab header. Friends opens RSVPs directly on the first tap. Locking keeps the same stop list and timing layout, while maps, sharing, overview and calendar remain available. Future and Past group the plan list using the final date, with today/ongoing trips in Future. Reopen is guarded against double taps; RSVP-only revision changes do not block itinerary saves, and real concurrent itinerary edits remain protected.
- Shared editor consolidation: shared Plan opens the full itinerary editor; People contains RSVPs, invitations, suggestions, and votes. Owner edits save to the existing shared plan with revision checks and stable stop IDs. Participants can view the itinerary but cannot edit or unlock it; conflicting edits remain local until the user reloads or resolves them. Leaving the editor saves first, and failures keep the user in the editor.
- Date/time picker follow-up: a tappable date above the start time opens a standard date picker; time uses a standard time picker instead of free text. Moving dates preserves multi-day duration and start time; both edits respect locking. Remove the automatic planning-window target warning and retain the calculated finish time.
- Add stop appears directly below the final stop (or the empty state), with its options underneath. Tapping the estimated start opens an inline time editor; valid changes shift arrivals, finish, and the target window while preserving durations. Locked plans cannot edit the start time.
- Plan-stop polish: activity stops use sparkles; travel mode and duration appear on a compact connector between stops, with no connector after the final stop. Expanding and reordering stops retain the correct travel leg.
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

- Plan header follow-up: full release verification passed (121 tests, 17 existing lint warnings, no errors), and web and Android/iOS exports passed. Local browser checks at 390px and 320px verified long-title wrapping, rename/save/tab round trips, identical header and tab placement across Plan/Friends, and disabled editing after locking. Physical native gestures remain unverified.
- September 8 navigation follow-up: full verification passed with the existing 17 lint warnings and no errors. Added regression coverage for direct Friends navigation, double-tap reopening, RSVP revision races, real itinerary conflicts, date grouping and multi-day summary data. Browser checks with simulated accounts at 390px and 320px confirmed the consistent header, unchanged layout after locking, direct RSVPs, duration-save round trips, Future/Past lists, and participant read-only controls with maps/sharing retained. Web and Android/iOS exports passed. Physical native gestures remain unverified.
- Shared editor consolidation: verification passed (17 existing lint warnings, no errors), with API coverage for full itinerary saves, membership preservation, stable IDs, stale revisions, and owner/lock enforcement. A local simulated shared account verified adding a stop, saving through People, returning to Plan, locking/unlocking, and the 390px editor layout. Web and Android/iOS exports and Expo compatibility checks passed; physical native gestures remain unverified.
- Date/time picker follow-up: typecheck, focused lint (existing App warnings only), 74 route/planning tests, web/Android/iOS exports, and Expo compatibility checks passed. Browser checks verified standard picker controls, changed dates and times, recalculated arrivals/finish, and date-above-time layout at 390px. Native picker gestures still require physical-device validation.
- Start-time/Add-stop follow-up: typecheck and 73 route/planning tests passed; lint retained 17 existing warnings and no errors. Local browser checks at 390px and 320px verified footer placement, readable time entry, synchronized arrivals/finish/target after changing 6:00 PM to 3:05 PM, reload persistence, and hidden edit controls after locking. Automated coverage includes midnight, invalid input, and a lock arriving while editing. Native device interaction is not yet verified.
- Local plan-stop follow-up: typecheck, focused component lint, and all 72 route/planning tests passed. At a 390px web viewport, verified a 24px travel connector between two manual stops, expanded-card placement, Drive-to-Walk updates, and Move down reordering with no connector after the final stop. Physical native drag gestures remain untested for this follow-up.
See the [September 7 alpha audit](../UX_AUDIT_2026-09-07.md) for the screen inventory, RSVP/shared-plan improvements, current runtime coverage and remaining physical-device/beta checks. The earlier [UX release review](../UX_RELEASE_REVIEW_2026-09-04.md) records the wider discovery/preset matrix. Production completion additionally requires successful GitHub/Vercel checks and an unauthenticated launch-gate probe.
