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
      'Shared from NomNomGo',
    ].join('\n'),
  );
});

test('returns undefined for empty route handoffs', () => {
  assert.equal(googleMapsDirectionsUrl({ stops: [] }), undefined);
  assert.equal(teslaDestinationPayload({ stops: [] }), undefined);
});
