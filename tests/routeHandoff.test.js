const test = require('node:test');
const assert = require('node:assert/strict');

const {
  googleMapsDirectionsUrl,
  stopToRouteQuery,
  teslaDestinationPayload,
} = require('../.route-import-test-build/routeHandoff.js');

test('builds Google Maps directions with ordered waypoints', () => {
  const url = googleMapsDirectionsUrl({
    origin: 'Current Location',
    stops: [
      { name: 'First Place' },
      { name: 'Dinner', latitude: 36.1, longitude: -86.7 },
    ],
  });

  assert.equal(
    url,
    'https://www.google.com/maps/dir/?api=1&origin=Current%20Location&destination=36.1%2C-86.7&waypoints=First%20Place&travelmode=driving',
  );
});

test('uses the locked walking mode for Google Maps directions', () => {
  const url = googleMapsDirectionsUrl({
    origin: 'Current Location',
    stops: [
      { name: 'Coffee', travelMode: 'walk' },
      { name: 'Park', travelMode: 'walk' },
    ],
  });

  assert.equal(
    url,
    'https://www.google.com/maps/dir/?api=1&origin=Current%20Location&destination=Park&waypoints=Coffee&travelmode=walking',
  );
});

test('maps bike and train route modes to Google Maps travel modes', () => {
  assert.equal(
    googleMapsDirectionsUrl({ stops: [{ name: 'Greenway', travelMode: 'bike' }] }),
    'https://www.google.com/maps/dir/?api=1&origin=Current%20Location&destination=Greenway&travelmode=bicycling',
  );
  assert.equal(
    googleMapsDirectionsUrl({ stops: [{ name: 'Station', travelMode: 'train' }] }),
    'https://www.google.com/maps/dir/?api=1&origin=Current%20Location&destination=Station&travelmode=transit',
  );
});

test('omits travelmode for mixed-mode Google Maps routes', () => {
  const url = googleMapsDirectionsUrl({
    stops: [
      { name: 'Dinner', travelMode: 'car' },
      { name: 'Dessert', travelMode: 'walk' },
    ],
  });

  assert.equal(
    url,
    'https://www.google.com/maps/dir/?api=1&origin=Current%20Location&destination=Dessert&waypoints=Dinner',
  );
});

test('omits travelmode for unsupported Google Maps route modes', () => {
  assert.equal(
    googleMapsDirectionsUrl({ stops: [{ name: 'Airport', travelMode: 'plane' }] }),
    'https://www.google.com/maps/dir/?api=1&origin=Current%20Location&destination=Airport',
  );
});

test('uses coordinates when available for route queries', () => {
  assert.equal(stopToRouteQuery({ name: 'Dinner', latitude: 36.1, longitude: -86.7 }), '36.1,-86.7');
  assert.equal(stopToRouteQuery({ name: 'Manual address' }), 'Manual address');
});

test('builds a Tesla share handoff payload without requiring credentials', () => {
  const payload = teslaDestinationPayload({
    title: 'Dinner + Activity',
    stops: [
      { name: 'Dinner', latitude: 36.1, longitude: -86.7 },
      { name: 'Show venue' },
    ],
  });

  assert.equal(
    payload,
    [
      'Tesla handoff destination: Show venue',
      'Plan: Dinner + Activity',
      'Route stops:',
      '1. Dinner - 36.1,-86.7',
      '2. Show venue',
      'Confirm route and charging in Tesla before departure.',
      'Shared from NomNomGo',
    ].join('\n'),
  );
});

test('returns undefined for empty route handoffs', () => {
  assert.equal(googleMapsDirectionsUrl({ stops: [] }), undefined);
  assert.equal(teslaDestinationPayload({ stops: [] }), undefined);
});
