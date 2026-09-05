# Core UX release review — September 4, 2026

Scope: ISSUE-0091. Tested the exported web app with real Google Places and Ticketmaster responses at desktop size and 390 × 844. This is representative scenario coverage, not proof of every possible combination of provider data, dates, permissions, devices, and preferences.

## Changes

- Search requests belong to the current user action. New searches and navigation cancel superseded provider requests; late responses cannot replace current manual-search results or loading state.
- Independent provider lookups run with a concurrency limit of three. Request timeouts include response-body parsing, and authentication/quota failures stop further calls to that provider for the current search.
- Final search caches are reused immediately. Cache identity includes timing, radius, result limit, and route context where relevant; refresh bypasses lower-level caches. Failed searches are not saved as successful empty results. Concurrent cache writes preserve each other's entries.
- Search has cancel, retry, partial-failure, and explicit manual-place recovery controls. A successful empty result is distinguished from a provider failure. First manual lookup shows loading immediately and clears an unrelated favorites filter.
- Web validation and handoff errors appear in dismissible dialogs instead of disappearing into React Native's unsupported web Alert implementation. Native alerts remain available on mobile.
- Tester sign-out removes the persisted selection before showing the selector. Restored plans retain invited people, RSVP state, date settings, time preference, and their search location.
- Repeated delayed auto-scrolls were reduced to a single cancellable scroll. Long suggested-place buttons wrap within narrow cards. Tester selection and the Google Maps route action have accessible button labels.
- Expo and expo-constants were updated to the compatible patch versions recommended by the installed SDK.

## Browser coverage

| Area | Exercised |
| --- | --- |
| Now food | Restaurants, Coffee, Dessert, Breakfast, Lunch, Dinner; real results; repeated/cached searches |
| Now activity | Outdoor, Family, Arcade, Bowling, Movie, Shopping, Entertainment; real results and Movie empty state |
| Search recovery | Rapid Outdoor → Bowling changes; keyboard submission; matching and nonsense manual queries; explicit manual insertion; navigation during search; unavailable location feedback |
| Locations | Explicit Franklin TN search and starting-location controls, cached-city discovery, unresolved browser GPS permission timeout |
| Later | All five date presets crossed with all five time preset controls; Tomorrow/Lunch group plan; custom Sep 12–13/Dinner plan; reversed date rejection |
| Preferences | Pizza + Vegetarian + No Fast Food; Bowling + Events + Dinner + Social + Rainy; future Ticketmaster event results; advanced controls |
| Places | Detail screen, favorite/save, favorites filter, add from list and detail, duplicate-add disabled state |
| Itinerary | Provider place plus manual idea; duration changes, expand/collapse, edit controls, all five travel mode controls, move-down reorder, totals/arrival changes |
| Plan lifecycle | Save, saved-plan load, finalize/review, unlock/edit, invited people and RSVP Maybe, reload persistence |
| Handoffs | Share preview opened/closed without sending; route chooser; successful web calendar download; route URL generation regression tests |
| Navigation/account | Home, Plans, Saved, Profile, Create; participant selection; sign-out followed by reload and tester selection |
| Responsive | Phone editor/share preview; long pairing label fixed and visually rechecked; document width and scroll width both 390px |

Observed local category completion times ranged from about 0.3 seconds for cached transitions to 0.9–1.3 seconds for several fresh lookups. These are walkthrough observations, not a production performance SLA or controlled before/after benchmark.

## Release checks

- `npm run verify`: pass, 37 tests; no lint errors, 17 pre-existing warnings.
- `npm run build:web`: pass.
- `npm run export:android`: pass.
- `npm run export:ios`: pass.
- `npx expo install --check`: dependencies up to date.
- Production must also pass GitHub Verify, Vercel deployment, and the unauthenticated launch-gate probe before the release is reported complete.

## Remaining scope and beta gaps

- Native device GPS permission behavior, native share sheets, actual calendar import, and physical navigation were not exercised on iOS/Android hardware. Exports validate packaging, not those integrations.
- Hidden road-trip/import/Tesla and session features retain their existing feature flags. Route helpers have unit coverage; hidden UI was not enabled for this release.
- Local tester sharing is still a prototype. Real accounts, durable cross-device plans/RSVPs, provider proxying, and the admin incident console remain separate architectural work. No error claims an administrator was notified: that requires confirmed durable incident delivery.
- Provider outage, delayed responses, malformed JSON, and 401/403/429 behavior were injected in regression tests, not by disrupting production accounts.
- Destructive saved-plan deletion and external message delivery were not completed during the walkthrough. Existing user data and recipients were not used as disposable test targets.
- The broader beta review remains in the separate project review/backlog changes; this release is focused on the demonstrated UX issues.
