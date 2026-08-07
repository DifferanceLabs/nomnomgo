export type BetaFeatureFlags = {
  peopleGroups: boolean;
  routeImport: boolean;
  roadTrips: boolean;
  legacyPlanningSessions: boolean;
};

/**
 * Closed-beta scope. Experimental code remains available for later work but is
 * not exposed while the shared planning loop is being made reliable.
 */
export const BETA_FEATURES: Readonly<BetaFeatureFlags> = Object.freeze({
  peopleGroups: false,
  routeImport: false,
  roadTrips: false,
  legacyPlanningSessions: false,
});
