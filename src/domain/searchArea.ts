import { SearchExecution } from './searchExecution';

export type AreaKind = 'downtown' | 'neighborhood' | 'freeway' | 'waterfront' | 'custom';
export type AreaCenter = { latitude: number; longitude: number; label?: string };
export type AreaFocus = {
  kind: AreaKind;
  placeId: string;
  radiusMeters: number;
  base: AreaCenter;
};
export type AreaLocation = AreaCenter & { areaFocus?: AreaFocus };
export type AreaMatch = AreaCenter & { id: string; label: string; address: string; description: string };

export const AREA_RADIUS_OPTIONS = [1, 2, 5] as const;
export const METERS_PER_MILE = 1609.344;
export const AREA_DISCOVERY_RADIUS = 25000;
export const AREA_CHOICES: { kind: AreaKind; label: string; query: string }[] = [
  { kind: 'downtown', label: 'Downtown', query: 'downtown historic district' },
  { kind: 'neighborhood', label: 'Neighborhoods', query: 'neighborhoods' },
  { kind: 'freeway', label: 'Near freeway', query: 'highway rest stops' },
  { kind: 'waterfront', label: 'Waterfront', query: 'waterfront parks' },
  { kind: 'custom', label: 'Other area', query: '' },
];

export function areaDistanceMeters(a: AreaCenter, b: AreaCenter) {
  const rad = Math.PI / 180;
  const lat = (b.latitude - a.latitude) * rad;
  const lon = (b.longitude - a.longitude) * rad;
  const h = Math.sin(lat / 2) ** 2 + Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin(lon / 2) ** 2;
  return 6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, h)));
}

export function areaSearchRadius(center: AreaLocation | null | undefined, fallback: number) {
  const radius = center?.areaFocus?.radiusMeters;
  return typeof radius === 'number' && Number.isFinite(radius) && radius > 0
    ? Math.min(fallback, radius)
    : fallback;
}

export function isInsideSearchArea(center: AreaLocation | null | undefined, card: { lat?: number; lng?: number }) {
  if (!center?.areaFocus) return true;
  if (!Number.isFinite(card.lat) || !Number.isFinite(card.lng)) return false;
  return areaDistanceMeters(center, { latitude: card.lat!, longitude: card.lng! }) <= areaSearchRadius(center, 50000);
}

export function areaSearchBody(kind: AreaKind, input: string, base: AreaCenter) {
  const choice = AREA_CHOICES.find((option) => option.kind === kind)!;
  const query = input.trim() || choice.query;
  if (!query) throw new Error('Enter a neighborhood, road, exit, or landmark.');
  const label = base.label?.trim();
  const hasNamedLocation = label && !/^(current location|last known location|shared search)$/i.test(label);
  return {
    textQuery: hasNamedLocation ? `${query} near ${label.replace(/^Near\s+/i, '')}` : query,
    pageSize: 12,
    ...(kind === 'freeway' && !input.trim() ? { includedType: 'rest_stop', strictTypeFiltering: true } : {}),
    locationBias: { circle: { center: { latitude: base.latitude, longitude: base.longitude }, radius: AREA_DISCOVERY_RADIUS } },
  };
}

type GoogleAreaPlace = {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  types?: string[];
};

export function areaMatches(places: GoogleAreaPlace[], base: AreaCenter, kind: AreaKind, customQuery = false): AreaMatch[] {
  const found = new Map<string, AreaMatch>();
  for (const place of places) {
    const latitude = place.location?.latitude;
    const longitude = place.location?.longitude;
    const label = place.displayName?.text?.trim();
    if (!place.id || !label || typeof latitude !== 'number' || typeof longitude !== 'number'
      || !Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) continue;
    const center = { latitude, longitude };
    if (areaDistanceMeters(base, center) > AREA_DISCOVERY_RADIUS) continue;
    const types = place.types || [];
    const geographic = types.some((type) => ['neighborhood', 'sublocality', 'sublocality_level_1', 'sublocality_level_2'].includes(type));
    if (!customQuery && kind === 'downtown' && !geographic && !/downtown|city cent(?:er|re)|main street|historic district/i.test(label)) continue;
    if (!customQuery && kind === 'neighborhood' && !geographic && !/neighborhood|district|village/i.test(label)) continue;
    found.set(place.id, {
      ...center, id: place.id, label, address: place.formattedAddress || '',
      description: geographic ? 'Neighborhood' : types.includes('route') ? 'Road'
        : types.includes('rest_stop') ? 'Rest stop' : types.includes('park') ? 'Park' : 'Local landmark',
    });
  }
  return Array.from(found.values()).slice(0, 6);
}

export async function findSearchAreas(
  apiKey: string, kind: AreaKind, input: string, base: AreaCenter, execution: SearchExecution,
): Promise<AreaMatch[]> {
  if (!apiKey) throw new Error('Area search is temporarily unavailable.');
  const json = await execution.json<{ places?: GoogleAreaPlace[] }>('Google Places', 'https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json', 'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.types',
    },
    body: JSON.stringify(areaSearchBody(kind, input, base)),
  });
  return areaMatches(Array.isArray(json.places) ? json.places : [], base, kind, Boolean(input.trim()));
}
