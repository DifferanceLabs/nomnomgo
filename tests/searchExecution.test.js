const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { SearchExecution, mapConcurrent, isSearchCancelled } = require('../.route-import-test-build/src/domain/searchExecution');

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

test('parallel search work is bounded and results retain query order', async () => {
  const gates = Array.from({ length: 5 }, deferred);
  let active = 0;
  let peak = 0;
  const started = [];
  const result = mapConcurrent([0, 1, 2, 3, 4], async (index) => {
    started.push(index);
    peak = Math.max(peak, ++active);
    await gates[index].promise;
    active -= 1;
    return index;
  }, 2);
  assert.deepEqual(started, [0, 1]);
  gates[1].resolve();
  await new Promise(setImmediate);
  assert.deepEqual(started, [0, 1, 2]);
  gates.forEach((gate) => gate.resolve());
  assert.deepEqual(await result, [0, 1, 2, 3, 4]);
  assert.equal(peak, 2);
  assert.deepEqual(await mapConcurrent([], async (x) => x), []);
});

test('cancelling a search aborts the network and cannot accept its late response', async (t) => {
  const response = deferred();
  let signal;
  t.mock.method(global, 'fetch', async (_, init) => { signal = init.signal; return response.promise; });
  const execution = new SearchExecution(1);
  const pending = execution.json('Google Places', 'https://provider.test');
  execution.cancel();
  await assert.rejects(pending, isSearchCancelled);
  assert.equal(signal.aborted, true);
  response.resolve({ ok: true, json: async () => ({ places: ['stale'] }) });
  assert.equal(execution.successes, 0);
  assert.equal(execution.failures, 0);
});

test('the timeout also covers a response body that never finishes', async (t) => {
  let signal;
  t.mock.method(global, 'fetch', async (_, init) => {
    signal = init.signal;
    return { ok: true, json: () => new Promise(() => {}) };
  });
  const execution = new SearchExecution(1);
  await assert.rejects(execution.json('Google Places', 'https://provider.test', undefined, 15), /unavailable/);
  assert.equal(signal.aborted, true);
  assert.equal(execution.failures, 1);
});

for (const status of [401, 403, 429]) {
  test(`a ${status} stops further fan-out to that provider but preserves another provider`, async (t) => {
    let googleCalls = 0;
    t.mock.method(global, 'fetch', async (url) => {
      if (url.endsWith('/google')) { googleCalls += 1; return { ok: false, status }; }
      return { ok: true, json: async () => ({ events: ['available'] }) };
    });
    const execution = new SearchExecution(1);
    await assert.rejects(execution.json('Google Places', 'https://provider.test/google'), new RegExp(String(status)));
    await assert.rejects(execution.json('Google Places', 'https://provider.test/google'));
    assert.equal(googleCalls, 1);
    assert.deepEqual(await execution.json('Ticketmaster', 'https://provider.test/events'), { events: ['available'] });
    assert.equal(execution.successes, 1);
    assert.equal(execution.failures, 1);
  });
}

test('malformed JSON is a failure; successful empty results are not', async (t) => {
  t.mock.method(global, 'fetch', async () => ({ ok: true, json: async () => { throw new Error('raw provider detail'); } }));
  const execution = new SearchExecution(1);
  await assert.rejects(execution.json('Google Places', 'https://provider.test'), (error) => {
    assert.equal(error.message.includes('raw provider detail'), false);
    return true;
  });
  global.fetch = async () => ({ ok: true, json: async () => ({ places: [] }) });
  assert.deepEqual(await execution.json('Google Places', 'https://provider.test'), { places: [] });
  assert.equal(execution.successes, 1);
  assert.equal(execution.failures, 1);
});

// Exercise the actual screen handlers without mounting unrelated native UI.
function appHandler(name, context) {
  const source = ts.createSourceFile('App.tsx', fs.readFileSync('App.tsx', 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let initializer;
  function visit(node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) initializer = node;
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === name) initializer = node.initializer;
    ts.forEachChild(node, visit);
  }
  visit(source);
  assert.ok(initializer, name);
  const js = ts.transpileModule(`(${initializer.getText(source)})`, { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText;
  return vm.runInNewContext(js, context);
}

test('a newer manual search owns the results and loading state after an older lookup completes', async () => {
  const first = deferred();
  const second = deferred();
  let execution;
  const states = [];
  const context = {
    manualSearch: 'First', isPlanLocked: false, planningSuggestionMode: false, keyLoaded: true,
    searchRequestIdRef: { current: 0 },
    beginSearch() { execution?.cancel(); execution = new SearchExecution(++context.searchRequestIdRef.current); return execution; },
    getSearchLocation: async () => ({}),
    searchPlaceByText: (query) => query === 'First' ? first.promise : second.promise,
    cardForActivePlanTiming: (card) => card,
    setCards: (cards) => states.push(['cards', cards]),
    setLoading: (loading) => states.push(['loading', loading]),
    isSearchCancelled,
    PAGE_SIZE: 8,
  };
  for (const name of ['setManualSearchSubmitted', 'setResultFilter', 'setResultMode', 'setHasInitiatedSearch', 'setVisibleCount', 'setPreferencesOpen', 'setSearchNotice', 'scrollToResults', 'addLog', 'setSearchFailed']) context[name] = () => {};
  const handler = appHandler('runManualSearch', context);
  const older = handler('food');
  await new Promise(setImmediate);
  context.manualSearch = 'Second';
  const newer = handler('activity');
  await new Promise(setImmediate);
  second.resolve([{ title: 'Latest' }]);
  await newer;
  const finishedState = JSON.stringify(states);
  first.resolve([{ title: 'Stale' }]);
  await older;
  assert.equal(JSON.stringify(states), finishedState);
  assert.equal(states.filter((state) => state[0] === 'cards').at(-1)[1][0].title, 'Latest');
});

test('sign-out removes the persisted tester before showing the selector', async () => {
  const events = [];
  const handler = appHandler('signOutTester', {
    AsyncStorage: { removeItem: async (key) => events.push(key) },
    STORAGE_TESTER_USER: 'tester', cancelSearch: () => {}, closeTransientSurfaces: () => {},
    setTesterAuthenticated: (value) => events.push(value), addLog: () => {}, showToast: () => {},
  });
  await handler();
  assert.deepEqual(events, ['tester', false]);
});


test('restoring a shared plan preserves the invited people and RSVP state', () => {
  const restore = appHandler('confirmedPlanFromBetaRecord', {});
  const record = { id: 'plan', owner: 'BDM', participants: ['BDM', 'Alex', 'Jordan'], rsvps: { Alex: 'maybe' }, status: 'finalized', stops: [], dateWindow: 'tomorrow', planDateStart: '2026-09-05' };
  const restored = restore(record);
  assert.deepEqual(Array.from(restored.invitees), ['Alex', 'Jordan']);
  assert.equal(restored.rsvps.Alex, 'maybe');
  assert.equal(restored.status, 'locked');
  assert.equal(restored.planDateStart, '2026-09-05');
});


test('parallel provider results do not overwrite each other in the search cache', async () => {
  let stored = '{}';
  const write = appHandler('writeCachedSearch', {
    searchCacheWriteRef: { current: Promise.resolve() },
    AsyncStorage: {
      getItem: async () => stored,
      setItem: async (_, value) => { await new Promise(setImmediate); stored = value; },
    },
    addLog: () => {}, compactError: String,
  });
  await Promise.all([
    write('cache', 'coffee', [{ id: 'one' }], 40, 'Text'),
    write('cache', 'dinner', [{ id: 'two' }], 40, 'Text'),
  ]);
  assert.equal(JSON.parse(stored).coffee.cards[0].id, 'one');
  assert.equal(JSON.parse(stored).dinner.cards[0].id, 'two');
});
