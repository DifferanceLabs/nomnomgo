export const GOOGLE_MAPS_ROUTE_IMPORT_ERROR =
  'Could not read this route automatically. Add stops manually or paste a full Google Maps directions URL.';

export type GoogleMapsRouteProvider = 'google_maps';

export type GoogleMapsRouteStop = {
  label: string;
  originalToken: string;
  placeName?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
};

export type GoogleMapsRouteImport = {
  title: string;
  stops: GoogleMapsRouteStop[];
  sourceUrl: string;
  routeProvider: GoogleMapsRouteProvider;
  status: 'draft';
};

type Coordinate = {
  latitude: number;
  longitude: number;
};

function normalizeUrlInput(rawUrl: string) {
  const trimmed = rawUrl.trim();
  if (!trimmed) return undefined;
  return /^[a-z][a-z\d+\-.]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function decodeRouteToken(token: string) {
  const plusAsSpaces = token.replace(/\+/g, ' ');
  try {
    return decodeURIComponent(plusAsSpaces).trim();
  } catch {
    return plusAsSpaces.trim();
  }
}

function parseCoordinateText(value: string): Coordinate | undefined {
  const match = value.trim().match(/^(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)$/);
  if (!match) return undefined;
  const latitude = Number(match[1]);
  const longitude = Number(match[2]);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return undefined;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return undefined;
  return { latitude, longitude };
}

function extractDataCoordinates(dataToken?: string): Coordinate[] {
  if (!dataToken) return [];
  const coordinates: Coordinate[] = [];
  const pattern = /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/g;
  let match = pattern.exec(dataToken);
  while (match) {
    const latitude = Number(match[1]);
    const longitude = Number(match[2]);
    if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
      coordinates.push({ latitude, longitude });
    }
    match = pattern.exec(dataToken);
  }
  return coordinates;
}

function isLikelyAddress(label: string) {
  return /^\d+\s+\S+/.test(label) ||
    /\b(st|street|ave|avenue|rd|road|dr|drive|ln|lane|pl|place|blvd|boulevard|pkwy|parkway|ct|court|way|cir|circle)\b/i.test(label);
}

function titleForStops(stops: GoogleMapsRouteStop[]) {
  if (!stops.length) return 'Google Maps route';
  if (stops.length === 1) return `Google Maps route: ${stops[0].label}`;
  return `${stops[0].label} to ${stops[stops.length - 1].label}`;
}

function routeStopFromToken(token: string, dataCoordinate?: Coordinate): GoogleMapsRouteStop | undefined {
  const label = decodeRouteToken(token);
  if (!label || label === 'maps' || label === 'dir') return undefined;

  const tokenCoordinate = parseCoordinateText(label);
  const coordinate = tokenCoordinate || dataCoordinate;
  const isCoordinateOnly = Boolean(tokenCoordinate);
  const stop: GoogleMapsRouteStop = {
    label: isCoordinateOnly && coordinate
      ? `${coordinate.latitude.toFixed(6)}, ${coordinate.longitude.toFixed(6)}`
      : label,
    originalToken: token,
  };

  if (coordinate) {
    stop.latitude = coordinate.latitude;
    stop.longitude = coordinate.longitude;
  }

  if (!isCoordinateOnly) {
    if (isLikelyAddress(label)) stop.address = label;
    else stop.placeName = label;
  }

  return stop;
}

function stopsFromPathDirections(url: URL): GoogleMapsRouteStop[] {
  const pathSegments = url.pathname.split('/').filter(Boolean);
  const dirIndex = pathSegments.findIndex((segment) => segment.toLowerCase() === 'dir');
  if (dirIndex === -1) return [];

  const routeTokens: string[] = [];
  let dataToken: string | undefined;

  for (const segment of pathSegments.slice(dirIndex + 1)) {
    if (segment.startsWith('data=')) {
      dataToken = segment;
      break;
    }
    if (segment.startsWith('@')) break;
    routeTokens.push(segment);
  }

  const dataCoordinates = extractDataCoordinates(dataToken);
  let dataCoordinateIndex = 0;

  const parsedStops = routeTokens
    .map((token) => {
      const decoded = decodeRouteToken(token);
      const tokenCoordinate = parseCoordinateText(decoded);
      const dataCoordinate = tokenCoordinate ? undefined : dataCoordinates[dataCoordinateIndex];
      if (!tokenCoordinate && dataCoordinate) dataCoordinateIndex += 1;
      return routeStopFromToken(token, dataCoordinate);
    });

  const stopCandidates = parsedStops.length > 1 ? parsedStops.slice(1) : parsedStops;

  return stopCandidates
    .filter((stop): stop is GoogleMapsRouteStop => Boolean(stop));
}

function stopsFromApiDirections(url: URL): GoogleMapsRouteStop[] {
  if (!url.pathname.includes('/maps/dir')) return [];
  const params = url.searchParams;
  const tokens = [
    ...(params.get('waypoints') || '').split('|'),
    params.get('destination'),
  ].filter((value): value is string => Boolean(value && value.trim()));

  return tokens
    .map((token) => routeStopFromToken(token))
    .filter((stop): stop is GoogleMapsRouteStop => Boolean(stop));
}

export function parseGoogleMapsRouteUrl(rawUrl: string, sourceUrl = rawUrl): GoogleMapsRouteImport | null {
  const normalized = normalizeUrlInput(rawUrl);
  if (!normalized) return null;

  let url: URL;
  try {
    url = new URL(normalized);
  } catch {
    return null;
  }

  const host = url.hostname.toLowerCase();
  const isGoogleMapsHost =
    host === 'maps.app.goo.gl' ||
    host === 'goo.gl' ||
    host === 'google.com' ||
    host === 'www.google.com' ||
    host.endsWith('.google.com');
  if (!isGoogleMapsHost) return null;

  const pathStops = stopsFromPathDirections(url);
  const stops = pathStops.length ? pathStops : stopsFromApiDirections(url);
  if (!stops.length) return null;

  return {
    title: titleForStops(stops),
    stops,
    sourceUrl,
    routeProvider: 'google_maps',
    status: 'draft',
  };
}
