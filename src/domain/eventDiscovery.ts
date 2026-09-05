type EventVenue = {
  id?: string;
  name?: string;
  url?: string;
  city?: { name?: string };
  state?: { stateCode?: string };
  country?: { countryCode?: string };
  address?: { line1?: string };
};

export type DiscoveryEvent = {
  id?: string;
  name?: string;
  dates?: {
    timezone?: string;
    start?: { localDate?: string; localTime?: string; dateTime?: string };
  };
  _embedded?: { venues?: EventVenue[] };
};

const normalize = (value = '') => value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

// Allow minor venue spelling differences (Hellbender / Hellbenders), while
// requiring the same city, named performance, and local start time.
const venueName = (value = '') => normalize(value).split(' ')
  .map((word) => word.length > 4 && word.endsWith('s') ? word.slice(0, -1) : word).join(' ');

function samePerformance(a: DiscoveryEvent, b: DiscoveryEvent) {
  if (a.id && a.id === b.id) return true;
  if (!a.name || normalize(a.name) !== normalize(b.name)) return false;
  const startA = a.dates?.start;
  const startB = b.dates?.start;
  if (!startA?.localDate || !startA.localTime || startA.localDate !== startB?.localDate || startA.localTime !== startB.localTime) return false;
  const venueA = a._embedded?.venues?.[0];
  const venueB = b._embedded?.venues?.[0];
  if (!venueA || !venueB) return false;
  if (venueA.id && venueA.id === venueB.id) return true;
  return Boolean(venueA.name && venueB.name && venueA.city?.name && venueB.city?.name
    && venueName(venueA.name) === venueName(venueB.name)
    && normalize(venueA.city.name) === normalize(venueB.city.name)
    && normalize(venueA.state?.stateCode) === normalize(venueB.state?.stateCode)
    && normalize(venueA.country?.countryCode) === normalize(venueB.country?.countryCode));
}

function venueDetailScore(event: DiscoveryEvent) {
  const venue = event._embedded?.venues?.[0];
  return (venue?.url ? 4 : 0) + (event.dates?.timezone ? 2 : 0) + (venue?.address?.line1 ? 1 : 0);
}

export function deduplicateEvents<T extends DiscoveryEvent>(events: T[]) {
  const unique: { event: T; addressConflict: boolean }[] = [];
  for (const event of events) {
    const existing = unique.find((candidate) => samePerformance(candidate.event, event));
    if (!existing) { unique.push({ event, addressConflict: false }); continue; }
    const previousAddress = existing.event._embedded?.venues?.[0]?.address?.line1;
    const nextAddress = event._embedded?.venues?.[0]?.address?.line1;
    existing.addressConflict ||= Boolean(previousAddress && nextAddress && normalize(previousAddress) !== normalize(nextAddress));
    // Keep one complete record: never mix one listing's address with another's coordinates.
    if (venueDetailScore(event) > venueDetailScore(existing.event)) existing.event = event;
  }
  return unique;
}

export type DiscoveryPage<T> = { _embedded?: { events?: T[] }; page?: { totalPages?: number } };

/** Discovery supports at most 1,000 records (five pages of 200). */
export async function collectEventPages<T>(readPage: (page: number, size: number) => Promise<DiscoveryPage<T>>) {
  const events: T[] = [];
  let totalPages = 1;
  for (let page = 0; page < Math.min(totalPages, 5); page += 1) {
    const response = await readPage(page, 200);
    events.push(...(response._embedded?.events || []));
    totalPages = Math.max(1, response.page?.totalPages || 1);
  }
  return { events, truncated: totalPages > 5 };
}
