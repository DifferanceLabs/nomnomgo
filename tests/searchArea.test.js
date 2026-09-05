const test = require('node:test');
const assert = require('node:assert/strict');
const { areaMatches, areaSearchBody, areaSearchRadius, findSearchAreas, isInsideSearchArea, locationForArea, localAreaMatches, localAreaQuery, rankNeighborhoods, METERS_PER_MILE } = require('../.route-import-test-build/src/domain/searchArea');
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
  assert.equal(areaSearchBody('supercharger', '', base).includedType, 'electric_vehicle_charging_station');
  assert.match(localAreaQuery('freeway', base), /highway.*motorway/);
  assert.match(localAreaQuery('neighborhood', base), /suburb\|quarter\|neighbourhood/);
  assert.throws(() => localAreaQuery('freeway', { ...base, latitude: NaN }), /location/);
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

test('freeway choices merge both directions by route, exclude local roads, and filter along the local corridor', () => {
  const way = (id, ref, geometry, highway = 'motorway') => ({ type: 'way', id, tags: { highway, ref }, geometry });
  const point = (lat, lon = base.longitude + 0.03) => ({ lat, lon });
  const matches = localAreaMatches([
    way(1, 'I 65', [point(base.latitude - 0.12), point(base.latitude), point(base.latitude + 0.12)]),
    way(2, 'I 65;I 840', [point(base.latitude), point(base.latitude + 0.1)]),
    way(3, 'Main Street', [point(base.latitude), point(base.latitude + 0.1)], 'residential'),
    way(4, 'I 40', [point(40), point(40.1)]),
    way(5, 'I 24', [point(NaN), point(NaN)]),
  ], base, 'freeway');
  assert.deepEqual(matches.map((match) => match.label), ['I-65', 'I-840']);
  const selected = locationForArea('freeway', base, matches[0], METERS_PER_MILE);
  assert.ok(areaSearchRadius(selected, 5000) > 13000);
  assert.equal(isInsideSearchArea(selected, { lat: base.latitude + 0.09, lng: base.longitude + 0.031 }), true);
  assert.equal(isInsideSearchArea(selected, { lat: base.latitude + 0.09, lng: base.longitude - 0.03 }), false);
  assert.equal(isInsideSearchArea(selected, { lat: 40, lng: base.longitude + 0.03 }), false);
  assert.equal(isInsideSearchArea(JSON.parse(JSON.stringify(selected)), { lat: base.latitude + 0.09, lng: base.longitude + 0.031 }), true);
});

test('neighborhoods include named districts, prioritize suburbs, and exclude distant places and businesses', () => {
  const node = (id, name, place, lat = base.latitude) => ({ type: 'node', id, lat, lon: base.longitude, tags: { name, place } });
  const matches = localAreaMatches([
    node(1, 'Westhaven', 'neighbourhood'), node(2, 'Cool Springs', 'suburb', base.latitude + 0.05),
    node(3, 'Westhaven', 'neighbourhood'), node(4, 'Other City', 'city'),
    node(5, 'Distant', 'suburb', 40), node(6, 'Realty shop', 'shop'),
  ], base, 'neighborhood');
  assert.deepEqual(matches.map((match) => match.label), ['Cool Springs', 'Westhaven']);
  assert.deepEqual(rankNeighborhoods(matches, [{ displayName: { text: 'Westhaven Realty' } }]).map((match) => match.label), ['Westhaven', 'Cool Springs']);
});

test('Tesla choices exclude Destination Chargers and other networks and keep station addresses', () => {
  const matches = areaMatches([
    place('one', 'Tesla Supercharger', ['electric_vehicle_charging_station']),
    { ...place('two', 'Tesla Supercharger', ['electric_vehicle_charging_station']), formattedAddress: 'Moores Lane' },
    place('slow', 'Tesla Destination Charger', ['electric_vehicle_charging_station']),
    place('other', 'Electrify America', ['electric_vehicle_charging_station']),
  ], base, 'supercharger');
  assert.deepEqual(matches.map((match) => match.id), ['one', 'two']);
  assert.equal(matches[1].address, 'Moores Lane');
  assert.equal(locationForArea('supercharger', base, matches[1]).areaFocus.placeId, 'two');
});

test('incomplete geographic data is an error, while an empty map result remains empty', async (t) => {
  t.mock.method(global, 'fetch', async () => ({ ok: true, json: async () => ({ elements: [] }) }));
  assert.deepEqual(await findSearchAreas('', 'freeway', '', base, new SearchExecution(1)), []);
  global.fetch = async () => ({ ok: true, json: async () => ({ elements: [], remark: 'timed out' }) });
  await assert.rejects(findSearchAreas('', 'freeway', '', base, new SearchExecution(2)), /unavailable/);
});

test('the local-area endpoint validates inputs, coalesces requests, caches successes, and retries failures', async (t) => {
  const handler = require('../api/local-areas');
  const response = () => ({ headers: {}, setHeader(key, value) { this.headers[key] = value; }, status(code) { this.code = code; return this; }, json(data) { this.data = data; return this; } });
  const invalid = response();
  await handler({ method: 'GET', query: { kind: 'freeway', lat: '91', lng: '0' } }, invalid);
  assert.equal(invalid.code, 400);
  const method = response();
  await handler({ method: 'POST' }, method);
  assert.equal(method.code, 405);
  let calls = 0;
  let resolve;
  const gate = new Promise((done) => { resolve = done; });
  t.mock.method(global, 'fetch', async (url, init) => {
    calls += 1;
    assert.equal(url, 'https://overpass-api.de/api/interpreter');
    assert.match(init.headers['User-Agent'], /NomNomGo/);
    assert.match(decodeURIComponent(init.body), /motorway/);
    await gate;
    return { ok: true, json: async () => ({ elements: [] }) };
  });
  const req = { method: 'GET', query: { kind: 'freeway', lat: '35.9251', lng: '-86.8689' } };
  const first = response();
  const second = response();
  const work = [handler(req, first), handler(req, second)];
  resolve();
  await Promise.all(work);
  assert.equal(calls, 1);
  assert.equal(first.code, 200);
  assert.equal(second.code, 200);
  await handler(req, response());
  assert.equal(calls, 1);
  const other = { ...req, query: { ...req.query, lat: '36' } };
  global.fetch = async () => ({ ok: true, json: async () => ({ remark: 'timeout', elements: [] }) });
  const failed = response();
  await handler(other, failed);
  assert.equal(failed.code, 502);
  assert.equal(failed.headers['Cache-Control'], 'no-store');
  global.fetch = async () => ({ ok: true, json: async () => ({ elements: [] }) });
  const retry = response();
  await handler(other, retry);
  assert.equal(retry.code, 200);
});
