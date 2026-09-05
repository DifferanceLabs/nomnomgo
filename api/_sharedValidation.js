const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const OWNER_ACTIONS = new Set(['plan.update', 'plan.lock', 'plan.reopen', 'plan.pick', 'plan.removeStop', 'plan.moveStop', 'plan.removeMember']);
const ACTIONS = new Set(['plan.list', 'plan.get', 'plan.create', 'plan.invite', 'plan.rsvp', 'plan.suggest', 'plan.vote', 'plan.metrics', ...OWNER_ACTIONS]);
function need(condition, message = 'Invalid plan request.') { if (!condition) throw new Error(message); }
function text(value, max, optional = false) {
  if (optional && (value === undefined || value === '')) return '';
  need(typeof value === 'string' && value.trim().length > 0 && value.length <= max);
  return value.trim();
}
function email(value) {
  const result = text(value, 254).toLowerCase();
  need(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result), 'Enter the email used for Google sign-in.');
  return result;
}
function date(value) {
  need(typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value), 'Use dates in YYYY-MM-DD format.');
  need(Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value, 'Enter a valid date.');
  return value;
}
function place(value) {
  need(value && typeof value === 'object' && !Array.isArray(value));
  const result = { title: text(value.title, 200), provider: value.provider };
  need(['manual', 'google_places', 'ticketmaster'].includes(result.provider));
  for (const [key, max] of [['providerId', 200], ['subtitle', 300], ['address', 500]]) {
    if (value[key]) result[key] = text(value[key], max);
  }
  if (value.sourceUrl) {
    const url = new URL(text(value.sourceUrl, 2000));
    need(['https:', 'http:'].includes(url.protocol) && !url.username && !url.password, 'Use a normal website link.');
    result.sourceUrl = url.toString();
  }
  for (const [key, limit] of [['latitude', 90], ['longitude', 180]]) {
    if (value[key] !== undefined) {
      need(typeof value[key] === 'number' && Number.isFinite(value[key]) && Math.abs(value[key]) <= limit);
      result[key] = value[key];
    }
  }
  return result;
}
function details(value, includeStops) {
  need(value && typeof value === 'object');
  const result = { title: text(value.title, 160), intent: value.intent, locationLabel: text(value.locationLabel, 300),
    dateStart: date(value.dateStart), dateEnd: date(value.dateEnd), timeWindow: text(value.timeWindow, 100, true) };
  need(['food', 'activity', 'both'].includes(result.intent));
  need(result.dateEnd >= result.dateStart, 'The end date must be on or after the start date.');
  if (includeStops) {
    need(Array.isArray(value.stops) && value.stops.length <= 30);
    result.stops = value.stops.map((stop, index) => {
      const result = { id: `initial-${index}`, planId: '', position: index, place: place(stop.place) };
      if (stop.travelMode) { need(['car', 'walk', 'bike', 'train', 'plane'].includes(stop.travelMode)); result.travelMode = stop.travelMode; }
      if (stop.arrivalTime) result.arrivalTime = text(stop.arrivalTime, 100);
      if (stop.durationMinutes !== undefined) { need(Number.isFinite(stop.durationMinutes) && stop.durationMinutes > 0 && stop.durationMinutes <= 10080); result.durationMinutes = stop.durationMinutes; }
      return result;
    });
  }
  return result;
}
function sharedData(action, body) {
  need(ACTIONS.has(action));
  if (['plan.list', 'plan.metrics'].includes(action)) return {};
  if (action === 'plan.create') return { sourceKey: text(body.sourceKey, 160), details: details(body.details, true) };
  need(UUID.test(body.planId));
  const data = { planId: body.planId };
  if (OWNER_ACTIONS.has(action)) {
    need(Number.isSafeInteger(body.revision) && body.revision > 0);
    data.revision = body.revision;
  }
  if (['plan.invite', 'plan.removeMember'].includes(action)) data.email = email(body.email);
  if (action === 'plan.rsvp') { need(['going', 'maybe', 'cant_make_it'].includes(body.rsvp)); data.rsvp = body.rsvp; }
  if (['plan.suggest', 'plan.vote', 'plan.pick'].includes(action)) { need(UUID.test(body.suggestionId)); data.suggestionId = body.suggestionId; }
  if (action === 'plan.suggest') { need(['food', 'activity'].includes(body.slot)); data.slot = body.slot; data.place = place(body.place); }
  if (action === 'plan.vote') { need(typeof body.voted === 'boolean'); data.voted = body.voted; }
  if (action === 'plan.update') data.details = details(body.details, false);
  if (['plan.removeStop', 'plan.moveStop'].includes(action)) data.stopId = text(body.stopId, 100);
  if (action === 'plan.moveStop') { need([-1, 1].includes(body.direction)); data.direction = body.direction; }
  return data;
}
module.exports = { sharedData, ACTIONS };
