import { SearchExecution } from './searchExecution';

export type AreaKind = 'downtown' | 'neighborhood' | 'freeway' | 'waterfront' | 'supercharger' | 'custom';
export type AreaCenter = { latitude: number; longitude: number; label?: string };
export type AreaCorridor = AreaCenter[][];
export type AreaFocus = {
  kind: AreaKind;
  placeId: string;
  radiusMeters: number;
  base: AreaCenter;
  corridor?: AreaCorridor;
  placeName?: string;
  placeAddress?: string;
};
export type AreaLocation = AreaCenter & { areaFocus?: AreaFocus };
export type AreaMatch = AreaCenter & { id: string; label: string; address: string; description: string; corridor?: AreaCorridor; source?: 'osm' | 'google' };

export const AREA_RADIUS_OPTIONS = [1, 2, 5] as const;
export const METERS_PER_MILE = 1609.344;
export const AREA_DISCOVERY_RADIUS = 25000;
export const AREA_CHOICES: { kind: AreaKind; label: string; query: string }[] = [
  { kind: 'downtown', label: 'Downtown', query: 'downtown historic district' },
  { kind: 'neighborhood', label: 'Neighborhoods', query: 'neighborhoods' },
  { kind: 'freeway', label: 'Near freeway', query: 'freeways' },
  { kind: 'waterfront', label: 'Waterfront', query: 'waterfront parks' },
  { kind: 'supercharger', label: 'Tesla Superchargers', query: 'Tesla Supercharger' },
  { kind: 'custom', label: 'Other area', query: '' },
];

/** Only an explicitly chosen location changes the main search. */
export function locationForArea(kind: AreaKind, base: AreaCenter, match: AreaMatch, radiusMeters = 2 * METERS_PER_MILE): AreaLocation {
  return {
    latitude: match.latitude,
    longitude: match.longitude,
    label: kind === 'supercharger' && match.address ? `${match.label} · ${match.address}` : match.label,
    areaFocus: {
      kind, placeId: match.id, base, radiusMeters,
      ...(match.corridor ? { corridor: match.corridor } : {}),
      ...(kind === 'supercharger' ? { placeName: match.label, placeAddress: match.address } : {}),
    },
  };
}

/** Reuse the selected station without another provider request, including older saved searches. */
export function superchargerForSearchArea(center: AreaLocation | null | undefined) {
  const focus = center?.areaFocus;
  if (!center || focus?.kind !== 'supercharger' || !focus.placeId
    || !Number.isFinite(center.latitude) || !Number.isFinite(center.longitude)
    || Math.abs(center.latitude) > 90 || Math.abs(center.longitude) > 180) return undefined;
  const [legacyName, ...legacyAddress] = (center.label || '').split(' · ');
  return {
    id: focus.placeId,
    title: focus.placeName || legacyName || 'Tesla Supercharger',
    subtitle: 'Tesla Supercharger',
    address: focus.placeAddress || legacyAddress.join(' · ') || undefined,
    lat: center.latitude,
    lng: center.longitude,
    types: ['electric_vehicle_charging_station'],
    mapsUri: `https://www.google.com/maps/search/?api=1&query=${center.latitude},${center.longitude}&query_place_id=${encodeURIComponent(focus.placeId)}`,
  };
}

export function areaDistanceMeters(a: AreaCenter, b: AreaCenter) {
  const rad = Math.PI / 180;
  const lat = (b.latitude - a.latitude) * rad;
  const lon = (b.longitude - a.longitude) * rad;
  const h = Math.sin(lat / 2) ** 2 + Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin(lon / 2) ** 2;
  return 6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, h)));
}

export function areaSearchRadius(center: AreaLocation | null | undefined, fallback: number) {
  const radius = center?.areaFocus?.radiusMeters;
  // Fetch across the local freeway corridor, then apply the distance-to-road filter.
  if (center?.areaFocus?.corridor?.length && radius && radius > 0) {
    const extent = Math.max(...center.areaFocus.corridor.flat().map((point) => areaDistanceMeters(center, point)));
    return Math.min(50000, extent + radius);
  }
  return typeof radius === 'number' && Number.isFinite(radius) && radius > 0
    ? Math.min(fallback, radius)
    : fallback;
}

export function isInsideSearchArea(center: AreaLocation | null | undefined, card: { lat?: number; lng?: number }) {
  if (!center?.areaFocus) return true;
  if (!Number.isFinite(card.lat) || !Number.isFinite(card.lng)) return false;
  const point = { latitude: card.lat!, longitude: card.lng! };
  if (center.areaFocus.corridor?.length) {
    return areaDistanceMeters(center.areaFocus.base, point) <= AREA_DISCOVERY_RADIUS
      && center.areaFocus.corridor.some((line) => line.some((start, index) => index > 0
        && distanceToSegment(point, line[index - 1], start) <= center.areaFocus!.radiusMeters));
  }
  return areaDistanceMeters(center, point) <= areaSearchRadius(center, 50000);
}

function distanceToSegment(point: AreaCenter, a: AreaCenter, b: AreaCenter) {
  const scaleX = 111195 * Math.cos(point.latitude * Math.PI / 180);
  const ax = (a.longitude - point.longitude) * scaleX;
  const ay = (a.latitude - point.latitude) * 111195;
  const bx = (b.longitude - point.longitude) * scaleX;
  const by = (b.latitude - point.latitude) * 111195;
  const dx = bx - ax;
  const dy = by - ay;
  const length = dx * dx + dy * dy;
  const t = length ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / length)) : 0;
  return Math.hypot(ax + t * dx, ay + t * dy);
}

/** Keep road bends within 50 m while avoiding huge saved plans and share links. */
function simplifyRoad(points: AreaCenter[]): AreaCenter[] {
  if (points.length <= 2) return points;
  let farthest = 50;
  let split = -1;
  for (let index = 1; index < points.length - 1; index += 1) {
    const distance = distanceToSegment(points[index], points[0], points[points.length - 1]);
    if (distance > farthest) { farthest = distance; split = index; }
  }
  if (split < 0) return [points[0], points[points.length - 1]];
  return [...simplifyRoad(points.slice(0, split + 1)).slice(0, -1), ...simplifyRoad(points.slice(split))];
}

export function areaSearchBody(kind: AreaKind, input: string, base: AreaCenter) {
  const choice = AREA_CHOICES.find((option) => option.kind === kind)!;
  const query = input.trim() || choice.query;
  if (!query) throw new Error('Enter a neighborhood, road, exit, or landmark.');
  const label = base.label?.trim();
  const hasNamedLocation = label && !/^(current location|last known location|shared search)$/i.test(label);
  return {
    textQuery: hasNamedLocation ? `${query} near ${label.replace(/^Near\s+/i, '')}` : query,
    pageSize: 20,
    ...(kind === 'supercharger' ? { includedType: 'electric_vehicle_charging_station', strictTypeFiltering: true } : {}),
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
    const geographic = types.some((type) => ['neighborhood', 'colloquial_area', 'sublocality', 'sublocality_level_1', 'sublocality_level_2'].includes(type));
    if (!customQuery && kind === 'downtown' && !geographic && !/downtown|city cent(?:er|re)|main street|historic district/i.test(label)) continue;
    if (!customQuery && kind === 'neighborhood' && !geographic && !/neighborhood|district|village/i.test(label)) continue;
    if (kind === 'supercharger' && (!/tesla/i.test(label) || !/supercharg/i.test(label))) continue;
    found.set(place.id, {
      ...center, id: place.id, label, address: place.formattedAddress || '', source: 'google',
      description: geographic ? 'Neighborhood' : types.includes('route') ? 'Road'
        : kind === 'supercharger' ? 'Tesla Supercharger' : types.includes('park') ? 'Park' : 'Local landmark',
    });
  }
  return Array.from(found.values()).slice(0, 20);
}

type MapElement = {
  type: string; id: number; lat?: number; lon?: number;
  center?: { lat: number; lon: number }; geometry?: { lat: number; lon: number }[];
  tags?: Record<string, string>;
};

export function localAreaQuery(kind: 'freeway' | 'neighborhood', base: AreaCenter) {
  if (!Number.isFinite(base.latitude) || !Number.isFinite(base.longitude) || Math.abs(base.latitude) > 90 || Math.abs(base.longitude) > 180) {
    throw new Error('Search location not found.');
  }
  const around = `${kind === 'freeway' ? 25000 : 15000},${base.latitude.toFixed(2)},${base.longitude.toFixed(2)}`;
  return `[out:json][timeout:20];${kind === 'freeway'
    ? `way["highway"="motorway"](around:${around});out tags geom;`
    : `nwr["place"~"^(suburb|quarter|neighbourhood)$"]["name"](around:${around});out tags center;`}`;
}

export function localAreaMatches(elements: MapElement[], base: AreaCenter, kind: 'freeway' | 'neighborhood'): AreaMatch[] {
  const matches = new Map<string, AreaMatch>();
  const ranks = new Map<string, number>();
  for (const element of elements) {
    const tags = element.tags || {};
    if (kind === 'freeway') {
      if (tags.highway !== 'motorway') continue;
      const refs = (tags.ref || tags.name || '').split(';').map((ref) => ref.trim().replace(/^I[ -]?(\d+)/, 'I-$1')).filter(Boolean);
      const rawGeometry = (element.geometry || []).map((point) => ({ latitude: point.lat, longitude: point.lon }));
      if (rawGeometry.some((p) => !Number.isFinite(p.latitude) || !Number.isFinite(p.longitude) || Math.abs(p.latitude) > 90 || Math.abs(p.longitude) > 180)) continue;
      const geometry = simplifyRoad(rawGeometry);
      // Keep separate segments: never bridge gaps or disconnected carriageways.
      const segments: AreaCorridor = [];
      for (let index = 1; index < geometry.length; index += 1) {
        const a = geometry[index - 1];
        const b = geometry[index];
        if ([a, b].every((p) => Number.isFinite(p.latitude) && Number.isFinite(p.longitude) && Math.abs(p.latitude) <= 90 && Math.abs(p.longitude) <= 180)
          && Math.min(areaDistanceMeters(base, a), areaDistanceMeters(base, b)) <= AREA_DISCOVERY_RADIUS) segments.push([a, b]);
      }
      if (!segments.length) continue;
      for (const label of refs) {
        const id = `osm-freeway:${label.toLowerCase()}`;
        const match = matches.get(id) || { ...base, id, label, address: `Near ${base.label || 'your search location'}`, description: 'Freeway', source: 'osm' as const, corridor: [] };
        match.corridor!.push(...segments);
        matches.set(id, match);
      }
    } else {
      if (!['suburb', 'quarter', 'neighbourhood'].includes(tags.place)) continue;
      const label = (tags.name || '').trim().replace(/\s*=\s*$/, '');
      const point = element.center || { lat: element.lat, lon: element.lon };
      if (!label || !Number.isFinite(point.lat) || !Number.isFinite(point.lon)) continue;
      const center = { latitude: point.lat!, longitude: point.lon! };
      const distance = areaDistanceMeters(base, center);
      if (distance > 15000) continue;
      const id = `osm-neighborhood:${label.toLowerCase()}`;
      if (matches.has(id)) continue;
      matches.set(id, { ...center, id, label, address: `Near ${base.label || 'your search location'}`, description: 'Neighborhood', source: 'osm' });
      // Larger districts first, then nearby neighborhoods.
      ranks.set(id, distance + (tags.place === 'suburb' || tags.place === 'quarter' ? -15000 : 0));
    }
  }
  if (kind === 'freeway') {
    for (const match of matches.values()) {
      ranks.set(match.id, Math.min(...match.corridor!.map(([a, b]) => distanceToSegment(base, a, b))));
    }
  }
  return [...matches.values()].sort((a, b) => ranks.get(a.id)! - ranks.get(b.id)!).slice(0, kind === 'freeway' ? 12 : 100);
}

/** Google's relevant local names promote recognizable districts; choices remain real map areas. */
export function rankNeighborhoods(matches: AreaMatch[], places: GoogleAreaPlace[]): AreaMatch[] {
  const names = places.map((place) => place.displayName?.text?.toLowerCase() || '');
  const rank = (match: AreaMatch) => {
    const index = names.findIndex((name) => name.includes(match.label.toLowerCase()));
    return index < 0 ? names.length : index;
  };
  return [...matches].sort((a, b) => rank(a) - rank(b)).slice(0, 30);
}

export async function findSearchAreas(
  apiKey: string, kind: AreaKind, input: string, base: AreaCenter, execution: SearchExecution,
): Promise<AreaMatch[]> {
  if (kind === 'freeway' || kind === 'neighborhood') {
    const query = localAreaQuery(kind, base);
    const hostedWeb = typeof window !== 'undefined' && /^https?:$/.test(window.location?.protocol || '');
    const json = await execution.json<{ elements?: MapElement[]; remark?: string }>('Local areas',
      hostedWeb ? `/api/local-areas?kind=${kind}&lat=${base.latitude.toFixed(2)}&lng=${base.longitude.toFixed(2)}` : 'https://overpass-api.de/api/interpreter',
      hostedWeb ? undefined : {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'NomNomGo/1.0 (+https://nomnomgo.differancelabs.com)' },
        body: `data=${encodeURIComponent(query)}`,
      }, 30000);
    if (json.remark || !Array.isArray(json.elements)) throw new Error('Area search is temporarily unavailable.');
    const matches = localAreaMatches(json.elements, base, kind);
    if (kind === 'neighborhood' && apiKey && matches.length) {
      try {
        const popular = await execution.json<{ places?: GoogleAreaPlace[] }>('Google Places', 'https://places.googleapis.com/v1/places:searchText', {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': apiKey, 'X-Goog-FieldMask': 'places.displayName' },
          body: JSON.stringify(areaSearchBody(kind, '', base)),
        });
        return rankNeighborhoods(matches, Array.isArray(popular.places) ? popular.places : []);
      } catch {
        execution.check(); // Ranking is optional; an unavailable provider must not hide map areas.
      }
    }
    return matches.slice(0, 30);
  }
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
