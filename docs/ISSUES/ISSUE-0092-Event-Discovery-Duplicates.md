# ISSUE-0092: Event discovery duplicates and sparse results

- Epic: EPIC-006 Reliability
- Backlog: NOW
- Priority: P1
- Status: Implemented; release verification in progress

## Problem

Asheville Events shows Acid Bath twice with conflicting venue addresses. The user reports it is the only show returned. Ticketmaster supplies four records for September 5 within ten miles: two Acid Bath listings, volleyball, and baseball. Provider coverage and application filtering must be distinguished.

## Acceptance criteria

- Merge duplicate listings for the same named event, start time, and matching venue/city while preserving distinct performances, venues, and cities.
- Prefer the more complete venue-linked listing without combining conflicting address/coordinate fields; expose address conflicts honestly.
- Verify the other provider-supplied events survive the app's date, location, and category filters.
- Avoid counting duplicates toward fallback eligibility. Do not silently truncate broad searches at 30 records.
- Show the event search scope and provider coverage limitation so a sparse result set is understandable.
- Add regression fixtures and checks; preserve the alpha gate and verify release builds before publishing.

## Implementation and validation

- Normalize matching event title, local start time, and venue identity; merge the two Acid Bath listings while preserving the more complete record intact. Surface the conflicting addresses in cards and details.
- Read up to five pages of 200 records, the Ticketmaster Discovery deep-paging limit, and disclose truncation. Invalidate old event caches. Count filtered unique events when deciding whether to fetch local place suggestions.
- Display event times in the venue timezone and show the actual search center, radius, date, and coverage limitation.
- Captured September 5 Asheville provider fixture: four records become three performances. Regression checks preserve volleyball, Acid Bath, and baseball; distinct times and venues remain separate.
- Browser check against live providers in the rebuilt app: create Asheville plan for September 5, Dinner; select Events; refresh twice. Each result set contains one Acid Bath, volleyball, and baseball, followed by date-unverified local suggestions. Acid Bath card and details show 5:00 PM and the address-conflict notice. At 390px viewport, document width remains 390px; no browser errors or warnings observed.
- `npm run verify`: 43 tests pass, including local-only provider time formatting; typecheck passes, lint has 17 existing warnings and no errors. Web build, Android export, iOS export, and Expo dependency compatibility check all pass. Production verification is required before declaring release complete.

## Coverage decision remains open

Starseer was absent from the direct Ticketmaster query, despite a September 5 listing on the local concert calendar. The duplicate fix does not add that show. The user requires dependable coverage across locations; an Asheville-specific feed is insufficient. See [provider evaluation plan](../EVENT_COVERAGE_EVALUATION_2026-09-04.md). No new provider or paid service is integrated in this issue.
