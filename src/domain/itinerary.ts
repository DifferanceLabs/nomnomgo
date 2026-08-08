export type ItineraryStopKind = 'food' | 'activity' | 'dessert' | 'idea';

export const DURATION_STEP_MINUTES = 15;
export const MIN_STOP_DURATION_MINUTES = 15;

export const DEFAULT_STOP_DURATION_MINUTES = {
  coffee: 30,
  dessert: 30,
  food: 75,
  activity: 75,
  activityShort: 60,
  activityLong: 90,
  idea: 60,
} as const;

type StopKindInput = {
  explicitKind?: ItineraryStopKind;
  slot: 'food' | 'activity';
  title?: string;
  types?: string[];
  manual?: boolean;
};

type StopDurationInput = StopKindInput & {
  providerDurationMinutes?: number;
  eventStartMs?: number;
  eventEndMs?: number;
};

export type ItineraryTimelineInput = {
  durationMinutes: number;
  travelMinutes: number;
  overlapsPreviousArrival?: boolean;
};

export type ItineraryTimelineStop = {
  arrivalMinutes: number;
  durationMinutes: number;
  finishMinutes: number;
  travelMinutes: number;
};

const DESSERT_TERMS = [
  'bakery',
  'coffee',
  'cafe',
  'dessert',
  'donut',
  'ice cream',
  'ice_cream',
  'pastry',
  'sweet',
];

const LONG_ACTIVITY_TERMS = [
  'amusement',
  'arcade',
  'bowling',
  'escape room',
  'escape_room',
  'live music',
];

const SHORT_ACTIVITY_TERMS = [
  'gallery',
  'museum',
  'park',
  'shopping',
  'tourist attraction',
  'tourist_attraction',
];

function searchableStopText(title = '', types: string[] = []) {
  return `${title} ${types.join(' ')}`.trim().toLowerCase();
}

function includesAny(value: string, terms: string[]) {
  return terms.some((term) => value.includes(term));
}

export function inferItineraryStopKind({
  explicitKind,
  slot,
  title,
  types,
  manual,
}: StopKindInput): ItineraryStopKind {
  if (explicitKind) return explicitKind;
  if (manual) return 'idea';
  if (slot === 'activity') return 'activity';
  return includesAny(searchableStopText(title, types), DESSERT_TERMS) ? 'dessert' : 'food';
}

export function defaultItineraryStopDurationMinutes(input: StopDurationInput) {
  if (
    typeof input.providerDurationMinutes === 'number' &&
    Number.isFinite(input.providerDurationMinutes) &&
    input.providerDurationMinutes > 0
  ) {
    return snapStopDurationMinutes(input.providerDurationMinutes);
  }

  if (
    typeof input.eventStartMs === 'number' &&
    typeof input.eventEndMs === 'number' &&
    Number.isFinite(input.eventStartMs) &&
    Number.isFinite(input.eventEndMs) &&
    input.eventEndMs > input.eventStartMs
  ) {
    return snapStopDurationMinutes((input.eventEndMs - input.eventStartMs) / 60_000);
  }

  const searchable = searchableStopText(input.title, input.types);
  const kind = inferItineraryStopKind(input);
  if (kind === 'dessert') return DEFAULT_STOP_DURATION_MINUTES.dessert;
  if (kind === 'food') {
    return includesAny(searchable, DESSERT_TERMS)
      ? DEFAULT_STOP_DURATION_MINUTES.coffee
      : DEFAULT_STOP_DURATION_MINUTES.food;
  }
  if (kind === 'idea') return DEFAULT_STOP_DURATION_MINUTES.idea;

  if (includesAny(searchable, LONG_ACTIVITY_TERMS)) return DEFAULT_STOP_DURATION_MINUTES.activityLong;
  if (includesAny(searchable, SHORT_ACTIVITY_TERMS)) return DEFAULT_STOP_DURATION_MINUTES.activityShort;
  return DEFAULT_STOP_DURATION_MINUTES.activity;
}

export function snapStopDurationMinutes(value: number) {
  const safeValue = Number.isFinite(value) ? value : MIN_STOP_DURATION_MINUTES;
  return Math.max(
    MIN_STOP_DURATION_MINUTES,
    Math.round(safeValue / DURATION_STEP_MINUTES) * DURATION_STEP_MINUTES,
  );
}

export function adjustStopDurationMinutes(value: number, direction: -1 | 1) {
  return snapStopDurationMinutes(value + direction * DURATION_STEP_MINUTES);
}

export function calculateItineraryTimeline(inputs: readonly ItineraryTimelineInput[]) {
  let elapsedMinutes = 0;
  let previousArrivalMinutes: number | undefined;

  const stops: ItineraryTimelineStop[] = inputs.map((input) => {
    const travelMinutes = Math.max(0, Math.round(Number.isFinite(input.travelMinutes) ? input.travelMinutes : 0));
    const durationMinutes = snapStopDurationMinutes(input.durationMinutes);
    const arrivalMinutes = input.overlapsPreviousArrival && previousArrivalMinutes !== undefined
      ? previousArrivalMinutes
      : elapsedMinutes + travelMinutes;
    const finishMinutes = arrivalMinutes + durationMinutes;

    elapsedMinutes = input.overlapsPreviousArrival
      ? Math.max(elapsedMinutes, finishMinutes)
      : finishMinutes;
    previousArrivalMinutes = arrivalMinutes;

    return {
      arrivalMinutes,
      durationMinutes,
      finishMinutes,
      travelMinutes,
    };
  });

  return {
    stops,
    totalMinutes: stops.length ? elapsedMinutes : 0,
  };
}

export function formatItineraryDuration(totalMinutes: number) {
  const minutes = Math.max(0, Math.round(totalMinutes));
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (!hours) return `${remainder} min`;
  if (!remainder) return `${hours} hr`;
  return `${hours} hr ${remainder} min`;
}
