const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const ts = require('typescript');

function fixture() {
  const local = new Map();
  let user = { id: 'account-a', email: 'a@example.com', isAdmin: false };
  let serverState = {};
  let outage = false;
  const writes = [];
  const compiled = ts.transpileModule(fs.readFileSync('src/data/accountStorage.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText;
  const context = { exports: {}, AbortController, setTimeout, clearTimeout,
    require: () => ({ getItem: async (key) => local.get(key) ?? null,
      setItem: async (key, value) => local.set(key, value), removeItem: async (key) => local.delete(key) }),
    fetch: async (_url, options) => {
      if (outage) throw new Error('Network unavailable');
      if (options.method === 'GET') return { ok: true, json: async () => ({ user, state: structuredClone(serverState) }) };
      if (options.method === 'DELETE') return { ok: true, json: async () => ({ ok: true }) };
      const body = JSON.parse(options.body);
      writes.push(body);
      if (body.version !== (serverState[body.key]?.version || 0)) return { ok: false, json: async () => ({ error: 'Changed on another device.' }) };
      serverState[body.key] = { value: body.value, version: body.version + 1 };
      return { ok: true, json: async () => ({ version: body.version + 1 }) };
    },
  };
  vm.runInNewContext(compiled, context);
  return { api: context.exports, local, writes, setOutage(value) { outage = value; },
    switchAccount() { user = { id: 'account-b', email: 'b@example.com', isAdmin: false }; serverState = {}; },
    remoteEdit(key) { serverState[key] = { value: '[]', version: 40 }; } };
}
const key = 'nomNomGoSavedPlansV1';

test('local Expo storage remains local; hosted accounts never import prototype data', async () => {
  const { api, local } = fixture();
  await api.default.setItem(key, '["prototype"]');
  assert.equal(local.get(key), '["prototype"]');
  await api.initializeAlphaAccount();
  assert.equal(await api.default.getItem(key), null);
  assert.equal(JSON.parse(await api.default.getItem('nomNomGoSelectedTesterV1')).name, 'a@example.com');
});

test('queued writes use successive server revisions and preserve removals', async () => {
  const { api, writes } = fixture();
  await api.initializeAlphaAccount();
  await Promise.all([api.default.setItem(key, '[1]'), api.default.setItem(key, '[1,2]')]);
  assert.deepEqual(writes.map((write) => write.version), [0, 1]);
  assert.equal(await api.default.getItem(key), '[1,2]');
  await api.default.removeItem(key);
  assert.equal(await api.default.getItem(key), null);
});

test('failed or conflicting saves notify the UI, reject success, and stop later stale writes', async () => {
  for (const kind of ['outage', 'conflict']) {
    const fixtureData = fixture();
    const { api, writes } = fixtureData;
    await api.initializeAlphaAccount();
    let error = '';
    const unsubscribe = api.subscribeAccountSaveError((message) => { error = message; });
    if (kind === 'outage') fixtureData.setOutage(true); else fixtureData.remoteEdit(key);
    await assert.rejects(api.default.setItem(key, '[1]'));
    assert.match(error, /Reload/);
    fixtureData.setOutage(false);
    const attempts = writes.length;
    await assert.rejects(api.default.setItem(key, '[1,2]'));
    assert.equal(writes.length, attempts);
    assert.equal(await api.default.getItem(key), null);
    unsubscribe();
  }
});

test('switching accounts isolates cloud data and local location caches', async () => {
  const f = fixture();
  await f.api.initializeAlphaAccount();
  await f.api.default.setItem(key, '["a"]');
  await f.api.default.setItem('location', 'private-location-a');
  await f.api.signOutAlphaAccount();
  f.switchAccount();
  await f.api.initializeAlphaAccount();
  assert.equal(await f.api.default.getItem(key), null);
  assert.equal(await f.api.default.getItem('location'), null);
  assert.equal(f.api.getAlphaAccount().email, 'b@example.com');
});

test('a delayed shared-plan poll cannot overwrite a newer RSVP or organizer response', () => {
  const compiled = ts.transpileModule(fs.readFileSync('src/data/sharedPlans.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const context = { exports: {}, require: () => ({}) };
  vm.runInNewContext(compiled, context);
  const newer = { id: 'same-plan', revision: 9, participants: [{ rsvp: 'going' }] };
  const older = { id: 'same-plan', revision: 8, participants: [{ rsvp: 'maybe' }] };
  assert.equal(context.exports.newerSharedPlan(newer, older), newer);
  assert.equal(context.exports.newerSharedPlan(older, newer), newer);
});
