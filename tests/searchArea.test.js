const test = require('node:test');
const assert = require('node:assert/strict');
const { areaMatches, areaSearchBody, areaSearchRadius, findSearchAreas, isInsideSearchArea, METERS_PER_MILE } = require('../.route-import-test-build/src/domain/searchArea');
const { SearchExecution, isSearchCancelled } = require('../.route-import-test-build/src/domain/searchExecution');
const base = { latitude: 35.9251, longitude: -86.8689, label: 'Franklin, TN' };
const focus = { ...base, areaFocus: { kind: 'downtown', placeId: 'downtown', base, radiusMeters: 2 * METERS_PER_MILE } };
const place = (id, label, types, latitude = base.latitude, longitude = base.longitude) => ({ id, displayName: { text: label }, types, location: { latitude, longitude }, formattedAddress: 'Franklin, TN' });

test('area discovery uses the chosen city and a bounded bias, including GPS-only locations', () => {
  const body = areaSearchBody('downtown', '', base);
  assert.equal(body.textQuery, 'downtown historic district near Franklin, TN');
  assert.equal(body.locationBias.circle.radius, 25000);
  assert.deepEqual(body.locationBias.circle.center, { latitude: base.latitude, longitude: base.longitude });
  assert.equal(areaSearchBody('custom', 'Cool Springs', { ...base, label: 'Current location' }).textQuery, 'Cool Springs');
  assert.throws(() => areaSearchBody('custom', ' ', base), /Enter/);
  assert.equal(areaSearchBody('freeway', '', base).includedType, 'rest_stop');
  assert.equal(areaSearchBody('freeway', 'I-65 exit 68', base).includedType, undefined);
});

test('area matches reject unrelated businesses, faraway road centers, missing coordinates and duplicates', () => {
  const results = areaMatches([
    place('district', 'Franklin Downtown Historic District', ['historical_landmark']),
    place('district', 'Franklin Downtown Historic District', ['historical_landmark']),
    place('city', 'Franklin', ['locality', 'political']),
    place('shop', 'Coffee shop', ['cafe']),
    place('far', 'Downtown', ['neighborhood'], 40, -87),
    place('nan', 'Downtown', ['neighborhood'], NaN),
    place('invalid', 'Downtown', ['neighborhood'], 91),
    { id: 'missing', displayName: { text: 'Downtown' } },
  ], base, 'downtown');
  assert.deepEqual(results.map((item) => item.id), ['district']);
  assert.equal(areaMatches([place('road', 'I-65', ['route'], 40, -87)], base, 'freeway', true).length, 0);
  assert.equal(areaMatches([place('neighborhood', 'Eastside', ['neighborhood'])], base, 'neighborhood')[0].description, 'Neighborhood');
});

test('an area radius caps all providers and excludes unknown or outside result locations', () => {
  assert.equal(areaSearchRadius(focus, 50000), 2 * METERS_PER_MILE);
  assert.equal(areaSearchRadius(focus, 1000), 1000);
  assert.equal(isInsideSearchArea(focus, { lat: base.latitude, lng: base.longitude }), true);
  assert.equal(isInsideSearchArea(focus, { lat: base.latitude + 0.1, lng: base.longitude }), false);
  assert.equal(isInsideSearchArea(focus, {}), false);
  const restored = JSON.parse(JSON.stringify(focus));
  assert.equal(areaSearchRadius(restored, 50000), 2 * METERS_PER_MILE);
  assert.equal(areaSearchRadius(restored.areaFocus.base, 50000), 50000);
  assert.equal(isInsideSearchArea(base, {}), true);
});

test('area discovery handles successful empty responses and provider failure distinctly', async (t) => {
  let body;
  t.mock.method(global, 'fetch', async (_, init) => {
    body = JSON.parse(init.body);
    return { ok: true, json: async () => ({ places: [place('district', 'Downtown', ['neighborhood'])] }) };
  });
  assert.equal((await findSearchAreas('test-key', 'downtown', '', base, new SearchExecution(1)))[0].id, 'district');
  assert.match(body.textQuery, /Franklin/);
  global.fetch = async () => ({ ok: true, json: async () => ({}) });
  assert.deepEqual(await findSearchAreas('test-key', 'downtown', '', base, new SearchExecution(2)), []);
  global.fetch = async () => ({ ok: false, status: 403 });
  await assert.rejects(findSearchAreas('test-key', 'downtown', '', base, new SearchExecution(3)), /403/);
  const cancelled = new SearchExecution(4);
  cancelled.cancel();
  await assert.rejects(findSearchAreas('test-key', 'downtown', '', base, cancelled), isSearchCancelled);
});
