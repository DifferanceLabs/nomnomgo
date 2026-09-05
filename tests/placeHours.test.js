const test = require('node:test');
const assert = require('node:assert/strict');
const { currentHoursDisplay, readPlaceHours, weeklyHoursForDate, PLACE_HOURS_FIELDS } = require('../.route-import-test-build/placeHours.js');
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
