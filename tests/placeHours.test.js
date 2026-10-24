const test = require('node:test');
const assert = require('node:assert/strict');
const { currentHoursDisplay, hasPlaceHours, plannedHoursDisplay, fetchPlaceHours, readPlaceHours, weeklyHoursForDate, PLACE_HOURS_FIELDS } = require('../.route-import-test-build/placeHours.js');
const { hoursLineForDate, placeOpenDuringWindow } = require('../.route-import-test-build/planningHours.js');

// Relevant fields from the live U Brew response on September 5, 2026:
// regular hours report open until 5 PM; current special hours close at 2 PM.
const provider = {
  utcOffsetMinutes: -240,
  regularOpeningHours: {
    openNow: true,
    weekdayDescriptions: ['Saturday: 9:00 AM – 5:00 PM'],
    nextCloseTime: '2026-09-05T21:00:00Z',
  },
  currentOpeningHours: {
    openNow: false,
    weekdayDescriptions: ['Saturday: 9:00 AM – 2:00 PM'],
    nextOpenTime: '2026-09-06T13:00:00Z',
  },
};
const now = new Date('2026-09-05T19:37:00Z');

test('U Brew special closure overrides the conflicting regular open flag and hours', () => {
  const hours = readPlaceHours(provider, now);
  assert.deepEqual(currentHoursDisplay(hours, now), {
    isOpen: false,
    hoursText: 'Closed now',
    todayHours: 'Saturday: 9:00 AM – 2:00 PM',
  });
  assert.ok(PLACE_HOURS_FIELDS.includes('currentOpeningHours'));
  assert.equal(placeOpenDuringWindow(weeklyHoursForDate(hours, '2026-09-05'), '2026-09-05', '3:00 PM - 4:00 PM'), false);
});

test('current exceptions apply only within the returned seven-day window', () => {
  const hours = readPlaceHours(provider, now);
  assert.equal(weeklyHoursForDate(hours, '2026-09-11'), hours.currentWeeklyHours);
  assert.equal(weeklyHoursForDate(hours, '2026-09-12'), hours.weeklyHours);
  assert.equal(weeklyHoursForDate(hours, '2026-09-04'), hours.weeklyHours);
});

test('uses the venue date when the device is already on the next UTC day', () => {
  const late = new Date('2026-09-06T01:00:00Z');
  const hours = readPlaceHours(provider, late);
  assert.equal(hours.currentHoursStartDate, '2026-09-05');
  assert.equal(currentHoursDisplay(hours, late).todayHours, 'Saturday: 9:00 AM – 2:00 PM');
});

test('falls back to regular hours only when current hours are absent', () => {
  const hours = readPlaceHours({ regularOpeningHours: provider.regularOpeningHours }, now);
  assert.equal(currentHoursDisplay(hours, now).isOpen, true);
  const unknown = readPlaceHours({ ...provider, currentOpeningHours: {} }, now);
  assert.equal(currentHoursDisplay(unknown, now).isOpen, null);
  assert.equal(currentHoursDisplay(unknown, now).todayHours, undefined);
});

test('unknown provider hours and old saved cards cannot claim open now', () => {
  assert.equal(currentHoursDisplay(readPlaceHours({}, now), now).isOpen, null);
  assert.equal(currentHoursDisplay({ openNow: true }, now).isOpen, null);
  const hours = readPlaceHours(provider, now);
  assert.equal(currentHoursDisplay(hours, new Date(now.getTime() + 5 * 60_000)).hoursText, 'Hours unverified');
});

test('cached status expires at the exact closing or reopening time', () => {
  const beforeClose = new Date('2026-09-05T17:59:00Z');
  const hours = readPlaceHours({ currentOpeningHours: { openNow: true, nextCloseTime: '2026-09-05T18:00:00Z' } }, beforeClose);
  assert.equal(currentHoursDisplay(hours, beforeClose).isOpen, true);
  assert.equal(currentHoursDisplay(hours, new Date('2026-09-05T18:00:00Z')).isOpen, null);
  const beforeOpen = new Date('2026-09-06T12:59:00Z');
  assert.equal(currentHoursDisplay(readPlaceHours(provider, beforeOpen), new Date('2026-09-06T13:00:00Z')).isOpen, null);
});

test('weekday labels work in Sunday-first and abbreviated responses without guessing', () => {
  const days = ['Sunday: Closed', 'Saturday: 9:00 AM – 2:00 PM', 'Monday: Closed'];
  assert.equal(hoursLineForDate(days, '2026-09-05'), days[1]);
  assert.equal(hoursLineForDate(['Sat: 9:00 AM – 2:00 PM'], '2026-09-05'), 'Sat: 9:00 AM – 2:00 PM');
  assert.equal(hoursLineForDate(['Monday: Closed'], '2026-09-05'), undefined);
  assert.equal(hoursLineForDate(['Samstag: Geschlossen'], '2026-09-05'), undefined);
});

test('planned hours show the selected date, special closure, and typical future schedule', () => {
  const hours = readPlaceHours(provider, now);
  const partial = plannedHoursDisplay(hours, '2026-09-05', '1:30 PM - 2:30 PM');
  assert.equal(partial.isOpen, null);
  assert.equal(partial.hoursWarning, 'Closes at 2:00 PM during visit');
  assert.equal(partial.operatingHours, '2026-09-05 · Saturday: 9:00 AM – 2:00 PM');
  assert.match(plannedHoursDisplay(hours, '2026-09-12', '3:00 PM - 4:00 PM').operatingHours, /Typical hours.*5:00 PM/);
  assert.equal(plannedHoursDisplay({ ...hours, currentWeeklyHours: undefined }, '2026-09-05', '3:00 PM - 4:00 PM').isOpen, null);
});

test('unknown text and expired badges are not evidence of known operating hours', () => {
  assert.equal(hasPlaceHours({ hoursText: 'Hours unknown' }), false);
  assert.equal(hasPlaceHours({ openNow: false }), true);
  assert.equal(hasPlaceHours({ currentWeeklyHours: ['Saturday: Closed'] }), true);
  const unknown = plannedHoursDisplay({}, '2026-09-05', '3:00 PM - 4:00 PM');
  assert.equal(unknown.isOpen, null);
  assert.match(unknown.hoursText, /check with venue/);
});

test('regular overnight hours do not override an unknown current special schedule', () => {
  const hours = readPlaceHours({ regularOpeningHours: { weekdayDescriptions: ['Friday: 5:00 PM – 2:00 AM'] },
    currentOpeningHours: {} }, now);
  assert.equal(plannedHoursDisplay(hours, '2026-09-05', '12:15 AM - 1:00 AM').isOpen, null);
});

test('hours lookup requests current exceptions and never turns provider errors into hours', async (t) => {
  t.mock.method(global, 'fetch', async (url, init) => {
    assert.match(url, /places\/sample\?languageCode=en$/);
    assert.ok(init.headers['X-Goog-FieldMask'].includes('currentOpeningHours'));
    assert.equal(init.cache, 'no-store');
    return { ok: true, json: async () => provider };
  });
  const hours = await fetchPlaceHours('sample', 'test-key');
  assert.deepEqual(hours.currentWeeklyHours, provider.currentOpeningHours.weekdayDescriptions);
  global.fetch.mock.mockImplementation(async () => ({ ok: false, status: 403 }));
  await assert.rejects(fetchPlaceHours('sample', 'test-key'), /status 403/);
});
