const test = require('node:test');
const assert = require('node:assert/strict');

const {
  parseGoogleMapsRouteUrl,
} = require('../.route-import-test-build/routeImport.js');

const sampleShortUrl = 'https://maps.app.goo.gl/yg9jRKMUCnLGYM5J8?g_st=ac';
const sampleExpandedUrl = "https://www.google.com/maps/dir/35.8454484,-86.8888559/Iris+Tattoo+%26+Piercings+Nashville/Dave+%26+Buster's+Nashville/Tesla+Supercharger/Iris+Tattoo+%26+Piercings+Nashville/118+Churchill+Pl/data=!4m37!4m36!1m1!4e1!1m5!1m4!1s0x8864677ffacc31c5:0x710658a588583a93!8m2!3d36.1519494!4d-86.7780004!1m5!1m4!1s0x886469cf0112497f:0x99ffa40236ce9b7f!8m2!3d36.205949499999996!4d-86.69428549999999!1m5!1m4!1s0x88646ba3b891eac1:0x17776538e5d69c64!8m2!3d36.154285699999996!4d-86.62718869999999!1m5!1m4!1s0x8864677ffacc31c5:0x710658a588583a93!8m2!3d36.1519494!4d-86.7780004!1m5!1m4!1s0x88647ede9165c795:0x9452c7bc7c836d6b!8m2!3d35.9217902!4d-86.83874469999999!2m2!2b1!11b1!3e0?utm_source=mstt_0&g_st=ac";

test('parses the provided Google Maps route sample after redirect expansion', () => {
  const result = parseGoogleMapsRouteUrl(sampleExpandedUrl, sampleShortUrl);

  assert.ok(result);
  assert.equal(result.sourceUrl, sampleShortUrl);
  assert.equal(result.routeProvider, 'google_maps');
  assert.equal(result.status, 'draft');
  assert.equal(result.stops.length, 5);
  assert.deepEqual(
    result.stops.map((stop) => stop.label),
    [
      'Iris Tattoo & Piercings Nashville',
      "Dave & Buster's Nashville",
      'Tesla Supercharger',
      'Iris Tattoo & Piercings Nashville',
      '118 Churchill Pl',
    ],
  );
  assert.equal(result.title, 'Iris Tattoo & Piercings Nashville to 118 Churchill Pl');
  assert.equal(result.stops[0].placeName, 'Iris Tattoo & Piercings Nashville');
  assert.equal(result.stops[0].latitude, 36.1519494);
  assert.equal(result.stops[0].longitude, -86.7780004);
  assert.equal(result.stops[4].address, '118 Churchill Pl');
  assert.equal(result.stops[4].latitude, 35.9217902);
  assert.equal(result.stops[4].longitude, -86.83874469999999);
});

test('parses Google Maps directions API style URLs in order', () => {
  const result = parseGoogleMapsRouteUrl(
    'https://www.google.com/maps/dir/?api=1&origin=Current+Location&waypoints=First+Place%7C120+Main+St&destination=36.1,-86.7',
  );

  assert.ok(result);
  assert.deepEqual(
    result.stops.map((stop) => stop.label),
    ['First Place', '120 Main St', '36.100000, -86.700000'],
  );
  assert.equal(result.stops[1].address, '120 Main St');
  assert.equal(result.stops[2].latitude, 36.1);
  assert.equal(result.stops[2].longitude, -86.7);
});

test('returns null for unsupported or unreadable route URLs', () => {
  assert.equal(parseGoogleMapsRouteUrl('https://example.com/maps/dir/A/B'), null);
  assert.equal(parseGoogleMapsRouteUrl('https://www.google.com/maps/search/pizza'), null);
});
