# Unified Plan Model

NomNomGo should grow from one shared idea: "I want to do something with people."

The product entry points stay simple:

- Now
- Later
- Saved/Shared

Those entry points all create or load the same `Plan` shape. NomNomGo should not fork a separate trip product before the planning model needs it.

## Plan Types

`planType` is an internal classification, not a required upfront user choice.

- `local_plan`: one activity or a short same-day plan.
- `day_plan`: multiple stops or activities in one day. This is reserved for later expansion.
- `trip_plan`: a multi-day container that can later include lodging, transport, and itinerary details.

Current inference:

- Multi-day date ranges become `trip_plan`.
- Travel-like destination text, such as road trip, airport, hotel, resort, campground, national park, or beach, becomes `trip_plan`.
- Everything else remains `local_plan` for now.

Future inference can promote same-day multi-stop plans to `day_plan`, but the app should not force users to choose that today.

## Trip Plan Container

A `trip_plan` is a container for planning work, not a separate product.

Future trip plans may contain:

- Local plans inside the destination.
- Day plans for individual days.
- Lodging placeholders.
- Transport placeholders.
- Imported or pasted route context.
- Itinerary segments.

Do not build flights, hotels, rental cars, or booking flows until NomNomGo has a clear independent server-side model and product reason to own those surfaces.

## Road Trip Mode

Road Trip Mode is a future extension of `trip_plan`, represented by lightweight fields:

- `roadTripMode`
- `vehicleProfile`
- `chargingStops`
- `nearbyPlacesDuringCharging`

The initial vehicle profile supports placeholders such as:

- `tesla`
- `ev`
- `gas`
- `unknown`

Future road-trip itinerary units may include:

- Drive segment.
- Charging stop.
- Estimated dwell time.
- Nearby food, coffee, restrooms, parks, or activities.
- Things within a 5-10 minute walk.
- Open-in-Tesla or Google Maps handoff links.

## Tesla Source Of Truth Rule

NomNomGo must not compete with Tesla navigation and must not claim to provide final charging guidance.

User-facing framing:

"Useful stops and places near likely charging stops. Confirm charging route in Tesla before departure."

Tesla/app navigation remains the source of truth for:

- Actual charging route.
- Charger availability.
- State-of-charge estimates.
- Arrival battery estimates.
- Final driving directions.

NomNomGo can help collect places near likely charging stops, but users must confirm the charging route in Tesla before leaving.

## Future Route Ingestion

Google Maps route paste/import should remain a planning input.

Future work:

- Preserve route origin, destination, and ordered waypoints.
- Detect likely drive segments.
- Detect candidate charging stops when the user included them manually.
- Let users paste a Google Maps route URL into a trip plan without changing NomNomGo into a navigation product.

## Future POI Discovery Near Charging Stops

Future discovery should search near charging stop coordinates for:

- Food.
- Coffee.
- Restrooms.
- Parks.
- Short walks.
- Quick activities.

This discovery should be framed as place ideas during charging dwell time, not as charging-route guidance.
