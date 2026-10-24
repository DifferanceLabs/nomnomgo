function parseClockToken(value: string) {
  const match = value.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
  if (!match) return undefined;

  let hours = Number(match[1]);
  const minutes = Number(match[2] || 0);
  if (minutes > 59) return undefined;
  if (!match[3]) return match[2] && hours <= 24 && (hours < 24 || minutes === 0) ? hours * 60 + minutes : undefined;
  if (hours < 1 || hours > 12) return undefined;
  if (hours === 12) hours = 0;
  if (match[3].toLowerCase() === 'pm') hours += 12;
  return hours * 60 + minutes;
}

function parseTimeWindow(value: string) {
  const parts = value.normalize('NFKC').split(/\s*[–—-]\s*/);
  if (parts.length !== 2) return undefined;
  // Google omits the first meridian in ranges such as "4:00–10:00 PM".
  const endMeridian = parts[1].match(/(am|pm)$/i)?.[1];
  const inheritedMeridian = !/(am|pm)$/i.test(parts[0]) && endMeridian;
  let start = parseClockToken(parts[0] + (inheritedMeridian ? ` ${endMeridian}` : ''));
  const end = parseClockToken(parts[1]);
  if (typeof start !== 'number' || typeof end !== 'number') return undefined;
  if (inheritedMeridian && start >= end && start - 720 >= 0 && start - 720 < end) start -= 720;
  return { start, end: end <= start ? end + 24 * 60 : end };
}

export function shiftHoursDate(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function intervalsForHours(line?: string) {
  if (!line) return undefined;
  const text = line.slice(line.indexOf(':') + 1).trim();
  if (/^open 24 hours$/i.test(text)) return [{ start: 0, end: 1440 }];
  if (/^closed$/i.test(text)) return [];
  const intervals = text.split(/[,;]/).map(parseTimeWindow);
  return intervals.length && intervals.every((interval) => interval !== undefined) ? intervals : undefined;
}

function clockLabel(minute: number) {
  const value = ((minute % 1440) + 1440) % 1440;
  const hour = Math.floor(value / 60);
  return `${hour % 12 || 12}:${String(value % 60).padStart(2, '0')} ${hour < 12 ? 'AM' : 'PM'}`;
}

export function hoursForVisit(
  lineForDate: (date: string) => string | undefined,
  dateKey: string,
  timeWindow: string | undefined,
) {
  const window = timeWindow ? parseTimeWindow(timeWindow) : undefined;
  if (!window) return { availability: 'unknown' as const, warning: undefined as string | undefined };
  const intervals: { start: number; end: number }[] = [];
  let known = true;
  // Previous-day openings can continue past midnight into this visit.
  for (let day = -1; day <= Math.floor((window.end - 1) / 1440); day += 1) {
    const daily = intervalsForHours(lineForDate(shiftHoursDate(dateKey, day)));
    if (!daily && day >= 0) known = false;
    daily?.forEach(({ start, end }) => intervals.push({ start: start + day * 1440, end: end + day * 1440 }));
  }
  const merged: typeof intervals = [];
  intervals.sort((a, b) => a.start - b.start).forEach((interval) => {
    const last = merged[merged.length - 1];
    if (last && interval.start <= last.end) last.end = Math.max(last.end, interval.end);
    else merged.push({ ...interval });
  });
  const covering = merged.find(({ start, end }) => start <= window.start && end >= window.end);
  if (covering) {
    const warning = covering.end - window.end <= 60
      ? `Closes at ${clockLabel(covering.end)}${covering.end >= 1440 ? ' next day' : ''}`
      : window.start - covering.start <= 60
        ? `Opens at ${clockLabel(covering.start)}` : undefined;
    return { availability: 'open' as const, warning };
  }
  const overlap = merged.find(({ start, end }) => start < window.end && end > window.start);
  if (overlap) {
    return { availability: 'partial' as const, warning: overlap.start > window.start
      ? `Opens at ${clockLabel(overlap.start)} during visit`
      : `Closes at ${clockLabel(overlap.end)} during visit` };
  }
  return { availability: known ? 'closed' as const : 'unknown' as const, warning: undefined };
}

function weekdayForDate(dateKey: string) {
  const date = new Date(`${dateKey}T12:00:00`);
  if (Number.isNaN(date.getTime())) return undefined;
  return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][date.getDay()];
}

export function hoursLineForDate(weeklyHours: string[] | undefined, dateKey: string) {
  if (!weeklyHours?.length) return undefined;
  const weekday = weekdayForDate(dateKey);
  if (!weekday) return undefined;
  // Google localizes the order as well as the text. Requests use English;
  // match the label rather than assuming the array starts on Monday.
  return weeklyHours.find((line) => {
    const label = line.slice(0, line.indexOf(':')).trim().toLowerCase();
    return label === weekday.toLowerCase() || label === weekday.slice(0, 3).toLowerCase();
  });
}

export function placeOpenDuringWindow(
  weeklyHours: string[] | undefined,
  dateKey: string,
  timeWindow: string | undefined,
): boolean | undefined {
  const { availability } = hoursForVisit((date) => hoursLineForDate(weeklyHours, date), dateKey, timeWindow);
  return availability === 'open' ? true : availability === 'closed' ? false : undefined;
}

export function foodTimePreferenceScore(
  candidate: { title?: string; subtitle?: string; types?: string[] },
  timePreference: string,
) {
  if (!timePreference || timePreference === 'Now') return 0;
  const primaryText = [candidate.title, candidate.subtitle]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .replace(/_/g, ' ');
  const typeText = (candidate.types || []).join(' ').toLowerCase().replace(/_/g, ' ');
  const text = `${primaryText} ${typeText}`;
  const includesAny = (terms: string[]) => terms.some((term) => text.includes(term));
  const primaryIncludesAny = (terms: string[]) => terms.some((term) => primaryText.includes(term));

  if (timePreference === 'Morning') {
    if (includesAny(['breakfast', 'brunch', 'bakery', 'coffee', 'cafe'])) return 32;
    if (includesAny(['bar', 'distillery', 'night club'])) return -28;
  }
  if (timePreference === 'Lunch') {
    if (primaryIncludesAny(['distillery', 'manufacturer', 'live music', 'night club'])) return -30;
    if (primaryIncludesAny(['coffee shop', 'bakery', 'cafe'])) return 6;
    if (primaryIncludesAny(['restaurant', 'sandwich', 'deli', 'pizza', 'salad', 'bar & grill', 'pub', 'eatery'])) return 42;
    if (includesAny(['restaurant', 'sandwich', 'deli', 'pizza', 'salad', 'meal takeaway', 'bar & grill'])) return 26;
  }
  if (timePreference === 'Afternoon') {
    if (includesAny(['coffee', 'cafe', 'bakery', 'dessert', 'ice cream', 'tea'])) return 28;
  }
  if (timePreference === 'Dinner') {
    if (includesAny(['restaurant', 'steak', 'italian', 'mexican', 'sushi', 'seafood', 'bar & grill'])) return 34;
    if (includesAny(['coffee shop', 'bakery', 'breakfast'])) return -18;
  }
  if (timePreference === 'Late night') {
    if (includesAny(['bar', 'pub', 'night club', 'bar & grill', 'restaurant'])) return 28;
    if (includesAny(['bakery', 'breakfast', 'coffee shop'])) return -22;
  }
  return 0;
}

export function timePreferenceForWindow(timeWindow: string | undefined, fallback = 'Now') {
  if (!timeWindow) return fallback;
  const preferences: Record<string, string> = {
    '9:00 AM - 11:30 AM': 'Morning',
    '11:30 AM - 1:30 PM': 'Lunch',
    '1:00 PM - 5:00 PM': 'Afternoon',
    '6:00 PM - 9:00 PM': 'Dinner',
    '9:00 PM - 12:00 AM': 'Late night',
  };
  return preferences[timeWindow] || fallback;
}
