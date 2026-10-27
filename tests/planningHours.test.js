const test = require('node:test');
const assert = require('node:assert/strict');

const {
  foodTimePreferenceScore,
  hoursForVisit,
  hoursLineForDate,
  placeOpenDuringWindow,
  timePreferenceForWindow,
} = require('../.route-import-test-build/planningHours.js');

const weeklyHours = [
  'Monday: 11:00 AM – 2:00 PM, 5:00 PM – 10:00 PM',
  'Tuesday: Closed',
  'Wednesday: Open 24 hours',
  'Thursday: 11:00 AM – 2:00 PM',
  'Friday: 11:00 AM – 1:00 AM',
  'Saturday: 9:00 AM – 11:00 PM',
  'Sunday: 9:00 AM – 9:00 PM',
];

test('selects the Monday-first hours line for a plan date', () => {
  assert.equal(hoursLineForDate(weeklyHours, '2026-07-13'), weeklyHours[0]);
  assert.equal(hoursLineForDate(weeklyHours, '2026-07-19'), weeklyHours[6]);
});

test('distinguishes lunch and dinner availability on the same future date', () => {
  assert.equal(placeOpenDuringWindow(weeklyHours, '2026-07-13', '11:30 AM - 1:30 PM'), true);
  assert.equal(placeOpenDuringWindow(weeklyHours, '2026-07-13', '2:30 PM - 4:00 PM'), false);
  assert.equal(placeOpenDuringWindow(weeklyHours, '2026-07-13', '6:00 PM - 9:00 PM'), true);
});

test('handles closed, 24-hour, and overnight schedules', () => {
  assert.equal(placeOpenDuringWindow(weeklyHours, '2026-07-14', '11:30 AM - 1:30 PM'), false);
  assert.equal(placeOpenDuringWindow(weeklyHours, '2026-07-15', '6:00 PM - 9:00 PM'), true);
  assert.equal(placeOpenDuringWindow(weeklyHours, '2026-07-17', '9:00 PM - 12:00 AM'), true);
});

test('returns unknown when hours cannot be evaluated', () => {
  assert.equal(placeOpenDuringWindow([], '2026-07-13', '11:30 AM - 1:30 PM'), undefined);
  assert.equal(placeOpenDuringWindow(['Monday: Hours vary'], '2026-07-13', '11:30 AM - 1:30 PM'), undefined);
});

test('reads live Google compact meridians, Unicode spaces, and 24-hour schedules', () => {
  assert.equal(placeOpenDuringWindow(['Monday: 4:00 – 10:00 PM'], '2026-07-13', '6:00 PM - 9:00 PM'), true);
  assert.equal(placeOpenDuringWindow(['Monday: 4:00 – 10:00 PM'], '2026-07-13', '11:30 AM - 1:30 PM'), false);
  assert.equal(placeOpenDuringWindow(['Monday: 11:00–2:00 PM'], '2026-07-13', '11:30 AM - 1:30 PM'), true);
  assert.equal(placeOpenDuringWindow(['Monday: 16:00–22:00'], '2026-07-13', '18:00-21:00'), true);
});

test('requires the full visit to fit and warns about opening, closing, and split shifts', () => {
  const evaluate = (window) => hoursForVisit((date) => hoursLineForDate(weeklyHours, date), '2026-07-13', window);
  assert.deepEqual(evaluate('1:00 PM - 3:00 PM'), { availability: 'partial', warning: 'Closes at 2:00 PM during visit' });
  assert.deepEqual(evaluate('4:30 PM - 6:00 PM'), { availability: 'partial', warning: 'Opens at 5:00 PM during visit' });
  assert.equal(evaluate('1:00 PM - 6:00 PM').availability, 'partial');
  assert.deepEqual(evaluate('8:30 PM - 9:30 PM'), { availability: 'open', warning: 'Closes at 10:00 PM' });
  assert.equal(placeOpenDuringWindow(weeklyHours, '2026-07-13', '1:00 PM - 3:00 PM'), undefined);
  assert.equal(evaluate('10:00 PM - 11:00 PM').availability, 'closed');
});

test('uses the previous day after midnight and the next day for an overnight visit', () => {
  const line = (date) => hoursLineForDate(weeklyHours, date);
  assert.equal(hoursForVisit(line, '2026-07-18', '12:15 AM - 12:45 AM').availability, 'open');
  assert.equal(hoursForVisit(line, '2026-07-18', '1:00 AM - 2:00 AM').availability, 'closed');
  assert.equal(hoursForVisit(line, '2026-07-15', '11:30 PM - 12:30 AM').availability, 'partial');
  assert.equal(hoursForVisit(line, '2026-07-17', '11:30 PM - 12:30 AM').availability, 'open');
});

test('ranks lunch restaurants above coffee-only and nightlife candidates', () => {
  const restaurant = { subtitle: 'Restaurant', types: ['restaurant', 'meal_takeaway'] };
  const coffee = { subtitle: 'Coffee Shop', types: ['coffee_shop', 'restaurant'] };
  const distillery = { subtitle: 'Manufacturer', types: ['distillery'] };
  assert.ok(foodTimePreferenceScore(restaurant, 'Lunch') > foodTimePreferenceScore(coffee, 'Lunch'));
  assert.ok(foodTimePreferenceScore(coffee, 'Lunch') > foodTimePreferenceScore(distillery, 'Lunch'));
  assert.equal(foodTimePreferenceScore(restaurant, 'Now'), 0);
});

test('restores a planning preference from its persisted time window', () => {
  assert.equal(timePreferenceForWindow('11:30 AM - 1:30 PM'), 'Lunch');
  assert.equal(timePreferenceForWindow('6:00 PM - 9:00 PM'), 'Dinner');
  assert.equal(timePreferenceForWindow(undefined, 'Now'), 'Now');
});
