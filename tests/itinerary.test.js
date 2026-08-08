const test = require('node:test');
const assert = require('node:assert/strict');

const {
  DEFAULT_STOP_DURATION_MINUTES,
  DURATION_STEP_MINUTES,
  MIN_STOP_DURATION_MINUTES,
  adjustStopDurationMinutes,
  calculateItineraryTimeline,
  defaultItineraryStopDurationMinutes,
  formatItineraryDuration,
  inferItineraryStopKind,
  snapStopDurationMinutes,
} = require('../.route-import-test-build/src/domain/itinerary.js');

test('infers each visual stop kind while respecting explicit and manual choices', () => {
  assert.equal(inferItineraryStopKind({ explicitKind: 'dessert', slot: 'activity' }), 'dessert');
  assert.equal(inferItineraryStopKind({ explicitKind: 'food', slot: 'food', manual: true, title: 'Coffee idea' }), 'food');
  assert.equal(inferItineraryStopKind({ slot: 'food', manual: true, title: 'Dinner idea' }), 'idea');
  assert.equal(inferItineraryStopKind({ slot: 'activity', title: 'Museum cafe' }), 'activity');
  assert.equal(inferItineraryStopKind({ slot: 'food', title: "Jeni's Ice Creams" }), 'dessert');
  assert.equal(inferItineraryStopKind({ slot: 'food', types: ['bakery', 'store'] }), 'dessert');
  assert.equal(inferItineraryStopKind({ slot: 'food', title: 'Gyros King' }), 'food');
});

test('uses provider and event durations before centralized kind defaults', () => {
  assert.equal(
    defaultItineraryStopDurationMinutes({ slot: 'food', providerDurationMinutes: 68 }),
    75,
  );
  assert.equal(
    defaultItineraryStopDurationMinutes({
      slot: 'activity',
      eventStartMs: Date.UTC(2026, 7, 7, 18, 0),
      eventEndMs: Date.UTC(2026, 7, 7, 19, 8),
    }),
    75,
  );

  assert.equal(
    defaultItineraryStopDurationMinutes({ slot: 'food', title: 'Coffee House' }),
    DEFAULT_STOP_DURATION_MINUTES.coffee,
  );
  assert.equal(
    defaultItineraryStopDurationMinutes({ slot: 'food', explicitKind: 'food', title: 'Coffee House' }),
    DEFAULT_STOP_DURATION_MINUTES.coffee,
  );
  assert.equal(
    defaultItineraryStopDurationMinutes({ slot: 'food', title: 'Dinner' }),
    DEFAULT_STOP_DURATION_MINUTES.food,
  );
  assert.equal(
    defaultItineraryStopDurationMinutes({ slot: 'activity', title: 'City Museum' }),
    DEFAULT_STOP_DURATION_MINUTES.activityShort,
  );
  assert.equal(
    defaultItineraryStopDurationMinutes({ slot: 'activity', title: 'Escape Room' }),
    DEFAULT_STOP_DURATION_MINUTES.activityLong,
  );
  assert.equal(
    defaultItineraryStopDurationMinutes({ slot: 'activity', title: 'Local Workshop' }),
    DEFAULT_STOP_DURATION_MINUTES.activity,
  );
  assert.equal(
    defaultItineraryStopDurationMinutes({ slot: 'food', explicitKind: 'dessert' }),
    DEFAULT_STOP_DURATION_MINUTES.dessert,
  );
  assert.equal(
    defaultItineraryStopDurationMinutes({ slot: 'activity', explicitKind: 'idea' }),
    DEFAULT_STOP_DURATION_MINUTES.idea,
  );
  assert.equal(
    defaultItineraryStopDurationMinutes({ slot: 'food', manual: true }),
    DEFAULT_STOP_DURATION_MINUTES.idea,
  );
});

test('ignores invalid provider and event durations while preserving precedence', () => {
  const eventStartMs = Date.UTC(2026, 7, 7, 18, 0);
  const eventEndMs = Date.UTC(2026, 7, 7, 19, 0);

  assert.equal(
    defaultItineraryStopDurationMinutes({
      slot: 'activity',
      providerDurationMinutes: 90,
      eventStartMs,
      eventEndMs,
    }),
    90,
  );
  assert.equal(
    defaultItineraryStopDurationMinutes({ slot: 'food', providerDurationMinutes: 0 }),
    DEFAULT_STOP_DURATION_MINUTES.food,
  );
  assert.equal(
    defaultItineraryStopDurationMinutes({ slot: 'activity', providerDurationMinutes: -30 }),
    DEFAULT_STOP_DURATION_MINUTES.activity,
  );
  assert.equal(
    defaultItineraryStopDurationMinutes({
      slot: 'activity',
      eventStartMs: eventEndMs,
      eventEndMs: eventStartMs,
    }),
    DEFAULT_STOP_DURATION_MINUTES.activity,
  );
});

test('snaps durations to 15-minute increments and enforces the minimum', () => {
  assert.equal(DURATION_STEP_MINUTES, 15);
  assert.equal(MIN_STOP_DURATION_MINUTES, 15);
  assert.equal(snapStopDurationMinutes(22), 15);
  assert.equal(snapStopDurationMinutes(23), 30);
  assert.equal(snapStopDurationMinutes(82), 75);
  assert.equal(snapStopDurationMinutes(0), 15);
  assert.equal(snapStopDurationMinutes(Number.NaN), 15);
  assert.equal(adjustStopDurationMinutes(75, 1), 90);
  assert.equal(adjustStopDurationMinutes(75, -1), 60);
  assert.equal(adjustStopDurationMinutes(15, -1), 15);
});

test('formats minute, hour, and mixed durations compactly', () => {
  assert.equal(formatItineraryDuration(0), '0 min');
  assert.equal(formatItineraryDuration(30), '30 min');
  assert.equal(formatItineraryDuration(60), '1 hr');
  assert.equal(formatItineraryDuration(75), '1 hr 15 min');
  assert.equal(formatItineraryDuration(135), '2 hr 15 min');
  assert.equal(formatItineraryDuration(-15), '0 min');
  assert.equal(formatItineraryDuration(74.6), '1 hr 15 min');
});

test('recalculates downstream arrivals and finish after duration or order changes', () => {
  const original = calculateItineraryTimeline([
    { travelMinutes: 10, durationMinutes: 75 },
    { travelMinutes: 15, durationMinutes: 60 },
    { travelMinutes: 5, durationMinutes: 30 },
  ]);
  assert.deepEqual(original.stops.map((stop) => stop.arrivalMinutes), [10, 100, 165]);
  assert.equal(original.totalMinutes, 195);

  const longerFirstStop = calculateItineraryTimeline([
    { travelMinutes: 10, durationMinutes: 90 },
    { travelMinutes: 15, durationMinutes: 60 },
    { travelMinutes: 5, durationMinutes: 30 },
  ]);
  assert.deepEqual(longerFirstStop.stops.map((stop) => stop.arrivalMinutes), [10, 115, 180]);
  assert.equal(longerFirstStop.totalMinutes, 210);

  const reordered = calculateItineraryTimeline([
    { travelMinutes: 8, durationMinutes: 30 },
    { travelMinutes: 12, durationMinutes: 75 },
    { travelMinutes: 20, durationMinutes: 60 },
  ]);
  assert.deepEqual(reordered.stops.map((stop) => stop.arrivalMinutes), [8, 50, 145]);
  assert.equal(reordered.totalMinutes, 205);
});

test('supports overlapping charging-stop activities and many compact stops', () => {
  const overlapping = calculateItineraryTimeline([
    { travelMinutes: 20, durationMinutes: 60 },
    { travelMinutes: 3, durationMinutes: 30, overlapsPreviousArrival: true },
    { travelMinutes: 10, durationMinutes: 45 },
  ]);
  assert.deepEqual(overlapping.stops.map((stop) => stop.arrivalMinutes), [20, 20, 90]);
  assert.equal(overlapping.totalMinutes, 135);

  const manyStops = calculateItineraryTimeline(
    Array.from({ length: 20 }, () => ({ travelMinutes: 5, durationMinutes: 15 })),
  );
  assert.equal(manyStops.stops.length, 20);
  assert.equal(manyStops.stops[19].arrivalMinutes, 385);
  assert.equal(manyStops.totalMinutes, 400);
});
