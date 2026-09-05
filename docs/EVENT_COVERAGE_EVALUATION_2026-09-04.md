# Event coverage evaluation

Decision: evaluate broad geographic coverage before choosing an additional provider. A single city's calendar cannot meet the user's requirement for reliable local discovery everywhere. No provider has been selected or purchased.

## What is established

- A live Ticketmaster query for Asheville within ten miles on September 5, 2026 returned four records: two Acid Bath listings, volleyball, and baseball. The app now deduplicates them into three performances. A separate Starseer query returned zero records.
- [Asheville FM's concert calendar](https://ashevillefm.org/concert-calendar/) and [Live Music Asheville](https://livemusicasheville.com/calendars/category/live-music/day/2026-09-05/) list Starseer with JusFine and Ryles Monroe at Fleetwood's that day. These establish a coverage gap, not a scalable integration source.
- [Ticketmaster Discovery](https://developer.ticketmaster.com/products-and-docs/apis/discovery-api/v2/) already includes its supported sources by default. Adding a source parameter will not turn it into a complete local calendar.
- NomNomGo's current Ticketmaster request explicitly restricts country to US. International discovery requires a separate change and cross-timezone date-boundary tests, even if the chosen provider supports other countries.
- Google place suggestions identify venues; they do not verify a performance on the selected date. Keep their unverified status visible.

## Candidates to evaluate

| Candidate | Why evaluate it | Evidence still needed |
| --- | --- | --- |
| Ticketmaster plus Songkick | [Songkick documents searches by artist, date, venue, and location](https://www.songkick.com/developer), making it a plausible music supplement. Access requires a partnership agreement and license fee. | Independent venue and small-town recall, exact Starseer example, update speed, deduplication quality, commercial display/caching rights, and cost. |
| Ticketmaster plus a broad event aggregator such as PredictHQ | [PredictHQ's event search documentation](https://docs.predicthq.com/api/events/search-events) is a starting point for evaluating multiple event categories. | Actual results for our benchmark, geographic/date entitlement limits, suitability for consumer listings and links, small-show coverage, and commercial terms. |

These are candidates, not verified recommendations. API availability or a large advertised inventory does not establish complete local coverage. Neither has been tested with licensed credentials in this review.

## Evaluation before integration

1. Agree on launch geography. Start a repeatable benchmark across large metros, midsize cities, and small towns in multiple regions; include Asheville and the Starseer example. If international launch is intended, include multiple countries and timezones.
2. Build a dated reference set from official venue and organizer calendars: independent concerts, arena shows, sports, festivals, community events, and free events. Include near-term and several-weeks-out dates.
3. Compare each provider and the combined set against that reference. Measure missing events by city and category, duplicates, incorrect date/time/address, cancellations, and last-update age. Track API latency, quota use, and cost at projected beta traffic.
4. Set pass thresholds before choosing a vendor. Report weak locations explicitly; an overall average can hide poor small-town coverage. Repeat the sample over several weeks to assess updates rather than only initial inventory.
5. Confirm consumer-display and caching rights and pricing. Bring concrete coverage results and cost to the user before committing to a paid integration.

## Proposed implementation after selection

Use a NomNomGo-owned server API with provider adapters, caching, and rate limits. Normalize listings while retaining source IDs, event links, venue timezone, last-checked time, cancellation state, and provenance. Extend conservative deduplication across providers. Route provider failures and data conflicts into the future admin console; only tell a user the admin was notified after that notification is durably recorded. Show coverage limitations honestly and allow missing-event reports.

This is proposed follow-up scope. The current duplicate release does not add this server, admin workflow, or another provider.
