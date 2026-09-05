function parseClockToken(value: string) {
  const match = value.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i);
  if (!match) return undefined;

  let hours = Number(match[1]);
  const minutes = Number(match[2] || 0);
  if (hours < 1 || hours > 12 || minutes < 0 || minutes > 59) return undefined;
  if (hours === 12) hours = 0;
  if (match[3].toLowerCase() === 'pm') hours += 12;
  return hours * 60 + minutes;
}

function parseTimeWindow(value: string) {
  const parts = value.split(/\s+[–—-]\s+/);
  if (parts.length !== 2) return undefined;
  const start = parseClockToken(parts[0]);
  const end = parseClockToken(parts[1]);
  if (typeof start !== 'number' || typeof end !== 'number') return undefined;
  return { start, end: end <= start ? end + 24 * 60 : end };
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
  if (!timeWindow) return undefined;
  const hoursLine = hoursLineForDate(weeklyHours, dateKey);
  if (!hoursLine) return undefined;

  const hoursText = hoursLine.slice(hoursLine.indexOf(':') + 1).trim();
  if (/open 24 hours/i.test(hoursText)) return true;
  if (/closed/i.test(hoursText)) return false;

  const planWindow = parseTimeWindow(timeWindow);
  if (!planWindow) return undefined;
  const targetMinute = (planWindow.start + planWindow.end) / 2;
  const intervalPattern = /(\d{1,2}(?::\d{2})?\s*(?:am|pm))\s*[–—-]\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm))/gi;
  let parsedInterval = false;
  let match = intervalPattern.exec(hoursText);

  while (match) {
    const start = parseClockToken(match[1]);
    const rawEnd = parseClockToken(match[2]);
    if (typeof start === 'number' && typeof rawEnd === 'number') {
      parsedInterval = true;
      const end = rawEnd <= start ? rawEnd + 24 * 60 : rawEnd;
      const comparableTarget = targetMinute < start && end > 24 * 60 ? targetMinute + 24 * 60 : targetMinute;
      if (comparableTarget >= start && comparableTarget <= end) return true;
    }
    match = intervalPattern.exec(hoursText);
  }

  return parsedInterval ? false : undefined;
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
