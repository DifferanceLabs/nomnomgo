const { test } = require('node:test');
const assert = require('node:assert/strict');
const { starterOptions, swapOptions, fitReplacement } = require('../.route-import-test-build/src/domain/starterOuting');
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
      types: [slot === 'food' ? 'restaurant' : 'bowling_alley'],
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
test('automatic activities require an evidenced experience even for highly rated or favorably named landmarks', () => {
  const bare = candidate('Guided Tours Trail Park', 'activity', 0, { types:['park','tourist_attraction'], rating:5, ratingCount:9200 });
  const monument = candidate('Memorial', 'activity', 0, { types:['historical_landmark'], editorialSummary:{text:'Former playground. No guided tours.'} });
  const trails = candidate('Regional park', 'activity', 0.02, { types:['park'], editorialSummary:{text:'Woodland trails and a pond.'} });
  const closed = candidate('Closed museum', 'activity', 0, {types:['museum'],businessStatus:'CLOSED_TEMPORARILY'});
  assert.deepEqual(options({pool:[bare,monument,closed]}),[]);
  assert.equal(options({pool:[bare,monument,trails,closed]})[0].stops[0].experience,'Walk the trails');
  const cityPark=candidate('City park','activity',0.01,{types:['park'],editorialSummary:{text:'Urban park with a replica and museum.'}});
  assert.equal(options({pool:[cityPark]})[0].stops[0].experience,'Visit the on-site museum');
  const reviewed = {...trails,review:{id:trails.item.id,slot:'activity',quality:0,feature:''}};
  assert.deepEqual(options({pool:[reviewed]}),[]);
});
test('search swaps may choose a new place or a deliberate landmark, preserving order and checking the entire outing', () => {
  const current=options()[0];
  const index=current.stops.findIndex(s=>s.slot==='activity');
  const fit=c=>fitReplacement(current,index,c,center,timing,emptyProfile,selection,'local',[]);
  const landmark=candidate('Local monument','activity',0.002,{types:['monument']});
  const replacement=fit(landmark);
  assert.equal(replacement.stops[index].item.id,'Local monument');
  assert.equal(replacement.stops[1-index].item.id,current.stops[1-index].item.id);
  assert.equal(fit(foods[0]),undefined);
  assert.equal(fit(current.stops[index]),undefined);
  assert.equal(fit(candidate('Too far','activity',1)),undefined);
  assert.equal(fit(candidate('Closed','activity',0.002,{weeklyHours:['Saturday: Closed']})),undefined);
});
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
