const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const ts = require('typescript');
const { homePlanUpdateKey } = require('../api/_accountStore');

function load(path, dependencies = {}) {
  const compiled = ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const context = { exports: {}, require: (name) => dependencies[name] || {} };
  vm.runInNewContext(compiled, context);
  return context.exports;
}
function fixture() {
  const storage = new Map();
  let account = 'a', fail = false;
  const dependencies = {
    './sharedPlans': load('src/data/sharedPlans.ts'),
    './accountStorage': { default: {
      getItem: async (key) => storage.get(`${account}:${key}`) || null,
      setItem: async (key, value) => { if (fail) throw new Error('Storage unavailable'); storage.set(`${account}:${key}`, value); },
    } },
  };
  return { api: load('src/data/homePlans.ts', dependencies), reload: () => load('src/data/homePlans.ts', dependencies),
    switchAccount: (value) => { account = value; }, fail: () => { fail = true; }, corrupt: (value) => storage.set(`${account}:nomNomGoHomePlanDismissalsV1`, value) };
}
const now = new Date(2026, 9, 20, 12);
const plan = { id: 'lunch', title: 'Lunch', dateStart: '2026-10-21', dateEnd: '2026-10-21', locationLabel: 'Franklin', status: 'planning', homeUpdateKey: 'outing-v1' };

test('Home excludes old plans, orders upcoming plans, and retains today and ongoing trips', () => {
  const { api } = fixture();
  const plans = [plan, { ...plan, id: 'old', dateStart: '2026-10-18', dateEnd: '2026-10-19' },
    { ...plan, id: 'today', dateStart: '2026-10-20', dateEnd: '2026-10-20' },
    { ...plan, id: 'trip', dateStart: '2026-10-18', dateEnd: '2026-10-22' }];
  assert.equal(api.upcomingHomePlans(plans, {}, now).map((p) => p.id).join(','), 'trip,today,lunch');
  assert.equal(plans[0], plan);
  assert.equal(api.upcomingHomePlans([plan], {}, new Date(2026, 9, 22, 0, 0)).length, 0);
});

test('dismissals survive module reload, navigation and RSVP revisions without changing the Plans list', async () => {
  const f = fixture();
  await f.api.dismissHomePlan(plan);
  const reloaded = f.reload();
  const dismissed = await reloaded.loadHomePlanDismissals();
  assert.equal(reloaded.upcomingHomePlans([{ ...plan, revision: 99, participants: [{ rsvp: 'going' }] }], dismissed, now).length, 0);
  assert.equal(load('src/data/sharedPlans.ts').groupPlansByDate([plan], now).future.length, 1);
});

test('major updates resurface dismissed future plans, but even an updated past plan stays hidden', async () => {
  const { api } = fixture();
  const dismissed = await api.dismissHomePlan(plan);
  const updated = { ...plan, homeUpdateKey: 'outing-v2' };
  assert.equal(api.upcomingHomePlans([updated], dismissed, now).length, 1);
  assert.equal(api.upcomingHomePlans([{ ...updated, dateStart: '2026-10-19', dateEnd: '2026-10-19' }], dismissed, now).length, 0);
  const hiddenAgain = await api.dismissHomePlan(updated);
  assert.equal(api.upcomingHomePlans([updated], hiddenAgain, now).length, 0);
});

test('dismissing multiple plans preserves prior choices and isolates accounts', async () => {
  const f = fixture();
  await f.api.dismissHomePlan(plan);
  const second = { ...plan, id: 'second' };
  await f.api.dismissHomePlan(second);
  assert.equal(f.api.upcomingHomePlans([plan, second], await f.api.loadHomePlanDismissals(), now).length, 0);
  f.switchAccount('b');
  assert.equal(f.api.upcomingHomePlans([plan], await f.api.loadHomePlanDismissals(), now).length, 1);
  f.switchAccount('a');
  assert.equal(f.api.upcomingHomePlans([plan], await f.api.loadHomePlanDismissals(), now).length, 0);
});

test('failed persistence rejects dismissal and corrupted storage does not hide plans', async () => {
  const f = fixture();
  for (const value of ['{broken', 'null', '[]', '{"lunch":42}']) {
    f.corrupt(value);
    assert.equal(f.api.upcomingHomePlans([plan], await f.api.loadHomePlanDismissals(), now).length, 1);
  }
  f.fail();
  await assert.rejects(f.api.dismissHomePlan(plan), /Storage unavailable/);
});

test('older summary responses ignore revisions but still recognize schedule and place changes', () => {
  const { api } = fixture();
  const legacy = { ...plan, homeUpdateKey: undefined };
  const hidden = { [plan.id]: api.homePlanVersion(legacy) };
  assert.equal(api.upcomingHomePlans([{ ...legacy, revision: 99 }], hidden, now).length, 0);
  for (const update of [{ dateStart: '2026-10-22' }, { timeWindow: '6–8 PM' }, { locationLabel: 'Nashville' }, { title: 'Dinner' }, { status: 'locked' }]) {
    assert.equal(api.upcomingHomePlans([{ ...legacy, ...update }], hidden, now).length, 1);
  }
});

test('major-update keys cover outing details and stop changes while ignoring social and provider noise', () => {
  const details = { ...plan, intent: 'food', timeWindow: '12–2 PM', stops: [
    { id: 'stop', position: 0, kind: 'food', place: { provider: 'manual', title: 'Cafe', address: 'Main St' }, arrivalTime: '12:00 PM', durationMinutes: 60, travelMode: 'walk' },
  ] };
  const key = homePlanUpdateKey(details, 'planning');
  const ignored = { ...details, revision: 9, participants: [{ rsvp: 'going' }], suggestions: [{ votes: [] }],
    stops: [{ ...details.stops[0], id: 'regenerated-id', place: { ...details.stops[0].place, rating: 5, subtitle: 'Refreshed', sourceUrl: 'https://example.com' } }] };
  assert.equal(homePlanUpdateKey(ignored, 'planning'), key);
  const reorderedKeys = Object.fromEntries(Object.entries(details).reverse());
  assert.equal(homePlanUpdateKey(reorderedKeys, 'planning'), key);
  for (const update of [{ title: 'Dinner' }, { intent: 'both' }, { locationLabel: 'Nashville' },
    { dateStart: '2026-10-22' }, { dateEnd: '2026-10-23' }, { timeWindow: '6–8 PM' }, { stops: [] },
    { stops: [{ ...details.stops[0], durationMinutes: 90 }] },
    { stops: [{ ...details.stops[0], arrivalTime: '1:00 PM' }] },
    { stops: [{ ...details.stops[0], place: { ...details.stops[0].place, title: 'New cafe' } }] }]) {
    assert.notEqual(homePlanUpdateKey({ ...details, ...update }, 'planning'), key);
  }
  assert.notEqual(homePlanUpdateKey(details, 'locked'), key);
});
