import { hoursLineForDate } from './planningHours';

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
