type PlanDestination = {
  title: string;
  address?: string;
  subtitle?: string;
  latitude?: number;
  longitude?: number;
};

// A city label alone should not group distant destinations in sprawling cities.
const MAX_AREA_SPAN_KM = 25;

function destinationArea(place: PlanDestination) {
  for (const text of [place.address, place.subtitle]) {
    if (!text) continue;
    // Use address evidence, never a word guessed from the venue's name.
    const match = text.match(/(?:^|,\s*)([\p{L}][\p{L}\s.'’-]*?),?\s+([A-Z]{2})(?:\s+\d{5}(?:-\d{4})?|\s+[A-Z]\d[A-Z]\s?\d[A-Z]\d)?(?=\s*(?:,|$|[·|]| - ))/u);
    if (match) return `${match[1].trim().replace(/\s+/g, ' ')}, ${match[2]}`;
  }
  return undefined;
}

function coordinates(place: PlanDestination) {
  const { latitude, longitude } = place;
  return typeof latitude === 'number' && Number.isFinite(latitude) && Math.abs(latitude) <= 90 &&
    typeof longitude === 'number' && Number.isFinite(longitude) && Math.abs(longitude) <= 180
    ? { latitude, longitude } : undefined;
}

function distanceKm(a: NonNullable<ReturnType<typeof coordinates>>, b: NonNullable<ReturnType<typeof coordinates>>) {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const haversine = Math.sin(radians(b.latitude - a.latitude) / 2) ** 2 +
    Math.cos(radians(a.latitude)) * Math.cos(radians(b.latitude)) * Math.sin(radians(b.longitude - a.longitude) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, haversine)));
}

export function planLocationLabel(stops: readonly PlanDestination[]) {
  const first = stops[0];
  if (!first) return 'Location to be decided';
  const areas = stops.map(destinationArea);
  const points = stops.map(coordinates);
  const sameArea = areas[0] && areas.every((area) => area?.toLocaleLowerCase() === areas[0]!.toLocaleLowerCase());
  const nearby = points.every((a, index) => !a || points.slice(index + 1).every((b) => !b || distanceKm(a, b) <= MAX_AREA_SPAN_KM));
  if (sameArea && nearby) return areas[0]!;
  return [first.title.trim() || first.address?.trim() || 'First stop', areas[0]].filter(Boolean).join(' · ');
}
