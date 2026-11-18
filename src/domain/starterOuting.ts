import { currentHoursDisplay, plannedHoursDisplay, type PlaceHours } from '../../placeHours';
import { defaultItineraryStopDurationMinutes, driveMinutesForMiles, pairingDistancePenalty } from './itinerary';
import type { StarterProfile, StarterSelection } from './planStarters';
import { areaDistanceMeters, METERS_PER_MILE, type AreaLocation } from './searchArea';
import { labels, venueFacts } from './venueFacts';

export type StarterSlot = 'food' | 'activity';
export type StarterPlace = PlaceHours & {
  id: string;
  title: string;
  subtitle: string;
  types?: string[];
  primaryType?: string;
  rating?: number;
  ratingCount?: number;
  businessStatus?: string;
  lat?: number;
  lng?: number;
  eventStartMs?: number;
  eventEndMs?: number;
  durationMinutes?: number;
};
export type VenueReview = { id: string; slot: StarterSlot; quality: number; feature: string };
export type Candidate = { slot: StarterSlot; item: StarterPlace; review?: VenueReview };
export type Visit = Candidate & {
  durationMinutes: number;
  hours: string;
  reason?: string;
  date: string;
  minute: number;
  experience?: string;
};
export type StarterOuting = { center: AreaLocation; stops: Visit[]; miles?: number };
export type VisitTiming = { date?: string; start?: number; end?: number; now: number };
type Match = Candidate & { weights: number[]; reason?: string };
export type OutingOption = { stops: Visit[]; miles?: number; weights: number[] };
type Option = OutingOption;

const broadTypes = new Set([
  'point_of_interest',
  'establishment',
  'food',
  'restaurant',
  'store',
  'tourist_attraction',
]);
function compare(a: number[], b: number[]) {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return b[i] - a[i];
  return 0;
}
function matchHistory(
  candidate: Candidate,
  profile: StarterProfile,
  selection: StarterSelection,
  context: string,
  favorites: string[],
): Match {
  const group = [...selection.people].sort().join('|');
  const weights = [0, 0, 0];
  let reason: string | undefined;
  let reasonRank = -1;
  const types = new Set(candidate.item.types?.filter((type) => !broadTypes.has(type)));
  for (const signal of profile.signals) {
    if (
      signal.context !== context ||
      [...signal.people].sort().join('|') !== group ||
      (signal.starter && signal.starter !== selection.id)
    )
      continue;
    const exact = signal.places?.some((p) => p.id === candidate.item.id);
    const similar = signal.places?.some((p) => p.types?.some((t) => types.has(t)));
    if (!exact && !similar) continue;
    const tier = ['favorite', 'more', 'different'].includes(signal.kind)
      ? 0
      : signal.kind === 'plan-completed'
        ? 1
        : 2;
    const weight = exact ? 3 : 1;
    weights[tier] += signal.kind === 'different' ? -weight : weight;
    const rank = (3 - tier) * 4 + weight;
    if (signal.kind !== 'different' && rank > reasonRank) {
      reasonRank = rank;
      reason =
        signal.kind === 'favorite'
          ? exact
            ? 'You favorited this place.'
            : 'Similar to a place you favorited.'
          : signal.kind === 'more'
            ? 'Matches an outing you marked “More like this”.'
            : tier === 1
              ? 'Matches a completed outing.'
              : 'Matches a place you chose before.';
    }
  }
  const scopedFavorite = profile.signals.some(
    (s) =>
      s.kind === 'favorite' &&
      (s.people.length || s.context !== 'local') &&
      s.places?.some((p) => p.id === candidate.item.id),
  );
  if (!group && context === 'local' && !scopedFavorite && favorites.includes(candidate.item.id)) {
    weights[0] += 3;
    reason = 'You favorited this place.';
  }
  return { ...candidate, weights, reason: compare(weights, [0, 0, 0]) < 0 ? reason : undefined };
}

export function venueQuality(candidate: Candidate) {
  const facts = venueFacts(candidate.slot, candidate.item);
  const review = candidate.review;
  return review
    ? { score: review.quality, experience: labels[review.feature] }
    : { score: facts.quality, experience: labels[facts.features[0]] };
}

function clock(minute: number) {
  const m = ((minute % 1440) + 1440) % 1440;
  return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
}
function venueWallTime(ms: number, offset?: number) {
  const date = new Date(ms);
  return ms + (offset ?? -date.getTimezoneOffset()) * 60_000;
}
function visit(match: Match, wallStart: number, latest: number, timing: VisitTiming): Visit | undefined {
  const { item, slot, reason } = match;
  const durationMinutes = defaultItineraryStopDurationMinutes({
    slot,
    title: item.title,
    types: item.types,
    providerDurationMinutes: item.durationMinutes,
    eventStartMs: item.eventStartMs,
    eventEndMs: item.eventEndMs,
  });
  if (item.eventStartMs) {
    const event = venueWallTime(item.eventStartMs, item.utcOffsetMinutes);
    if (event < wallStart || event - wallStart > 90 * 60_000) return;
    wallStart = event;
  }
  const finish = wallStart + durationMinutes * 60_000;
  if (finish > latest) return;
  const date = new Date(wallStart);
  const minute = date.getUTCHours() * 60 + date.getUTCMinutes();
  const hours = plannedHoursDisplay(
    item,
    date.toISOString().slice(0, 10),
    clock(minute) + ' - ' + clock(minute + durationMinutes),
  );
  if (hours.availability === 'closed' || hours.availability === 'partial') return;
  if (
    !timing.date &&
    !item.eventStartMs &&
    Math.abs(wallStart - venueWallTime(timing.now, item.utcOffsetMinutes)) < 5 * 60_000 &&
    currentHoursDisplay(item, new Date(timing.now)).isOpen === false
  )
    return;
  return {
    slot,
    item,
    review: match.review,
    experience: venueQuality(match).experience,
    reason,
    durationMinutes,
    date: date.toISOString().slice(0, 10),
    minute,
    hours: item.eventStartMs ? 'Starts at ' + clock(minute) : hours.operatingHours || hours.hoursText,
  };
}

export function starterOptions(
  candidates: Candidate[],
  center: AreaLocation,
  timing: VisitTiming,
  profile: StarterProfile,
  selection: StarterSelection,
  context: string,
  favorites: string[] = [],
  manual = false,
): Option[] {
  const matches = candidates
    .filter(
      (c) =>
        (selection.intent === 'both' || selection.intent === c.slot) &&
        Number.isFinite(c.item.lat) &&
        Number.isFinite(c.item.lng),
    )
    .filter(
      (c) =>
        (!c.item.businessStatus || c.item.businessStatus === 'OPERATIONAL') &&
        (manual || venueQuality(c).score > 0),
    )
    .map((c) => {
      const match = matchHistory(c, profile, selection, context, favorites);
      match.weights.push(venueQuality(c).score);
      return match;
    });
  function base(match: Match) {
    const now = Math.floor(venueWallTime(timing.now, match.item.utcOffsetMinutes) / 60_000) * 60_000;
    if (!timing.date) return now;
    const midnight = Date.parse(timing.date + 'T00:00:00Z');
    const start = timing.start ?? (now / 60_000) % 1440;
    return Math.max(now, midnight + start * 60_000);
  }
  const limit =
    timing.date && timing.end !== undefined
      ? Date.parse(timing.date + 'T00:00:00Z') + timing.end * 60_000
      : Infinity;
  const coords = (m: Match) => ({ latitude: m.item.lat!, longitude: m.item.lng! });
  const nearby = (a: Match, b: Match) =>
    compare(a.weights, b.weights) ||
    areaDistanceMeters(center, coords(a)) - areaDistanceMeters(center, coords(b));
  const shortlist = (slot: StarterSlot) =>
    matches
      .filter((m) => m.slot === slot)
      .sort(nearby)
      .slice(0, 16);
  const food = shortlist('food'),
    activity = shortlist('activity');
  const options: Option[] = [];
  const visits = new Map<string, Visit | undefined>();
  function scheduled(match: Match, start: number) {
    const key = [match.slot, match.item.id, start].join('|');
    if (!visits.has(key)) visits.set(key, visit(match, start, limit, timing));
    return visits.get(key);
  }
  for (const first of [...food, ...activity]) {
    const start = base(first);
    const firstVisit = scheduled(first, start);
    if (!firstVisit) continue;
    const distance = areaDistanceMeters(center, coords(first)) / METERS_PER_MILE;
    options.push({ stops: [firstVisit], weights: [1, ...first.weights, -distance] });
    const wait = first.item.eventStartMs
      ? venueWallTime(first.item.eventStartMs, first.item.utcOffsetMinutes) - start
      : 0;
    for (const second of first.slot === 'food' ? activity : food) {
      if (second.item.id === first.item.id) continue;
      const miles = areaDistanceMeters(coords(first), coords(second)) / METERS_PER_MILE;
      if (pairingDistancePenalty(miles) > 0) continue;
      const travelMinutes = driveMinutesForMiles(miles);
      const arrival = start + wait + (firstVisit.durationMinutes + travelMinutes) * 60_000;
      const next = scheduled(second, arrival);
      if (!next) continue;
      // Fit an earlier stop against the event time so the editable itinerary uses the same clock.
      const lead = second.item.eventStartMs
        ? scheduled(
            first,
            start + venueWallTime(second.item.eventStartMs, second.item.utcOffsetMinutes) - arrival,
          )
        : firstVisit;
      if (!lead) continue;
      options.push({
        stops: [lead, next],
        miles,
        weights: [2, ...first.weights.map((v, i) => v + second.weights[i]), -miles - distance / 4],
      });
    }
  }
  return options.sort((a, b) => compare(a.weights, b.weights));
}

/** Keep the other stop and its position fixed, including when only one stop fits. */
export function swapOptions(options: Option[], current: Option, index: number) {
  return options.filter(
    (o) =>
      o.stops.length === current.stops.length &&
      o.stops.every(
        (s, i) =>
          s.slot === current.stops[i].slot &&
          (i === index ? s.item.id !== current.stops[i].item.id : s.item.id === current.stops[i].item.id),
      ),
  );
}

export function fitReplacement(
  current: Option,
  index: number,
  candidate: Candidate,
  center: AreaLocation,
  timing: VisitTiming,
  profile: StarterProfile,
  selection: StarterSelection,
  context: string,
  favorites: string[],
) {
  if (
    candidate.slot !== current.stops[index]?.slot ||
    current.stops.some((s) => s.item.id === candidate.item.id)
  )
    return;
  const wanted = current.stops.map((s, i) => (i === index ? candidate : s));
  return starterOptions(wanted, center, timing, profile, selection, context, favorites, true).find(
    (o) => o.stops.length === wanted.length && o.stops.every((s, i) => s.item.id === wanted[i].item.id),
  );
}
