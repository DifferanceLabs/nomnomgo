const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { deduplicateEvents, collectEventPages } = require('../.route-import-test-build/src/domain/eventDiscovery');
const fixture = require('./fixtures/ticketmaster-asheville-2026-09-05.json');

test('Asheville results retain volleyball and baseball and show Acid Bath once', () => {
  const unique = deduplicateEvents(fixture);
  assert.equal(unique.length, 3);
  assert.ok(unique.some(({ event }) => event.name.includes('Volleyball')));
  assert.ok(unique.some(({ event }) => event.name.includes('Tourists')));
  const acidBath = unique.find(({ event }) => event.name === 'Acid Bath');
  assert.equal(acidBath.event.id, 'G5eVZ_kQ1PtMl');
  assert.equal(acidBath.addressConflict, true);
  assert.equal(acidBath.event._embedded.venues[0].address.line1, '151 Thompson Ave.');
  assert.equal(acidBath.event._embedded.venues[0].location.latitude, '35.57600000');
  assert.deepEqual(deduplicateEvents([...fixture].reverse()).find(({ event }) => event.name === 'Acid Bath'), acidBath);
});

test('distinct times, venues, and cities remain separate performances', () => {
  const event = fixture.find((item) => item.id === 'G5eVZ_kQ1PtMl');
  for (const change of [
    (copy) => { copy.dates.start.localTime = '21:00:00'; },
    (copy) => { copy._embedded.venues[0].id = 'other'; copy._embedded.venues[0].name = 'A different stage'; },
    (copy) => { copy._embedded.venues[0].id = 'other'; copy._embedded.venues[0].city.name = 'Charlotte'; },
    (copy) => { delete copy.dates.start.localTime; },
  ]) {
    const copy = structuredClone(event);
    copy.id = 'different-event';
    change(copy);
    assert.equal(deduplicateEvents([event, copy]).length, 2);
  }
});

test('pagination includes later pages without requesting nonexistent pages', async () => {
  const calls = [];
  const result = await collectEventPages(async (page, size) => {
    calls.push({ page, size });
    return { page: { totalPages: 2 }, _embedded: { events: [page ? 'later show' : 'early show'] } };
  });
  assert.deepEqual(result, { events: ['early show', 'later show'], truncated: false });
  assert.deepEqual(calls, [{ page: 0, size: 200 }, { page: 1, size: 200 }]);
});

test('pagination reports the provider limit and stops after failure/cancellation', async () => {
  let calls = 0;
  const capped = await collectEventPages(async () => { calls += 1; return { page: { totalPages: 9 } }; });
  assert.equal(calls, 5);
  assert.equal(capped.truncated, true);
  calls = 0;
  await assert.rejects(collectEventPages(async () => {
    calls += 1;
    if (calls === 2) throw new Error('cancelled');
    return { page: { totalPages: 4 } };
  }), /cancelled/);
  assert.equal(calls, 2);
});

// Run the screen's real mapping and result-filter functions on the captured response.
function appFunction(name, context) {
  const source = ts.createSourceFile('App.tsx', fs.readFileSync('App.tsx', 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let value;
  function visit(node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) value = node;
    if (ts.isVariableDeclaration(node) && node.name.getText(source) === name) value = node.initializer;
    ts.forEachChild(node, visit);
  }
  visit(source);
  assert.ok(value, name);
  return vm.runInNewContext(ts.transpileModule(`(${value.getText(source)})`, { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText, context);
}

test('all three Asheville events survive the actual September 5 Events filters', () => {
  const context = {
    slot: 'activity', activitySelections: ['Events'], chargerFocused: false,
    memory: { neverRecommend: [] }, center: {}, resultRadiusMeters: 16093.44,
    planStartMs: Date.parse('2026-09-05T04:00:00Z'), planEndMs: Date.parse('2026-09-06T03:59:59Z'),
    activeTiming: { timePreference: 'Dinner' }, cardForActivePlanTiming: (card) => card,
    distanceMeters: () => 0, mapsSearchUrl: (query) => query,
  };
  context.BLOCKED_ACTIVITY_TERMS = appFunction('BLOCKED_ACTIVITY_TERMS', context);
  for (const name of ['formatEventDateText', 'ticketmasterEventToCard', 'hasKnownHours', 'isBadActivityResult', 'isRelevantActivityResult']) {
    context[name] = appFunction(name, context);
  }
  const cards = deduplicateEvents(fixture).map(({ event }) => context.ticketmasterEventToCard(event));
  const filter = appFunction('applyResultFilters', context);
  assert.equal(filter(cards).length, 3);
  const acidBath = cards.find((card) => card.title === 'Acid Bath');
  assert.match(acidBath.eventDateText, /5:00/); // Venue time, even for a Central-time viewer.
  assert.equal(acidBath.eventStartMs, Date.parse('2026-09-05T21:00:00Z'));
});
