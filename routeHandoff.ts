export type RouteHandoffTravelMode = 'car' | 'walk' | 'bike' | 'train' | 'plane';

export type RouteHandoffStop = {
  name: string;
  latitude?: number;
  longitude?: number;
  travelMode?: RouteHandoffTravelMode;
};

export type RouteHandoffPlan = {
  title?: string;
  origin?: string;
  travelMode?: RouteHandoffTravelMode;
  stops: RouteHandoffStop[];
};

type GoogleMapsTravelMode = 'driving' | 'walking' | 'bicycling' | 'transit';

const GOOGLE_MAPS_TRAVEL_MODES: Partial<Record<RouteHandoffTravelMode, GoogleMapsTravelMode>> = {
  car: 'driving',
  walk: 'walking',
  bike: 'bicycling',
  train: 'transit',
};

function hasCoordinate(stop: RouteHandoffStop) {
  return typeof stop.latitude === 'number' && typeof stop.longitude === 'number';
}

export function stopToRouteQuery(stop: RouteHandoffStop) {
  if (hasCoordinate(stop)) return `${stop.latitude},${stop.longitude}`;
  return stop.name.trim();
}

function googleMapsTravelModeForPlan(plan: RouteHandoffPlan): GoogleMapsTravelMode | undefined {
  if (plan.travelMode) return GOOGLE_MAPS_TRAVEL_MODES[plan.travelMode];

  const routeModes = plan.stops
    .map((stop) => stop.travelMode)
    .filter((mode): mode is RouteHandoffTravelMode => Boolean(mode));
  const uniqueModes = Array.from(new Set(routeModes));
  if (uniqueModes.length === 1) return GOOGLE_MAPS_TRAVEL_MODES[uniqueModes[0]];
  if (uniqueModes.length > 1) return undefined;

  return 'driving';
}

export function googleMapsDirectionsUrl(plan: RouteHandoffPlan) {
  const stops = plan.stops.map(stopToRouteQuery).filter(Boolean);
  const destination = stops[stops.length - 1];
  if (!destination) return undefined;

  const origin = plan.origin?.trim() || 'Current Location';
  const waypoints = stops.slice(0, -1);
  const waypointQuery = waypoints.length ? `&waypoints=${encodeURIComponent(waypoints.join('|'))}` : '';
  const travelMode = googleMapsTravelModeForPlan(plan);
  const travelModeQuery = travelMode ? `&travelmode=${travelMode}` : '';

  return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(
    destination,
  )}${waypointQuery}${travelModeQuery}`;
}

export function teslaDestinationPayload(plan: RouteHandoffPlan) {
  const destination = [...plan.stops].reverse().find((stop) => stopToRouteQuery(stop));
  if (!destination) return undefined;

  const destinationLine = hasCoordinate(destination)
    ? `${destination.name} (${destination.latitude},${destination.longitude})`
    : destination.name.trim();
  const routeLines = plan.stops
    .map((stop, index) => {
      const query = stopToRouteQuery(stop);
      if (!query) return undefined;
      return `${index + 1}. ${stop.name}${hasCoordinate(stop) ? ` - ${query}` : ''}`;
    })
    .filter(Boolean);

  return [
    `Tesla handoff destination: ${destinationLine}`,
    plan.title ? `Plan: ${plan.title}` : undefined,
    routeLines.length > 1 ? 'Route stops:' : undefined,
    ...routeLines,
    'Confirm route and charging in Tesla before departure.',
    'Shared from NomNomGo',
  ].filter(Boolean).join('\n');
}
