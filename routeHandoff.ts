export type RouteHandoffStop = {
  name: string;
  latitude?: number;
  longitude?: number;
};

export type RouteHandoffPlan = {
  title?: string;
  origin?: string;
  stops: RouteHandoffStop[];
};

function hasCoordinate(stop: RouteHandoffStop) {
  return typeof stop.latitude === 'number' && typeof stop.longitude === 'number';
}

export function stopToRouteQuery(stop: RouteHandoffStop) {
  if (hasCoordinate(stop)) return `${stop.latitude},${stop.longitude}`;
  return stop.name.trim();
}

export function googleMapsDirectionsUrl(plan: RouteHandoffPlan) {
  const stops = plan.stops.map(stopToRouteQuery).filter(Boolean);
  const destination = stops[stops.length - 1];
  if (!destination) return undefined;

  const origin = plan.origin?.trim() || 'Current Location';
  const waypoints = stops.slice(0, -1);
  const waypointQuery = waypoints.length ? `&waypoints=${encodeURIComponent(waypoints.join('|'))}` : '';

  return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(
    destination,
  )}${waypointQuery}&travelmode=driving`;
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
    'Shared from NomNomGo',
  ].filter(Boolean).join('\n');
}
