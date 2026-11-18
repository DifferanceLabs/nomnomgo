const { test } = require('node:test');
const assert = require('node:assert/strict');
const { starterOptions, swapOptions } = require('../.route-import-test-build/src/domain/starterOuting');
const { starterCandidates } = require('../.route-import-test-build/src/domain/starterSearch');
const { SearchExecution } = require('../.route-import-test-build/src/domain/searchExecution');
const { emptyProfile, starters } = require('../.route-import-test-build/src/domain/planStarters');

const center = { latitude: 36, longitude: -86 };
const timing = { date: '2026-11-21', start: 720, end: 930, now: Date.parse('2026-11-20T12:00:00Z') };
const selection = { id: 'friends', people: [], intent: 'both' };
function candidate(id, slot, distance, fields = {}) {
  return {
    slot,
    item: {
      id,
      title: id,
      subtitle: slot,
      lat: 36 + distance,
      lng: -86,
      types: [slot],
      durationMinutes: 45,
      ...fields,
    },
  };
}
const foods = [
  candidate('near cafe', 'food', 0.001),
  candidate('far cafe', 'food', 0.01, { types: ['coffee_shop'] }),
];
const activities = [candidate('park', 'activity', 0.002), candidate('gallery', 'activity', 0.006)];
const pool = [...foods, ...activities];
const options = (overrides = {}) =>
  starterOptions(
    overrides.pool || pool,
    center,
    overrides.timing || timing,
    overrides.profile || emptyProfile,
    overrides.selection || selection,
    overrides.context || 'local',
    overrides.favorites || [],
  );
test('each new starter produces the same nearby pair, alternatives preserve the other stop and order', () => {
  const expected = options()[0].stops;
  for (const { id, intent } of starters)
    assert.deepEqual(options({ selection: { id, intent, people: [] } })[0].stops, expected);
  assert.equal(expected.length, 2);
  const choices = options(),
    current = choices[0];
  for (const i of [0, 1]) {
    const swapped = swapOptions(choices, current, i)[0];
    assert.equal(swapped.stops[1 - i].item.id, current.stops[1 - i].item.id);
    assert.equal(swapped.stops[i].slot, current.stops[i].slot);
    assert.notEqual(swapped.stops[i].item.id, current.stops[i].item.id);
  }
  assert.equal(options({ selection: { ...selection, intent: 'food' } })[0].stops.length, 1);
});
test('exact group evidence can change a real stop and explain why, without crossing context', () => {
  const signal = {
    starter: 'friends',
    people: ['a'],
    kind: 'favorite',
    context: 'local',
    places: [{ id: 'far cafe', types: ['coffee_shop'] }],
  };
  const profile = { ...emptyProfile, signals: [signal] };
  const top = (s, c = 'local') =>
    options({ profile, selection: s, context: c, favorites: ['far cafe'] })[0].stops.find(
      (v) => v.slot === 'food',
    );
  assert.equal(top({ ...selection, people: ['a'] }).item.id, 'far cafe');
  assert.match(top({ ...selection, people: ['a'] }).reason, /favorited/);
  assert.equal(top(selection).item.id, 'near cafe');
  assert.equal(top({ ...selection, people: ['b'] }).item.id, 'near cafe');
  assert.equal(top({ ...selection, people: ['a'] }, 'travel').item.id, 'near cafe');
  profile.signals = [
    { ...signal, kind: 'different' },
    ...Array(30).fill({ ...signal, kind: 'plan-completed' }),
  ];
  assert.equal(top({ ...selection, people: ['a'] }).item.id, 'near cafe');
});
test('hours and fixed events determine order, with partial and missing provider results handled', () => {
  const morning = candidate('museum', 'activity', 0.003, { weeklyHours: ['Saturday: 12:00 PM – 1:00 PM'] });
  const evening = candidate('cafe', 'food', 0.001, { weeklyHours: ['Saturday: 1:00 PM – 4:00 PM'] });
  const optionsFor = (items) => options({ pool: items, timing: { ...timing, start: 725 } })[0]?.stops;
  const event = candidate('show', 'activity', 0.002, {
    eventStartMs: Date.parse('2026-11-21T12:10:00Z'),
    utcOffsetMinutes: 0,
  });
  assert.deepEqual(
    optionsFor([event, evening]).map((v) => v.item.id),
    ['show', 'cafe'],
  );
  assert.deepEqual(
    optionsFor([morning, foods[0]]).map((v) => v.item.id),
    ['museum', 'near cafe'],
  );
  assert.equal(optionsFor([candidate('closed', 'food', 0, { weeklyHours: ['Saturday: Closed'] })]), undefined);
  assert.equal(optionsFor([morning])[0].item.id, 'museum');
  assert.equal(optionsFor([foods[0], candidate('distant', 'activity', 1)]).length, 1);
  assert.equal(optionsFor([foods[0]])[0].hours, 'Hours unavailable — check with venue');
});
test('preview provider results cannot publish after cancellation and one source can fail independently', async () => {
  const execution = new SearchExecution(1);
  let finish;
  const pending = starterCandidates(
    'food',
    center,
    execution,
    {
      food: () =>
        new Promise((r) => {
          finish = r;
        }),
    },
    () => true,
  );
  execution.cancel();
  finish([foods[0].item]);
  await assert.rejects(pending, { name: 'AbortError' });
  const output = await starterCandidates(
    'both',
    center,
    new SearchExecution(2),
    {
      food: async () => {
        throw Error('offline');
      },
      activity: async () => activities.map((a) => a.item),
    },
    (_, p) => p.id === 'park',
  );
  assert.deepEqual(
    output.map((c) => c.item.id),
    ['park'],
  );
});
