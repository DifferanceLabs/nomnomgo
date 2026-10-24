import { hoursForVisit, hoursLineForDate, shiftHoursDate } from './planningHours';

export const PLACE_HOURS_FIELDS = ['currentOpeningHours', 'regularOpeningHours', 'utcOffsetMinutes'];
export const OPEN_STATUS_MAX_AGE_MS = 5 * 60 * 1000;

type OpeningHours = {
  openNow?: boolean;
  weekdayDescriptions?: string[];
  nextOpenTime?: string;
  nextCloseTime?: string;
};

export type PlaceHours = {
  openNow?: boolean | null;
  weeklyHours?: string[];
  currentWeeklyHours?: string[];
  currentHoursStartDate?: string;
  currentHoursEndDate?: string;
  hoursFetchedAt?: number;
  hoursNextChange?: string;
  utcOffsetMinutes?: number;
};

export function placeDateKey(now: Date, utcOffsetMinutes?: number) {
  if (typeof utcOffsetMinutes === 'number') {
    return new Date(now.getTime() + utcOffsetMinutes * 60_000).toISOString().slice(0, 10);
  }
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export function readPlaceHours(place: {
  currentOpeningHours?: OpeningHours;
  regularOpeningHours?: OpeningHours;
  utcOffsetMinutes?: number;
}, now = new Date()): PlaceHours {
  // Never replace an explicit current closed/unknown status with regular hours.
  const active = place.currentOpeningHours ?? place.regularOpeningHours;
  const start = placeDateKey(now, place.utcOffsetMinutes);
  const end = new Date(`${start}T12:00:00Z`);
  end.setUTCDate(end.getUTCDate() + 6);
  return {
    openNow: typeof active?.openNow === 'boolean' ? active.openNow : null,
    weeklyHours: place.regularOpeningHours?.weekdayDescriptions ?? [],
    currentWeeklyHours: place.currentOpeningHours?.weekdayDescriptions,
    currentHoursStartDate: place.currentOpeningHours ? start : undefined,
    currentHoursEndDate: place.currentOpeningHours ? end.toISOString().slice(0, 10) : undefined,
    hoursFetchedAt: now.getTime(),
    hoursNextChange: active?.openNow ? active.nextCloseTime : active?.nextOpenTime,
    utcOffsetMinutes: place.utcOffsetMinutes,
  };
}

export function weeklyHoursForDate(hours: PlaceHours, dateKey: string) {
  if (hours.currentHoursStartDate && hours.currentHoursEndDate &&
      dateKey >= hours.currentHoursStartDate && dateKey <= hours.currentHoursEndDate) {
    // Unknown current hours must not silently become the regular schedule.
    return hours.currentWeeklyHours;
  }
  return hours.weeklyHours;
}

export function currentHoursDisplay(hours: PlaceHours, now = new Date()) {
  const age = now.getTime() - (hours.hoursFetchedAt ?? 0);
  const transition = hours.hoursNextChange ? Date.parse(hours.hoursNextChange) : NaN;
  const fresh = hours.hoursFetchedAt !== undefined && age >= 0 && age < OPEN_STATUS_MAX_AGE_MS &&
    (!Number.isFinite(transition) || now.getTime() < transition);
  const isOpen = fresh && typeof hours.openNow === 'boolean' ? hours.openNow : null;
  const dateKey = placeDateKey(now, hours.utcOffsetMinutes);
  return {
    isOpen,
    hoursText: isOpen === true ? 'Open now' : isOpen === false ? 'Closed now' : 'Hours unverified',
    todayHours: hoursLineForDate(weeklyHoursForDate(hours, dateKey), dateKey),
  };
}

export function plannedHoursDisplay(hours: PlaceHours, dateKey: string, timeWindow?: string) {
  const current = hours.currentHoursStartDate && hours.currentHoursEndDate &&
    dateKey >= hours.currentHoursStartDate && dateKey <= hours.currentHoursEndDate;
  const lineForDate = (date: string) => {
    // Yesterday's regular hours cannot prove an overnight opening on the first
    // day of the current schedule, where a special closure may have occurred.
    if (current && date < hours.currentHoursStartDate!) return undefined;
    return hoursLineForDate(weeklyHoursForDate(hours, date), date);
  };
  const { availability, warning } = hoursForVisit(lineForDate, dateKey, timeWindow);
  const previous = lineForDate(shiftHoursDate(dateKey, -1));
  const todayHours = lineForDate(dateKey);
  // Include the previous day's schedule when it actually covers an early visit.
  const previousVisit = hoursForVisit((date) => date < dateKey ? lineForDate(date) : undefined, dateKey, timeWindow);
  const hoursLines = [previousVisit.availability !== 'unknown' && previousVisit.availability !== 'closed' ? previous : undefined, todayHours].filter(Boolean);
  return {
    isOpen: availability === 'open' ? true : availability === 'closed' ? false : null,
    hoursText: availability === 'open' ? 'Open for planned visit'
      : availability === 'partial' ? 'Partly open during visit'
        : availability === 'closed' ? 'Closed during planned visit'
          : todayHours ? 'Check hours for planned visit' : 'Hours unavailable — check with venue',
    todayHours,
    operatingHours: hoursLines.length
      ? `${dateKey} · ${current ? '' : 'Typical hours · '}${hoursLines.join(' · ')}` : undefined,
    hoursWarning: warning,
  };
}

export function hasPlaceHours(hours: PlaceHours) {
  return typeof hours.openNow === 'boolean' || Boolean(hours.weeklyHours?.length || hours.currentWeeklyHours?.length);
}

export async function fetchPlaceHours(placeId: string, apiKey: string): Promise<PlaceHours> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?languageCode=en`, {
      headers: { 'X-Goog-Api-Key': apiKey, 'X-Goog-FieldMask': PLACE_HOURS_FIELDS.join(',') },
      cache: 'no-store', signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Google Places hours status ${response.status}`);
    return readPlaceHours(await response.json());
  } finally { clearTimeout(timer); }
}
