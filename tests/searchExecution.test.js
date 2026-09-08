const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { SearchExecution, mapConcurrent, isSearchCancelled } = require('../.route-import-test-build/src/domain/searchExecution');
const { areaSearchRadius, isInsideSearchArea, locationForArea, superchargerForSearchArea, METERS_PER_MILE } = require('../.route-import-test-build/src/domain/searchArea');
const { currentHoursDisplay, readPlaceHours, PLACE_HOURS_FIELDS } = require('../.route-import-test-build/placeHours');

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
function appHandler(name, context, filename = 'App.tsx') {
  const source = ts.createSourceFile(filename, fs.readFileSync(filename, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
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

test('place details reuse fresh special hours and refresh stale or regular-only data', async () => {
  let details;
  let calls = 0;
  const context = {
    placeDetailRequestRef: { current: 0 }, GOOGLE_API_KEY: 'test-key',
    currentHoursDisplay, readPlaceHours, PLACE_HOURS_FIELDS,
    cardForActivePlanTiming: (card) => ({ ...card, ...currentHoursDisplay(card) }),
    setPlaceDetailCard: (update) => { details = typeof update === 'function' ? update(details) : update; },
    canResolvePlaceWebsite: () => true, placeDetailsLookupId: (card) => card.id,
    recordPlacesUsage: async () => {}, withTimeout: (promise) => promise,
    setCards: () => {}, addLog: () => {},
    fetch: async (_, init) => {
      calls += 1;
      assert.ok(init.headers['X-Goog-FieldMask'].includes('currentOpeningHours'));
      return { ok: true, json: async () => ({ currentOpeningHours: { openNow: false } }) };
    },
  };
  const open = appHandler('openPlaceDetails', context);
  const fresh = { id: 'coffee', ...readPlaceHours({ currentOpeningHours: { openNow: false } }) };
  await open(fresh);
  assert.equal(calls, 0);
  assert.equal(details.isOpen, false);
  await open({ ...fresh, hoursFetchedAt: Date.now() - 6 * 60_000 });
  assert.equal(calls, 1);
  assert.equal(details.isOpen, false);
  await open(details);
  assert.equal(calls, 1);
  await open({ id: 'regular-only', ...readPlaceHours({ regularOpeningHours: { openNow: true } }) });
  assert.equal(calls, 2);
  assert.equal(details.isOpen, false);
  await open({ ...fresh, openNow: true, hoursNextChange: new Date(Date.now() - 1000).toISOString() });
  assert.equal(calls, 3);
});

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
    getAlphaAccount: () => null,
    AsyncStorage: { removeItem: async (key) => events.push(key) },
    STORAGE_TESTER_USER: 'tester', cancelSearch: () => {}, closeTransientSurfaces: () => {},
    setTesterAuthenticated: (value) => events.push(value), addLog: () => {}, showToast: () => {},
  });
  await handler();
  assert.deepEqual(events, ['tester', false]);
});

test('hosted sign-out clears the server session before reloading and never opens a tester selector', async () => {
  const events = [];
  const handler = appHandler('signOutTester', {
    getAlphaAccount: () => ({ email: 'real@example.com' }),
    signOutAlphaAccount: async () => events.push('server logout'),
    Platform: { OS: 'web' }, window: { location: { reload: () => events.push('reload') } },
    showToast: () => events.push('error'),
  });
  await handler();
  assert.deepEqual(events, ['server logout', 'reload']);
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

test('the actual text search narrows requests and results, with separate caches for each area radius', async () => {
  const requests = [];
  const keys = [];
  const center = { latitude: 35.9251, longitude: -86.8689, label: 'Downtown', areaFocus: { radiusMeters: METERS_PER_MILE, placeId: 'district' } };
  const execution = {
    check() {}, refresh: false,
    async json(_, __, init) {
      requests.push(JSON.parse(init.body));
      return { places: [{ id: 'near', title: 'Coffee', lat: center.latitude, lng: center.longitude }, { id: 'far', title: 'Coffee', lat: 40, lng: -87 }] };
    },
  };
  const search = appHandler('searchPlaceByText', {
    GOOGLE_API_KEY: 'test-key', FIELD_MASK: 'places.id', DEFAULT_ACTIVITY_RADIUS_METERS: 10000,
    areaSearchRadius, isInsideSearchArea, textSearchCacheKey: () => 'coffee',
    STORAGE_TEXT_SEARCH_CACHE: 'cache', TEXT_SEARCH_CACHE_TTL_MS: 1,
    readCachedSearch: async (_, key) => { keys.push(key); }, writeCachedSearch: async () => {},
    addLog: () => {}, recordPlacesUsage: async () => {}, normalizePlaceName: (value) => value,
    toCard: (card) => card, distanceMeters: () => 0, scoreCard: () => 0, memory: {}, selectedMoods: [],
  });
  assert.deepEqual(Array.from(await search('Coffee', 'food', center, undefined, execution), (card) => card.id), ['near']);
  assert.equal(requests[0].locationBias.circle.radius, METERS_PER_MILE);
  await search('Coffee', 'food', { ...center, areaFocus: { ...center.areaFocus, radiusMeters: 5 * METERS_PER_MILE } }, undefined, execution);
  assert.notEqual(keys[0], keys[1]);
  assert.equal(requests[1].locationBias.circle.radius, 5 * METERS_PER_MILE);
  await search('Coffee', 'food', center, { radiusMeters: 1000 }, execution);
  await search('Coffee', 'food', { ...center, areaFocus: { ...center.areaFocus, radiusMeters: 5 * METERS_PER_MILE } }, { radiusMeters: 1000 }, execution);
  assert.notEqual(keys[2], keys[3]); // Same provider bias, different final result boundary.
});

test('sparse food results never expand outside an explicitly selected area', () => {
  const context = { slot: 'food', center: { areaFocus: { radiusMeters: 1609 } }, routeBias: undefined,
    wantsCloseBy: () => false, foodSelections: [], effectiveRadiusMeters: 1609, EXPANDED_FOOD_RADIUS_METERS: 50000, MIN_FOOD_RESULTS_BEFORE_EXPAND: 8 };
  const shouldExpand = appHandler('shouldExpand', context);
  assert.equal(shouldExpand(0), false);
  context.center = {};
  assert.equal(shouldExpand(0), true);
});

function areaSelectionHarness(overrides = {}) {
  const events = [];
  const base = { latitude: 35.9251, longitude: -86.8689, label: 'Franklin, TN' };
  let execution;
  const context = {
    locationForArea, isSearchCancelled,
    GOOGLE_API_KEY: 'test-key', activePlanningSession: null, activeSearchLocation: null,
    searchLocationOverride: 'Franklin, TN', manualSearch: '', manualSearchSubmitted: false, resultMode: 'food',
    searchRequestIdRef: { current: 0 },
    beginSearch() { execution?.cancel(); execution = new SearchExecution(++context.searchRequestIdRef.current); return execution; },
    getAreaBaseLocation: async () => base,
    recordPlacesUsage: async () => {},
    findSearchAreas: async (_, kind) => [{ ...base, id: kind, label: `${kind} match`, address: 'Franklin, TN', description: 'Area' }],
    saveSearchLocation: async (next) => { events.push(['saved', next]); context.activeSearchLocation = next; },
    setSearchLocationOverride: (value) => { context.searchLocationOverride = value; },
    searchForSlot: (slot, scroll, refresh, center) => { context.beginSearch(); events.push(['main', slot, center]); },
    runManualSearch: (slot, center) => { context.beginSearch(); events.push(['manual', slot, center, context.manualSearch]); },
    setLoading: (value) => events.push(['loading', value]),
    setSearchNotice: (value) => events.push(['notice', value]),
    setCards: (value) => events.push(['cards', value]),
    setAreaSelection: () => {}, setHasInitiatedSearch: () => {}, setResultFilter: () => {}, setSearchFailed: () => {},
    ...overrides,
  };
  return { context, events, base, select: appHandler('selectSearchArea', context), load: appHandler('loadSearchAreas', context) };
}

test('Current location requests fresh GPS rather than a cached route address and handles denial', async () => {
  let permission = 'granted', calls = 0;
  const get = appHandler('getCurrentJourneyOrigin', { setTimeout, clearTimeout, Location: {
    Accuracy: { Balanced: 3 }, requestForegroundPermissionsAsync: async () => ({ status: permission }),
    getCurrentPositionAsync: async () => { calls++; return { coords: { latitude: 36, longitude: -86, accuracy: 5, altitude: 80 } }; },
  } }, 'src/ui/GettingThereRow.tsx');
  const origin = await get();
  assert.equal(origin.latitude, 36); assert.equal(origin.longitude, -86); assert.equal(origin.label, 'Current location');
  assert.equal(Object.keys(origin).length, 3);
  await get(); assert.equal(calls, 2);
  permission = 'denied';
  await assert.rejects(get(), /choose an address/);
  assert.equal(calls, 2);
});

test('a double tap on Unlock waits for one reopen request without showing a stale error', async () => {
  const pending = deferred(); let calls=0, opened, error;
  const context = {
    sharedEditor: {id:'plan',revision:1,status:'locked'}, sharedEditorReadOnly:false,
    sharedEditorRef:{current:{id:'plan',revision:2,status:'locked'}},
    sharedStatusChangingRef:{current:false}, setSharedStatusChanging:()=>{},
    changeSharedItinerary: async(base,action)=>{calls++;assert.equal(base.revision,2);assert.equal(action,'plan.reopen');return pending.promise;},
    openSharedPlanEditor:plan=>{opened=plan;},setSharedEditorConflict:value=>{error=value;},compactError:String,
  };
  const unlock=appHandler('unlockPlan',context);
  const first=unlock();await unlock();assert.equal(calls,1);
  pending.resolve({id:'plan',revision:3,status:'planning'});await first;
  assert.equal(opened.status,'planning');assert.equal(error,undefined);assert.equal(context.sharedStatusChangingRef.current,false);
});

test('the first Friends action opens RSVPs directly after creating the shared plan', async () => {
  let workspace;
  const context = {
    sharedEditor:null,sharedPublishingRef:{current:false},
    ensureActiveBetaPlanRecord:async()=>({id:'local',title:'Lunch',stops:[]}),
    activePlanDateRange:{start:'2026-09-08',end:'2026-09-08'},
    createSharedPlan:async()=>({id:'shared'}),setSharePreviewOpen:()=>{},setPlanPeopleOpen:()=>{},
    setSharedWorkspace:value=>{workspace=value;},showAppNotice:()=>assert.fail('unexpected error'),compactError:String,
  };
  await appHandler('openCurrentSharedPlan',context)();
  assert.equal(workspace.plan.id,'shared');assert.equal(workspace.section,'people');
});

test('shared editor restores stable stops, typed activity icons, single-clock time, and locked arrivals', () => {
  const context = { scheduleFromFirstArrival: require('../.route-import-test-build/src/domain/itinerary').scheduleFromFirstArrival };
  for (const name of ['clockMinutes', 'clockTimeFromMinutes', 'formatClockTime', 'clockTimePlusMinutes', 'timeWindowFromStartClock', 'parseClockMinutes']) context[name] = appHandler(name, context);
  const restore = appHandler('confirmedPlanFromSharedPlan', context);
  const result = restore({ title: 'Lunch', ownerId: 'owner', status: 'locked', intent: 'both', locationLabel: 'Downtown', dateStart: '2026-09-08', dateEnd: '2026-09-08', timeWindow: '1pm', suggestions: [], stops: [
    { id: 'stable', kind: 'food', place: { title: 'Tacos', provider: 'google_places', providerId: 'provider-id', latitude: 35, longitude: -82 }, durationMinutes: 75, arrivalTime: '1:20 PM' },
  ] });
  assert.equal(result.stops[0].key, 'stable');
  assert.equal(result.stops[0].visualType, 'food');
  assert.equal(result.stops[0].item.lat, 35);
  assert.equal(result.timeWindow, '1:20 PM - 4:20 PM');
  assert.equal(result.status, 'locked');
  assert.equal(result.lockedArrivalTimes.stable.hours, 13);
  assert.equal(result.lockedArrivalTimes.stable.minutes, 20);
});

test('date picker moves a multi-day plan across month boundaries without changing its time or locked plans', () => {
  const context = {
    isPlanLocked: false,
    activePlanDateRange: { start: '2026-09-07', end: '2026-09-09' },
    activePlanTimeWindow: '4:00 PM - 7:00 PM',
    selectedDateWindowRef: { current: 'today' }, customDateRangeRef: { current: null },
  };
  for (const name of ['formatDateInput', 'addLocalDays']) context[name] = appHandler(name, context);
  for (const name of ['setSelectedDateWindow', 'setCustomDateRange', 'setCustomDateStartInput', 'setCustomDateEndInput', 'setArrivalTimes']) context[name] = () => {};
  const stops = [{ key: 'dinner', durationMinutes: 75 }];
  let plan = { status: 'draft', stops, savedPlanId: 'saved' };
  context.setPlan = (update) => { plan = update(plan); };
  const change = appHandler('savePlanStartDate', context);
  change(new Date(2026, 8, 30, 16, 0));
  assert.equal(plan.planDateStart, '2026-09-30');
  assert.equal(plan.planDateEnd, '2026-10-02');
  assert.equal(plan.timeWindow, context.activePlanTimeWindow);
  assert.equal(plan.stops, stops);
  assert.equal(plan.dateWindow, 'custom');
  assert.equal(context.selectedDateWindowRef.current, 'custom');
  assert.equal(plan.savedPlanId, undefined);
  const moved = plan;
  change(new Date(NaN));
  assert.equal(plan, moved);
  plan = { ...plan, status: 'locked' };
  const locked = plan;
  change(new Date(2026, 9, 10));
  assert.equal(plan, locked);
  context.isPlanLocked = true;
  context.setPlan = () => assert.fail('Locked date cannot be changed');
  change(new Date(2026, 9, 10));
});

test('editing the plan start shifts its window, including midnight, and protects locked plans', () => {
  const context = {};
  for (const name of ['clockMinutes', 'clockTimeFromMinutes', 'formatClockTime', 'clockTimePlusMinutes', 'timeWindowFromStartClock', 'parseClockMinutes', 'parsePlanningTimeWindow']) {
    context[name] = appHandler(name, context);
  }
  let plan;
  let arrivals;
  Object.assign(context, {
    isPlanLocked: false,
    startTimeDraft: '11:30 PM',
    activePlanTimeWindow: '3:05 PM - 6:05 PM',
    setPlan: (update) => { plan = update(plan); },
    setArrivalTimes: (value) => { arrivals = value; },
  });
  const save = appHandler('savePlanStartTime', context);
  const stops = [{ key: 'dinner', durationMinutes: 75 }, { key: 'activity', durationMinutes: 90 }];
  plan = { status: 'draft', stops, savedPlanId: 'old-save', lockedArrivalTimes: { dinner: { hours: 16, minutes: 0 } } };
  save(context.startTimeDraft);
  assert.equal(plan.timeWindow, '11:30 PM - 2:30 AM');
  assert.equal(plan.stops, stops);
  assert.equal(plan.savedPlanId, undefined);
  assert.equal(plan.lockedArrivalTimes, undefined);
  assert.equal(Object.keys(arrivals).length, 0);
  const updated = plan;
  for (const invalid of ['25:00', '13:05 PM', '0 AM', '4:75 PM', 'noon-ish']) {
    context.startTimeDraft = invalid;
    save(context.startTimeDraft);
    assert.equal(plan, updated);
  }
  context.startTimeDraft = '15:05';
  context.activePlanTimeWindow = undefined;
  save(context.startTimeDraft);
  assert.equal(plan.timeWindow, '3:05 PM - 6:05 PM');
  plan = { ...plan, status: 'locked' };
  const locked = plan;
  save(context.startTimeDraft); // Also protect against a lock arriving after the editor opened.
  assert.equal(plan, locked);
  context.isPlanLocked = true;
  context.setPlan = () => assert.fail('Locked plans cannot submit a time edit');
  save(context.startTimeDraft);
});


test('loading choices leaves main results unchanged; an explicit location refreshes them', async () => {
  const { events, select, load } = areaSelectionHarness();
  const { base, matches } = await load('downtown', new SearchExecution(1));
  assert.deepEqual(events, []);
  const chosen = locationForArea('downtown', base, matches[0]);
  await select(chosen);
  const main = events.find((event) => event[0] === 'main');
  assert.equal(main[1], 'food');
  assert.equal(main[2].areaFocus.kind, 'downtown');
  assert.equal(main[2].areaFocus.radiusMeters, 2 * METERS_PER_MILE);
  assert.equal(main[2].label, 'downtown match');
  assert.equal(events.filter((event) => event[0] === 'main').length, 1);
});

test('each area, radius, and Whole area choice preserves an active typed search', async () => {
  const { events, select, base } = areaSelectionHarness({ manualSearch: 'pizza', manualSearchSubmitted: true, resultMode: 'activity' });
  for (const kind of ['downtown', 'neighborhood', 'freeway', 'waterfront', 'supercharger']) {
    await select(locationForArea(kind, base, { ...base, id: kind, label: kind }, METERS_PER_MILE));
  }
  await select(null);
  const queries = events.filter((event) => event[0] === 'manual');
  assert.equal(queries.length, 6);
  assert.ok(queries.every((event) => event[1] === 'activity' && event[3] === 'pizza'));
  assert.equal(queries[1][2].areaFocus.radiusMeters, METERS_PER_MILE);
  assert.deepEqual(queries.at(-1)[2], base);
});

test('cancelled area discovery rejects a late response without changing main results', async () => {
  const first = deferred();
  const { context, events, load, base } = areaSelectionHarness();
  context.findSearchAreas = async () => first.promise;
  const execution = new SearchExecution(1);
  const older = load('downtown', execution);
  await new Promise(setImmediate);
  execution.cancel();
  first.resolve([{ ...base, id: 'old', label: 'Old downtown' }]);
  await assert.rejects(older, isSearchCancelled);
  assert.deepEqual(events, []);
});

test('empty or failed discovery leaves existing main results intact', async () => {
  const { events, load, context } = areaSelectionHarness({ findSearchAreas: async () => [] });
  assert.deepEqual((await load('downtown', new SearchExecution(1))).matches, []);
  context.findSearchAreas = async () => { throw new Error('Unavailable'); };
  await assert.rejects(load('freeway', new SearchExecution(2)), /Unavailable/);
  assert.deepEqual(events, []);
});

function chargerPlanHarness() {
  const queue = [];
  const notices = [];
  const center = locationForArea('supercharger', { latitude: 35.93, longitude: -86.87, label: 'Franklin' }, {
    id: 'charger-one', label: 'Tesla Supercharger', address: '7116 Moores Ln', latitude: 35.967471, longitude: -86.811444,
  });
  const context = {
    superchargerForSearchArea,
    cardToId: (item) => typeof item === 'string' ? item : item.id,
    cardToName: (item) => typeof item === 'string' ? item : item.title,
    makeStopKey: (slot, item) => `${slot}-${typeof item === 'string' ? item : item.id}`,
    defaultStopDurationMinutes: () => 75,
    inferItineraryStopKind: ({ slot }) => slot,
    isPlanLocked: false, plan: { stops: [], status: 'draft' },
    setPlan: (update) => queue.push(update),
    currentPlanContext: () => ({}), setRecentlyAddedStopKey: () => {}, setTimeout: () => {},
    refreshStopFeatures: async () => {}, showToast: (message) => notices.push(message),
    planningSuggestionMode: false, nowDiscovering: false, resultMode: 'food', searchVisualType: 'food', selectedFoods: [],
    lastSearchLocationCenter: center, memory: { selectedHistory: [] },
    addLog: () => {}, unique: (items) => [...new Set(items)], saveMemory: async () => {},
    scrollToPlanStop: () => {}, setManualSearch: () => {}, setManualSearchSubmitted: () => {},
  };
  context.searchSuperchargerStop = appHandler('searchSuperchargerStop', context);
  context.appendPlanSelection = appHandler('appendPlanSelection', context);
  context.insertStopIntoPlan = appHandler('insertStopIntoPlan', context);
  const flush = () => { while (queue.length) context.plan = queue.shift()(context.plan); };
  return { context, center, notices, flush, select: appHandler('selectCard', context) };
}

test('adding a search result inserts the selected Supercharger first and keeps one charger across rapid additions', async () => {
  const { context, flush, select, center } = chargerPlanHarness();
  const one = { id: 'pizza', title: 'Pizza', subtitle: 'Food' };
  const two = { id: 'coffee', title: 'Coffee', subtitle: 'Food' };
  await select(one);
  await select(two);
  await select(one); // All three updates were queued against the same render.
  flush();
  assert.deepEqual(Array.from(context.plan.stops, (stop) => stop.item.id), ['charger-one', 'pizza', 'coffee']);
  assert.equal(context.plan.stops[0].slot, 'activity');
  assert.equal(context.plan.stops[0].item.lat, center.latitude);
  assert.equal(context.plan.stops[0].item.address, '7116 Moores Ln');
});

test('existing charging stops keep their order; different Supercharger sites remain distinct', () => {
  const { context, center, flush } = chargerPlanHarness();
  const existing = context.searchSuperchargerStop(center);
  const priorFood = { key: 'existing-food', slot: 'food', item: { id: 'existing-food', title: 'Existing place' } };
  context.plan.stops = [priorFood, existing];
  context.insertStopIntoPlan('food', { id: 'one', title: 'One' }, 'food', center);
  const other = { ...center, areaFocus: { ...center.areaFocus, placeId: 'charger-two', placeAddress: 'Other station' } };
  context.insertStopIntoPlan('food', { id: 'two', title: 'Two' }, 'food', other);
  flush();
  assert.deepEqual(Array.from(context.plan.stops, (stop) => stop.item.id), ['existing-food', 'charger-one', 'one', 'charger-two', 'two']);
});

test('selecting the charger itself adds it once; ordinary additions and locked plans do not gain a charger', async () => {
  const { context, center, flush, select } = chargerPlanHarness();
  context.resultMode = 'activity';
  await select(superchargerForSearchArea(center));
  flush();
  assert.equal(context.plan.stops.length, 1);
  context.plan.stops = [];
  context.insertStopIntoPlan('activity', 'An unrelated idea');
  flush();
  assert.equal(context.plan.stops.length, 1);
  assert.equal(context.plan.stops[0].item, 'An unrelated idea');
  context.isPlanLocked = true;
  await select({ id: 'blocked', title: 'Blocked' });
  flush();
  assert.equal(context.plan.stops.length, 1);
  context.isPlanLocked = false;
  context.insertStopIntoPlan('food', { id: 'late', title: 'Late' }, 'food', center);
  context.plan.status = 'locked'; // A queued insertion cannot edit a newly locked plan.
  flush();
  assert.equal(context.plan.stops.length, 1);
});

test('Now plans leave now and save the first arrival after travel, including the next day', async () => {
  const { context } = chargerPlanHarness();
  let saved;
  let active;
  Object.assign(context, {
    Date: class extends Date { static now() { return new Date(2026, 8, 8, 23, 50).getTime(); } },
    estimateTravelMinutes: () => 40, effectivePlanStopTravelMode: () => 'car',
    nowPlanCreating: false, setNowPlanCreating: () => {},
    dateRangeKeysForWindow: () => ({ start: '2026-09-05', end: '2026-09-05' }),
    contextualNowPlanTitle: () => 'Lunch', inferPlanType: () => 'local_plan',
    startingLocationLabel: 'Franklin', routeStartLocation: undefined, nowSelectedPeople: [],
    cloneStopForSavedPlan: (stop) => ({ ...stop }),
    createBetaPlanRecord: async (record) => { saved = record; return { id: 'new-plan', owner: 'Tester', rsvps: {} }; },
    selectedDateWindowRef: { current: '' }, customDateRangeRef: { current: null }, EMPTY_PLAN: { stops: [] },
    setPlan: (plan) => { active = plan; }, scrollToPlan: () => {},
    compactError: (error) => error.message, showAppNotice: (_, message) => assert.fail(message),
  });
  for (const name of ['clockMinutes', 'clockTimeFromMinutes', 'formatClockTime', 'clockTimePlusMinutes', 'timeWindowFromStartClock', 'clockTimeFromDate', 'formatDateInput']) context[name] = appHandler(name, context);
  for (const name of ['setSelectedDateWindow', 'setCustomDateRange', 'setSelectedTime', 'setResultMode', 'setPlanTimes', 'setArrivalTimes', 'setTimeEditorKey', 'setNowMode', 'setPlanSetupOpen', 'setHomeOpen', 'setSavedPlansLandingOpen', 'setSavedPlansOpen', 'setPlanSettingsOpen', 'setPreferencesOpen', 'setAdvancedPreferencesOpen', 'setCards', 'setHasInitiatedSearch']) context[name] = () => {};
  await appHandler('createNowPlanFromDestination', context)({ slot: 'food', item: { id: 'lunch', title: 'Lunch' }, category: 'Lunch' });
  assert.deepEqual(Array.from(saved.stops, (stop) => stop.item.id), ['charger-one', 'lunch']);
  assert.deepEqual(Array.from(active.stops, (stop) => stop.item.id), ['charger-one', 'lunch']);
  assert.equal(active.timeWindow, '12:30 AM - 3:30 AM');
  assert.equal(saved.timeWindow, active.timeWindow);
  assert.equal(active.planDateStart, '2026-09-09');
  assert.equal(saved.planDateStart, active.planDateStart);
});
