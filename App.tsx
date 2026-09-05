import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Image,
  Linking,
  Modal,
  Platform,
  Share,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Location from 'expo-location';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage, { getAlphaAccount, initializeAlphaAccount, signOutAlphaAccount, subscribeAccountSaveError } from './src/data/accountStorage';
import { AlphaAccountPanel } from './src/ui/AlphaAccountPanel';
import { SharedPlansScreen } from './src/ui/SharedPlansScreen';
import { createSharedPlan, planIdFromUrl, type SharedPlan, type SharedPlanDraft } from './src/data/sharedPlans';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import Sortable, { type DropIndicatorComponentProps, type SortableFlexDragEndParams } from 'react-native-sortables';
import Animated, { useAnimatedRef, useAnimatedStyle } from 'react-native-reanimated';
import {
  GOOGLE_MAPS_ROUTE_IMPORT_ERROR,
  parseGoogleMapsRouteUrl,
  type GoogleMapsRouteImport,
  type GoogleMapsRouteProvider,
  type GoogleMapsRouteStop,
} from './routeImport';
import {
  googleMapsDirectionsUrl,
  teslaDestinationPayload,
  type RouteHandoffPlan,
  type RouteHandoffStop,
} from './routeHandoff';
import { foodTimePreferenceScore, hoursLineForDate, placeOpenDuringWindow, timePreferenceForWindow } from './planningHours';
import { currentHoursDisplay, PLACE_HOURS_FIELDS, readPlaceHours, weeklyHoursForDate, type PlaceHours } from './placeHours';
import { BETA_FEATURES } from './src/config/features';
import { SearchExecution, isSearchCancelled, mapConcurrent } from './src/domain/searchExecution';
import { collectEventPages, deduplicateEvents } from './src/domain/eventDiscovery';
import { areaSearchRadius, findSearchAreas, isInsideSearchArea, superchargerForSearchArea, METERS_PER_MILE, type AreaFocus, type AreaKind, type AreaLocation } from './src/domain/searchArea';
import { SearchAreaPicker } from './src/ui/SearchAreaPicker';
import {
  calculateItineraryTimeline,
  defaultItineraryStopDurationMinutes,
  inferItineraryStopKind,
  snapStopDurationMinutes,
  type ItineraryStopKind,
} from './src/domain/itinerary';
import { colors, controls, elevations, iconSizes, layout, radii, semanticTones, spacing, typography } from './src/ui/theme';
import { ActionButton, AppHeader, BottomNavigation, EmptyState, PersonRow, RsvpControl, Stat } from './src/ui/primitives';
import { ItineraryStopRow } from './src/ui/ItineraryStopRow';
import {
  DIFFERANCE_NOMNOMGO_LAUNCH_URL,
  LAUNCH_TOKEN_PARAM,
  responseGrantsAlphaAccess,
} from './alphaAccess';

type PlanSlot = 'food' | 'activity';
type NowExperienceMode = 'closed' | 'home' | 'food' | 'activity';
type MainNavigationKey = 'home' | 'plans' | 'saved' | 'profile';
type StopTravelMode = 'car' | 'walk' | 'bike' | 'train' | 'plane';
type PairingSuggestion = {
  label: string;
  slot: PlanSlot;
  selections: string[];
  searchText: string;
  combo?: Array<{ slot: PlanSlot; item: PlaceCard | string }>;
};
type ResultFilter = 'all' | 'favorites';
type SearchPreferenceOverride = {
  foodSelections?: string[];
  activitySelections?: string[];
  dietarySelections?: string[];
};
type SearchRouteBias = {
  mode: StopTravelMode;
  anchor?: LatLon;
  start?: LatLon;
};
type DateWindowId = 'today' | 'tomorrow' | 'next3' | 'weekend' | 'nextWeekend' | 'custom';
type PlanStatus = 'draft' | 'locked';
type PlanType = 'local_plan' | 'day_plan' | 'trip_plan';
type SavedPlanTimeSchema = 'clock-arrivals-v1';
type RsvpStatus = 'going' | 'maybe' | 'cant_make_it';
type CustomDateRange = {
  start: string;
  end: string;
};

type VehicleProfile = {
  kind: 'unknown' | 'tesla' | 'ev' | 'gas';
  label?: string;
  notes?: string;
};

type ChargingStopIdea = {
  id: string;
  name: string;
  locationLabel?: string;
  estimatedDwellMinutes?: number;
  notes?: string;
  source: 'manual' | 'placeholder' | 'itinerary';
};

type NearbyChargingPlaceIdea = {
  id: string;
  chargingStopId?: string;
  name: string;
  category?: 'food' | 'coffee' | 'restroom' | 'park' | 'other';
  walkMinutes?: number;
  notes?: string;
  source: 'manual' | 'placeholder';
};

type LatLon = {
  latitude: number;
  longitude: number;
  label?: string;
  ts?: number;
  areaFocus?: AreaFocus;
};

type CityState = {
  city: string;
  state?: string;
};

type PlaceCard = PlaceHours & {
  id: string;
  title: string;
  subtitle: string;
  imageUrl?: string;
  photoName?: string;
  photoAttribution?: string;
  kind?: 'place' | 'event';
  address?: string;
  rating?: number;
  ratingCount?: number;
  priceLevel?: string;
  openNow?: boolean | null;
  isOpen?: boolean | null;
  hoursText?: string;
  eventDateText?: string;
  eventAddressConflict?: boolean;
  eventStartMs?: number;
  eventEndMs?: number;
  durationMinutes?: number;
  eventUrl?: string;
  source?: string;
  todayHours?: string;
  weeklyHours?: string[];
  mapsUri?: string;
  websiteUri?: string;
  lat?: number;
  lng?: number;
  types?: string[];
};

type ItineraryStop = {
  key: string;
  slot: PlanSlot;
  item: PlaceCard | string;
  visualType?: ItineraryStopKind;
  durationMinutes?: number;
  travelMode?: StopTravelMode;
  featureOptions?: string[];
  selectedFeatures?: string[];
  featuresExpanded?: boolean;
};

type ConfirmedPlan = {
  stops: ItineraryStop[];
  title?: string;
  sharedPlanId?: string;
  owner?: string;
  intent?: PlanningIntent;
  sourceUrl?: string;
  routeProvider?: GoogleMapsRouteProvider;
  status?: PlanStatus;
  importedAt?: number;
  savedPlanId?: string;
  invitees?: string[];
  dateWindow?: DateWindowId;
  customDateRange?: CustomDateRange | null;
  planDateStart?: string;
  planDateEnd?: string;
  planType?: PlanType;
  timeWindow?: string;
  routeOriginLabel?: string;
  routeStartLocation?: LatLon;
  searchLocation?: LatLon;
  searchLocationLabel?: string;
  roadTripMode?: boolean;
  vehicleProfile?: VehicleProfile;
  chargingStops?: ChargingStopIdea[];
  nearbyPlacesDuringCharging?: NearbyChargingPlaceIdea[];
  lockedArrivalTimes?: Record<string, StopTime | undefined>;
  rsvps?: Record<string, RsvpStatus>;
  participantSuggestions?: PlanningSuggestion[];
  finalizedSuggestionIds?: string[];
};

type StopTime = {
  hours: number;
  minutes: number;
};

type LocalMemory = {
  favorites: string[];
  favoriteCards: Record<string, { slot: PlanSlot; card: PlaceCard; location?: LatLon }>;
  dismissedSession: string[];
  neverRecommend: string[];
  selectedHistory: string[];
};

type TesterUser = {
  name: string;
};

type UsageMeter = {
  day: string;
  month: string;
  nearbySearchesToday: number;
  textSearchesToday: number;
  nearbySearchesMonth: number;
  textSearchesMonth: number;
  lastUpdated: number;
};

type QuickShareTarget =
  | { kind: 'card'; slot: PlanSlot; card: PlaceCard }
  | { kind: 'stop'; stop: ItineraryStop; index: number };

type NowDestinationSelection = {
  slot: PlanSlot;
  item: PlaceCard | string;
  category: string;
};

type PeoplePickerGroup = {
  name: string;
  members: string[];
};

type SavedPlan = {
  id: string;
  title: string;
  stops: ItineraryStop[];
  planTimes: Record<string, StopTime | undefined>;
  arrivalTimes: Record<string, StopTime | undefined>;
  arrivalOverrides?: Record<string, StopTime | undefined>;
  createdAt: number;
  source: 'saved' | 'shared';
  sourceUrl?: string;
  routeProvider?: GoogleMapsRouteProvider;
  status?: PlanStatus;
  timeSchema?: SavedPlanTimeSchema;
  invitees?: string[];
  dateWindow?: DateWindowId;
  customDateRange?: CustomDateRange | null;
  planDateStart?: string;
  planDateEnd?: string;
  planType?: PlanType;
  timeWindow?: string;
  routeOriginLabel?: string;
  routeStartLocation?: LatLon;
  searchLocation?: LatLon;
  searchLocationLabel?: string;
  roadTripMode?: boolean;
  vehicleProfile?: VehicleProfile;
  chargingStops?: ChargingStopIdea[];
  nearbyPlacesDuringCharging?: NearbyChargingPlaceIdea[];
  owner?: string;
  sharedBy?: string;
  sharedTo?: string;
};

type PlanningIntent = 'food' | 'activity' | 'both';

type PlanningSuggestionSource = 'food' | 'activity' | 'event' | 'manual';

type PlanningSuggestion = {
  id: string;
  slot: PlanSlot;
  item: PlaceCard | string;
  source: PlanningSuggestionSource;
  addedBy: string;
  createdAt: number;
  votes: string[];
};

type PlanningRouteContext = {
  originLabel: string;
  location?: LatLon;
  updatedAt: number;
};

type PlanningRecommendation = {
  suggestionIds: string[];
  generatedAt: number;
  notes: string[];
};

type PlanningSession = {
  id: string;
  owner: string;
  participants: string[];
  title: string;
  locationLabel: string;
  searchLocation: LatLon;
  dateWindow: DateWindowId;
  customDateRange?: CustomDateRange | null;
  timeWindow: string;
  intent: PlanningIntent;
  suggestions: PlanningSuggestion[];
  recommendation?: PlanningRecommendation;
  finalizedSuggestionIds: string[];
  finalPlan: ItineraryStop[];
  routeContexts: Record<string, PlanningRouteContext>;
  status: 'planning' | 'finalized';
  createdAt: number;
  updatedAt: number;
};

type BetaPlanRecord = {
  id: string;
  owner: string;
  participants: string[];
  title: string;
  source: 'now' | 'later' | 'saved';
  locationLabel: string;
  searchLocation?: LatLon;
  routeOriginLabel?: string;
  routeStartLocation?: LatLon;
  dateWindow: DateWindowId;
  customDateRange?: CustomDateRange | null;
  planDateStart: string;
  planDateEnd: string;
  timeWindow?: string;
  intent: PlanningIntent;
  stops: ItineraryStop[];
  suggestions: PlanningSuggestion[];
  finalizedSuggestionIds: string[];
  rsvps: Record<string, RsvpStatus>;
  status: 'planning' | 'finalized';
  savedPlanId?: string;
  createdAt: number;
  updatedAt: number;
};

type SearchCacheEntry = {
  ts: number;
  cards: PlaceCard[];
};

type ZipCacheEntry = {
  ts: number;
  location: LatLon;
};

type WebsiteFeatureCacheEntry = {
  ts: number;
  features: string[];
};

const GOOGLE_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;
const TICKETMASTER_API_KEY = process.env.EXPO_PUBLIC_TICKETMASTER_API_KEY;
const STORAGE_MEMORY = 'thingsNearbyGooglePlacesMemoryV1';
const STORAGE_LOCATION = 'thingsNearbyGooglePlacesLocationV1';
const STORAGE_SEARCH_LOCATION = 'thingsNearbyGooglePlacesSearchLocationV1';
const STORAGE_SEARCH_CACHE = 'thingsNearbyGooglePlacesSearchCacheV5';
const STORAGE_TEXT_SEARCH_CACHE = 'thingsNearbyGooglePlacesTextSearchCacheV3';
const STORAGE_ZIP_CACHE = 'thingsNearbyZipCacheV1';
const STORAGE_WEBSITE_FEATURE_CACHE = 'thingsNearbyWebsiteFeatureCacheV1';
const STORAGE_TESTER_USER = 'nomNomGoSelectedTesterV1';
const STORAGE_USAGE_METER = 'nomNomGoUsageMeterV1';
const STORAGE_SAVED_PLANS = 'nomNomGoSavedPlansV1';
const STORAGE_PLANNING_SESSIONS = 'nomNomGoPlanningSessionsV1';
const STORAGE_ACTIVE_PLANNING_SESSION = 'nomNomGoActivePlanningSessionV1';
const STORAGE_BETA_PLANS = 'nomNomGoBetaPlansV1';
const STORAGE_ACTIVE_BETA_PLAN = 'nomNomGoActiveBetaPlanV1';
const EVENT_PROVIDER_CACHE_VERSION = 'ticketmaster-v2';
const LOCATION_TTL_MS = 10 * 60 * 1000;
const SEARCH_CACHE_TTL_MS = 15 * 60 * 1000;
const TEXT_SEARCH_CACHE_TTL_MS = 30 * 60 * 1000;
const EVENT_SEARCH_CACHE_TTL_MS = 60 * 60 * 1000;
const ZIP_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const WEBSITE_FEATURE_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const DEFAULT_RADIUS_METERS = 8047;
const CLOSE_BY_RADIUS_METERS = 3219;
const EXPANDED_FOOD_RADIUS_METERS = 16093;
const MIN_FOOD_RESULTS_BEFORE_EXPAND = 10;
const DEFAULT_ACTIVITY_RADIUS_METERS = 16093;
const TICKETMASTER_EVENT_RADIUS_MILES = 10;
const PAIRING_RADIUS_METERS = 11265;
const FAVORITE_SUGGESTION_RADIUS_METERS = DEFAULT_RADIUS_METERS;
const VENUE_FEATURE_RADIUS_METERS = 805;
const WALKING_DISTANCE_METERS = 805;
const DEFAULT_WALK_MAX_MINUTES = 5;
const WALKING_SEARCH_RADIUS_METERS = 2414;
const PAGE_SIZE = 8;
const SUGGESTED_PAIRING_PREVIEW_COUNT = 3;
const FACTORY_EXPERIENCE_URL = 'https://factoryatfranklin.com/experience/';
const DEV_SHARE_USERS = ['Alex', 'Jordan', 'Taylor', 'Morgan'];
const TEST_USERS = ['BDM', ...DEV_SHARE_USERS];
const GROUP_SESSION_ENABLED = BETA_FEATURES.legacyPlanningSessions;
const RSVP_OPTIONS: Array<{ status: RsvpStatus; label: string }> = [
  { status: 'going', label: 'Going' },
  { status: 'maybe', label: 'Maybe' },
  { status: 'cant_make_it', label: "Can't make it" },
];
const COMPACT_RSVP_OPTIONS: { status: RsvpStatus; label: string }[] = [
  { status: 'going', label: 'Going' },
  { status: 'maybe', label: 'Maybe' },
  { status: 'cant_make_it', label: "Can't go" },
];
const LOCAL_TEST_LOCATIONS: Record<string, LatLon> = {
  'franklin tn': { latitude: 35.9251, longitude: -86.8689, label: 'Franklin, TN' },
  'franklin tennessee': { latitude: 35.9251, longitude: -86.8689, label: 'Franklin, TN' },
  '37064': { latitude: 35.9251, longitude: -86.8689, label: 'Franklin, TN 37064' },
  'nashville tn': { latitude: 36.1627, longitude: -86.7816, label: 'Nashville, TN' },
  'nashville tennessee': { latitude: 36.1627, longitude: -86.7816, label: 'Nashville, TN' },
};

const MOODS = ['Easy', 'Fun', 'Hungry', 'Tired', 'Bored', 'Date', 'Social', 'New', 'Cheap', 'Kid-friendly', 'Cozy', 'Active'];
const TIMES = ['Now', 'Morning', 'Lunch', 'Afternoon', 'Dinner', 'Late night'];
const WEATHER = ['Mild', 'Nice', 'Hot', 'Cold', 'Rainy', 'Unknown'];
const DATE_WINDOW_IDS: DateWindowId[] = ['today', 'tomorrow', 'next3', 'weekend', 'nextWeekend', 'custom'];
const TRAVEL_MODE_OPTIONS: Array<{ id: StopTravelMode; label: string; icon: React.ComponentProps<typeof Ionicons>['name'] }> = [
  { id: 'car', label: 'Drive', icon: 'car-outline' },
  { id: 'walk', label: 'Walk', icon: 'walk-outline' },
  { id: 'bike', label: 'Bike', icon: 'bicycle-outline' },
  { id: 'train', label: 'Train', icon: 'train-outline' },
  { id: 'plane', label: 'Plane', icon: 'airplane-outline' },
];
const DEFAULT_FOOD_SELECTIONS = ['Any'];
const DEFAULT_ACTIVITY_SELECTIONS = ['Any'];
const DEFAULT_DIETARY_SELECTIONS = ['Any'];
const FOOD_QUICK_FILTERS = ['Any', 'Open now', 'Close by', 'No Fast Food'];
const NOW_FOOD_CATEGORIES = ['Restaurants', 'Coffee', 'Dessert', 'Breakfast', 'Lunch', 'Dinner'];
const NOW_ACTIVITY_CATEGORIES = ['Outdoor', 'Family', 'Arcade', 'Bowling', 'Movie', 'Shopping', 'Entertainment'];
const NOW_FOOD_CATEGORY_SELECTIONS: Record<string, string[]> = {
  Restaurants: ['Any'],
  Coffee: ['Coffee'],
  Dessert: ['Dessert'],
  Breakfast: ['Breakfast'],
  Lunch: ['Any'],
  Dinner: ['Any'],
};
const NOW_ACTIVITY_CATEGORY_SELECTIONS: Record<string, string[]> = {
  Outdoor: ['Park'],
  Family: ['Park', 'Museum', 'Arcade'],
  Arcade: ['Arcade'],
  Bowling: ['Bowling'],
  Movie: ['Movies'],
  Shopping: ['Shopping'],
  Entertainment: ['Events'],
};
const PEOPLE_PICKER_GROUPS: PeoplePickerGroup[] = [
  { name: 'Dinner Crew', members: ['Alex', 'Jordan'] },
  { name: 'Weekend Group', members: ['Taylor', 'Morgan'] },
];
const CUISINES = [
  'Pizza',
  'Burgers',
  'Mexican',
  'BBQ',
  'Sushi',
  'Seafood',
  'Steak',
  'Italian',
  'Indian',
  'Subs',
  'Mediterranean',
  'Thai',
  'Chinese',
  'Breakfast',
  'Coffee',
  'Dessert',
];
const ACTIVITIES = [
  'Any',
  'Events',
  'Movies',
  'Bowling',
  'Arcade',
  'Park',
  'Shopping',
  'Museum',
  'Dessert',
  'Coffee',
  ...(BETA_FEATURES.roadTrips ? ['Tesla Supercharger', 'EV Charger'] : []),
];
const DIETARY_PREFERENCES = [
  'Any',
  'Vegetarian',
  'Vegan',
  'Gluten-free',
  'Dairy-free',
  'Nut-free',
  'Shellfish-free',
  'Halal',
  'Kosher',
  'Pescatarian',
  'No pork',
  'No beef',
  'Low carb',
];

const FOOD_TYPE_MAP: Record<string, string[]> = {
  Steak: ['steak_house'],
  Sushi: ['sushi_restaurant'],
  Seafood: ['seafood_restaurant'],
  Pizza: ['pizza_restaurant'],
  Burgers: ['hamburger_restaurant'],
  Mexican: ['mexican_restaurant'],
  BBQ: ['barbecue_restaurant'],
  Italian: ['italian_restaurant'],
  Indian: ['indian_restaurant'],
  Subs: ['sandwich_shop'],
  Mediterranean: ['mediterranean_restaurant'],
  Thai: ['thai_restaurant'],
  Chinese: ['chinese_restaurant'],
  Breakfast: ['breakfast_restaurant'],
  Coffee: ['cafe', 'coffee_shop'],
  Dessert: ['bakery', 'ice_cream_shop', 'dessert_shop'],
};

const DEFAULT_FOOD_TYPES = ['restaurant', 'cafe', 'bakery', 'meal_takeaway'];
const FAST_FOOD_TERMS = [
  'mcdonald',
  'burger king',
  'wendy',
  'taco bell',
  'kfc',
  'chick-fil-a',
  'chick fil a',
  'arbys',
  "arby's",
  'subway',
  'sonic',
  'dairy queen',
  'jack in the box',
  'hardee',
  'krystal',
  'white castle',
  'zaxby',
  'bojangles',
  'popeyes',
];
const FOOD_RELEVANCE_TERMS: Record<string, string[]> = {
  Pizza: ['pizza', 'pizzeria'],
  Burgers: ['burger', 'hamburger', 'cheeseburger', 'grill'],
  Mexican: ['mexican', 'taco', 'burrito', 'quesadilla'],
  BBQ: ['bbq', 'barbecue', 'barbeque'],
  Sushi: ['sushi'],
  Seafood: ['seafood', 'fish', 'oyster', 'crab', 'shrimp', 'lobster'],
  Steak: ['steak', 'steakhouse'],
  Italian: ['italian', 'pasta'],
  Indian: ['indian', 'curry', 'tandoori'],
  Subs: ['sub', 'sandwich', 'hoagie', 'deli', 'cheesesteak'],
  Mediterranean: ['mediterranean', 'gyro', 'pita', 'falafel'],
  Thai: ['thai'],
  Chinese: ['chinese'],
  Breakfast: ['breakfast', 'brunch'],
  Coffee: ['coffee', 'cafe'],
  Dessert: ['dessert', 'bakery', 'ice cream', 'ice_cream', 'donut', 'cookie'],
};
const FOOD_TEXT_QUERY_MAP: Record<string, string[]> = {
  Pizza: ['pizza restaurants', 'pizza places'],
  Burgers: ['burgers', 'best burgers', 'burger restaurants', 'restaurants with burgers', 'grills'],
  Mexican: ['mexican restaurants'],
  BBQ: ['bbq restaurants'],
  Sushi: ['sushi restaurants'],
  Seafood: ['seafood restaurants', 'fish restaurants', 'crab seafood'],
  Steak: ['steak restaurants'],
  Italian: ['italian restaurants'],
  Indian: ['indian restaurants'],
  Subs: ['subs', 'sub sandwiches', 'sandwiches', 'sandwich shops', 'delis', 'hoagies', 'cheesesteaks'],
  Mediterranean: ['mediterranean restaurants'],
  Thai: ['thai restaurants'],
  Chinese: ['chinese restaurants'],
  Breakfast: ['breakfast restaurants', 'brunch restaurants'],
  Coffee: ['coffee shops'],
  Dessert: ['dessert shops'],
};
const DIETARY_TEXT_QUERY_MAP: Record<string, string[]> = {
  Vegetarian: ['vegetarian restaurants', 'vegetarian food'],
  Vegan: ['vegan restaurants', 'vegan food'],
  'Gluten-free': ['gluten free restaurants', 'gluten free food'],
  'Dairy-free': ['dairy free restaurants', 'dairy free food'],
  'Nut-free': ['nut free restaurants', 'nut free food'],
  'Shellfish-free': ['shellfish free restaurants'],
  Halal: ['halal restaurants', 'halal food'],
  Kosher: ['kosher restaurants', 'kosher food'],
  Pescatarian: ['pescatarian restaurants', 'seafood restaurants'],
  'No pork': ['pork free restaurants', 'restaurants without pork'],
  'No beef': ['beef free restaurants', 'restaurants without beef'],
  'Low carb': ['low carb restaurants', 'healthy restaurants'],
};
const DIETARY_RELEVANCE_TERMS: Record<string, string[]> = {
  Vegetarian: ['vegetarian', 'veggie', 'plant based', 'meatless'],
  Vegan: ['vegan', 'plant based', 'plant-based'],
  'Gluten-free': ['gluten free', 'gluten-free', 'celiac'],
  'Dairy-free': ['dairy free', 'dairy-free', 'non dairy', 'non-dairy'],
  'Nut-free': ['nut free', 'nut-free', 'allergy friendly'],
  'Shellfish-free': ['shellfish free', 'shellfish-free'],
  Halal: ['halal'],
  Kosher: ['kosher'],
  Pescatarian: ['pescatarian', 'seafood', 'fish'],
  'No pork': ['pork free', 'no pork', 'halal', 'kosher'],
  'No beef': ['beef free', 'no beef'],
  'Low carb': ['low carb', 'low-carb', 'keto', 'healthy'],
};
const BLOCKED_ACTIVITY_TERMS = [
  'funeral',
  'funeral_home',
  'cremation',
  'crematorium',
  'cemetery',
  'mortuary',
  'memorial gardens',
];

const FOOD_VENUE_TYPES = new Set([
  'restaurant',
  'cafe',
  'coffee_shop',
  'bakery',
  'meal_takeaway',
  'meal_delivery',
  'food',
  'ice_cream_shop',
  'dessert_shop',
  'sandwich_shop',
]);

const ACTIVITY_TYPE_MAP: Record<string, string[]> = {
  Movies: ['movie_theater'],
  Bowling: ['bowling_alley'],
  Arcade: ['amusement_center'],
  Park: ['park'],
  Shopping: ['shopping_mall'],
  Museum: ['museum'],
  Dessert: ['bakery', 'ice_cream_shop', 'dessert_shop'],
  Coffee: ['cafe', 'coffee_shop'],
  'Tesla Supercharger': ['electric_vehicle_charging_station'],
  'EV Charger': ['electric_vehicle_charging_station'],
};

const DEFAULT_ACTIVITY_TYPES = [
  'movie_theater',
  'bowling_alley',
  'park',
  'shopping_mall',
  'museum',
  'amusement_center',
  'tourist_attraction',
];
const DEFAULT_ACTIVITY_TYPE_SET = new Set(DEFAULT_ACTIVITY_TYPES);

const FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.location',
  'places.rating',
  'places.userRatingCount',
  'places.types',
  'places.primaryType',
  'places.primaryTypeDisplayName',
  ...PLACE_HOURS_FIELDS.map((field) => `places.${field}`),
  'places.googleMapsUri',
  'places.websiteUri',
  'places.priceLevel',
  'places.photos',
].join(',');

const LOCATION_FIELD_MASK = [
  'places.location',
].join(',');

const PLACE_WEBSITE_FIELD_MASK = 'websiteUri';

const EMPTY_PLAN: ConfirmedPlan = {
  stops: [],
};

const INITIAL_MEMORY: LocalMemory = {
  favorites: [],
  favoriteCards: {},
  dismissedSession: [],
  neverRecommend: [],
  selectedHistory: [],
};

function usageDayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function usageMonthKey(date = new Date()) {
  return date.toISOString().slice(0, 7);
}

function emptyUsageMeter(date = new Date()): UsageMeter {
  return {
    day: usageDayKey(date),
    month: usageMonthKey(date),
    nearbySearchesToday: 0,
    textSearchesToday: 0,
    nearbySearchesMonth: 0,
    textSearchesMonth: 0,
    lastUpdated: Date.now(),
  };
}

function normalizeUsageMeter(raw?: Partial<UsageMeter> | null) {
  const now = new Date();
  const day = usageDayKey(now);
  const month = usageMonthKey(now);
  return {
    day,
    month,
    nearbySearchesToday: raw?.day === day ? raw.nearbySearchesToday || 0 : 0,
    textSearchesToday: raw?.day === day ? raw.textSearchesToday || 0 : 0,
    nearbySearchesMonth: raw?.month === month ? raw.nearbySearchesMonth || 0 : 0,
    textSearchesMonth: raw?.month === month ? raw.textSearchesMonth || 0 : 0,
    lastUpdated: raw?.lastUpdated || Date.now(),
  };
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });

  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function unique<T>(items: T[]) {
  return Array.from(new Set(items));
}

function normalizeCurrentLocationInput(value: string) {
  const trimmed = value.trim();
  return trimmed.toLowerCase() === 'current location' ? '' : trimmed;
}

function typesForSelection(selected: string[], typeMap: Record<string, string[]>, defaults: string[]) {
  if (selected.includes('Any')) return defaults;
  const mapped = selected.flatMap((item) => typeMap[item] || []);
  return mapped.length ? unique(mapped) : defaults;
}

function wantsNoFastFood(selectedFoods: string[]) {
  return selectedFoods.includes('No Fast Food');
}

function wantsCloseBy(selectedFoods: string[]) {
  return selectedFoods.includes('Close by');
}

function wantsOpenNow(selectedFoods: string[]) {
  return selectedFoods.includes('Open now');
}

function wantsTeslaSupercharger(selectedActivities: string[]) {
  return selectedActivities.includes('Tesla Supercharger');
}

function wantsEvCharger(selectedActivities: string[]) {
  return selectedActivities.includes('EV Charger');
}

function wantsChargerActivity(selectedActivities: string[]) {
  return wantsTeslaSupercharger(selectedActivities) || wantsEvCharger(selectedActivities);
}

function chargerText(item: PlaceCard | string) {
  return typeof item === 'string'
    ? item
    : [item.title, item.subtitle, item.address, ...(item.types || [])].join(' ');
}

function isEvCharger(item: PlaceCard | string) {
  const blob = chargerText(item).toLowerCase().replace(/_/g, ' ');
  return (
    blob.includes('electric vehicle charging') ||
    blob.includes('ev charging') ||
    blob.includes('charging station') ||
    blob.includes('supercharger')
  );
}

function isTeslaSupercharger(item: PlaceCard | string) {
  const blob = chargerText(item).toLowerCase().replace(/_/g, ' ');
  return blob.includes('tesla') && (blob.includes('supercharger') || blob.includes('charging station') || blob.includes('charger'));
}

function isLikelyFastFood(card: PlaceCard) {
  const blob = [card.title, card.subtitle, card.address, ...(card.types || [])].join(' ').toLowerCase();
  return (
    blob.includes('fast_food') ||
    blob.includes('meal_takeaway') ||
    FAST_FOOD_TERMS.some((term) => blob.includes(term))
  );
}

function cuisineSelections(selectedFoods: string[]) {
  return selectedFoods.filter((item) => FOOD_RELEVANCE_TERMS[item]);
}

function dietarySelections(selectedDietary: string[]) {
  return selectedDietary.filter((item) => item !== 'Any');
}

function dietaryQueryTerm(value: string) {
  return value.toLowerCase().replace(/-/g, ' ');
}

function preferenceTag(value: string) {
  return normalizePlaceName(value).replace(/\s+/g, '_');
}

function foodCuisineMatchStrength(card: PlaceCard, selectedFoods: string[]) {
  const selectedCuisines = cuisineSelections(selectedFoods);
  if (!selectedCuisines.length) return 1;
  const title = normalizePlaceName(card.title);
  const subtitle = normalizePlaceName(card.subtitle || '');
  const typeText = (card.types || []).join(' ').toLowerCase().replace(/_/g, ' ');
  const blob = [card.title, card.subtitle, card.address, ...(card.types || [])]
    .join(' ')
    .toLowerCase()
    .replace(/_/g, ' ');
  let best = 0;
  selectedCuisines.forEach((cuisine) => {
    const terms = FOOD_RELEVANCE_TERMS[cuisine] || [];
    const mappedTypes = (FOOD_TYPE_MAP[cuisine] || []).map((type) => type.replace(/_/g, ' ').toLowerCase());
    if (blob.includes(`food semantic ${cuisine.toLowerCase()}`)) best = Math.max(best, 1);
    if (blob.includes(`food match ${cuisine.toLowerCase()}`)) best = Math.max(best, 4);
    if (mappedTypes.some((type) => typeText.includes(type))) best = Math.max(best, 4);
    if (terms.some((term) => title.includes(term))) best = Math.max(best, 5);
    if (terms.some((term) => subtitle.includes(term))) best = Math.max(best, 3);
    if (terms.some((term) => blob.includes(term))) best = Math.max(best, 2);
  });
  return best;
}

function foodDietaryMatchStrength(card: PlaceCard, selectedDietary: string[]) {
  const activeDietary = dietarySelections(selectedDietary);
  if (!activeDietary.length) return 0;
  const title = normalizePlaceName(card.title);
  const subtitle = normalizePlaceName(card.subtitle || '');
  const typeText = (card.types || []).join(' ').toLowerCase().replace(/_/g, ' ');
  const blob = [card.title, card.subtitle, card.address, ...(card.types || [])]
    .join(' ')
    .toLowerCase()
    .replace(/_/g, ' ');
  let best = 0;
  activeDietary.forEach((preference) => {
    const terms = DIETARY_RELEVANCE_TERMS[preference] || [dietaryQueryTerm(preference)];
    const tag = preferenceTag(preference).replace(/_/g, ' ');
    if (blob.includes(`food dietary ${tag}`)) best = Math.max(best, 4);
    if (terms.some((term) => title.includes(term))) best = Math.max(best, 5);
    if (terms.some((term) => subtitle.includes(term))) best = Math.max(best, 3);
    if (terms.some((term) => typeText.includes(term))) best = Math.max(best, 3);
    if (terms.some((term) => blob.includes(term))) best = Math.max(best, 2);
  });
  return best;
}

function isLikelyFoodPreferenceMatch(card: PlaceCard, selectedFoods: string[]) {
  const strength = foodCuisineMatchStrength(card, selectedFoods);
  if (!cuisineSelections(selectedFoods).length) return true;
  if (isLikelyFastFood(card) && strength <= 1) return false;
  return strength > 0;
}

function isLikelyFoodVenue(card: PlaceCard) {
  if (card.kind === 'event') return false;
  const normalizedTypes = (card.types || []).map((type) => type.toLowerCase());
  if (normalizedTypes.some((type) => FOOD_VENUE_TYPES.has(type) || type.endsWith('_restaurant'))) return true;

  const description = [card.subtitle, card.title].filter(Boolean).join(' ').toLowerCase().replace(/_/g, ' ');
  return /\b(restaurant|cafe|coffee shop|bakery|dessert shop|ice cream|sandwich shop|meal takeaway)\b/.test(description);
}

function isBadActivityResult(card: PlaceCard) {
  const blob = [card.title, card.subtitle, card.address, ...(card.types || [])].join(' ').toLowerCase();
  return BLOCKED_ACTIVITY_TERMS.some((term) => blob.includes(term));
}

function isRelevantActivityResult(card: PlaceCard, selectedActivities: string[]) {
  const eventsFocused = selectedActivities.includes('Events');
  if (card.kind === 'event') return eventsFocused;
  if (eventsFocused) return false;
  const primaryDescription = (card.subtitle || '').split(' - ')[0].toLowerCase().replace(/_/g, ' ');
  if (primaryDescription.includes('store') && !primaryDescription.includes('shopping mall')) return false;
  const selectedSpecificActivity = nonEventActivitySelections(selectedActivities).length > 0;
  if (selectedSpecificActivity) return matchesActivitySelection(card, selectedActivities);
  return (card.types || []).some((type) => DEFAULT_ACTIVITY_TYPE_SET.has(type));
}

async function openExternalUrl(url: string) {
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    const link = document.createElement('a');
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    link.remove();
    return;
  }
  await Linking.openURL(url);
}

function priceText(priceLevel?: string) {
  if (!priceLevel) return undefined;
  const map: Record<string, string> = {
    PRICE_LEVEL_FREE: 'Free',
    PRICE_LEVEL_INEXPENSIVE: '$',
    PRICE_LEVEL_MODERATE: '$$',
    PRICE_LEVEL_EXPENSIVE: '$$$',
    PRICE_LEVEL_VERY_EXPENSIVE: '$$$$',
  };
  return map[priceLevel] || priceLevel.replace('PRICE_LEVEL_', '').toLowerCase();
}

function toCard(place: any): PlaceCard {
  const title = place?.displayName?.text || 'Unnamed place';
  const primaryPhoto = Array.isArray(place?.photos) ? place.photos[0] : undefined;
  const hours = readPlaceHours(place || {});

  return {
    id: place?.id || place?.name || `${title}-${place?.formattedAddress || ''}`,
    title,
    photoName: typeof primaryPhoto?.name === 'string' ? primaryPhoto.name : undefined,
    photoAttribution: typeof primaryPhoto?.authorAttributions?.[0]?.displayName === 'string'
      ? primaryPhoto.authorAttributions[0].displayName
      : undefined,
    subtitle: [
      place?.primaryTypeDisplayName?.text || place?.primaryType || place?.types?.[0] || 'Place',
      typeof place?.rating === 'number' ? `${place.rating.toFixed(1)} star` : undefined,
      place?.userRatingCount ? `${place.userRatingCount} reviews` : undefined,
      priceText(place?.priceLevel),
    ]
      .filter(Boolean)
      .join(' - '),
    address: place?.formattedAddress,
    rating: place?.rating,
    ratingCount: place?.userRatingCount,
    priceLevel: priceText(place?.priceLevel),
    ...hours,
    ...currentHoursDisplay(hours),
    mapsUri: place?.googleMapsUri,
    websiteUri: typeof place?.websiteUri === 'string' ? place.websiteUri : undefined,
    lat: place?.location?.latitude,
    lng: place?.location?.longitude,
    types: place?.types || [],
  };
}

function formatEventDateText(event: any) {
  const ticketmasterStart = [
    event?.dates?.start?.localDate,
    event?.dates?.start?.localTime,
  ].filter(Boolean).join('T');
  const date = event?.dates?.start?.dateTime || ticketmasterStart || event?.start?.local || event?.start?.utc;
  if (!date) return 'Date TBA';
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) {
    return [
      event?.dates?.start?.localDate,
      event?.dates?.start?.localTime,
      event?.start?.local,
    ].filter(Boolean).join(' ');
  }
  return parsed.toLocaleString([], {
    // A local-only value is already a venue wall-clock time, not a UTC instant.
    timeZone: event?.dates?.start?.dateTime || event?.start?.utc
      ? event?.dates?.timezone || event?._embedded?.venues?.[0]?.timezone
      : undefined,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function ticketmasterEventToCard(event: any): PlaceCard | undefined {
  const venue = event?._embedded?.venues?.[0];
  const title = typeof event?.name === 'string' ? event.name.trim() : '';
  if (!title) return undefined;

  const venueName = typeof venue?.name === 'string' ? venue.name : undefined;
  const city = venue?.city?.name;
  const state = venue?.state?.stateCode || venue?.state?.name;
  const address = [
    venue?.address?.line1,
    city,
    state,
    venue?.postalCode,
  ].filter(Boolean).join(', ');
  const lat = Number(venue?.location?.latitude);
  const lng = Number(venue?.location?.longitude);
  const eventDateText = formatEventDateText(event);
  const eventStartMs = new Date(event?.dates?.start?.dateTime || `${event?.dates?.start?.localDate || ''}T${event?.dates?.start?.localTime || '00:00:00'}`).getTime();
  const eventEndMs = new Date(event?.dates?.end?.dateTime || `${event?.dates?.end?.localDate || ''}T${event?.dates?.end?.localTime || ''}`).getTime();
  const eventImages = Array.isArray(event?.images) ? event.images : [];
  const eventImage = eventImages.find((image: any) => image?.ratio === '16_9' && Number(image?.width) >= 640)
    || eventImages.find((image: any) => image?.ratio === '16_9')
    || eventImages[0];

  return {
    id: `ticketmaster-${event?.id || `${title}-${eventDateText}`}`,
    title,
    imageUrl: typeof eventImage?.url === 'string' ? eventImage.url : undefined,
    kind: 'event',
    subtitle: [venueName || [city, state].filter(Boolean).join(', '), 'Ticketmaster'].filter(Boolean).join(' - '),
    address: address || undefined,
    isOpen: null,
    hoursText: eventDateText,
    eventDateText,
    eventStartMs: Number.isFinite(eventStartMs) ? eventStartMs : undefined,
    eventEndMs: Number.isFinite(eventEndMs) ? eventEndMs : undefined,
    eventUrl: typeof event?.url === 'string' ? event.url : undefined,
    source: 'Ticketmaster',
    mapsUri: venueName ? mapsSearchUrl(`${venueName} ${address || ''}`.trim()) : mapsSearchUrl(title),
    lat: Number.isFinite(lat) ? lat : undefined,
    lng: Number.isFinite(lng) ? lng : undefined,
    types: ['event', 'ticketmaster', event?.classifications?.[0]?.segment?.name, event?.classifications?.[0]?.genre?.name].filter(Boolean),
  };
}

function cardToName(card?: PlaceCard | string) {
  if (!card) return undefined;
  return typeof card === 'string' ? card : card.title;
}

function cardImageUri(card?: PlaceCard | string) {
  if (!card || typeof card === 'string') return undefined;
  if (card.imageUrl) return card.imageUrl;
  if (!card.photoName || !GOOGLE_API_KEY) return undefined;
  const photoResource = card.photoName.replace(/^\/+/, '').replace(/\/media$/, '');
  return `https://places.googleapis.com/v1/${photoResource}/media?maxWidthPx=960&maxHeightPx=640&key=${encodeURIComponent(GOOGLE_API_KEY)}`;
}

function cardCategoryLabel(card: PlaceCard) {
  if (card.kind === 'event') return 'Event';
  const raw = card.types?.[0] || card.subtitle.split(' - ')[0] || 'Place';
  return raw
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function cardToId(card: PlaceCard | string) {
  return typeof card === 'string' ? card : card.id;
}

function makeStopKey(slot: PlanSlot, item: PlaceCard | string) {
  return `${slot}-${cardToId(item)}-${Date.now()}`;
}

function searchSuperchargerStop(center: AreaLocation | null | undefined): ItineraryStop | undefined {
  const charger = superchargerForSearchArea(center);
  if (!charger) return undefined;
  const stop: ItineraryStop = {
    key: makeStopKey('activity', charger), slot: 'activity', item: charger, visualType: 'activity',
    featureOptions: [], selectedFeatures: [], featuresExpanded: false,
  };
  stop.durationMinutes = defaultStopDurationMinutes(stop);
  return stop;
}

/** Commit the selected place and its charging stop together, retaining existing stop order. */
function appendPlanSelection(stops: ItineraryStop[], selected: ItineraryStop, companion?: ItineraryStop) {
  if (stops.some((stop) => stop.slot === selected.slot && cardToId(stop.item) === cardToId(selected.item))) return stops;
  const needsCompanion = companion && cardToId(companion.item) !== cardToId(selected.item)
    && !stops.some((stop) => cardToId(stop.item) === cardToId(companion.item));
  return [...stops, ...(needsCompanion ? [companion] : []), selected];
}

function planItems(plan: ConfirmedPlan, slot: PlanSlot) {
  return plan.stops.filter((stop) => stop.slot === slot).map((stop) => stop.item);
}

function isMultiDayDateRange(startKey?: string, endKey?: string) {
  if (!startKey || !endKey) return false;
  const start = parseDateInput(startKey);
  const end = parseDateInput(endKey);
  if (!start || !end) return false;
  return formatDateInput(start) !== formatDateInput(end);
}

function looksTravelLikeDestination(value?: string) {
  const normalized = (value || '').toLowerCase();
  if (!normalized.trim()) return false;
  return [
    'road trip',
    'weekend trip',
    'vacation',
    'airport',
    'hotel',
    'resort',
    'lodging',
    'campground',
    'cabin',
    'national park',
    'state park',
    'theme park',
    'beach',
    'mountain',
    'ski',
    'cruise',
  ].some((term) => normalized.includes(term));
}

function inferPlanType(input: {
  planDateStart?: string;
  planDateEnd?: string;
  destinationLabel?: string;
  title?: string;
}): PlanType {
  if (isMultiDayDateRange(input.planDateStart, input.planDateEnd)) return 'trip_plan';
  if (looksTravelLikeDestination(input.destinationLabel) || looksTravelLikeDestination(input.title)) return 'trip_plan';
  return 'local_plan';
}

function planTypeLabel(planType?: PlanType) {
  if (planType === 'trip_plan') return 'Trip plan';
  if (planType === 'day_plan') return 'Day plan';
  return 'Plan';
}

function hasChargingStop(stops: ItineraryStop[]) {
  return stops.some((stop) => isEvCharger(stop.item));
}

function inferRoadTripMode(input: {
  planType: PlanType;
  destinationLabel?: string;
  startingLocationLabel?: string;
  routeProvider?: GoogleMapsRouteProvider;
  sourceUrl?: string;
  stops: ItineraryStop[];
  currentRoadTripMode?: boolean;
}) {
  if (input.currentRoadTripMode) return true;
  if (hasChargingStop(input.stops)) return true;
  const routeText = [input.destinationLabel, input.startingLocationLabel, input.sourceUrl].filter(Boolean).join(' ').toLowerCase();
  const roadTripText = /road trip|drive|driving|tesla|supercharger|ev charger|charging/.test(routeText);
  return input.planType === 'trip_plan' && (Boolean(input.routeProvider) || roadTripText);
}

function vehicleProfileForPlan(roadTripMode: boolean, current: VehicleProfile | undefined, stops: ItineraryStop[], label?: string): VehicleProfile | undefined {
  if (current) return current;
  if (!roadTripMode) return undefined;
  const profileText = [label, ...stops.map((stop) => cardToName(stop.item))].filter(Boolean).join(' ').toLowerCase();
  if (profileText.includes('tesla') || stops.some((stop) => isTeslaSupercharger(stop.item))) {
    return { kind: 'tesla', label: 'Tesla', notes: 'Confirm vehicle and charging route in Tesla before departure.' };
  }
  return { kind: 'unknown', label: 'Vehicle', notes: 'Confirm vehicle and charging route before departure.' };
}

function chargingStopIdeasFromStops(stops: ItineraryStop[], existing: ChargingStopIdea[] = []) {
  const ideas = [...existing];
  stops.forEach((stop) => {
    if (!isEvCharger(stop.item)) return;
    const id = `itinerary-${cardToId(stop.item)}`;
    if (ideas.some((idea) => idea.id === id)) return;
    const locationLabel = typeof stop.item === 'string'
      ? undefined
      : cityStateLabel(cityStateForPlace(stop.item)) || stop.item.address;
    ideas.push({
      id,
      name: cardToName(stop.item) || 'Charging stop',
      locationLabel,
      estimatedDwellMinutes: 25,
      notes: 'Manual itinerary charging stop idea. Confirm charging route in Tesla before departure.',
      source: 'itinerary',
    });
  });
  return ideas;
}

function cardListNames(cards: Array<PlaceCard | string>) {
  return cards.map(cardToName).filter(Boolean) as string[];
}

function inferPlaceFeatures(item: PlaceCard | string, slot: PlanSlot) {
  if (typeof item === 'string') return [];
  const blob = [item.title, item.subtitle, item.address, ...(item.types || [])]
    .join(' ')
    .toLowerCase()
    .replace(/_/g, ' ');
  const features: string[] = [];
  const add = (...items: string[]) => items.forEach((feature) => {
    if (!features.includes(feature)) features.push(feature);
  });

  if (slot === 'food') {
    if (blob.includes('coffee') || blob.includes('cafe')) add('Coffee', 'Dessert');
    if (blob.includes('bakery') || blob.includes('dessert') || blob.includes('ice cream')) add('Dessert');
    if (blob.includes('bar') || blob.includes('brewery')) add('Drinks');
    if (blob.includes('live music')) add('Live music');
    return features.slice(0, 8);
  }

  return [];
}

function featureCategoryForCard(card: PlaceCard) {
  const blob = [card.title, card.subtitle, card.address, ...(card.types || [])]
    .join(' ')
    .toLowerCase()
    .replace(/_/g, ' ');

  if (blob.includes('pottery') || blob.includes('ceramic') || blob.includes('clay')) return 'Pottery';
  if (blob.includes('carousel')) return 'Carousel';
  if (blob.includes('music') || blob.includes('theater') || blob.includes('concert')) return 'Live music';
  if (blob.includes('bingo')) return 'Bingo';
  if (blob.includes('event')) return 'Events';
  if (blob.includes('market')) return 'Market';
  if (blob.includes('restaurant') || blob.includes('food') || blob.includes('taco') || blob.includes('pizza') || blob.includes('chicken')) return 'Food';
  if (blob.includes('coffee') || blob.includes('cafe')) return 'Coffee';
  if (blob.includes('dessert') || blob.includes('bakery') || blob.includes('ice cream')) return 'Dessert';
  if (blob.includes('shop') || blob.includes('store') || blob.includes('boutique') || blob.includes('retail')) return 'Shop';
  if (blob.includes('museum') || blob.includes('gallery')) return 'Exhibit';
  if (blob.includes('park')) return 'Outdoor';
  if (blob.includes('bowling')) return 'Bowling';
  if (blob.includes('arcade') || blob.includes('game')) return 'Games';
  return undefined;
}

function resultBadgeForCard(card: PlaceCard, isSelected: boolean, index: number) {
  if (card.kind === 'event') return 'EVENT';
  if (isSelected) return 'SELECTED';
  const category = featureCategoryForCard(card);
  if (category) return category.toUpperCase();
  if (index === 0) return 'BEST MATCH';
  return 'PLACE';
}

function featureLabelForCard(card: PlaceCard) {
  const category = featureCategoryForCard(card);
  if (!category) return undefined;
  return `${category}: ${card.title}`;
}

function isDefaultWalkBetweenStops(previous?: ItineraryStop, current?: ItineraryStop) {
  if (!previous || !current) return false;
  const previousCoords = stopCoords(previous.item);
  const currentCoords = stopCoords(current.item);
  if (!previousCoords || !currentCoords) return false;
  return estimateTravelMinutes(previousCoords, current.item, 'walk') <= DEFAULT_WALK_MAX_MINUTES;
}

function effectivePlanStopTravelMode(stops: ItineraryStop[], index: number): StopTravelMode {
  const stop = stops[index];
  if (stop?.travelMode) return stop.travelMode;
  const previousStop = stops[index - 1];
  return isWalkableAfterTeslaStop(previousStop, stop) || isDefaultWalkBetweenStops(previousStop, stop) ? 'walk' : 'car';
}

function cardToRouteHandoffStop(card: PlaceCard | string, travelMode?: StopTravelMode): RouteHandoffStop | undefined {
  const name = cardToName(card)?.trim() || '';
  if (!name) return undefined;
  if (typeof card !== 'string' && typeof card.lat === 'number' && typeof card.lng === 'number') {
    return { name, latitude: card.lat, longitude: card.lng, travelMode };
  }
  return { name, travelMode };
}

function planToRouteHandoffPlan(plan: ConfirmedPlan, origin = 'Current Location'): RouteHandoffPlan {
  return {
    title: plan.title,
    origin,
    stops: plan.stops
      .map((stop, index) => cardToRouteHandoffStop(stop.item, effectivePlanStopTravelMode(plan.stops, index)))
      .filter((stop): stop is RouteHandoffStop => Boolean(stop)),
  };
}

function cardHours(card?: PlaceCard | string) {
  if (!card || typeof card === 'string') return 'unknown';
  return card.todayHours || card.hoursText || 'unknown';
}

function stopSearchCenter(stop?: ItineraryStop): LatLon | undefined {
  if (!stop || typeof stop.item === 'string') return undefined;
  if (typeof stop.item.lat !== 'number' || typeof stop.item.lng !== 'number') return undefined;
  return {
    latitude: stop.item.lat,
    longitude: stop.item.lng,
    label: stop.item.title,
  };
}

function hasKnownHours(card: PlaceCard) {
  if (card.kind === 'event') return Boolean(card.eventDateText);
  return Boolean(card.todayHours || card.hoursText || (card.weeklyHours && card.weeklyHours.length > 0));
}

function mapsDirectionsUrl(plan: ConfirmedPlan, origin = 'Current Location') {
  return googleMapsDirectionsUrl(planToRouteHandoffPlan(plan, origin));
}

function mapsSearchUrl(query: string, near?: PlaceCard | LatLon | null) {
  const location =
    near && 'lat' in near && near.lat && near.lng
      ? `${near.lat},${near.lng}`
      : near && 'latitude' in near
        ? `${near.latitude},${near.longitude}`
        : undefined;
  const fullQuery = location ? `${query} near ${location}` : query;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullQuery)}`;
}

function routeStopMapsUrl(stop: GoogleMapsRouteStop) {
  const query = typeof stop.latitude === 'number' && typeof stop.longitude === 'number'
    ? `${stop.latitude},${stop.longitude}`
    : stop.label;
  return mapsSearchUrl(query);
}

function routeImportStopToCard(stop: GoogleMapsRouteStop, index: number): PlaceCard {
  const title = stop.placeName || stop.address || stop.label || `Stop ${index + 1}`;
  const coordinateText = typeof stop.latitude === 'number' && typeof stop.longitude === 'number'
    ? `${stop.latitude.toFixed(6)}, ${stop.longitude.toFixed(6)}`
    : undefined;
  const idBase = normalizePlaceName(`${index + 1} ${title}`).replace(/\s+/g, '-') || `stop-${index + 1}`;

  return {
    id: `google-route-${idBase}`,
    title,
    subtitle: stop.placeName && stop.address
      ? stop.address
      : coordinateText
        ? `Coordinates: ${coordinateText}`
        : 'Imported from Google Maps route',
    kind: 'place',
    address: stop.address,
    source: 'Google Maps route',
    mapsUri: routeStopMapsUrl(stop),
    lat: stop.latitude,
    lng: stop.longitude,
    types: ['google_maps_route_import'],
  };
}

function placeDetailsLookupId(card: PlaceCard) {
  return card.id.startsWith('places/') ? card.id.slice('places/'.length) : card.id;
}

function canResolvePlaceWebsite(card: PlaceCard) {
  if (!GOOGLE_API_KEY) return false;
  if (card.kind === 'event') return false;
  if (card.source === 'Google Maps route') return false;
  if (!card.id || card.id.startsWith('ticketmaster-') || card.id.startsWith('google-route-')) return false;
  return true;
}

function canOpenPlaceWebsite(item: PlaceCard | string) {
  return typeof item !== 'string' && Boolean(item.websiteUri || canResolvePlaceWebsite(item));
}

function routeImportToPlanStops(routeImport: GoogleMapsRouteImport): ItineraryStop[] {
  const stamp = Date.now();
  return routeImport.stops.map((stop, index) => {
    const card = routeImportStopToCard(stop, index);
    return {
      key: `google-route-stop-${stamp}-${index}`,
      slot: 'activity',
      item: card,
      featureOptions: [],
      selectedFeatures: [],
      featuresExpanded: false,
    };
  });
}

const CITY_TRAILING_STOP_WORDS = new Set([
  'st',
  'street',
  'ave',
  'avenue',
  'rd',
  'road',
  'dr',
  'drive',
  'ln',
  'lane',
  'pl',
  'place',
  'blvd',
  'boulevard',
  'pkwy',
  'parkway',
  'ct',
  'court',
  'way',
  'cir',
  'circle',
  'supercharger',
  'station',
  'restaurant',
  'grill',
  'bar',
  'cafe',
  'coffee',
  'shop',
  'store',
  'center',
  'mall',
  'theater',
  'theatre',
  'museum',
  'park',
  'parking',
  'airport',
]);

const CITY_PREFIX_WORDS = new Set(['new', 'los', 'las', 'san', 'santa', 'saint', 'st', 'fort', 'port', 'north', 'south', 'east', 'west']);

function normalizeCityCandidate(value: string) {
  const candidate = value
    .replace(/\b(?:usa|united states)\b/gi, '')
    .replace(/[^\w\s.'-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!candidate) return undefined;
  const lastWord = candidate.split(/\s+/).pop()?.toLowerCase().replace(/[.'-]/g, '');
  if (!lastWord || CITY_TRAILING_STOP_WORDS.has(lastWord)) return undefined;
  return candidate
    .split(/\s+/)
    .map((word) => word.length ? `${word[0].toUpperCase()}${word.slice(1)}` : word)
    .join(' ');
}

function addressCityCandidates(value: string) {
  const candidates: string[] = [];
  const stateMatch = value.match(/,\s*([^,\d]+?)\s*,?\s+[A-Z]{2}(?:\s+\d{5})?\b/);
  if (stateMatch?.[1]) {
    const normalized = normalizeCityCandidate(stateMatch[1]);
    if (normalized) candidates.push(normalized);
  }
  const commaParts = value.split(',').map((part) => part.trim()).filter(Boolean);
  if (commaParts.length >= 3) {
    const normalized = normalizeCityCandidate(commaParts[commaParts.length - 2]);
    if (normalized) candidates.push(normalized);
  }
  return candidates;
}

function addressCityStateCandidates(value: string) {
  const candidates: CityState[] = [];
  const addCandidate = (cityValue?: string, stateValue?: string) => {
    if (!cityValue) return;
    const city = normalizeCityCandidate(cityValue);
    const state = stateValue?.trim().toUpperCase();
    if (!city) return;
    candidates.push({ city, state: state && /^[A-Z]{2}$/.test(state) ? state : undefined });
  };

  Array.from(value.matchAll(/,\s*([^,\d]+?)\s*,?\s+([A-Z]{2})(?:\s+\d{5})?\b/g)).forEach((match) => {
    addCandidate(match[1], match[2]);
  });

  const commaParts = value.split(',').map((part) => part.trim()).filter(Boolean);
  if (commaParts.length >= 3) {
    const stateMatch = commaParts[commaParts.length - 1].match(/\b([A-Z]{2})\b/);
    addCandidate(commaParts[commaParts.length - 2], stateMatch?.[1]);
  }

  return candidates;
}

function labelCityCandidates(value: string) {
  const words = value.match(/[A-Za-z][A-Za-z.'-]*/g) || [];
  if (!words.length) return [];

  const candidates: string[] = [];
  const lastWord = normalizeCityCandidate(words[words.length - 1]);
  if (lastWord) candidates.push(lastWord);

  if (words.length >= 2) {
    const previous = words[words.length - 2];
    const previousKey = previous.toLowerCase().replace(/[.'-]/g, '');
    const lastKey = words[words.length - 1].toLowerCase().replace(/[.'-]/g, '');
    if (CITY_PREFIX_WORDS.has(previousKey) && !CITY_TRAILING_STOP_WORDS.has(lastKey)) {
      const normalized = normalizeCityCandidate(`${previous} ${words[words.length - 1]}`);
      if (normalized) candidates.push(normalized);
    }
  }

  return candidates;
}

function cityStateLabel(value?: CityState) {
  if (!value?.city) return undefined;
  return value.state ? `${value.city}, ${value.state}` : value.city;
}

function cityStateForPlace(item: PlaceCard | string) {
  if (typeof item === 'string') {
    const cityState = addressCityStateCandidates(item)[0];
    if (cityState) return cityState;
    const city = addressCityCandidates(item)[0] || labelCityCandidates(item)[0];
    return city ? { city } : undefined;
  }

  const addressCityState = item.address ? addressCityStateCandidates(item.address)[0] : undefined;
  if (addressCityState) return addressCityState;

  const subtitleCityState = item.subtitle ? addressCityStateCandidates(item.subtitle)[0] : undefined;
  if (subtitleCityState) return subtitleCityState;

  const addressCity = item.address ? addressCityCandidates(item.address)[0] : undefined;
  if (addressCity) return { city: addressCity };

  const subtitleCity = item.subtitle ? addressCityCandidates(item.subtitle)[0] : undefined;
  if (subtitleCity) return { city: subtitleCity };

  const labelCity = labelCityCandidates(item.title)[0];
  return labelCity ? { city: labelCity } : undefined;
}

function cityForPlace(item: PlaceCard | string) {
  return cityStateForPlace(item)?.city;
}

function importedRouteCity(routeImport: GoogleMapsRouteImport) {
  const scores = new Map<string, { label: string; score: number; firstSeen: number }>();
  const addCandidate = (candidate: string, score: number, firstSeen: number) => {
    const normalized = normalizeCityCandidate(candidate);
    if (!normalized) return;
    const key = normalized.toLowerCase();
    const current = scores.get(key);
    scores.set(key, {
      label: current?.label || normalized,
      score: (current?.score || 0) + score,
      firstSeen: current?.firstSeen ?? firstSeen,
    });
  };

  routeImport.stops.forEach((stop, index) => {
    [stop.address, stop.label].filter(Boolean).forEach((value) => {
      addressCityCandidates(value as string).forEach((candidate) => addCandidate(candidate, 4, index));
    });
    if (stop.placeName) {
      labelCityCandidates(stop.placeName).forEach((candidate) => addCandidate(candidate, 1, index));
    }
  });

  const ranked = [...scores.values()].sort((a, b) => b.score - a.score || a.firstSeen - b.firstSeen);
  return ranked[0]?.label;
}

function defaultImportedRouteTitle(routeImport: GoogleMapsRouteImport, windowId: DateWindowId, customRange?: CustomDateRange | null) {
  const weekday = dateWindowRange(windowId, new Date(), customRange).start.toLocaleDateString([], { weekday: 'long' });
  const city = importedRouteCity(routeImport);
  return city ? `${weekday} in ${city}` : `${weekday} route`;
}

function normalizedMaybeUrl(rawUrl: string) {
  const trimmed = rawUrl.trim();
  if (!trimmed) return undefined;
  return /^[a-z][a-z\d+\-.]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function isGoogleMapsShortUrl(rawUrl: string) {
  const normalized = normalizedMaybeUrl(rawUrl);
  if (!normalized) return false;
  try {
    const host = new URL(normalized).hostname.toLowerCase();
    return host === 'maps.app.goo.gl' || host === 'goo.gl';
  } catch {
    return false;
  }
}

async function expandGoogleMapsRouteUrlForImport(rawUrl: string) {
  const normalized = normalizedMaybeUrl(rawUrl);
  if (!normalized || !isGoogleMapsShortUrl(normalized)) return rawUrl.trim();

  if (Platform.OS === 'web') {
    try {
      const response = await withTimeout(
        fetch(`/api/expand-route-url?url=${encodeURIComponent(normalized)}`),
        8000,
        'Google Maps route expansion',
      );
      if (response.ok) {
        const body = await response.json();
        if (typeof body?.url === 'string' && body.url.includes('/maps/dir/')) return body.url;
      }
    } catch {
      // Expo web development may not serve Vercel functions; fall through to client expansion.
    }
  }

  try {
    const response = await withTimeout(
      fetch(normalized, { method: 'GET', redirect: 'follow' }),
      8000,
      'Google Maps route expansion',
    );
    if (response.url && response.url.includes('/maps/dir/')) return response.url;
  } catch {
    // CORS can block this on web; the caller will parse the original URL and fail gracefully.
  }

  return normalized;
}

function scoreCard(card: PlaceCard, memory: LocalMemory, selectedMoods: string[]) {
  const rating = card.rating || 0;
  const reviewCount = card.ratingCount || 0;
  let score = rating * 10 + Math.log10(reviewCount + 1);

  if (card.isOpen) score += 8;
  if (card.isOpen === false) score -= 20;
  if (card.kind === 'event') score += 8;
  if (memory.favorites.includes(card.id)) score += 18;
  if (memory.dismissedSession.includes(card.id)) score -= 50;
  if (selectedMoods.includes('Date')) score += rating * 2 + Math.log10(reviewCount + 1) * 3;
  if (selectedMoods.includes('Cheap') && card.priceLevel === '$') score += 8;
  if (selectedMoods.includes('Easy') || selectedMoods.includes('Tired')) {
    if (card.isOpen) score += 5;
  }

  return score;
}

function isEventCard(card: PlaceCard) {
  return card.kind === 'event';
}

function isTicketmasterEvent(card: PlaceCard) {
  return card.kind === 'event' && card.source === 'Ticketmaster';
}

function nonEventActivitySelections(selectedActivities: string[]) {
  return selectedActivities.filter((item) => item !== 'Any' && item !== 'Events');
}

function matchesActivitySelection(card: PlaceCard, selectedActivities: string[]) {
  const selected = nonEventActivitySelections(selectedActivities);
  if (!selected.length) return true;
  const blob = [card.title, card.subtitle, card.address, ...(card.types || [])]
    .join(' ')
    .toLowerCase()
    .replace(/_/g, ' ');

  return selected.some((activity) => {
    if (activity === 'Tesla Supercharger') return isTeslaSupercharger(card);
    if (activity === 'EV Charger') return isEvCharger(card);
    const label = activity.toLowerCase();
    const mappedTypes = (ACTIVITY_TYPE_MAP[activity] || []).map((type) => type.replace(/_/g, ' ').toLowerCase());
    return blob.includes(label) || mappedTypes.some((type) => blob.includes(type));
  });
}

function eventTimingScore(card: PlaceCard) {
  if (!card.eventStartMs) return -4;
  const hoursFromNow = (card.eventStartMs - Date.now()) / (60 * 60 * 1000);
  if (hoursFromNow < -1) return -35;
  if (hoursFromNow <= 2) return 10;
  if (hoursFromNow <= 8) return 14;
  if (hoursFromNow <= 24) return 8;
  if (hoursFromNow <= 72) return 5;
  return 2;
}

function distanceScore(center: LatLon, card: PlaceCard) {
  const meters = distanceMeters(center, card);
  if (!Number.isFinite(meters)) return 0;
  const miles = meters / 1609.344;
  if (miles <= 2) return 14;
  if (miles <= 5) return 10;
  if (miles <= 10) return 6;
  if (miles <= 20) return 1;
  return -10;
}

function walkingDistanceBiasScore(meters: number, primary = false) {
  if (!Number.isFinite(meters)) return 0;
  const miles = meters / 1609.344;
  if (miles <= 0.25) return primary ? 46 : 24;
  if (miles <= 0.5) return primary ? 38 : 20;
  if (miles <= 1) return primary ? 24 : 12;
  if (miles <= 1.5) return primary ? 8 : 4;
  if (miles <= 2) return primary ? -24 : -10;
  return primary ? -72 : -30;
}

function routeBiasScore(card: PlaceCard, routeBias?: SearchRouteBias) {
  if (!routeBias || routeBias.mode !== 'walk') return 0;

  let score = 0;
  if (routeBias.anchor) {
    score += walkingDistanceBiasScore(distanceMeters(routeBias.anchor, card), true);
  }

  if (routeBias.start) {
    const anchorStartMeters = routeBias.anchor
      ? distanceMeters(routeBias.start, { lat: routeBias.anchor.latitude, lng: routeBias.anchor.longitude })
      : Number.POSITIVE_INFINITY;
    if (!routeBias.anchor || anchorStartMeters > 80) {
      score += walkingDistanceBiasScore(distanceMeters(routeBias.start, card), false);
    }
  }

  return score;
}

function routeBiasCacheKey(routeBias?: SearchRouteBias) {
  if (!routeBias || routeBias.mode !== 'walk') return '';
  const pointKey = (point?: LatLon) =>
    point ? `${point.latitude.toFixed(4)},${point.longitude.toFixed(4)}` : 'none';
  return `|route-bias:${routeBias.mode}:${pointKey(routeBias.anchor)}:${pointKey(routeBias.start)}`;
}

function walkingAdjustedRadius(radiusMeters: number, routeBias?: SearchRouteBias) {
  if (!routeBias || routeBias.mode !== 'walk') return radiusMeters;
  return Math.min(radiusMeters, WALKING_SEARCH_RADIUS_METERS);
}

function activityCardScore(
  card: PlaceCard,
  center: LatLon,
  memory: LocalMemory,
  selectedMoods: string[],
  selectedActivities: string[],
  eventsFocused: boolean,
  routeBias?: SearchRouteBias,
) {
  let score = scoreCard(card, memory, selectedMoods) + distanceScore(center, card) + routeBiasScore(card, routeBias);
  const selectedSpecificActivity = nonEventActivitySelections(selectedActivities).length > 0;

  if (isEventCard(card)) {
    score += eventTimingScore(card);
    score += isTicketmasterEvent(card) ? 38 : -14;
    score += card.eventDateText && card.eventDateText !== 'Date Not Verified' ? 14 : -10;
    if (eventsFocused) score += 38;
    else if (selectedSpecificActivity) score -= 14;
    else score += 28;
  } else {
    if (selectedSpecificActivity && matchesActivitySelection(card, selectedActivities)) score += 22;
    if (!selectedSpecificActivity) score += 8;
    if (card.isOpen) score += 8;
  }

  return score;
}

function foodCardScore(
  card: PlaceCard,
  center: LatLon,
  memory: LocalMemory,
  selectedMoods: string[],
  selectedFoods: string[],
  selectedDietary: string[] = DEFAULT_DIETARY_SELECTIONS,
  routeBias?: SearchRouteBias,
) {
  const cuisineStrength = foodCuisineMatchStrength(card, selectedFoods);
  const hasCuisineFilter = cuisineSelections(selectedFoods).length > 0;
  const dietaryStrength = foodDietaryMatchStrength(card, selectedDietary);
  const hasDietaryFilter = dietarySelections(selectedDietary).length > 0;
  let score = scoreCard(card, memory, selectedMoods) + distanceScore(center, card) + routeBiasScore(card, routeBias);

  if (hasCuisineFilter) {
    score += cuisineStrength * 26;
    if (isLikelyFastFood(card) && cuisineStrength <= 1) score -= 50;
    else if (isLikelyFastFood(card) && cuisineStrength < 5) score -= 18;
  }

  if (hasDietaryFilter) score += dietaryStrength * 20;
  if (isLikelyFastFood(card)) score -= 10;

  if (card.isOpen) score += 8;
  return score;
}

function capActivityEventBlend(cards: PlaceCard[], selectedActivities: string[]) {
  const eventsFocused = selectedActivities.includes('Events');
  if (eventsFocused) return cards;

  const selectedSpecificActivity = nonEventActivitySelections(selectedActivities).length > 0;
  const normalCount = cards.filter((card) => !isEventCard(card)).length;
  if (normalCount < 3) return cards;

  const result: PlaceCard[] = [];
  const deferredEvents: PlaceCard[] = [];

  cards.forEach((card) => {
    if (!isEventCard(card)) {
      result.push(card);
      return;
    }

    const nextIndex = result.length;
    const top3Events = result.slice(0, 3).filter(isEventCard).length;
    const top10Events = result.slice(0, 10).filter(isEventCard).length;
    const hasNormalRoom = result.filter((item) => !isEventCard(item)).length < normalCount;

    if (!selectedSpecificActivity) {
      const top5Events = result.slice(0, 5).filter(isEventCard).length;
      if (nextIndex < 3 && top3Events >= 1 && normalCount >= 6 && hasNormalRoom) {
        deferredEvents.push(card);
        return;
      }
      if (nextIndex < 5 && top5Events >= 2 && normalCount >= 5 && hasNormalRoom) {
        deferredEvents.push(card);
        return;
      }
      if (nextIndex < 10 && top10Events >= 5 && normalCount >= 6 && hasNormalRoom) {
        deferredEvents.push(card);
        return;
      }
    } else {
      if (nextIndex < 5 && hasNormalRoom) {
        deferredEvents.push(card);
        return;
      }
      if (nextIndex < 10 && top10Events >= 1 && hasNormalRoom) {
        deferredEvents.push(card);
        return;
      }
    }

    result.push(card);
  });

  return [...result, ...deferredEvents];
}

function promoteActivityEvents(cards: PlaceCard[], selectedActivities: string[]) {
  const eventsFocused = selectedActivities.includes('Events');
  const selectedSpecificActivity = nonEventActivitySelections(selectedActivities).length > 0;
  if (eventsFocused || selectedSpecificActivity) return cards;

  const normalCount = cards.filter((card) => !isEventCard(card)).length;
  const ticketmasterCount = cards.filter(isTicketmasterEvent).length;
  if (normalCount < 3 || ticketmasterCount === 0) return cards;

  const result = [...cards];
  const moveNextTicketmasterEvent = (targetIndex: number) => {
    const currentEventCount = result.slice(0, targetIndex + 1).filter(isTicketmasterEvent).length;
    if (currentEventCount > 0) return;
    const eventIndex = result.findIndex((card, index) => index > targetIndex && isTicketmasterEvent(card));
    if (eventIndex < 0) return;
    const [event] = result.splice(eventIndex, 1);
    result.splice(Math.min(targetIndex, result.length), 0, event);
  };

  moveNextTicketmasterEvent(1);

  if (ticketmasterCount >= 2 && result.slice(0, 5).filter(isTicketmasterEvent).length < 2) {
    const eventIndex = result.findIndex((card, index) => index >= 5 && isTicketmasterEvent(card));
    if (eventIndex >= 0) {
      const [event] = result.splice(eventIndex, 1);
      result.splice(Math.min(4, result.length), 0, event);
    }
  }

  if (ticketmasterCount >= 3 && result.slice(0, 8).filter(isTicketmasterEvent).length < 3 && normalCount >= 5) {
    const eventIndex = result.findIndex((card, index) => index >= 8 && isTicketmasterEvent(card));
    if (eventIndex >= 0) {
      const [event] = result.splice(eventIndex, 1);
      result.splice(Math.min(7, result.length), 0, event);
    }
  }

  return result;
}

function compactError(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function searchCacheKey(slot: PlanSlot, center: LatLon, types: string[], radiusMeters: number) {
  const lat = center.latitude.toFixed(4);
  const lng = center.longitude.toFixed(4);
  const label = center.label ? normalizePlaceName(center.label) : 'unlabeled';
  return [slot, lat, lng, label, radiusMeters, [...types].sort().join(',')].join('|');
}

function textSearchCacheKey(query: string, slot: PlanSlot, center?: LatLon | null) {
  const lat = center ? center.latitude.toFixed(4) : 'none';
  const lng = center ? center.longitude.toFixed(4) : 'none';
  const label = center?.label ? normalizePlaceName(center.label) : 'unlabeled';
  return [slot, normalizePlaceName(query), lat, lng, label].join('|');
}

function normalizePlaceName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&#038;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#8217;/g, "'")
    .replace(/&rsquo;/g, "'")
    .replace(/&ndash;/g, '-')
    .replace(/&mdash;/g, '-')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isFactoryAtFranklin(item: PlaceCard | string) {
  const name = normalizePlaceName(cardToName(item) || '');
  return name.includes('factory at franklin') || name === 'the factory' || name.includes('the factory franklin');
}

function parseFactoryExperienceFeatures(html: string) {
  const skip = new Set([
    'Experience',
    'Unforgettable Experiences',
    'Things To Do in Franklin, TN',
    'Visit Us',
    'Open Daily',
  ]);
  const features: string[] = [];
  const add = (value: string) => {
    const clean = decodeHtml(value);
    if (!clean || skip.has(clean) || clean.length > 80) return;
    if (!features.includes(clean)) features.push(clean);
  };

  Array.from(html.matchAll(/<h3[^>]*>([\s\S]*?)<\/h3>/gi)).forEach((match) => add(match[1]));
  return features.slice(0, 10);
}

function distanceMeters(a: LatLon, b: Pick<PlaceCard, 'lat' | 'lng'>) {
  if (typeof b.lat !== 'number' || typeof b.lng !== 'number') return Number.POSITIVE_INFINITY;
  const toRad = (value: number) => (value * Math.PI) / 180;
  const earthRadius = 6371000;
  const dLat = toRad(b.lat - a.latitude);
  const dLng = toRad(b.lng - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * earthRadius * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function formatDistanceFromMeters(meters: number) {
  if (!Number.isFinite(meters)) return undefined;
  const miles = meters / 1609.344;
  if (miles < 0.1) return '<0.1 mi';
  if (miles < 10) return `${miles.toFixed(1)} mi`;
  return `${Math.round(miles)} mi`;
}

function favoriteMatchesSearchLocation(entry: { card: PlaceCard; location?: LatLon }, center?: LatLon | null) {
  if (!center) return true;
  if (entry.location) {
    const distance = distanceMeters(center, { lat: entry.location.latitude, lng: entry.location.longitude });
    return Number.isFinite(distance) && distance <= EXPANDED_FOOD_RADIUS_METERS;
  }

  const cardDistance = distanceMeters(center, entry.card);
  return Number.isFinite(cardDistance) && cardDistance <= EXPANDED_FOOD_RADIUS_METERS;
}

function formatStopTime(time?: StopTime) {
  if (!time) return undefined;
  if (time.hours <= 0) return `${time.minutes} min`;
  if (time.minutes <= 0) return `${time.hours} hr`;
  return `${time.hours} hr ${time.minutes} min`;
}

function stopTimeFromMinutes(totalMinutes: number): StopTime {
  const bounded = Math.max(0, Math.min(12 * 60, Math.round(totalMinutes)));
  return {
    hours: Math.floor(bounded / 60),
    minutes: bounded % 60,
  };
}

function clockMinutes(time: StopTime) {
  return (time.hours || 0) * 60 + (time.minutes || 0);
}

function clockTimeFromMinutes(totalMinutes: number): StopTime {
  const normalized = ((Math.round(totalMinutes) % (24 * 60)) + 24 * 60) % (24 * 60);
  return {
    hours: Math.floor(normalized / 60),
    minutes: normalized % 60,
  };
}

function clockTimeFromDate(date: Date): StopTime {
  return {
    hours: date.getHours(),
    minutes: date.getMinutes(),
  };
}

function clockTimePlusMinutes(time: StopTime, deltaMinutes: number) {
  return clockTimeFromMinutes(clockMinutes(time) + deltaMinutes);
}

function timeWindowFromStartClock(start: StopTime, durationMinutes = 180) {
  const end = clockTimePlusMinutes(start, durationMinutes);
  return `${formatClockTime(start)} - ${formatClockTime(end)}`;
}

function localDateClockMs(dateKey: string, totalClockMinutes: number) {
  const parsed = parseDateInput(dateKey) || new Date();
  const dayOffset = Math.floor(totalClockMinutes / (24 * 60));
  const minuteOfDay = ((totalClockMinutes % (24 * 60)) + 24 * 60) % (24 * 60);
  const date = addLocalDays(startOfLocalDay(parsed), dayOffset);
  date.setHours(Math.floor(minuteOfDay / 60), minuteOfDay % 60, 0, 0);
  return date.getTime();
}

function clockTimeFromOffsetMinutes(totalMinutes: number, baseMs = Date.now()): StopTime {
  const date = new Date(baseMs + Math.max(0, Math.round(totalMinutes)) * 60 * 1000);
  const snappedMinutes = Math.round(date.getMinutes() / 15) * 15;
  if (snappedMinutes >= 60) {
    date.setHours(date.getHours() + 1, 0, 0, 0);
  } else {
    date.setMinutes(snappedMinutes, 0, 0);
  }
  return {
    hours: date.getHours(),
    minutes: date.getMinutes(),
  };
}

function clockTimeFromRelativeStopTime(relativeTime: StopTime, baseMs: number) {
  const totalMinutes = (relativeTime.hours || 0) * 60 + (relativeTime.minutes || 0);
  const date = new Date(baseMs + Math.max(0, Math.round(totalMinutes)) * 60 * 1000);
  return {
    hours: date.getHours(),
    minutes: date.getMinutes(),
  };
}

function minutesUntilClockTime(time: StopTime, baseMs = Date.now()) {
  const now = new Date(baseMs);
  const target = new Date(baseMs);
  target.setHours(time.hours, time.minutes, 0, 0);
  if (target.getTime() < now.getTime()) target.setDate(target.getDate() + 1);
  return Math.round((target.getTime() - now.getTime()) / 60000);
}

function formatClockTime(time: StopTime) {
  const date = new Date();
  date.setHours(time.hours, time.minutes, 0, 0);
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function stopCoords(item: PlaceCard | string): LatLon | undefined {
  if (typeof item === 'string' || typeof item.lat !== 'number' || typeof item.lng !== 'number') return undefined;
  return { latitude: item.lat, longitude: item.lng, label: item.title };
}

function isWalkableAfterTeslaStop(previous?: ItineraryStop, current?: ItineraryStop) {
  if (!previous || !current || !isTeslaSupercharger(previous.item)) return false;
  const previousCoords = stopCoords(previous.item);
  const currentCoords = stopCoords(current.item);
  if (!previousCoords || !currentCoords) return false;
  return distanceMeters(previousCoords, { lat: currentCoords.latitude, lng: currentCoords.longitude }) <= WALKING_DISTANCE_METERS;
}

function travelModeIconName(mode: StopTravelMode) {
  return TRAVEL_MODE_OPTIONS.find((option) => option.id === mode)?.icon || 'car-outline';
}

function travelModeLabel(mode: StopTravelMode) {
  return TRAVEL_MODE_OPTIONS.find((option) => option.id === mode)?.label || 'Drive';
}

function estimateDriveMinutes(from: LatLon | undefined, to: PlaceCard | string) {
  const toCoords = stopCoords(to);
  if (!from || !toCoords) return 15;
  const miles = distanceMeters(from, { lat: toCoords.latitude, lng: toCoords.longitude }) / 1609.344;
  if (miles <= 1) return Math.max(5, Math.round(miles * 8 + 3));
  if (miles <= 5) return Math.round(miles * 3 + 5);
  if (miles <= 15) return Math.round(miles * 2 + 6);
  return Math.round(miles * 1.35 + 7);
}

function estimateTravelMinutes(from: LatLon | undefined, to: PlaceCard | string, mode: StopTravelMode) {
  const toCoords = stopCoords(to);
  if (!from || !toCoords) {
    if (mode === 'walk') return 15;
    if (mode === 'bike') return 10;
    if (mode === 'train') return 25;
    if (mode === 'plane') return 90;
    return estimateDriveMinutes(from, to);
  }

  const miles = distanceMeters(from, { lat: toCoords.latitude, lng: toCoords.longitude }) / 1609.344;
  if (mode === 'walk') return Math.max(2, Math.round(miles * 20));
  if (mode === 'bike') return Math.max(3, Math.round(miles * 6 + 2));
  if (mode === 'train') return Math.max(12, Math.round(miles * 2.2 + 12));
  if (mode === 'plane') return Math.max(60, Math.round(miles * 0.9 + 75));
  return estimateDriveMinutes(from, to);
}

function defaultStopDurationMinutes(stop: ItineraryStop) {
  const item = stop.item;
  return defaultItineraryStopDurationMinutes({
    explicitKind: stop.visualType,
    slot: stop.slot,
    title: cardToName(item),
    types: typeof item === 'string' ? [] : item.types,
    providerDurationMinutes: typeof item === 'string' ? undefined : item.durationMinutes,
    eventStartMs: typeof item === 'string' ? undefined : item.eventStartMs,
    eventEndMs: typeof item === 'string' ? undefined : item.eventEndMs,
  });
}

function itineraryKindForStop(stop: ItineraryStop): ItineraryStopKind {
  return inferItineraryStopKind({
    explicitKind: stop.visualType,
    slot: stop.slot,
    title: cardToName(stop.item),
    types: typeof stop.item === 'string' ? [] : stop.item.types,
    manual: typeof stop.item === 'string' && stop.visualType === 'idea',
  });
}

function itineraryKindLabel(kind: ItineraryStopKind) {
  if (kind === 'food') return 'Food';
  if (kind === 'activity') return 'Activity';
  if (kind === 'dessert') return 'Dessert';
  return 'Idea';
}

function startOfLocalDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function endOfLocalDay(date: Date) {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

function addLocalDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function nextSaturday(from: Date, skipCurrentWeekend = false) {
  const day = from.getDay();
  const daysUntilSaturday = (6 - day + 7) % 7;
  const addDays = daysUntilSaturday === 0 && skipCurrentWeekend ? 7 : daysUntilSaturday;
  return startOfLocalDay(addLocalDays(from, addDays));
}

function parseDateInput(value: string) {
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return undefined;
  const parsed = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed;
}

function formatDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function dateWindowRange(windowId: DateWindowId, now = new Date(), customRange?: CustomDateRange | null) {
  if (windowId === 'custom' && customRange) {
    const start = parseDateInput(customRange.start);
    const end = parseDateInput(customRange.end);
    if (start && end) {
      const startDate = start < now ? now : startOfLocalDay(start);
      return { start: startDate, end: endOfLocalDay(end) };
    }
  }

  const today = startOfLocalDay(now);
  const tomorrow = addLocalDays(today, 1);
  if (windowId === 'today') return { start: now, end: endOfLocalDay(now) };
  if (windowId === 'tomorrow') return { start: tomorrow, end: endOfLocalDay(tomorrow) };
  if (windowId === 'next3') return { start: now, end: endOfLocalDay(addLocalDays(today, 2)) };
  if (windowId === 'weekend') {
    const saturday = now.getDay() === 0 ? addLocalDays(today, -1) : nextSaturday(now);
    return { start: saturday < now ? now : saturday, end: endOfLocalDay(addLocalDays(saturday, 1)) };
  }
  if (windowId === 'nextWeekend') {
    const thisSaturday = now.getDay() === 0 ? addLocalDays(today, -1) : nextSaturday(now);
    const nextWeekendStart = addLocalDays(thisSaturday, 7);
    return { start: nextWeekendStart, end: endOfLocalDay(addLocalDays(nextWeekendStart, 1)) };
  }
  return { start: now, end: endOfLocalDay(now) };
}

function dateRangeKeysForWindow(windowId: DateWindowId, customRange?: CustomDateRange | null, now = new Date()) {
  const range = dateWindowRange(windowId, now, customRange);
  return {
    start: formatDateInput(range.start),
    end: formatDateInput(range.end),
  };
}

function shortDate(date: Date) {
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function absoluteDateRangeLabel(startKey?: string, endKey?: string) {
  if (!startKey || !endKey) return undefined;
  const start = parseDateInput(startKey);
  const end = parseDateInput(endKey);
  if (!start || !end) return undefined;
  if (startKey === endKey) return shortDate(start);
  return `${shortDate(start)} - ${shortDate(end)}`;
}

function dateWindowLabel(windowId: DateWindowId, now = new Date(), customRange?: CustomDateRange | null) {
  const range = dateWindowRange(windowId, now, customRange);
  if (windowId === 'today') return `Today ${shortDate(range.start)}`;
  if (windowId === 'tomorrow') return `Tomorrow ${shortDate(range.start)}`;
  if (windowId === 'next3') return `Next 3 days`;
  if (windowId === 'weekend') return `This weekend`;
  if (windowId === 'nextWeekend') return `Next weekend`;
  if (windowId === 'custom' && customRange) return `${shortDate(range.start)} - ${shortDate(range.end)}`;
  return 'Choose dates';
}

function dateWindowSearchPhrase(windowId: DateWindowId, customRange?: CustomDateRange | null) {
  if (windowId === 'today') return 'today';
  if (windowId === 'tomorrow') return 'tomorrow';
  if (windowId === 'weekend') return 'this weekend';
  if (windowId === 'nextWeekend') return 'next weekend';
  if (windowId === 'custom' && customRange) return `between ${customRange.start} and ${customRange.end}`;
  return 'next few days';
}

function formatClockAfterMinutes(totalMinutes: number, baseMs = Date.now()) {
  const date = new Date(baseMs + Math.max(0, Math.round(totalMinutes)) * 60 * 1000);
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function planningIntentLabel(intent: PlanningIntent) {
  if (intent === 'food') return 'Food';
  if (intent === 'activity') return 'Activity';
  return 'Food + Activity';
}

function planningIntentIncludesSlot(intent: PlanningIntent, slot: PlanSlot) {
  return intent === 'both' || intent === slot;
}

function defaultTimeWindowForPreference(selectedTime: string) {
  if (selectedTime === 'Morning') return '9:00 AM - 11:30 AM';
  if (selectedTime === 'Lunch') return '11:30 AM - 1:30 PM';
  if (selectedTime === 'Afternoon') return '1:00 PM - 5:00 PM';
  if (selectedTime === 'Dinner') return '6:00 PM - 9:00 PM';
  if (selectedTime === 'Late night') return '9:00 PM - 12:00 AM';
  return '6:00 PM - 9:00 PM';
}

function parseClockMinutes(value: string) {
  const match = value.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
  if (!match) return undefined;
  let hours = Number(match[1]);
  const minutes = Number(match[2] || 0);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes) || minutes > 59) return undefined;
  const meridian = match[3]?.toLowerCase();
  if (meridian === 'pm' && hours < 12) hours += 12;
  if (meridian === 'am' && hours === 12) hours = 0;
  if (hours > 23) return undefined;
  return hours * 60 + minutes;
}

function parsePlanningTimeWindow(value: string) {
  const parts = value.split(/\s+-\s+|\s+to\s+/i).map((part) => part.trim()).filter(Boolean);
  if (parts.length < 2) return undefined;
  const start = parseClockMinutes(parts[0]);
  const end = parseClockMinutes(parts[1]);
  if (typeof start !== 'number' || typeof end !== 'number') return undefined;
  return { start, end: end <= start ? end + 24 * 60 : end };
}

function eventFitsSessionWindow(card: PlaceCard, session: PlanningSession) {
  if (!card.eventStartMs) return 0;
  const start = new Date(card.eventStartMs);
  const range = dateWindowRange(session.dateWindow, new Date(), session.customDateRange);
  if (start < range.start || start > range.end) return -45;

  const window = parsePlanningTimeWindow(session.timeWindow);
  if (!window) return 18;
  const eventMinutes = start.getHours() * 60 + start.getMinutes();
  const normalizedEventMinutes = eventMinutes < window.start ? eventMinutes + 24 * 60 : eventMinutes;
  if (normalizedEventMinutes >= window.start && normalizedEventMinutes <= window.end) return 32;
  const minutesAway = Math.min(
    Math.abs(normalizedEventMinutes - window.start),
    Math.abs(normalizedEventMinutes - window.end),
  );
  if (minutesAway <= 60) return 8;
  return -18;
}

function planningSourceForCard(slot: PlanSlot, card: PlaceCard): PlanningSuggestionSource {
  if (card.kind === 'event') return 'event';
  return slot;
}

function makePlanningSuggestionId(slot: PlanSlot, item: PlaceCard | string) {
  const base = normalizePlaceName(cardToId(item)).slice(0, 48) || slot;
  return `session-suggestion-${slot}-${base}-${Date.now()}`;
}

function samePlanningSuggestion(a: PlanningSuggestion, slot: PlanSlot, item: PlaceCard | string) {
  return a.slot === slot && cardToId(a.item) === cardToId(item);
}

function suggestionDistanceMiles(suggestion: PlanningSuggestion, session: PlanningSession) {
  if (typeof suggestion.item === 'string') return Number.POSITIVE_INFINITY;
  return distanceMeters(session.searchLocation, suggestion.item) / 1609.344;
}

function scorePlanningSuggestion(suggestion: PlanningSuggestion, session: PlanningSession) {
  const voteCount = unique(suggestion.votes).length;
  let score = voteCount * 100;
  const notes: string[] = [];

  if (planningIntentIncludesSlot(session.intent, suggestion.slot)) {
    score += 30;
  } else {
    score -= 60;
    notes.push('outside the session intent');
  }

  if (typeof suggestion.item !== 'string') {
    const miles = suggestionDistanceMiles(suggestion, session);
    if (Number.isFinite(miles)) {
      if (miles <= 2) score += 26;
      else if (miles <= 5) score += 18;
      else if (miles <= 10) score += 8;
      else if (miles <= 20) score -= 8;
      else score -= 35;
      notes.push(`${miles.toFixed(1)} mi from shared search`);
    }

    if (suggestion.item.kind === 'event') {
      const eventScore = eventFitsSessionWindow(suggestion.item, session);
      score += eventScore;
      if (eventScore > 0) notes.push('event time fits');
      if (eventScore < 0) notes.push('event timing is awkward');
    }

    if (suggestion.item.isOpen === true) {
      score += 18;
      notes.push('currently open');
    } else if (suggestion.item.isOpen === false) {
      score -= 45;
      notes.push('currently closed');
    } else if (hasKnownHours(suggestion.item)) {
      score += 5;
      notes.push('hours available');
    }

    if (suggestion.item.rating) score += suggestion.item.rating * 3;
  } else {
    score -= 8;
    notes.push('manual idea needs manual fit check');
  }

  return { suggestion, score, notes };
}

function pairDistancePenalty(food: PlanningSuggestion, activity: PlanningSuggestion) {
  if (typeof food.item === 'string' || typeof activity.item === 'string') return 8;
  const from = stopCoords(food.item);
  if (!from) return 8;
  const miles = distanceMeters(from, activity.item) / 1609.344;
  if (!Number.isFinite(miles)) return 8;
  if (miles <= 3) return -8;
  if (miles <= 8) return 0;
  if (miles <= 15) return 18;
  return 40;
}

function buildPlanningRecommendation(session: PlanningSession): PlanningRecommendation {
  const eligible = session.suggestions
    .filter((suggestion) => planningIntentIncludesSlot(session.intent, suggestion.slot))
    .map((suggestion) => scorePlanningSuggestion(suggestion, session))
    .sort((a, b) => b.score - a.score);

  const notes: string[] = [];
  let selected: PlanningSuggestion[] = [];

  if (session.intent === 'both') {
    const foods = eligible.filter((item) => item.suggestion.slot === 'food').slice(0, 5);
    const activities = eligible.filter((item) => item.suggestion.slot === 'activity').slice(0, 5);
    let bestPair: { food: typeof eligible[number]; activity: typeof eligible[number]; score: number } | undefined;
    foods.forEach((food) => {
      activities.forEach((activity) => {
        const score = food.score + activity.score - pairDistancePenalty(food.suggestion, activity.suggestion);
        if (!bestPair || score > bestPair.score) bestPair = { food, activity, score };
      });
    });
    if (bestPair) {
      const activityIsEarlyEvent =
        typeof bestPair.activity.suggestion.item !== 'string' &&
        bestPair.activity.suggestion.item.kind === 'event' &&
        bestPair.activity.suggestion.item.eventStartMs &&
        new Date(bestPair.activity.suggestion.item.eventStartMs).getHours() < 17;
      selected = activityIsEarlyEvent
        ? [bestPair.activity.suggestion, bestPair.food.suggestion]
        : [bestPair.food.suggestion, bestPair.activity.suggestion];
      notes.push('Chose one food and one activity with votes, distance, and timing balanced.');
    } else {
      selected = eligible.slice(0, 2).map((item) => item.suggestion);
      notes.push('Not enough paired food/activity suggestions yet, so the best available options are shown.');
    }
  } else {
    selected = eligible.slice(0, 1).map((item) => item.suggestion);
    notes.push(`Chose the strongest ${planningIntentLabel(session.intent).toLowerCase()} option for this session.`);
  }

  selected.forEach((suggestion) => {
    const scored = scorePlanningSuggestion(suggestion, session);
    const voteCount = unique(suggestion.votes).length;
    notes.push(`${cardToName(suggestion.item) || 'Suggestion'}: ${voteCount} vote${voteCount === 1 ? '' : 's'}, ${scored.notes.slice(0, 2).join(', ') || 'best overall fit'}.`);
  });

  return {
    suggestionIds: selected.map((suggestion) => suggestion.id),
    generatedAt: Date.now(),
    notes,
  };
}

function suggestionToStop(suggestion: PlanningSuggestion, suffix = ''): ItineraryStop {
  return {
    key: `${makeStopKey(suggestion.slot, suggestion.item)}${suffix}`,
    slot: suggestion.slot,
    item: suggestion.item,
    featureOptions: [],
    selectedFeatures: [],
    featuresExpanded: false,
  };
}

function shortDateToken(dateKey?: string) {
  const date = dateKey ? parseDateInput(dateKey) : null;
  return date ? date.toLocaleDateString([], { month: 'short', day: 'numeric' }) : '';
}

function conciseDateTitle(windowId: DateWindowId, dateStart?: string, customRange?: CustomDateRange | null) {
  if (windowId === 'today') return 'Today';
  if (windowId === 'tomorrow') return 'Tomorrow';
  if (windowId === 'weekend') return 'This Weekend';
  if (windowId === 'nextWeekend') return 'Next Weekend';
  if (windowId === 'custom' && customRange) return shortDateToken(customRange.start) || 'Soon';
  return shortDateToken(dateStart) || 'Soon';
}

function weekdayTitle(dateKey?: string) {
  const date = dateKey ? parseDateInput(dateKey) : null;
  return date ? date.toLocaleDateString([], { weekday: 'long' }) : '';
}

function titleDatePhrase(windowId: DateWindowId, dateStart?: string, customRange?: CustomDateRange | null) {
  if (windowId === 'today') return 'Today';
  if (windowId === 'tomorrow') return 'Tomorrow';
  if (windowId === 'weekend' || windowId === 'nextWeekend') return 'Weekend';
  if (windowId === 'custom' && customRange) return weekdayTitle(customRange.start) || shortDateToken(customRange.start) || 'Soon';
  return weekdayTitle(dateStart) || shortDateToken(dateStart) || 'Soon';
}

function nowFoodSelectionsForCategory(category: string) {
  return NOW_FOOD_CATEGORY_SELECTIONS[category] || DEFAULT_FOOD_SELECTIONS;
}

function nowActivitySelectionsForCategory(category: string) {
  return NOW_ACTIVITY_CATEGORY_SELECTIONS[category] || DEFAULT_ACTIVITY_SELECTIONS;
}

function nowFoodTitlePrefix(category: string, now = new Date()) {
  if (['Coffee', 'Dessert', 'Breakfast', 'Lunch', 'Dinner'].includes(category)) return category;
  const hour = now.getHours();
  if (hour < 11) return 'Breakfast';
  if (hour < 16) return 'Lunch';
  return 'Dinner';
}

function nowActivityTitlePrefix(category: string) {
  if (category === 'Movie') return 'Movie';
  if (['Arcade', 'Bowling', 'Shopping'].includes(category)) return category;
  if (category === 'Outdoor') return 'Outdoor stop';
  if (category === 'Family') return 'Family outing';
  return 'Activity';
}

function contextualNowPlanTitle(slot: PlanSlot, item: PlaceCard | string, category: string) {
  const destination = cardToName(item) || (slot === 'food' ? 'a place to eat' : 'an activity');
  const prefix = slot === 'food' ? nowFoodTitlePrefix(category) : nowActivityTitlePrefix(category);
  return `${prefix} at ${destination}`;
}

function defaultBetaPlanTitle({
  intent,
  dateWindow,
  customDateRange,
  planDateStart,
  timePreference,
}: {
  intent: PlanningIntent;
  dateWindow: DateWindowId;
  customDateRange?: CustomDateRange | null;
  planDateStart?: string;
  timePreference?: string;
}) {
  const dateTitle = conciseDateTitle(dateWindow, planDateStart, customDateRange);
  const titleDate = titleDatePhrase(dateWindow, planDateStart, customDateRange);
  const weekday = weekdayTitle(planDateStart);
  const isWeekend = dateWindow === 'weekend' || dateWindow === 'nextWeekend';
  if ((timePreference === 'Dinner' || timePreference === 'Late night') && weekday === 'Friday') return 'Friday Night Out';
  if (isWeekend && intent === 'activity') return 'Weekend Activity';
  if (isWeekend && intent === 'both') return timePreference === 'Dinner' ? 'Weekend Dinner' : 'Weekend Outing';
  if (timePreference === 'Dinner') return `Dinner ${dateTitle}`;
  if (timePreference === 'Lunch') return `Lunch ${dateTitle}`;
  if (timePreference === 'Late night') return `${titleDate} Night Out`;
  if (intent === 'activity') return `${titleDate} Activity`;
  if (intent === 'food') return `${titleDate} Food`;
  return `${titleDate || dateTitle} Outing`;
}

function rsvpStatusLabel(status: RsvpStatus) {
  return RSVP_OPTIONS.find((option) => option.status === status)?.label || status;
}

function rsvpCountsFor(rsvps: Record<string, RsvpStatus> = {}) {
  return Object.values(rsvps).reduce<Record<RsvpStatus, number>>((counts, status) => {
    counts[status] += 1;
    return counts;
  }, { going: 0, maybe: 0, cant_make_it: 0 });
}

function rsvpSummaryText(rsvps: Record<string, RsvpStatus> = {}) {
  const counts = rsvpCountsFor(rsvps);
  return `${counts.going} Going | ${counts.maybe} Maybe | ${counts.cant_make_it} Can't make it`;
}

function betaPlanLocationLabel(plan: BetaPlanRecord) {
  return plan.locationLabel || plan.searchLocation?.label || plan.routeOriginLabel || 'Location TBD';
}

function betaPlanDateLabel(plan: BetaPlanRecord) {
  return absoluteDateRangeLabel(plan.planDateStart, plan.planDateEnd) ||
    dateWindowLabel(plan.dateWindow, new Date(plan.createdAt), plan.customDateRange);
}

function betaPlanFinalLabel(plan: BetaPlanRecord) {
  const finalStops = plan.status === 'finalized' ? plan.stops : [];
  if (finalStops.length) {
    return finalStops.map((stop) => cardToName(stop.item)).filter(Boolean).join(' + ');
  }
  const finalSuggestion = plan.suggestions.find((suggestion) => plan.finalizedSuggestionIds.includes(suggestion.id));
  return finalSuggestion ? cardToName(finalSuggestion.item) || 'Final option' : '';
}

function publicBetaPlanSnapshot(plan: BetaPlanRecord): BetaPlanRecord {
  return {
    ...plan,
    suggestions: plan.suggestions.slice(0, 30),
    stops: plan.stops.slice(0, 8),
  };
}

function encodeBetaPlanSnapshot(plan: BetaPlanRecord) {
  return encodeURIComponent(JSON.stringify(publicBetaPlanSnapshot(plan)));
}

function decodeBetaPlanSnapshot(rawValue?: string | null) {
  if (!rawValue) return null;
  const candidates = [rawValue];
  try {
    candidates.push(decodeURIComponent(rawValue));
  } catch {
    // Already decoded by URLSearchParams.
  }
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as BetaPlanRecord;
      if (parsed?.id && parsed?.title) {
        return {
          ...parsed,
          participants: parsed.participants || [],
          suggestions: parsed.suggestions || [],
          finalizedSuggestionIds: parsed.finalizedSuggestionIds || [],
          rsvps: parsed.rsvps || {},
          stops: parsed.stops || [],
          status: parsed.status || 'planning',
        };
      }
    } catch {
      // Try the next representation.
    }
  }
  return null;
}

function sharedBetaPlanFromCurrentWebUrl() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  const query = new URLSearchParams(window.location.search);
  const queryPlan = decodeBetaPlanSnapshot(query.get('shared_plan'));
  if (queryPlan) return queryPlan;
  const hash = window.location.hash.replace(/^#/, '');
  const hashParams = new URLSearchParams(hash);
  return decodeBetaPlanSnapshot(hashParams.get('shared_plan') || hashParams.get('plan'));
}

function betaPlanShareUrl(plan: BetaPlanRecord) {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return undefined;
  const baseUrl = `${window.location.origin}${window.location.pathname}`;
  return `${baseUrl}#shared_plan=${encodeBetaPlanSnapshot(plan)}`;
}

function betaPlanShareMessage(plan: BetaPlanRecord) {
  if (plan.stops.length) {
    return plan.stops
      .map((stop, index) => {
        const name = cardToName(stop.item) || 'Stop';
        const firstStopTime = index === 0 && plan.timeWindow ? parsePlanningTimeWindow(plan.timeWindow) : undefined;
        const timeLabel = firstStopTime ? formatClockTime(clockTimeFromMinutes(firstStopTime.start)) : '';
        return [timeLabel, name].filter(Boolean).join(' ');
      })
      .join('\n');
  }
  return betaPlanFinalLabel(plan) || plan.title || 'Plan';
}

function confirmedPlanFromBetaRecord(record: BetaPlanRecord): ConfirmedPlan {
  return {
    title: record.title,
    sharedPlanId: record.id,
    owner: record.owner,
    invitees: record.participants.filter((name) => name !== record.owner),
    intent: record.intent,
    stops: record.stops || [],
    status: record.status === 'finalized' ? 'locked' : 'draft',
    savedPlanId: record.savedPlanId,
    dateWindow: record.dateWindow,
    customDateRange: record.customDateRange || null,
    planDateStart: record.planDateStart,
    planDateEnd: record.planDateEnd,
    timeWindow: record.timeWindow,
    routeOriginLabel: record.routeOriginLabel,
    routeStartLocation: record.routeStartLocation,
    searchLocation: record.searchLocation,
    searchLocationLabel: record.locationLabel,
    rsvps: record.rsvps,
    participantSuggestions: record.suggestions,
    finalizedSuggestionIds: record.finalizedSuggestionIds,
  };
}

function toIcsUtc(ms: number) {
  return new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function escapeIcsText(value?: string) {
  return (value || '')
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

function calendarRangeForBetaPlan(plan: BetaPlanRecord) {
  const parsedWindow = plan.timeWindow ? parsePlanningTimeWindow(plan.timeWindow) : undefined;
  const startClock = parsedWindow?.start ?? 18 * 60;
  const endClock = parsedWindow?.end ?? startClock + 180;
  const startsAt = localDateClockMs(plan.planDateStart, startClock);
  const endsAt = localDateClockMs(plan.planDateStart, Math.max(endClock, startClock + 60));
  return { startsAt, endsAt };
}

function betaPlanIcs(plan: BetaPlanRecord, shareUrl?: string) {
  const { startsAt, endsAt } = calendarRangeForBetaPlan(plan);
  const finalLabel = betaPlanFinalLabel(plan);
  const notes = [
    finalLabel ? `Final plan: ${finalLabel}` : undefined,
    rsvpSummaryText(plan.rsvps),
    shareUrl,
    'Shared from NomNomGo',
  ].filter(Boolean).join('\n');
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//NomNomGo//Closed Beta MVP//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${escapeIcsText(plan.id)}@nomnomgo`,
    `DTSTAMP:${toIcsUtc(Date.now())}`,
    `DTSTART:${toIcsUtc(startsAt)}`,
    `DTEND:${toIcsUtc(endsAt)}`,
    `SUMMARY:${escapeIcsText(plan.title)}`,
    `LOCATION:${escapeIcsText(finalLabel || betaPlanLocationLabel(plan))}`,
    `DESCRIPTION:${escapeIcsText(notes)}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

function safeCalendarFileName(title: string) {
  const safe = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48);
  return `${safe || 'nomnomgo-plan'}.ics`;
}

const DARK_WEB_BACKGROUND = colors.background;

type AlphaGateState = 'checking' | 'allowed' | 'locked';

function isLocalWebHost(hostname: string) {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (normalized === 'localhost' || normalized === '127.0.0.1' || normalized === '0.0.0.0' || normalized === '::1') return true;
  if (normalized.endsWith('.local')) return true;
  if (/^10\./.test(normalized) || /^192\.168\./.test(normalized)) return true;
  return /^172\.(1[6-9]|2\d|3[01])\./.test(normalized);
}

function shouldApplyAlphaGate() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return false;
  if (__DEV__) return false;
  const hostname = window.location.hostname.toLowerCase();
  return Boolean(hostname) && !isLocalWebHost(hostname);
}

function getLaunchTokenFromUrl() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search).get(LAUNCH_TOKEN_PARAM);
}

function removeLaunchTokenFromUrl() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  if (!url.searchParams.has(LAUNCH_TOKEN_PARAM)) return;
  url.searchParams.delete(LAUNCH_TOKEN_PARAM);
  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
}

function useWebDocumentSurface(backgroundColor: string) {
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;

    const root = document.getElementById('root');
    const viewport = document.querySelector('meta[name="viewport"]');
    const viewportContent = viewport?.getAttribute('content') || '';
    const focusStyleId = 'nomnomgo-focus-styles';
    let focusStyle = document.getElementById(focusStyleId) as HTMLStyleElement | null;

    if (!focusStyle) {
      focusStyle = document.createElement('style');
      focusStyle.id = focusStyleId;
      document.head.appendChild(focusStyle);
    }
    focusStyle.textContent = `
      :where(button, input, textarea, select, a, [role="button"], [role="tab"]):focus-visible {
        outline: 3px solid ${colors.focus} !important;
        outline-offset: 3px !important;
      }
      :where(input, textarea, select):focus-visible {
        border-color: ${colors.focus} !important;
      }
    `;

    document.documentElement.style.backgroundColor = backgroundColor;
    document.documentElement.style.minHeight = '100%';
    document.body.style.backgroundColor = backgroundColor;
    document.body.style.margin = '0';
    document.body.style.minHeight = '100%';

    if (root) {
      root.style.backgroundColor = backgroundColor;
      root.style.minHeight = '100dvh';
    }

    if (viewport && !viewportContent.includes('viewport-fit=cover')) {
      viewport.setAttribute('content', viewportContent ? `${viewportContent}, viewport-fit=cover` : 'viewport-fit=cover');
    }
  }, [backgroundColor]);
}

function openDifferanceLaunch() {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const pendingPlan = planIdFromUrl();
    if (pendingPlan) {
      try { window.sessionStorage.setItem('nngPendingPlan', pendingPlan); } catch { /* Optional redirect recovery. */ }
    }
    if (window.location.hash.includes('shared_plan=')) {
      try { window.sessionStorage.setItem('nngPendingShare', window.location.hash); } catch { /* Browser storage may be disabled. */ }
    }
    window.location.assign(DIFFERANCE_NOMNOMGO_LAUNCH_URL);
    return;
  }
  void Linking.openURL(DIFFERANCE_NOMNOMGO_LAUNCH_URL);
}

async function validateLaunchToken(token: string) {
  return fetch('/api/alpha-launch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ token }),
  });
}

async function validateAlphaSession() {
  return fetch('/api/alpha-session', {
    method: 'GET',
    credentials: 'include',
  });
}

function AlphaAccessGate({ children }: { children: React.ReactNode }) {
  const isLightMode = false;
  const isDarkMode = true;
  useWebDocumentSurface(DARK_WEB_BACKGROUND);
  const [gateState, setGateState] = useState<AlphaGateState>(() => (shouldApplyAlphaGate() ? 'checking' : 'allowed'));
  const [gateError, setGateError] = useState('');

  useEffect(() => {
    if (!shouldApplyAlphaGate()) {
      setGateState('allowed');
      return;
    }

    let active = true;

    async function checkAccess() {
      const launchToken = getLaunchTokenFromUrl();
      if (launchToken) removeLaunchTokenFromUrl();

      try {
        const response = launchToken ? await validateLaunchToken(launchToken) : await validateAlphaSession();
        const hasAccess = await responseGrantsAlphaAccess(response);
        if (hasAccess) {
          await initializeAlphaAccount();
          try {
            const pendingPlan = window.sessionStorage.getItem('nngPendingPlan');
            if (pendingPlan && !planIdFromUrl()) {
              const url = new URL(window.location.href);
              url.searchParams.set('plan', pendingPlan);
              window.history.replaceState({}, '', url.toString());
            }
            window.sessionStorage.removeItem('nngPendingPlan');
            const pendingShare = window.sessionStorage.getItem('nngPendingShare');
            if (pendingShare && !window.location.hash) window.history.replaceState({}, '', `${window.location.pathname}${window.location.search}${pendingShare}`);
            window.sessionStorage.removeItem('nngPendingShare');
          } catch { /* Sharing still works without optional browser storage. */ }
        }
        if (active) setGateState(hasAccess ? 'allowed' : 'locked');
      } catch (error) {
        if (active) {
          setGateError(error instanceof Error ? error.message : 'Your account could not be loaded. Please try again.');
          setGateState('locked');
        }
      }
    }

    void checkAccess();

    return () => {
      active = false;
    };
  }, []);

  if (gateState === 'allowed') return <>{children}</>;

  return (
    <SafeAreaView style={[styles.safeArea, isLightMode && styles.lightScreen, isDarkMode && styles.darkScreen]} edges={['top', 'bottom', 'left', 'right']}>
      <View style={styles.alphaGateShell}>
        <View style={[styles.authCard, Platform.OS === 'web' && styles.webAuthCard, isDarkMode && styles.darkPanel]}>
          {gateState === 'checking' ? (
            <View style={styles.authCentered}>
              <ActivityIndicator color={colors.coral} />
              <Text style={[styles.authHint, isDarkMode && styles.darkMutedText]}>Checking NomNomGo alpha access</Text>
            </View>
          ) : (
            <>
              <Text style={[styles.authTitle, isDarkMode && styles.darkText]}>NomNomGo is currently in private alpha.</Text>
              <Text style={[styles.authCopy, isDarkMode && styles.darkMutedText]}>
                {gateError || 'Launch NomNomGo from Differance Labs to continue.'}
              </Text>
              <Button label="Open with Differance Labs" onPress={openDifferanceLaunch} primary />
            </>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

function ItineraryInsertionIndicator({ activeAnimationProgress, style }: DropIndicatorComponentProps) {
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: activeAnimationProgress.value,
  }));
  return <Animated.View style={[style, styles.itineraryInsertionIndicator, animatedStyle]} />;
}

function NomNomGoApp() {
  const [sharedWorkspace, setSharedWorkspace] = useState<{ id?: string; plan?: SharedPlan } | null>(() => {
    const id = getAlphaAccount() ? planIdFromUrl() : null;
    return id ? { id } : null;
  });
  const sharedPublishingRef = useRef(false);
  const [accountSaveError, setAccountSaveError] = useState('');
  useEffect(() => subscribeAccountSaveError(setAccountSaveError), []);
  const scrollRef = useAnimatedRef<React.ComponentRef<typeof Animated.ScrollView>>();
  const manualSearchRef = useRef<TextInput | null>(null);
  const resultsYRef = useRef(0);
  const planBoxYRef = useRef(0);
  const savedPlansYRef = useRef(0);
  const timelineYRef = useRef(0);
  const stopLayoutYRef = useRef<Record<string, number>>({});
  const searchRequestIdRef = useRef(0);
  const searchExecutionRef = useRef<SearchExecution | null>(null);
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const searchCacheWriteRef = useRef<Promise<void>>(Promise.resolve());
  const activePlanTimingRef = useRef<{
    dateRange: { start: string; end: string };
    timeWindow?: string;
    timePreference: string;
  }>({ dateRange: { start: '', end: '' }, timePreference: 'Now' });
  const betaPlanRecordBuilderRef = useRef<((base?: BetaPlanRecord | null) => BetaPlanRecord) | null>(null);
  const isLightMode = false;
  const isDarkMode = true;
  const [selectedMoods, setSelectedMoods] = useState<string[]>(['Easy']);
  const [selectedTime, setSelectedTime] = useState('Now');
  const [selectedDateWindow, setSelectedDateWindow] = useState<DateWindowId>('today');
  const selectedDateWindowRef = useRef<DateWindowId>('today');
  const customDateRangeRef = useRef<CustomDateRange | null>(null);
  const [customDateRange, setCustomDateRange] = useState<CustomDateRange | null>(null);
  const [customDateStartInput, setCustomDateStartInput] = useState(formatDateInput(new Date()));
  const [customDateEndInput, setCustomDateEndInput] = useState(formatDateInput(addLocalDays(new Date(), 6)));
  const [customDateOpen, setCustomDateOpen] = useState(false);
  const [selectedWeather, setSelectedWeather] = useState('Mild');
  const [selectedFoods, setSelectedFoods] = useState<string[]>(() => [...DEFAULT_FOOD_SELECTIONS]);
  const [selectedActivities, setSelectedActivities] = useState<string[]>(() => [...DEFAULT_ACTIVITY_SELECTIONS]);
  const [selectedDietary, setSelectedDietary] = useState<string[]>(() => [...DEFAULT_DIETARY_SELECTIONS]);
  const [plan, setPlan] = useState<ConfirmedPlan>(EMPTY_PLAN);
  const [cards, setCards] = useState<PlaceCard[]>([]);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [searchNotice, setSearchNotice] = useState('');
  const [searchFailed, setSearchFailed] = useState(false);
  const [appNotice, setAppNotice] = useState<{ title: string; message: string } | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [location, setLocation] = useState<LatLon | null>(null);
  const [searchLocation, setSearchLocation] = useState<LatLon | null>(null);
  const [areaSelection, setAreaSelection] = useState<{ kind: AreaKind | 'whole'; requestId: number } | null>(null);
  const [lastSearchLocationCenter, setLastSearchLocationCenter] = useState<LatLon | null>(null);
  const [manualSearch, setManualSearch] = useState('');
  const [manualSearchSubmitted, setManualSearchSubmitted] = useState(false);
  const routeOriginOverrideRef = useRef('');
  const [routeOriginOverride, setRouteOriginOverride] = useState('');
  const [searchLocationOverride, setSearchLocationOverride] = useState('');
  const [locationOverrideOpen, setLocationOverrideOpen] = useState(false);
  const [searchLocationOverrideOpen, setSearchLocationOverrideOpen] = useState(false);
  const [memory, setMemory] = useState<LocalMemory>(INITIAL_MEMORY);
  const [planTimes, setPlanTimes] = useState<Record<string, StopTime | undefined>>({});
  const [arrivalTimes, setArrivalTimes] = useState<Record<string, StopTime | undefined>>({});
  const [timeEditorKey, setTimeEditorKey] = useState<string | null>(null);
  const [expandedStopKey, setExpandedStopKey] = useState<string | null>(null);
  const [addStopMenuOpen, setAddStopMenuOpen] = useState(false);
  const [itineraryListWidth, setItineraryListWidth] = useState<number>();
  const [ideaDraft, setIdeaDraft] = useState('');
  const [pendingVisualType, setPendingVisualType] = useState<ItineraryStopKind | undefined>();
  const [searchVisualType, setSearchVisualType] = useState<ItineraryStopKind | undefined>();
  const [recentlyAddedStopKey, setRecentlyAddedStopKey] = useState<string | null>(null);
  const [resultMode, setResultMode] = useState<PlanSlot>('food');
  const [resultFilter, setResultFilter] = useState<ResultFilter>('all');
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [advancedPreferencesOpen, setAdvancedPreferencesOpen] = useState(false);
  const [expandedPreferenceGroups, setExpandedPreferenceGroups] = useState<Record<string, boolean>>({});
  const [planSettingsOpen, setPlanSettingsOpen] = useState(false);
  const [hasInitiatedSearch, setHasInitiatedSearch] = useState(false);
  const [sharePreviewOpen, setSharePreviewOpen] = useState(false);
  const [planPreviewOpen, setPlanPreviewOpen] = useState(false);
  const [quickShareTarget, setQuickShareTarget] = useState<QuickShareTarget | null>(null);
  const [placeDetailCard, setPlaceDetailCard] = useState<PlaceCard | null>(null);
  const placeDetailRequestRef = useRef(0);
  useEffect(() => {
    if (!placeDetailCard?.id || placeDetailCard.kind === 'event') return;
    const timer = setInterval(() => {
      if (activePlanTimingRef.current.timeWindow) return;
      setPlaceDetailCard((card) => card ? { ...card, ...currentHoursDisplay(card) } : card);
    }, 30_000);
    return () => clearInterval(timer);
  }, [placeDetailCard?.id, placeDetailCard?.kind]);
  const [routeOptionsOpen, setRouteOptionsOpen] = useState(false);
  const [pendingConfirmation, setPendingConfirmation] = useState<{
    title: string;
    message: string;
    confirmLabel: string;
    action: () => void;
  } | null>(null);
  const [savedPlans, setSavedPlans] = useState<SavedPlan[]>([]);
  const savedPlansRef = useRef<SavedPlan[]>([]);
  const [savedPlansOpen, setSavedPlansOpen] = useState(false);
  const [homeOpen, setHomeOpen] = useState(true);
  const [savedPlansLandingOpen, setSavedPlansLandingOpen] = useState(false);
  const [savedPlansNavigationSource, setSavedPlansNavigationSource] = useState<'plans' | 'saved'>('saved');
  const [planSetupOpen, setPlanSetupOpen] = useState(false);
  const [planSetupTiming, setPlanSetupTiming] = useState<'now' | 'later'>('now');
  const [planSetupName, setPlanSetupName] = useState('');
  const [planSetupIntent, setPlanSetupIntent] = useState<PlanningIntent>('both');
  const [planSetupDateWindow, setPlanSetupDateWindow] = useState<DateWindowId>('today');
  const [planSetupCustomDateStartInput, setPlanSetupCustomDateStartInput] = useState(formatDateInput(new Date()));
  const [planSetupCustomDateEndInput, setPlanSetupCustomDateEndInput] = useState(formatDateInput(addLocalDays(new Date(), 6)));
  const [planSetupTime, setPlanSetupTime] = useState('Now');
  const [planSetupWhere, setPlanSetupWhere] = useState('Current location');
  const [planSetupStartingLocation, setPlanSetupStartingLocation] = useState('Current location');
  const [planSetupInvitees, setPlanSetupInvitees] = useState<string[]>([]);
  const [planSetupSubmitting, setPlanSetupSubmitting] = useState(false);
  const [nowMode, setNowMode] = useState<NowExperienceMode>('closed');
  const [nowFoodCategory, setNowFoodCategory] = useState(NOW_FOOD_CATEGORIES[0]);
  const [nowActivityCategory, setNowActivityCategory] = useState(NOW_ACTIVITY_CATEGORIES[0]);
  const [nowSelectedPeople, setNowSelectedPeople] = useState<string[]>([]);
  const [nowPeoplePickerOpen, setNowPeoplePickerOpen] = useState(false);
  const [nowPlanCreating, setNowPlanCreating] = useState(false);
  const [suggestedPairingsOpen, setSuggestedPairingsOpen] = useState(true);
  const [suggestedPairingsExpanded, setSuggestedPairingsExpanded] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [accountSettingsOpen, setAccountSettingsOpen] = useState(false);
  const [peopleGroupsOpen, setPeopleGroupsOpen] = useState(false);
  const [planPeopleOpen, setPlanPeopleOpen] = useState(false);
  const [authLoaded, setAuthLoaded] = useState(false);
  const [testerUser, setTesterUser] = useState<TesterUser | null>(null);
  const [testerAuthenticated, setTesterAuthenticated] = useState(false);
  const [usageMeter, setUsageMeter] = useState<UsageMeter>(emptyUsageMeter());
  const usageMeterRef = useRef(usageMeter);
  usageMeterRef.current = usageMeter;
  const [planningSessions, setPlanningSessions] = useState<PlanningSession[]>([]);
  const [activePlanningSessionId, setActivePlanningSessionId] = useState<string | null>(null);
  const [betaPlans, setBetaPlans] = useState<BetaPlanRecord[]>([]);
  const betaPlansRef = useRef<BetaPlanRecord[]>([]);
  const [activeBetaPlanId, setActiveBetaPlanId] = useState<string | null>(null);
  const [visitorBetaPlan, setVisitorBetaPlan] = useState<BetaPlanRecord | null>(null);
  const [visitorName, setVisitorName] = useState('');
  const [betaSuggestionInput, setBetaSuggestionInput] = useState('');
  const [sessionBuilderOpen, setSessionBuilderOpen] = useState(false);
  const [sessionInvitees, setSessionInvitees] = useState<string[]>([]);
  const [sessionLocationInput, setSessionLocationInput] = useState('');
  const [sessionTimeWindowInput, setSessionTimeWindowInput] = useState(defaultTimeWindowForPreference('Dinner'));
  const [sessionIntent, setSessionIntent] = useState<PlanningIntent>('both');
  const [sessionManualSuggestion, setSessionManualSuggestion] = useState('');
  const [routeImportOpen, setRouteImportOpen] = useState(false);
  const [routeImportUrl, setRouteImportUrl] = useState('');
  const [routeImportError, setRouteImportError] = useState('');
  const [routeImporting, setRouteImporting] = useState(false);
  selectedDateWindowRef.current = selectedDateWindow;
  customDateRangeRef.current = customDateRange;
  routeOriginOverrideRef.current = routeOriginOverride;
  savedPlansRef.current = savedPlans;
  betaPlansRef.current = betaPlans;

  const keyLoaded = Boolean(GOOGLE_API_KEY);
  const savedFavoriteResultCards = Object.values(memory.favoriteCards || {})
    .filter((entry) => entry.slot === resultMode)
    .filter((entry) => memory.favorites.includes(entry.card.id))
    .filter((entry) => !(resultMode === 'activity' && isBadActivityResult(entry.card)))
    .filter((entry) => favoriteMatchesSearchLocation(entry, lastSearchLocationCenter))
    .map((entry) => entry.card);
  const favoriteOnlyCards = [...cards.filter((card) => memory.favorites.includes(card.id))];
  savedFavoriteResultCards.forEach((card) => {
    if (!favoriteOnlyCards.some((item) => item.id === card.id)) favoriteOnlyCards.push(card);
  });
  const filteredCards = resultFilter === 'favorites' ? favoriteOnlyCards : cards;
  const shownCards = filteredCards.slice(0, visibleCount);
  const nowExperienceActive = nowMode !== 'closed';
  const nowDiscovering = nowMode === 'food' || nowMode === 'activity';
  const nowCategoryLabel = nowMode === 'food' ? nowFoodCategory : nowMode === 'activity' ? nowActivityCategory : '';
  const foodItems = planItems(plan, 'food');
  const activityItems = planItems(plan, 'activity');
  const hasFood = foodItems.length > 0;
  const hasActivity = activityItems.length > 0;
  const activeFood = hasFood;
  const activeActivity = hasActivity;
  const activeStopCount = plan.stops.length;
  const hasAnyActiveStop = activeFood || activeActivity;
  const titleForResults = nowDiscovering
    ? resultMode === 'food'
      ? `Nearby ${nowFoodCategory.toLowerCase()}`
      : `Nearby ${nowActivityCategory.toLowerCase()}`
    : resultMode === 'food'
      ? 'Food places'
      : activeFood
        ? 'Activities near your food'
        : 'Activity options';
  const selectedCards = resultMode === 'food' ? foodItems : activityItems;
  const dateWindowOptions = useMemo(() => DATE_WINDOW_IDS.map((id) => ({ id, label: dateWindowLabel(id, new Date(), customDateRange) })), [customDateRange]);
  const setupDateWindowOptions = useMemo(() => DATE_WINDOW_IDS.map((id) => ({
    id,
    label: id === 'custom' ? 'Choose dates' : dateWindowLabel(id, new Date(), null),
  })), []);
  const planSetupPreviewCustomRange = planSetupDateWindow === 'custom'
    ? { start: planSetupCustomDateStartInput, end: planSetupCustomDateEndInput }
    : null;
  const planSetupPreviewDateRange = dateRangeKeysForWindow(planSetupDateWindow, planSetupPreviewCustomRange, new Date());
  const planSetupPreviewType = inferPlanType({
    planDateStart: planSetupPreviewDateRange.start,
    planDateEnd: planSetupPreviewDateRange.end,
    destinationLabel: planSetupWhere,
  });
  const selectedDateWindowText = dateWindowLabel(selectedDateWindow, new Date(), customDateRange);
  const currentTesterName = testerUser?.name || 'Tester';
  const activeBetaPlan = betaPlans.find((betaPlan) => betaPlan.id === activeBetaPlanId) || null;
  let activePlanningSession: PlanningSession | null = null;
  if (GROUP_SESSION_ENABLED) {
    activePlanningSession = planningSessions.find((session) =>
      session.id === activePlanningSessionId && session.participants.includes(currentTesterName),
    ) || null;
  }
  const currentSessionRouteContext = activePlanningSession?.routeContexts?.[currentTesterName];
  const activeSearchLocation = activePlanningSession?.searchLocation || searchLocation;
  const startingLocationLabel = currentSessionRouteContext?.originLabel || routeOriginOverride.trim() || location?.label || 'Current location';
  const routeStartLocation = currentSessionRouteContext?.location || location || undefined;
  const lastStopDistanceAnchor = stopSearchCenter(plan.stops[plan.stops.length - 1]);
  const resultDistanceAnchor = lastStopDistanceAnchor || lastSearchLocationCenter || activeSearchLocation || routeStartLocation || undefined;
  const resultDistanceContext = lastStopDistanceAnchor
    ? 'from last stop'
    : lastSearchLocationCenter || activeSearchLocation
        ? 'from search area'
        : routeStartLocation
          ? 'from start'
          : undefined;
  const searchLocationLabel = activePlanningSession?.locationLabel || searchLocationOverride.trim() || searchLocation?.label || startingLocationLabel;
  const selectedPreferenceTimeWindow = selectedTime === 'Now' ? undefined : defaultTimeWindowForPreference(selectedTime);
  const activePlanDateWindow = plan.dateWindow || selectedDateWindow;
  const activePlanCustomDateRange = plan.customDateRange ?? customDateRange;
  const activePlanDateRange = plan.planDateStart && plan.planDateEnd
    ? { start: plan.planDateStart, end: plan.planDateEnd }
    : dateRangeKeysForWindow(activePlanDateWindow, activePlanCustomDateRange);
  const activePlanDateLabel = absoluteDateRangeLabel(activePlanDateRange.start, activePlanDateRange.end) ||
    dateWindowLabel(activePlanDateWindow, new Date(), activePlanCustomDateRange);
  const activePlanTimeWindow = plan.timeWindow || selectedPreferenceTimeWindow;
  const activePlanTimePreference = timePreferenceForWindow(activePlanTimeWindow, selectedTime);
  activePlanTimingRef.current = {
    dateRange: activePlanDateRange,
    timeWindow: activePlanTimeWindow,
    timePreference: activePlanTimePreference,
  };
  const cardForActivePlanTiming = (card: PlaceCard): PlaceCard => {
    if (card.kind === 'event') return card;
    const timing = activePlanTimingRef.current;
    if (!timing.timeWindow) {
      return {
        ...card,
        ...currentHoursDisplay(card),
      };
    }

    const weeklyHours = weeklyHoursForDate(card, timing.dateRange.start);
    const planAvailability = placeOpenDuringWindow(weeklyHours, timing.dateRange.start, timing.timeWindow);
    const plannedDayHours = hoursLineForDate(weeklyHours, timing.dateRange.start);
    return {
      ...card,
      isOpen: planAvailability ?? null,
      hoursText: planAvailability === true
        ? 'Open at planned time'
        : planAvailability === false
          ? 'Closed at planned time'
          : plannedDayHours ? 'Hours available' : 'Hours unknown',
      todayHours: plannedDayHours,
    };
  };
  const activePlanType = inferPlanType({
    planDateStart: activePlanDateRange.start,
    planDateEnd: activePlanDateRange.end,
    destinationLabel: searchLocationLabel,
    title: plan.title,
  });
  const activeRoadTripMode = inferRoadTripMode({
    planType: activePlanType,
    destinationLabel: searchLocationLabel,
    startingLocationLabel,
    routeProvider: plan.routeProvider,
    sourceUrl: plan.sourceUrl,
    stops: plan.stops,
    currentRoadTripMode: plan.roadTripMode,
  });
  const activeChargingStops = chargingStopIdeasFromStops(plan.stops, plan.chargingStops || []);
  const activeNearbyPlacesDuringCharging = plan.nearbyPlacesDuringCharging || [];
  const activeVehicleProfile = vehicleProfileForPlan(activeRoadTripMode, plan.vehicleProfile, plan.stops, searchLocationLabel);
  const activePlanTimelineBaseMs = (() => {
    const parsedWindow = activePlanTimeWindow ? parsePlanningTimeWindow(activePlanTimeWindow) : undefined;
    if (parsedWindow) return localDateClockMs(activePlanDateRange.start, parsedWindow.start);
    const now = new Date();
    return localDateClockMs(activePlanDateRange.start, now.getHours() * 60 + now.getMinutes());
  })();
  const activePlanPeopleSummary = (plan.invitees || []).length ? unique([currentTesterName, ...(plan.invitees || [])]).join(', ') : 'Just me';
  const activePlanTimeLabel = activePlanTimePreference || 'Time TBD';
  const activePlanDateToken = conciseDateTitle(activePlanDateWindow, activePlanDateRange.start, activePlanCustomDateRange);
  const activePlanTimingLabel = activePlanDateWindow === 'today'
    ? activePlanTimeLabel
    : [activePlanTimeLabel, activePlanDateToken].filter(Boolean).join(' ');
  const activePlanContextLabel = [activePlanTimingLabel, activePlanPeopleSummary].filter(Boolean).join(' | ');
  const planHeaderMeta = [
    plan.routeProvider === 'google_maps' ? 'Google Maps draft route' : undefined,
    activeRoadTripMode ? 'Road trip' : undefined,
    activePlanContextLabel,
    searchLocationLabel,
    plan.stops.length ? `${plan.stops.length} stop${plan.stops.length === 1 ? '' : 's'}` : undefined,
  ].filter(Boolean).join(' | ');
  const showChargingStopIdeas = BETA_FEATURES.roadTrips &&
    (activePlanType === 'trip_plan' || activeRoadTripMode || activeChargingStops.length > 0);
  const planSettingsSummary = startingLocationLabel === searchLocationLabel
    ? `${activePlanDateLabel} | ${startingLocationLabel}`
    : `${activePlanDateLabel} | Start ${startingLocationLabel} | Search ${searchLocationLabel}`;
  const userPlanningSessions = planningSessions.filter((session) => session.participants.includes(currentTesterName));
  const foodSuggestions = activePlanningSession?.suggestions.filter((suggestion) => suggestion.slot === 'food') || [];
  const activitySuggestions = activePlanningSession?.suggestions.filter((suggestion) => suggestion.slot === 'activity') || [];
  const isPlanningOwner = activePlanningSession?.owner === currentTesterName;
  const planningSuggestionMode = Boolean(activePlanningSession && activePlanningSession.status === 'planning');
  const visibleSavedPlans = savedPlans.filter((saved) => {
    if (saved.source === 'shared') return saved.sharedTo === currentTesterName;
    return (saved.owner || saved.sharedBy || 'BDM') === currentTesterName;
  });
  const savedArrivalClockTime = (saved: SavedPlan, stop: ItineraryStop) => {
    const savedArrival = saved.arrivalTimes?.[stop.key];
    if (!savedArrival) return undefined;
    return saved.timeSchema === 'clock-arrivals-v1'
      ? savedArrival
      : clockTimeFromRelativeStopTime(savedArrival, saved.createdAt);
  };
  const savedPlanStopsLabel = (saved: SavedPlan) => {
    const stops = saved.stops.map((stop) => {
      const name = cardToName(stop.item);
      if (!name) return undefined;
      const arrival = savedArrivalClockTime(saved, stop);
      const place = cityStateLabel(cityStateForPlace(stop.item));
      const labeledName = place ? `${name} (${place})` : name;
      return arrival ? `${formatClockTime(arrival)} ${labeledName}` : labeledName;
    }).filter(Boolean);
    return stops.join(' - ') || 'No stops';
  };

  const durationForStop = (stop: ItineraryStop) => {
    const storedMinutes = typeof stop.durationMinutes === 'number' && stop.durationMinutes > 0
      ? stop.durationMinutes
      : (planTimes[stop.key]?.hours || 0) * 60 + (planTimes[stop.key]?.minutes || 0);
    return snapStopDurationMinutes(storedMinutes || defaultStopDurationMinutes(stop));
  };

  const effectiveTravelModeForStop = (stop: ItineraryStop, index: number): StopTravelMode => {
    return effectivePlanStopTravelMode(plan.stops, index);
  };

  const itineraryTimelineInputs = (() => {
    let from = routeStartLocation;
    let previousCoords: LatLon | undefined;

    return plan.stops.map((stop, index) => {
      const travelMode = effectiveTravelModeForStop(stop, index);
      const walkableAfterTesla = travelMode === 'walk' && isWalkableAfterTeslaStop(plan.stops[index - 1], stop);
      const travelMinutes = estimateTravelMinutes(from, stop.item, travelMode);
      const currentCoords = stopCoords(stop.item);
      from = walkableAfterTesla && previousCoords ? previousCoords : currentCoords;
      previousCoords = currentCoords;
      return {
        durationMinutes: durationForStop(stop),
        overlapsPreviousArrival: walkableAfterTesla,
        travelMinutes,
      };
    });
  })();
  const itineraryTimeline = calculateItineraryTimeline(itineraryTimelineInputs);
  const travelMinutesForStop = (_stop: ItineraryStop, index: number) =>
    itineraryTimeline.stops[index]?.travelMinutes ?? 0;
  const itineraryArrivalMinutes = (targetIndex: number) =>
    itineraryTimeline.stops[targetIndex]?.arrivalMinutes ?? 0;

  const stepDetail = (stop: ItineraryStop, index: number) => {
    const arrival = formatClockAfterMinutes(itineraryArrivalMinutes(index), activePlanTimelineBaseMs);
    const stay = formatStopTime(stopTimeFromMinutes(durationForStop(stop)));
    return `Est. ${arrival} - ${stay} stop`;
  };
  const travelMetaForStop = (stop: ItineraryStop, index: number) => {
    const mode = effectiveTravelModeForStop(stop, index);
    return {
      mode,
      icon: travelModeIconName(mode),
      label: travelModeLabel(mode),
      duration: formatStopTime(stopTimeFromMinutes(travelMinutesForStop(stop, index))) || '0 min',
    };
  };
  const searchRouteBiasForAnchorIndex = (anchorIndex: number): SearchRouteBias | undefined => {
    if (anchorIndex < 0) return undefined;
    const anchorStop = plan.stops[anchorIndex];
    const anchor = stopSearchCenter(anchorStop);
    if (!anchor || effectiveTravelModeForStop(anchorStop, anchorIndex) !== 'walk') return undefined;
    return {
      mode: 'walk',
      anchor,
      start: routeStartLocation,
    };
  };
  const resultRouteBias = lastStopDistanceAnchor ? searchRouteBiasForAnchorIndex(plan.stops.length - 1) : undefined;
  const displayedArrivalTimeForStop = (stop: ItineraryStop, index: number) =>
    (plan.status === 'locked' ? plan.lockedArrivalTimes?.[stop.key] : undefined) ||
    clockTimeFromMinutes(
      clockMinutes(clockTimeFromDate(new Date(activePlanTimelineBaseMs))) + itineraryArrivalMinutes(index),
    );
  const currentDisplayedArrivalTimes = () => {
    const next: Record<string, StopTime | undefined> = {};
    plan.stops.forEach((stop, index) => {
      next[stop.key] = displayedArrivalTimeForStop(stop, index);
    });
    return next;
  };
  const firstStop = plan.stops[0];
  const firstStopArrivalMinutes = firstStop ? itineraryArrivalMinutes(0) : undefined;
  const firstStopTravelMinutes = firstStop ? travelMinutesForStop(firstStop, 0) : undefined;
  const leaveForFirstStopText = firstStop && typeof firstStopArrivalMinutes === 'number' && typeof firstStopTravelMinutes === 'number'
    ? `Leave around ${formatClockAfterMinutes(Math.max(0, firstStopArrivalMinutes - firstStopTravelMinutes), activePlanTimelineBaseMs)} from ${startingLocationLabel}`
    : undefined;
  const finalStop = plan.stops[plan.stops.length - 1];
  const planTotalMinutes = finalStop ? itineraryTimeline.totalMinutes : 0;
  const planTotalTimeLabel = finalStop
    ? formatStopTime(stopTimeFromMinutes(planTotalMinutes)) || 'Under 1 min'
    : 'Not set';
  const planFinishTimeLabel = finalStop
    ? formatClockAfterMinutes(planTotalMinutes, activePlanTimelineBaseMs)
    : 'Not set';
  const planStartTimeLabel = finalStop
    ? formatClockAfterMinutes(0, activePlanTimelineBaseMs)
    : 'Not set';
  const parsedPlanTarget = activePlanTimeWindow ? parsePlanningTimeWindow(activePlanTimeWindow) : undefined;
  const targetDeltaMinutes = parsedPlanTarget
    ? parsedPlanTarget.end - parsedPlanTarget.start - planTotalMinutes
    : undefined;
  const targetStatus = typeof targetDeltaMinutes !== 'number'
    ? undefined
    : targetDeltaMinutes === 0
      ? { label: `Meets target ${formatClockTime(clockTimeFromMinutes(parsedPlanTarget!.end))}`, tone: 'near' as const }
      : targetDeltaMinutes > 0
        ? {
            label: `${targetDeltaMinutes} min before target ${formatClockTime(clockTimeFromMinutes(parsedPlanTarget!.end))}`,
            tone: targetDeltaMinutes <= 15 ? 'near' as const : 'under' as const,
          }
        : {
            label: `${Math.abs(targetDeltaMinutes)} min over target ${formatClockTime(clockTimeFromMinutes(parsedPlanTarget!.end))}`,
            tone: 'over' as const,
          };
  const activePlanDateTimeLabel = firstStop
    ? `${activePlanDateLabel} | First stop ${formatClockTime(displayedArrivalTimeForStop(firstStop, 0))}`
    : activePlanDateLabel;
  const shareStopLine = (stop: ItineraryStop, index: number) => {
    const time = formatClockTime(displayedArrivalTimeForStop(stop, index));
    const name = cardToName(stop.item) || 'Stop';
    return `${time} ${name}`;
  };
  const sharePlanText = () => {
    const lines = plan.stops.map((stop, index) => shareStopLine(stop, index));
    return lines.length ? lines.join('\n') : plan.title || 'Plan';
  };

  const addLog = (line: string) => {
    const stamp = new Date().toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
    });
    const msg = `${stamp} ${line}`;
    console.log(msg);
    setLogs((prev) => [msg, ...prev].slice(0, 180));
  };

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => {
      setToastMessage((current) => (current === message ? '' : current));
    }, 2200);
  };

  const notifyGooglePlacesMissing = (logLine: string, message = 'Place search is unavailable. You can add a place manually.') => {
    showToast(message);
    addLog(logLine);
  };

  const showAppNotice = (title: string, message: string) => {
    if (Platform.OS === 'web') setAppNotice({ title, message });
    else Alert.alert(title, message);
  };

  const resetResultsUntilSearch = () => {
    searchExecutionRef.current?.cancel();
    searchRequestIdRef.current += 1;
    setHasInitiatedSearch(false);
    setCards([]);
    setVisibleCount(PAGE_SIZE);
    setSearchNotice('');
    setSearchFailed(false);
    setLoading(false);
  };

  const beginSearch = (refresh = false) => {
    searchExecutionRef.current?.cancel();
    const execution = new SearchExecution(++searchRequestIdRef.current, refresh);
    searchExecutionRef.current = execution;
    setSearchFailed(false);
    setSearchNotice('');
    return execution;
  };

  const cancelSearch = () => {
    searchExecutionRef.current?.cancel();
    searchRequestIdRef.current += 1;
    setLoading(false);
    if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
  };

  useEffect(() => () => {
    searchExecutionRef.current?.cancel();
    if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
  }, []);

  const saveTesterUser = async (next: TesterUser | null) => {
    setTesterUser(next);
    if (next) {
      await AsyncStorage.setItem(STORAGE_TESTER_USER, JSON.stringify(next));
    } else {
      await AsyncStorage.removeItem(STORAGE_TESTER_USER);
    }
  };

  const saveUsageMeter = async (next: UsageMeter) => {
    usageMeterRef.current = next;
    setUsageMeter(next);
    await AsyncStorage.setItem(STORAGE_USAGE_METER, JSON.stringify(next));
  };

  const saveSavedPlans = async (nextOrUpdater: SavedPlan[] | ((current: SavedPlan[]) => SavedPlan[])) => {
    const next = typeof nextOrUpdater === 'function'
      ? nextOrUpdater(savedPlansRef.current)
      : nextOrUpdater;
    savedPlansRef.current = next;
    setSavedPlans(next);
    await AsyncStorage.setItem(STORAGE_SAVED_PLANS, JSON.stringify(next.slice(0, 40)));
  };

  const saveBetaPlans = async (nextOrUpdater: BetaPlanRecord[] | ((current: BetaPlanRecord[]) => BetaPlanRecord[])) => {
    const next = typeof nextOrUpdater === 'function'
      ? nextOrUpdater(betaPlansRef.current)
      : nextOrUpdater;
    const trimmed = next
      .slice()
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, 40);
    betaPlansRef.current = trimmed;
    setBetaPlans(trimmed);
    await AsyncStorage.setItem(STORAGE_BETA_PLANS, JSON.stringify(trimmed));
  };

  const saveActiveBetaPlan = async (id: string | null) => {
    setActiveBetaPlanId(id);
    if (id) {
      await AsyncStorage.setItem(STORAGE_ACTIVE_BETA_PLAN, JSON.stringify(id));
    } else {
      await AsyncStorage.removeItem(STORAGE_ACTIVE_BETA_PLAN);
    }
  };

  const patchBetaPlan = async (id: string, updater: (record: BetaPlanRecord) => BetaPlanRecord) => {
    let updatedRecord: BetaPlanRecord | null = null;
    await saveBetaPlans((current) => current.map((record) => {
      if (record.id !== id) return record;
      updatedRecord = { ...updater(record), updatedAt: Date.now() };
      return updatedRecord;
    }));
    if (updatedRecord && visitorBetaPlan?.id === id) setVisitorBetaPlan(updatedRecord);
    return updatedRecord;
  };

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return undefined;
    const openSharedPlanFromUrl = () => {
      const sharedPlan = sharedBetaPlanFromCurrentWebUrl();
      if (!sharedPlan) return;
      setVisitorBetaPlan(sharedPlan);
      void saveBetaPlans((current) => [sharedPlan, ...current.filter((record) => record.id !== sharedPlan.id)]);
    };
    window.addEventListener('hashchange', openSharedPlanFromUrl);
    return () => window.removeEventListener('hashchange', openSharedPlanFromUrl);
  }, []);

  const recordPlacesUsage = async (kind: 'nearby' | 'text') => {
    const current = normalizeUsageMeter(usageMeterRef.current);
    const next = {
      ...current,
      nearbySearchesToday: current.nearbySearchesToday + (kind === 'nearby' ? 1 : 0),
      textSearchesToday: current.textSearchesToday + (kind === 'text' ? 1 : 0),
      nearbySearchesMonth: current.nearbySearchesMonth + (kind === 'nearby' ? 1 : 0),
      textSearchesMonth: current.textSearchesMonth + (kind === 'text' ? 1 : 0),
      lastUpdated: Date.now(),
    };
    await saveUsageMeter(next);
  };

  const selectTester = async (name: string) => {
    const next = { name };
    await saveTesterUser(next);
    setTesterAuthenticated(true);
    addLog(`Tester selected: ${name}`);
  };

  const signOutTester = async () => {
    try {
      if (getAlphaAccount()) {
        await signOutAlphaAccount();
        if (Platform.OS === 'web') window.location.reload();
        return;
      }
      await AsyncStorage.removeItem(STORAGE_TESTER_USER);
      cancelSearch();
      closeTransientSurfaces();
      setTesterAuthenticated(false);
      addLog('Tester signed out');
    } catch {
      showToast('Could not sign out. Please try again.');
    }
  };

  const scheduleScroll = (target: () => number) => {
    if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
    scrollTimerRef.current = setTimeout(() => {
      scrollRef.current?.scrollTo({ y: Math.max(target(), 0), animated: true });
    }, 90);
  };

  const scrollToResults = () => {
    scheduleScroll(() => resultsYRef.current - 8);
  };

  const scrollToTop = () => {
    scheduleScroll(() => 0);
  };

  const scrollToPlan = () => {
    scheduleScroll(() => planBoxYRef.current - 8);
  };

  const scrollToSavedPlans = () => {
    scheduleScroll(() => savedPlansYRef.current - 8);
  };

  const scrollToPlanStop = (key: string) => {
    scheduleScroll(() => {
      const stopY = stopLayoutYRef.current[key];
      const targetY = typeof stopY === 'number'
        ? planBoxYRef.current + timelineYRef.current + stopY
        : planBoxYRef.current;
      return targetY - 8;
    });
  };

  const closeTransientSurfaces = () => {
    cancelSearch();
    setAccountMenuOpen(false);
    setAccountSettingsOpen(false);
    setPeopleGroupsOpen(false);
    setPlanPeopleOpen(false);
    setNowPeoplePickerOpen(false);
    setSharePreviewOpen(false);
    setPlanPreviewOpen(false);
    setQuickShareTarget(null);
    setPlaceDetailCard(null);
    setRouteOptionsOpen(false);
    setLocationOverrideOpen(false);
    setSearchLocationOverrideOpen(false);
    setCustomDateOpen(false);
    setRouteImportOpen(false);
  };

  const openHome = () => {
    cancelSearch();
    closeTransientSurfaces();
    setHomeOpen(true);
    setNowMode('closed');
    setSavedPlansLandingOpen(false);
    setPlanSetupOpen(false);
    setSavedPlansOpen(false);
    setPlanSettingsOpen(false);
    setPreferencesOpen(false);
    setAdvancedPreferencesOpen(false);
    setPlanPeopleOpen(false);
    scrollToTop();
    addLog('Home opened');
  };

  const createBetaPlanRecord = async ({
    source,
    title,
    dateWindow,
    customDateRange,
    planDateStart,
    planDateEnd,
    timeWindow,
    timePreference,
    intent,
    locationLabel,
    searchLocation: nextSearchLocation,
    routeOriginLabel,
    routeStartLocation: nextRouteStartLocation,
    participants,
    stops,
  }: {
    source: BetaPlanRecord['source'];
    title?: string;
    dateWindow: DateWindowId;
    customDateRange?: CustomDateRange | null;
    planDateStart: string;
    planDateEnd: string;
    timeWindow?: string;
    timePreference?: string;
    intent: PlanningIntent;
    locationLabel: string;
    searchLocation?: LatLon;
    routeOriginLabel?: string;
    routeStartLocation?: LatLon;
    participants?: string[];
    stops?: ItineraryStop[];
  }) => {
    const stamp = Date.now();
    const resolvedTitle = title?.trim() || defaultBetaPlanTitle({
      intent,
      dateWindow,
      customDateRange,
      planDateStart,
      timePreference,
    });
    const record: BetaPlanRecord = {
      id: `beta-plan-${stamp}`,
      owner: currentTesterName,
      participants: unique([currentTesterName, ...(participants || [])]),
      title: resolvedTitle,
      source,
      locationLabel: locationLabel || 'Current location',
      searchLocation: nextSearchLocation,
      routeOriginLabel: routeOriginLabel || 'Current location',
      routeStartLocation: nextRouteStartLocation,
      dateWindow,
      customDateRange: customDateRange || null,
      planDateStart,
      planDateEnd,
      timeWindow,
      intent,
      stops: stops || [],
      suggestions: [],
      finalizedSuggestionIds: [],
      rsvps: { [currentTesterName]: 'going' },
      status: 'planning',
      createdAt: stamp,
      updatedAt: stamp,
    };
    await saveBetaPlans((current) => [record, ...current.filter((item) => item.id !== record.id)]);
    await saveActiveBetaPlan(record.id);
    return record;
  };

  const startNowPlan = async () => {
    closeTransientSurfaces();
    if (activePlanningSession) await saveActivePlanningSession(null);
    if (activeBetaPlanId) await saveActiveBetaPlan(null);

    const effectiveDateWindow: DateWindowId = 'today';
    routeOriginOverrideRef.current = '';
    setRouteOriginOverride('');
    setSearchLocationOverride('');
    setSearchLocation(null);
    setLastSearchLocationCenter(null);
    await AsyncStorage.removeItem(STORAGE_SEARCH_LOCATION);

    selectedDateWindowRef.current = effectiveDateWindow;
    customDateRangeRef.current = null;
    setSelectedDateWindow(effectiveDateWindow);
    setCustomDateRange(null);
    setSelectedTime('Now');
    setResultMode('food');
    setSelectedFoods([...DEFAULT_FOOD_SELECTIONS]);
    setSelectedActivities([...DEFAULT_ACTIVITY_SELECTIONS]);
    setSelectedDietary([...DEFAULT_DIETARY_SELECTIONS]);
    setPlan(EMPTY_PLAN);
    setPlanTimes({});
    setArrivalTimes({});
    setTimeEditorKey(null);
    setCards([]);
    setVisibleCount(PAGE_SIZE);
    setSearchNotice('');
    setLoading(false);
    setHasInitiatedSearch(false);
    setResultFilter('all');
    setPlanSetupOpen(false);
    setHomeOpen(false);
    setSavedPlansLandingOpen(false);
    setSavedPlansOpen(false);
    setPlanSettingsOpen(false);
    setPreferencesOpen(false);
    setAdvancedPreferencesOpen(false);
    setNowMode('home');
    setNowFoodCategory(NOW_FOOD_CATEGORIES[0]);
    setNowActivityCategory(NOW_ACTIVITY_CATEGORIES[0]);
    setNowSelectedPeople([]);
    setNowPeoplePickerOpen(false);
    scrollToTop();
    addLog('Home action: now discovery');
  };

  const startNowDiscovery = async (slot: PlanSlot, category?: string) => {
    const nextCategory = category || (slot === 'food' ? nowFoodCategory : nowActivityCategory);
    const foodSelections = slot === 'food' ? nowFoodSelectionsForCategory(nextCategory) : selectedFoods;
    const activitySelections = slot === 'activity' ? nowActivitySelectionsForCategory(nextCategory) : selectedActivities;

    closeTransientSurfaces();
    setNowPeoplePickerOpen(false);
    setNowMode(slot);
    setResultMode(slot);
    setResultFilter('all');
    setSelectedTime('Now');
    selectedDateWindowRef.current = 'today';
    customDateRangeRef.current = null;
    setSelectedDateWindow('today');
    setCustomDateRange(null);
    setPreferencesOpen(false);
    setAdvancedPreferencesOpen(false);

    if (slot === 'food') {
      setNowFoodCategory(nextCategory);
      setSelectedFoods(foodSelections);
      setSelectedDietary([...DEFAULT_DIETARY_SELECTIONS]);
    } else {
      setNowActivityCategory(nextCategory);
      setSelectedActivities(activitySelections);
    }

    await searchForSlot(slot, true, false, undefined, {
      foodSelections,
      activitySelections,
      dietarySelections: [...DEFAULT_DIETARY_SELECTIONS],
    });
  };

  const startNowDiscoveryFromHome = async (slot: PlanSlot) => {
    await startNowPlan();
    await startNowDiscovery(slot, slot === 'food' ? NOW_FOOD_CATEGORIES[0] : NOW_ACTIVITY_CATEGORIES[0]);
  };

  const openNowPeopleFromHome = async () => {
    if (getAlphaAccount()) {
      setSharedWorkspace({});
      return;
    }
    await startNowPlan();
    setNowPeoplePickerOpen(true);
  };

  const toggleNowPerson = (user: string) => {
    setNowSelectedPeople((prev) => prev.includes(user) ? prev.filter((item) => item !== user) : unique([...prev, user]));
  };

  const toggleNowGroup = (group: PeoplePickerGroup) => {
    setNowSelectedPeople((prev) => {
      const allSelected = group.members.every((member) => prev.includes(member));
      return allSelected
        ? prev.filter((item) => !group.members.includes(item))
        : unique([...prev, ...group.members]);
    });
  };

  const openPlanSetup = (timing: 'now' | 'later') => {
    closeTransientSurfaces();
    setNowMode('closed');
    const nextDateWindow: DateWindowId = timing === 'now' ? 'today' : 'tomorrow';
    const nextTime = timing === 'now' ? 'Now' : 'Dinner';
    const defaultCustomStart = formatDateInput(new Date());
    const defaultCustomEnd = formatDateInput(addLocalDays(new Date(), 6));
    setPlanSetupTiming(timing);
    setPlanSetupName('');
    setPlanSetupIntent('both');
    setPlanSetupDateWindow(nextDateWindow);
    setPlanSetupCustomDateStartInput(defaultCustomStart);
    setPlanSetupCustomDateEndInput(defaultCustomEnd);
    setPlanSetupTime(nextTime);
    setPlanSetupWhere('Current location');
    setPlanSetupStartingLocation('Current location');
    setPlanSetupInvitees([]);
    setPlanSetupOpen(true);
    setHomeOpen(true);
    setSavedPlansLandingOpen(false);
    setSavedPlansOpen(false);
    scrollToTop();
    addLog(`Home action: ${timing}`);
  };

  const submitPlanSetup = async () => {
    if (planSetupSubmitting) return;

    const whereInput = normalizeCurrentLocationInput(planSetupWhere);
    const startingInput = normalizeCurrentLocationInput(planSetupStartingLocation);
    const isNowSetup = planSetupTiming === 'now';
    const effectiveDateWindow: DateWindowId = isNowSetup ? 'today' : planSetupDateWindow;
    const effectiveTime = isNowSetup ? 'Now' : planSetupTime;
    const initialSearchSlot: PlanSlot = isNowSetup && planSetupIntent === 'activity' ? 'activity' : 'food';
    const nextTimeWindow = effectiveTime === 'Now' ? undefined : defaultTimeWindowForPreference(effectiveTime);
    let nextCustomDateRange: CustomDateRange | null = null;

    if (!isNowSetup && effectiveDateWindow === 'custom') {
      const start = parseDateInput(planSetupCustomDateStartInput);
      const end = parseDateInput(planSetupCustomDateEndInput);
      if (!start || !end) {
        showAppNotice('Check dates', 'Use dates like 2026-06-12.');
        return;
      }
      if (end < start) {
        showAppNotice('Check dates', 'End date must be the same as or after the start date.');
        return;
      }
      nextCustomDateRange = {
        start: formatDateInput(start),
        end: formatDateInput(end),
      };
    }

    const nextDateRange = dateRangeKeysForWindow(effectiveDateWindow, nextCustomDateRange, new Date());
    const nextPlanType = inferPlanType({
      planDateStart: nextDateRange.start,
      planDateEnd: nextDateRange.end,
      destinationLabel: whereInput,
      title: planSetupName,
    });
    const nextRoadTripMode = inferRoadTripMode({
      planType: nextPlanType,
      destinationLabel: whereInput,
      startingLocationLabel: startingInput,
      stops: [],
    });
    const nextVehicleProfile = vehicleProfileForPlan(nextRoadTripMode, undefined, [], whereInput);
    setPlanSetupSubmitting(true);

    try {
      if (startingInput) {
        routeOriginOverrideRef.current = startingInput;
        setRouteOriginOverride(startingInput);
        setLocation(null);
        await AsyncStorage.removeItem(STORAGE_LOCATION);
        resolveRouteOriginInBackground(startingInput);
      } else {
        routeOriginOverrideRef.current = '';
        setRouteOriginOverride('');
      }

      if (whereInput) {
        setSearchLocationOverride(whereInput);
      } else {
        setSearchLocationOverride('');
      }
      setSearchLocation(null);
      setLastSearchLocationCenter(null);
      await AsyncStorage.removeItem(STORAGE_SEARCH_LOCATION);

      if (activePlanningSession) await saveActivePlanningSession(null);
      selectedDateWindowRef.current = effectiveDateWindow;
      customDateRangeRef.current = nextCustomDateRange;
      setSelectedDateWindow(effectiveDateWindow);
      setCustomDateRange(nextCustomDateRange);
      if (nextCustomDateRange) {
        setCustomDateStartInput(nextCustomDateRange.start);
        setCustomDateEndInput(nextCustomDateRange.end);
      }
      setSelectedTime(effectiveTime);
      activePlanTimingRef.current = {
        dateRange: nextDateRange,
        timeWindow: nextTimeWindow,
        timePreference: effectiveTime,
      };
      setSelectedMoods(['Easy']);
      setSelectedFoods([...DEFAULT_FOOD_SELECTIONS]);
      setSelectedActivities([...DEFAULT_ACTIVITY_SELECTIONS]);
      setSelectedDietary([...DEFAULT_DIETARY_SELECTIONS]);
      setResultMode(initialSearchSlot);
      const betaRecord = await createBetaPlanRecord({
        source: isNowSetup ? 'now' : 'later',
        title: planSetupName,
        dateWindow: effectiveDateWindow,
        customDateRange: nextCustomDateRange,
        planDateStart: nextDateRange.start,
        planDateEnd: nextDateRange.end,
        timeWindow: nextTimeWindow,
        timePreference: effectiveTime,
        intent: planSetupIntent,
        locationLabel: whereInput || startingInput || 'Current location',
        routeOriginLabel: startingInput || 'Current location',
        routeStartLocation: startingInput ? undefined : location || undefined,
        participants: planSetupInvitees,
      });
      setPlan({
        ...EMPTY_PLAN,
        title: betaRecord.title,
        sharedPlanId: betaRecord.id,
        owner: betaRecord.owner,
        intent: betaRecord.intent,
        status: 'draft',
        dateWindow: effectiveDateWindow,
        customDateRange: nextCustomDateRange,
        planDateStart: nextDateRange.start,
        planDateEnd: nextDateRange.end,
        planType: nextPlanType,
        timeWindow: nextTimeWindow,
        routeOriginLabel: startingInput || 'Current location',
        routeStartLocation: startingInput ? undefined : location || undefined,
        searchLocation: undefined,
        searchLocationLabel: whereInput || startingInput || 'Current location',
        roadTripMode: nextRoadTripMode,
        vehicleProfile: nextVehicleProfile,
        invitees: planSetupInvitees,
        chargingStops: [],
        nearbyPlacesDuringCharging: [],
        rsvps: betaRecord.rsvps,
        participantSuggestions: [],
        finalizedSuggestionIds: [],
      });
      setPlanTimes({});
      setArrivalTimes({});
      setTimeEditorKey(null);
      setCards([]);
      setVisibleCount(PAGE_SIZE);
      setSearchNotice('');
      setLoading(false);
      setHasInitiatedSearch(false);
      setPlanSetupOpen(false);
      setHomeOpen(false);
      setSavedPlansLandingOpen(false);
      setSavedPlansOpen(false);
      setPlanSettingsOpen(false);
      setLocationOverrideOpen(false);
      setSearchLocationOverrideOpen(false);
      setCustomDateOpen(false);
      setRouteImportOpen(false);
      setPreferencesOpen(false);
      setAdvancedPreferencesOpen(false);
      scrollToPlan();
      addLog(`Plan setup complete: ${planSetupTiming}`);
      if (whereInput) {
        void (async () => {
          try {
            const center = await resolveLocationInput(whereInput);
            if (!center) {
              setSearchNotice(`Could not find ${whereInput}. Update the search area and try again.`);
              return;
            }
            const stampedCenter = { ...center, label: whereInput, ts: Date.now() };
            setSearchLocation(stampedCenter);
            setLastSearchLocationCenter(stampedCenter);
            await AsyncStorage.setItem(STORAGE_SEARCH_LOCATION, JSON.stringify(stampedCenter));
            await searchForSlot(initialSearchSlot, true, false, stampedCenter, {
              foodSelections: [...DEFAULT_FOOD_SELECTIONS],
              activitySelections: [...DEFAULT_ACTIVITY_SELECTIONS],
              dietarySelections: [...DEFAULT_DIETARY_SELECTIONS],
            });
          } catch (err) {
            setSearchNotice('The plan is ready, but suggestions could not be loaded. Try Search Food or Search Activities.');
            addLog(`Initial plan search failed: ${compactError(err)}`);
          }
        })();
      }
    } catch (err) {
      addLog(`Plan setup failed: ${compactError(err)}`);
      showAppNotice('Plan setup failed', compactError(err));
    } finally {
      setPlanSetupSubmitting(false);
    }
  };

  const openSavedPlansHomeAction = (source: 'plans' | 'saved' = 'saved') => {
    closeTransientSurfaces();
    setNowMode('closed');
    setPlanSetupOpen(false);
    setHomeOpen(false);
    setSavedPlansLandingOpen(true);
    setSavedPlansOpen(true);
    setSavedPlansNavigationSource(source);
    setPreferencesOpen(false);
    setAdvancedPreferencesOpen(false);
    setPlanSettingsOpen(false);
    scrollToSavedPlans();
    addLog('Home action: saved plans');
  };

  const openCurrentPlanFromNavigation = () => {
    if (!hasAnyActiveStop && !activeBetaPlan && !plan.sharedPlanId) {
      openSavedPlansHomeAction('plans');
      return;
    }
    closeTransientSurfaces();
    setNowMode('closed');
    setPlanSetupOpen(false);
    setHomeOpen(false);
    setSavedPlansLandingOpen(false);
    setSavedPlansOpen(false);
    setPreferencesOpen(false);
    setAdvancedPreferencesOpen(false);
    scrollToPlan();
    addLog('Navigation: current plan');
  };

  const handleMainNavigation = (key: MainNavigationKey) => {
    if (key === 'home') {
      openHome();
      return;
    }
    if (key === 'plans') {
      openCurrentPlanFromNavigation();
      return;
    }
    if (key === 'saved') {
      openSavedPlansHomeAction('saved');
      return;
    }
    closeTransientSurfaces();
    setAccountSettingsOpen(true);
  };

  const openPeopleGroupsHomeAction = () => {
    closeTransientSurfaces();
    setNowMode('closed');
    if (GROUP_SESSION_ENABLED) {
      setPlanSetupOpen(false);
      setHomeOpen(false);
      setSavedPlansLandingOpen(false);
      setSavedPlansOpen(false);
      setSessionBuilderOpen(true);
      scrollToTop();
      addLog('Home action: people and groups session builder');
      return;
    }
    setPeopleGroupsOpen(true);
    addLog('Home action: people and groups');
  };

  useEffect(() => {
    addLog(`Google Places key loaded: ${keyLoaded}`);
    addLog(`Ticketmaster key loaded: ${Boolean(TICKETMASTER_API_KEY)}`);
    AsyncStorage.getItem(STORAGE_MEMORY)
      .then((raw) => {
        if (raw) setMemory({ ...INITIAL_MEMORY, ...JSON.parse(raw) });
      })
      .catch((err) => addLog(`Memory load failed: ${compactError(err)}`));

    AsyncStorage.getItem(STORAGE_LOCATION)
      .then((raw) => {
        if (!raw) return;
        const cached = JSON.parse(raw) as LatLon;
        setLocation(cached);
        if (cached.ts && Date.now() - cached.ts < LOCATION_TTL_MS) {
          addLog(`Using cached location: ${cached.latitude.toFixed(4)}, ${cached.longitude.toFixed(4)}`);
        } else {
          addLog(`Using stale location for suggestions: ${cached.latitude.toFixed(4)}, ${cached.longitude.toFixed(4)}`);
        }
      })
      .catch((err) => addLog(`Location cache load failed: ${compactError(err)}`));

    AsyncStorage.getItem(STORAGE_SEARCH_LOCATION)
      .then((raw) => {
        if (!raw) return;
        const cached = JSON.parse(raw) as LatLon;
        setSearchLocation(cached);
        setLastSearchLocationCenter(cached);
        setSearchLocationOverride(cached.label || '');
        addLog(`Using cached search location: ${cached.label || `${cached.latitude.toFixed(4)}, ${cached.longitude.toFixed(4)}`}`);
      })
      .catch((err) => addLog(`Search location cache load failed: ${compactError(err)}`));

    Promise.all([
      AsyncStorage.getItem(STORAGE_TESTER_USER),
      AsyncStorage.getItem(STORAGE_USAGE_METER),
      AsyncStorage.getItem(STORAGE_SAVED_PLANS),
      AsyncStorage.getItem(STORAGE_PLANNING_SESSIONS),
      AsyncStorage.getItem(STORAGE_ACTIVE_PLANNING_SESSION),
      AsyncStorage.getItem(STORAGE_BETA_PLANS),
      AsyncStorage.getItem(STORAGE_ACTIVE_BETA_PLAN),
    ])
      .then(([rawUser, rawUsage, rawSavedPlans, rawPlanningSessions, rawActivePlanningSession, rawBetaPlans, rawActiveBetaPlan]) => {
        if (rawUser) {
          const user = JSON.parse(rawUser) as TesterUser;
          if (user.name) {
            setTesterUser({ name: user.name });
            setTesterAuthenticated(true);
          }
        }
        if (rawUsage) setUsageMeter(normalizeUsageMeter(JSON.parse(rawUsage) as UsageMeter));
        if (rawSavedPlans) {
          const parsedSavedPlans = JSON.parse(rawSavedPlans) as SavedPlan[];
          const seenSavedPlans = new Set<string>();
          const dedupedSavedPlans = parsedSavedPlans.filter((saved) => {
            const contentKey = JSON.stringify({
              source: saved.source,
              title: saved.title,
              owner: saved.owner,
              sharedBy: saved.sharedBy,
              sharedTo: saved.sharedTo,
              planDateStart: saved.planDateStart,
              planDateEnd: saved.planDateEnd,
              timeWindow: saved.timeWindow,
              stops: saved.stops.map((stop) => ({
                slot: stop.slot,
                item: cardToId(stop.item),
                visualType: stop.visualType,
                durationMinutes: stop.durationMinutes ?? (saved.planTimes?.[stop.key]
                  ? clockMinutes(saved.planTimes[stop.key]!)
                  : undefined),
                travelMode: stop.travelMode,
                selectedFeatures: stop.selectedFeatures || [],
              })),
            });
            if (seenSavedPlans.has(contentKey)) return false;
            seenSavedPlans.add(contentKey);
            return true;
          });
          savedPlansRef.current = dedupedSavedPlans;
          setSavedPlans(dedupedSavedPlans);
          if (dedupedSavedPlans.length !== parsedSavedPlans.length) {
            void AsyncStorage.setItem(STORAGE_SAVED_PLANS, JSON.stringify(dedupedSavedPlans.slice(0, 40)));
          }
        }
        if (rawPlanningSessions) setPlanningSessions(JSON.parse(rawPlanningSessions) as PlanningSession[]);
        if (rawActivePlanningSession) setActivePlanningSessionId(JSON.parse(rawActivePlanningSession) as string);
        const parsedBetaPlans = rawBetaPlans ? JSON.parse(rawBetaPlans) as BetaPlanRecord[] : [];
        if (parsedBetaPlans.length) {
          betaPlansRef.current = parsedBetaPlans;
          setBetaPlans(parsedBetaPlans);
        }
        if (rawActiveBetaPlan) {
          const parsedActiveBetaPlanId = JSON.parse(rawActiveBetaPlan) as string;
          setActiveBetaPlanId(parsedActiveBetaPlanId);
          const activeRecord = parsedBetaPlans.find((record) => record.id === parsedActiveBetaPlanId);
          if (activeRecord) {
            setPlan(confirmedPlanFromBetaRecord(activeRecord));
            setSelectedDateWindow(activeRecord.dateWindow);
            selectedDateWindowRef.current = activeRecord.dateWindow;
            setCustomDateRange(activeRecord.customDateRange || null);
            customDateRangeRef.current = activeRecord.customDateRange || null;
            setSelectedTime(activeRecord.timeWindow ? timePreferenceForWindow(activeRecord.timeWindow) : 'Now');
            if (activeRecord.searchLocation) {
              setSearchLocation(activeRecord.searchLocation);
              setLastSearchLocationCenter(activeRecord.searchLocation);
              setSearchLocationOverride(activeRecord.locationLabel);
            }
            setHomeOpen(false);
            setSavedPlansLandingOpen(false);
          }
        }
        const sharedPlan = sharedBetaPlanFromCurrentWebUrl();
        if (sharedPlan) {
          setVisitorBetaPlan(sharedPlan);
          betaPlansRef.current = [sharedPlan, ...parsedBetaPlans.filter((record) => record.id !== sharedPlan.id)];
          setBetaPlans(betaPlansRef.current);
          void AsyncStorage.setItem(STORAGE_BETA_PLANS, JSON.stringify(betaPlansRef.current.slice(0, 40)));
        }
      })
      .catch((err) => addLog(`Tester profile load failed: ${compactError(err)}`))
      .finally(() => setAuthLoaded(true));
  }, []);

  useEffect(() => {
    if (!activePlanningSession) return;
    setSelectedDateWindow(activePlanningSession.dateWindow);
    selectedDateWindowRef.current = activePlanningSession.dateWindow;
    setCustomDateRange(activePlanningSession.customDateRange || null);
    customDateRangeRef.current = activePlanningSession.customDateRange || null;
    setSearchLocation(activePlanningSession.searchLocation);
    setLastSearchLocationCenter(activePlanningSession.searchLocation);
    setSearchLocationOverride(activePlanningSession.locationLabel);
    if (activePlanningSession.intent === 'activity') setResultMode('activity');
    if (activePlanningSession.intent === 'food' || activePlanningSession.intent === 'both') setResultMode('food');

    const routeContext = activePlanningSession.routeContexts?.[currentTesterName];
    setRouteOriginOverride(routeContext?.originLabel && routeContext.originLabel !== 'Current location' ? routeContext.originLabel : '');
    setLocation(routeContext?.location || null);
  }, [activePlanningSession?.id, currentTesterName]);

  const saveMemory = async (next: LocalMemory) => {
    setMemory(next);
    await AsyncStorage.setItem(STORAGE_MEMORY, JSON.stringify(next));
  };

  const savePlanningSessions = async (next: PlanningSession[]) => {
    const trimmed = next
      .slice()
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, 20);
    setPlanningSessions(trimmed);
    await AsyncStorage.setItem(STORAGE_PLANNING_SESSIONS, JSON.stringify(trimmed));
  };

  const saveActivePlanningSession = async (id: string | null) => {
    setActivePlanningSessionId(id);
    if (id) {
      await AsyncStorage.setItem(STORAGE_ACTIVE_PLANNING_SESSION, JSON.stringify(id));
    } else {
      await AsyncStorage.removeItem(STORAGE_ACTIVE_PLANNING_SESSION);
    }
  };

  const labelApproximateLocation = async (next: LatLon) => {
    if (next.label && !['Current location', 'Last known location'].includes(next.label)) return next;

    try {
      const matches = await withTimeout(
        Location.reverseGeocodeAsync({ latitude: next.latitude, longitude: next.longitude }),
        8000,
        'Reverse geocode',
      );
      const match = matches[0];
      const town = match?.city || match?.subregion || match?.district || match?.region;
      return town ? { ...next, label: `Near ${town}` } : next;
    } catch (err) {
      addLog(`Approximate location label failed: ${compactError(err)}`);
      return next;
    }
  };

  const saveLocation = async (next: LatLon) => {
    const labeled = await labelApproximateLocation(next);
    const stamped = { ...labeled, ts: Date.now() };
    setLocation(stamped);
    await AsyncStorage.setItem(STORAGE_LOCATION, JSON.stringify(stamped));
  };

  const saveSearchLocation = async (next: LatLon) => {
    const labeled = await labelApproximateLocation(next);
    const stamped = { ...labeled, ts: Date.now() };
    setSearchLocation(stamped);
    setLastSearchLocationCenter(stamped);
    await AsyncStorage.setItem(STORAGE_SEARCH_LOCATION, JSON.stringify(stamped));
  };

  const readCachedSearch = async (storageKey: string, key: string, ttlMs: number, label: string) => {
    try {
      const raw = await AsyncStorage.getItem(storageKey);
      if (!raw) return undefined;
      const cache = JSON.parse(raw) as Record<string, SearchCacheEntry>;
      const entry = cache[key];
      if (!entry || Date.now() - entry.ts > ttlMs) return undefined;
      addLog(`${label} cache hit: ${entry.cards.length} cards`);
      return entry.cards;
    } catch (err) {
      addLog(`${label} cache read failed: ${compactError(err)}`);
      return undefined;
    }
  };

  const writeCachedSearch = async (storageKey: string, key: string, nextCards: PlaceCard[], maxEntries: number, label: string) => {
    const write = searchCacheWriteRef.current.then(async () => {
      try {
        const raw = await AsyncStorage.getItem(storageKey);
        const cache = raw ? (JSON.parse(raw) as Record<string, SearchCacheEntry>) : {};
        cache[key] = { ts: Date.now(), cards: nextCards };
        const recentEntries = Object.entries(cache)
          .sort((a, b) => b[1].ts - a[1].ts)
          .slice(0, maxEntries);
        await AsyncStorage.setItem(storageKey, JSON.stringify(Object.fromEntries(recentEntries)));
        addLog(`${label} cache saved: ${nextCards.length} cards`);
      } catch (err) {
        addLog(`${label} cache write failed: ${compactError(err)}`);
      }
    });
    searchCacheWriteRef.current = write;
    await write;
  };

  const readCachedZip = async (value: string) => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_ZIP_CACHE);
      if (!raw) return undefined;
      const cache = JSON.parse(raw) as Record<string, ZipCacheEntry>;
      const entry = cache[value];
      if (!entry || Date.now() - entry.ts > ZIP_CACHE_TTL_MS) return undefined;
      addLog(`ZIP cache hit: ${value}`);
      return entry.location;
    } catch (err) {
      addLog(`ZIP cache read failed: ${compactError(err)}`);
      return undefined;
    }
  };

  const writeCachedZip = async (value: string, nextLocation: LatLon) => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_ZIP_CACHE);
      const cache = raw ? (JSON.parse(raw) as Record<string, ZipCacheEntry>) : {};
      cache[value] = { ts: Date.now(), location: nextLocation };
      const recentEntries = Object.entries(cache)
        .sort((a, b) => b[1].ts - a[1].ts)
        .slice(0, 40);
      await AsyncStorage.setItem(STORAGE_ZIP_CACHE, JSON.stringify(Object.fromEntries(recentEntries)));
      addLog(`ZIP cache saved: ${value}`);
    } catch (err) {
      addLog(`ZIP cache write failed: ${compactError(err)}`);
    }
  };

  const readCachedWebsiteFeatures = async (key: string) => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_WEBSITE_FEATURE_CACHE);
      if (!raw) return undefined;
      const cache = JSON.parse(raw) as Record<string, WebsiteFeatureCacheEntry>;
      const entry = cache[key];
      if (!entry || Date.now() - entry.ts > WEBSITE_FEATURE_CACHE_TTL_MS) return undefined;
      addLog(`Website features cache hit: ${entry.features.length}`);
      return entry.features;
    } catch (err) {
      addLog(`Website features cache read failed: ${compactError(err)}`);
      return undefined;
    }
  };

  const writeCachedWebsiteFeatures = async (key: string, features: string[]) => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_WEBSITE_FEATURE_CACHE);
      const cache = raw ? (JSON.parse(raw) as Record<string, WebsiteFeatureCacheEntry>) : {};
      cache[key] = { ts: Date.now(), features };
      const recentEntries = Object.entries(cache)
        .sort((a, b) => b[1].ts - a[1].ts)
        .slice(0, 20);
      await AsyncStorage.setItem(STORAGE_WEBSITE_FEATURE_CACHE, JSON.stringify(Object.fromEntries(recentEntries)));
      addLog(`Website features cache saved: ${features.length}`);
    } catch (err) {
      addLog(`Website features cache write failed: ${compactError(err)}`);
    }
  };

  const fetchFactoryExperienceFeatures = async () => {
    const cacheKey = 'factory-at-franklin-experience';
    const cached = await readCachedWebsiteFeatures(cacheKey);
    if (cached) return cached;

    addLog('Fetching Factory website features');
    const response = await withTimeout(fetch(FACTORY_EXPERIENCE_URL), 12000, 'Factory website');
    const html = await response.text();
    if (!response.ok) throw new Error(`Factory website failed: ${response.status}`);
    const features = parseFactoryExperienceFeatures(html);
    await writeCachedWebsiteFeatures(cacheKey, features);
    return features;
  };

  const resolveLocationWithGooglePlaces = async (query: string, label: string) => {
    if (!GOOGLE_API_KEY) return undefined;

    try {
      addLog(`Google Places location fallback: ${query}`);
      await recordPlacesUsage('text');
      const response = await withTimeout(
        fetch('https://places.googleapis.com/v1/places:searchText', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': GOOGLE_API_KEY,
            'X-Goog-FieldMask': LOCATION_FIELD_MASK,
          },
          body: JSON.stringify({
            textQuery: query,
            maxResultCount: 1,
          }),
        }),
        12000,
        `Google Places location ${query}`,
      );

      const text = await response.text();
      addLog(`Google Places location status: ${response.status}`);
      if (!response.ok) {
        addLog(`Google Places location failed: ${response.status} ${text.slice(0, 140)}`);
        return undefined;
      }

      const json = JSON.parse(text);
      const place = Array.isArray(json?.places) ? json.places[0] : undefined;
      const latitude = place?.location?.latitude;
      const longitude = place?.location?.longitude;
      if (typeof latitude !== 'number' || typeof longitude !== 'number') return undefined;

      return {
        latitude,
        longitude,
        label,
      };
    } catch (err) {
      addLog(`Google Places location fallback failed: ${compactError(err)}`);
      return undefined;
    }
  };

  const resolveLocationInput = async (value: string) => {
    const localPreset = LOCAL_TEST_LOCATIONS[normalizePlaceName(value)];
    if (localPreset) return { ...localPreset };

    const isZip = /^\d{5}$/.test(value);
    let next = isZip ? await readCachedZip(value) : undefined;
    if (next) return next;

    const query = isZip ? `${value}, USA` : value;
    try {
      const results = Platform.OS === 'web' ? [] : await withTimeout(Location.geocodeAsync(query), 12000, `Location ${value}`);
      const match = results[0];
      if (match) {
        next = {
          latitude: match.latitude,
          longitude: match.longitude,
          label: value,
        };
      }
    } catch (err) {
      addLog(`Location geocode failed, trying Places fallback: ${compactError(err)}`);
    }

    next = next || await resolveLocationWithGooglePlaces(query, value);
    if (!next) return undefined;

    if (isZip) await writeCachedZip(value, next);
    return next;
  };

  const resolveRouteOriginInBackground = (value: string) => {
    const query = value.trim();
    if (!query) return;

    void (async () => {
      try {
        const resolved = await resolveLocationInput(query);
        if (!resolved) {
          addLog(`Starting location background resolve returned no results: ${query}`);
          return;
        }
        if (routeOriginOverrideRef.current.trim() !== query) return;

        await saveLocation({ ...resolved, label: query });
        addLog(`Starting location resolved: ${query} ${resolved.latitude.toFixed(4)}, ${resolved.longitude.toFixed(4)}`);
      } catch (err) {
        addLog(`Starting location background resolve failed: ${compactError(err)}`);
      }
    })();
  };

  const toggleMulti = (value: string, current: string[], setter: (next: string[]) => void, label: string) => {
    addLog(`${label} chip tapped: ${value}`);
    if (value === 'Any') {
      setter(['Any']);
      return;
    }

    const withoutAny = current.filter((item) => item !== 'Any');
    const next = withoutAny.includes(value)
      ? withoutAny.filter((item) => item !== value)
      : [...withoutAny, value];
    if (label === 'Food') {
      const cuisineFoods = next.filter((item) => !FOOD_QUICK_FILTERS.includes(item));
      setter(next.length && cuisineFoods.length ? next : next.length ? ['Any', ...next] : ['Any']);
      return;
    }
    setter(next.length ? next : ['Any']);
  };

  const getLocation = async () => {
    if (location?.ts && Date.now() - location.ts < LOCATION_TTL_MS) {
      addLog('Location cache hit');
      return location;
    }

    addLog('Requesting GPS permission');
    const permission = await withTimeout(Location.requestForegroundPermissionsAsync(), 10000, 'Location permission');
    addLog(`GPS permission: ${permission.status}`);
    if (permission.status !== 'granted') throw new Error('Location permission was not granted.');

    try {
      addLog('Getting current GPS location');
      const current = await withTimeout(
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        8000,
        'GPS',
      );
      const next = {
        latitude: current.coords.latitude,
        longitude: current.coords.longitude,
        label: 'Current location',
      };
      await saveLocation(next);
      addLog(`GPS success: ${next.latitude.toFixed(4)}, ${next.longitude.toFixed(4)}`);
      return next;
    } catch (err) {
      addLog(`GPS failed: ${compactError(err)}`);
      const lastKnown = await withTimeout(Location.getLastKnownPositionAsync(), 3000, 'Last known location');
      if (!lastKnown) throw new Error('No current or last known location found. Try a ZIP search in Maps.');
      const next = {
        latitude: lastKnown.coords.latitude,
        longitude: lastKnown.coords.longitude,
        label: 'Last known location',
      };
      await saveLocation(next);
      addLog(`Last known location success: ${next.latitude.toFixed(4)}, ${next.longitude.toFixed(4)}`);
      return next;
    }
  };

  const getSearchLocation = async (): Promise<LatLon> => {
    if (activePlanningSession?.searchLocation) return activePlanningSession.searchLocation;

    const searchOverride = searchLocationOverride.trim();
    const originOverride = routeOriginOverride.trim();
    const cachedSearchLabel = searchLocation?.label?.trim().toLowerCase();
    if (searchOverride && searchLocation && cachedSearchLabel === searchOverride.toLowerCase()) return searchLocation;

    if (!searchOverride && searchLocation) return searchLocation;

    const cachedOriginLabel = location?.label?.trim().toLowerCase();
    if (!searchOverride && originOverride && location && cachedOriginLabel === originOverride.toLowerCase()) return location;

    const locationQuery = searchOverride || originOverride;
    if (locationQuery) {
      const resolved = await resolveLocationInput(locationQuery);
      if (!resolved) throw new Error(`Could not find a location for ${locationQuery}.`);

      const stamped = { ...resolved, label: locationQuery, ts: Date.now() };
      setSearchLocation(stamped);
      setLastSearchLocationCenter(stamped);
      await AsyncStorage.setItem(STORAGE_SEARCH_LOCATION, JSON.stringify(stamped));
      addLog(`Search location resolved: ${locationQuery} ${resolved.latitude.toFixed(4)}, ${resolved.longitude.toFixed(4)}`);
      return stamped;
    }

    return getLocation();
  };

  const searchNearbyType = async (type: string, center: LatLon, radiusMeters: number, execution = new SearchExecution(0)): Promise<PlaceCard[]> => {
    execution.check();
    if (!GOOGLE_API_KEY) throw new Error('Google Places API key is not loaded.');

    addLog(`Google Places search: ${type}`);
    await recordPlacesUsage('nearby');
    const json = await execution.json<{ places?: any[] }>('Google Places', 'https://places.googleapis.com/v1/places:searchNearby', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': GOOGLE_API_KEY,
          'X-Goog-FieldMask': FIELD_MASK,
        },
        body: JSON.stringify({
          includedTypes: [type],
          languageCode: 'en',
          maxResultCount: 20,
          rankPreference: 'DISTANCE',
          locationRestriction: {
            circle: {
              center: { latitude: center.latitude, longitude: center.longitude },
              radius: areaSearchRadius(center, radiusMeters),
            },
          },
        }),
      });
    const places = Array.isArray(json?.places) ? json.places : [];
    addLog(`Google Places ${type} returned ${places.length}`);
    return places.map(toCard);
  };

  const searchPlaceByText = async (
    query: string,
    slot: PlanSlot,
    center?: LatLon | null,
    options?: { rawFoodQuery?: boolean; maxResults?: number; radiusMeters?: number },
    execution = new SearchExecution(0),
  ): Promise<PlaceCard[]> => {
    execution.check();
    if (!GOOGLE_API_KEY) throw new Error('Google Places API key is not loaded.');

    const radiusMeters = areaSearchRadius(center, options?.radiusMeters || (slot === 'food' ? 50000 : DEFAULT_ACTIVITY_RADIUS_METERS));
    const cacheKey = `${textSearchCacheKey(`${options?.rawFoodQuery ? 'raw' : 'default'}:${query}`, slot, center)}|radius:${radiusMeters}|area:${center?.areaFocus?.placeId || 'whole'}:${center?.areaFocus?.radiusMeters || ''}|limit:${options?.maxResults || 10}`;
    const cachedCards = execution.refresh ? undefined : await readCachedSearch(STORAGE_TEXT_SEARCH_CACHE, cacheKey, TEXT_SEARCH_CACHE_TTL_MS, 'Text search');
    execution.check();
    if (cachedCards) return cachedCards;

    addLog(`Google Places text search: ${query}`);
    await recordPlacesUsage('text');
    const json = await execution.json<{ places?: any[] }>('Google Places', 'https://places.googleapis.com/v1/places:searchText', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': GOOGLE_API_KEY,
          'X-Goog-FieldMask': FIELD_MASK,
        },
        body: JSON.stringify({
          textQuery: slot === 'food' && !options?.rawFoodQuery ? `${query} restaurant` : query,
          languageCode: 'en',
          maxResultCount: options?.maxResults || 10,
          locationBias: center
            ? {
                circle: {
                  center: { latitude: center.latitude, longitude: center.longitude },
                  radius: radiusMeters,
                },
              }
            : undefined,
        }),
      });
    const places = Array.isArray(json?.places) ? json.places : [];
    const queryName = normalizePlaceName(query);
    const scoreTextMatch = (card: PlaceCard) => {
      const name = normalizePlaceName(card.title);
      const address = normalizePlaceName(card.address || '');
      let score = 0;
      if (name === queryName) score += 100;
      if (name.startsWith(queryName)) score += 80;
      if (name.includes(queryName)) score += 60;
      if (address.includes(queryName)) score += 15;
      if (center) {
        const miles = distanceMeters(center, card) / 1609.344;
        score += Math.max(0, 30 - miles);
      }
      return score + scoreCard(card, memory, selectedMoods) / 20;
    };
    const cards: PlaceCard[] = places.map(toCard).filter((card: PlaceCard) => isInsideSearchArea(center, card)).sort((a: PlaceCard, b: PlaceCard) => scoreTextMatch(b) - scoreTextMatch(a));
    addLog(`Google Places text returned ${cards.length}: ${cards.slice(0, 3).map((card) => card.title).join(' | ') || 'none'}`);
    await writeCachedSearch(STORAGE_TEXT_SEARCH_CACHE, cacheKey, cards, 40, 'Text search');
    return cards;
  };

  const discoverPlaceFeatures = async (item: PlaceCard | string, slot: PlanSlot) => {
    const fallback: string[] = [];
    if (slot === 'activity' && isFactoryAtFranklin(item)) {
      try {
        const websiteFeatures = await fetchFactoryExperienceFeatures();
        if (websiteFeatures.length) return websiteFeatures;
      } catch (err) {
        addLog(`Factory website feature fetch failed: ${compactError(err)}`);
      }
    }

    if (typeof item === 'string' || typeof item.lat !== 'number' || typeof item.lng !== 'number') return fallback;
    if (!GOOGLE_API_KEY) return fallback;

    const center = { latitude: item.lat, longitude: item.lng, label: item.title };
    const queries = [
      `${item.title} restaurants`,
      `${item.title} shops`,
      `${item.title} coffee`,
      `${item.title} dessert`,
      `${item.title} live music`,
      `${item.title} events`,
      `${item.title} pottery`,
      `${item.title} carousel`,
      `things to do at ${item.title}`,
    ];
    const found = new Map<string, string>();

    for (const query of queries) {
      try {
        const results = await searchPlaceByText(query, 'activity', center);
        results
          .filter((card) => card.id !== item.id)
          .filter((card) => distanceMeters(center, card) <= VENUE_FEATURE_RADIUS_METERS)
          .slice(0, 3)
          .forEach((card) => {
            const label = featureLabelForCard(card);
            if (label) found.set(label, label);
          });
      } catch (err) {
        addLog(`Feature search failed: ${query} ${compactError(err)}`);
      }
    }

    const dynamicFeatures = Array.from(found.values()).slice(0, 8);
    return dynamicFeatures.length ? dynamicFeatures : fallback;
  };

  const refreshStopFeatures = async (key: string, slot: PlanSlot, item: PlaceCard | string) => {
    const featureOptions = await discoverPlaceFeatures(item, slot);
    setPlan((prev) => ({
      ...prev,
      stops: prev.stops.map((stop) => {
        if (stop.key !== key) return stop;
        const selectedFeatures = (stop.selectedFeatures || []).filter((feature) => featureOptions.includes(feature));
        return { ...stop, featureOptions, selectedFeatures };
      }),
    }));
    if (featureOptions.length) addLog(`Dynamic things here found: ${featureOptions.length}`);
  };

  const searchOpenFoodByText = async (center: LatLon, execution = new SearchExecution(0)): Promise<PlaceCard[]> => {
    execution.check();
    if (!GOOGLE_API_KEY) throw new Error('Google Places API key is not loaded.');

    const cacheKey = [
      'open-food-text',
      center.latitude.toFixed(4),
      center.longitude.toFixed(4),
      center.label ? normalizePlaceName(center.label) : 'unlabeled',
    ].join('|');
    const cachedCards = execution.refresh ? undefined : await readCachedSearch(STORAGE_TEXT_SEARCH_CACHE, cacheKey, TEXT_SEARCH_CACHE_TTL_MS, 'Open food text search');
    execution.check();
    if (cachedCards) return cachedCards;

    addLog('Google Places open food text search');
    await recordPlacesUsage('text');
    const json = await execution.json<{ places?: any[] }>('Google Places', 'https://places.googleapis.com/v1/places:searchText', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': GOOGLE_API_KEY,
          'X-Goog-FieldMask': FIELD_MASK,
        },
        body: JSON.stringify({
          textQuery: 'restaurants',
          includedType: 'restaurant',
          openNow: true,
          languageCode: 'en',
          maxResultCount: 20,
          locationBias: {
            circle: {
              center: { latitude: center.latitude, longitude: center.longitude },
              radius: EXPANDED_FOOD_RADIUS_METERS,
            },
          },
        }),
      });
    const places = Array.isArray(json?.places) ? json.places : [];
    const cards = places
      .map(toCard)
      .filter((card: PlaceCard) => hasKnownHours(card) && card.isOpen !== false)
      .sort((a: PlaceCard, b: PlaceCard) => scoreCard(b, memory, selectedMoods) - scoreCard(a, memory, selectedMoods));
    addLog(`Google Places open food text returned ${cards.length}`);
    await writeCachedSearch(STORAGE_TEXT_SEARCH_CACHE, cacheKey, cards, 40, 'Open food text search');
    return cards;
  };

  const searchFoodByTextPreferences = async (
    center: LatLon,
    foodSelections: string[],
    selectedDietaryPreferences: string[],
    execution = new SearchExecution(0),
  ): Promise<PlaceCard[]> => {
    execution.check();
    const cuisines = cuisineSelections(foodSelections);
    const activeDietary = dietarySelections(selectedDietaryPreferences);
    const cuisineQueries = cuisines.length
      ? cuisines.flatMap((cuisine) => FOOD_TEXT_QUERY_MAP[cuisine] || [`${cuisine} restaurants`])
      : ['restaurants', 'places to eat', 'best food nearby'];
    const dietaryQueries = activeDietary.flatMap((preference) =>
      DIETARY_TEXT_QUERY_MAP[preference] || [`${dietaryQueryTerm(preference)} restaurants`],
    );
    const combinedQueries = activeDietary.length && cuisines.length
      ? activeDietary.flatMap((preference) =>
          cuisines.slice(0, 4).map((cuisine) => `${dietaryQueryTerm(preference)} ${cuisine} restaurants`),
        )
      : [];
    const baseQueries = activeDietary.length
      ? unique([...combinedQueries, ...dietaryQueries, ...cuisineQueries])
      : cuisineQueries;
    const locationLabel = center.label && !/current location|last known location/i.test(center.label) ? center.label : '';
    const locationQueries = locationLabel && (cuisines.length || activeDietary.length)
      ? baseQueries.slice(0, 4).map((query) => `${query} near ${locationLabel}`)
      : [];
    const queries = unique([...locationQueries, ...baseQueries]);
    const found = new Map<string, PlaceCard>();

    const queryResults = await mapConcurrent(unique(queries).slice(0, 8), async (query) => {
      execution.check();
      const queryFound = new Map<string, PlaceCard>();
      try {
        const results = await searchPlaceByText(query, 'food', center, {
          rawFoodQuery: true,
          maxResults: 20,
          radiusMeters: EXPANDED_FOOD_RADIUS_METERS,
        }, execution);
        results.slice(0, 10).forEach((card) => {
          if (memory.neverRecommend.includes(card.id)) return;
          const matchedCuisine = cuisines.find((cuisine) =>
            (FOOD_TEXT_QUERY_MAP[cuisine] || []).some((foodQuery) => query === foodQuery || query.startsWith(`${foodQuery} near `)),
          );
          const normalizedQuery = query.toLowerCase();
          const matchedDietary = activeDietary.find((preference) =>
            normalizedQuery.includes(dietaryQueryTerm(preference)) ||
            (DIETARY_TEXT_QUERY_MAP[preference] || []).some((foodQuery) =>
              normalizedQuery === foodQuery || normalizedQuery.startsWith(`${foodQuery} near `),
            ),
          );
          const explicitStrength = matchedCuisine ? foodCuisineMatchStrength(card, [matchedCuisine]) : 0;
          const taggedCard = matchedCuisine
            ? {
                ...card,
                types: unique([
                  ...(card.types || []),
                  explicitStrength > 0
                    ? `food_match_${matchedCuisine.toLowerCase()}`
                    : `food_semantic_${matchedCuisine.toLowerCase()}`,
                ]),
              }
            : { ...card, types: unique([...(card.types || []), 'food_text_match']) };
          const dietaryTaggedCard = matchedDietary
            ? {
                ...taggedCard,
                types: unique([...(taggedCard.types || []), `food_dietary_${preferenceTag(matchedDietary)}`]),
              }
            : taggedCard;
          queryFound.set(card.id, {
            ...dietaryTaggedCard,
          });
        });
      } catch (err) {
        execution.check();
        addLog(`Food text discovery failed: ${query} ${compactError(err)}`);
      }
      return Array.from(queryFound.values());
    });
    queryResults.flat().forEach((card) => found.set(card.id, card));

    const cards = Array.from(found.values())
      .filter((card) => hasKnownHours(card))
      .sort((a, b) =>
        foodCardScore(b, center, memory, selectedMoods, foodSelections, selectedDietaryPreferences) -
        foodCardScore(a, center, memory, selectedMoods, foodSelections, selectedDietaryPreferences)
      );
    addLog(`Food text discovery returned ${cards.length}`);
    return cards;
  };

  const searchLocalEventPlaces = async (center: LatLon, execution = new SearchExecution(0)): Promise<PlaceCard[]> => {
    execution.check();
    if (!GOOGLE_API_KEY) return [];
    const activeDateWindow = selectedDateWindowRef.current;
    const datePhrase = dateWindowSearchPhrase(activeDateWindow, customDateRangeRef.current);
    const queries = [
      `fair rodeo festival ${datePhrase}`,
      `local events ${datePhrase}`,
      `farmers market live music festival ${datePhrase}`,
    ];
    const found = new Map<string, PlaceCard>();

    const queryResults = await mapConcurrent(queries, async (query) => {
      execution.check();
      const queryFound = new Map<string, PlaceCard>();
      try {
        const results = await searchPlaceByText(query, 'activity', center, undefined, execution);
        results.slice(0, 4).forEach((card) => {
          if (memory.neverRecommend.includes(card.id)) return;
          queryFound.set(`local-event-${card.id}`, {
            ...card,
            id: `local-event-${card.id}`,
            kind: 'event',
            subtitle: [card.title === card.subtitle ? undefined : card.subtitle, 'Local search'].filter(Boolean).join(' - '),
            source: 'Local search',
            eventDateText: 'Date Not Verified',
            hoursText: 'Date Not Verified',
          });
        });
      } catch (err) {
        execution.check();
        addLog(`Local event fallback failed: ${query} ${compactError(err)}`);
      }
      return Array.from(queryFound.values());
    });
    queryResults.flat().forEach((card) => found.set(card.id, card));

    return Array.from(found.values());
  };

  const ticketmasterDateParam = (date: Date) => date.toISOString().replace(/\.\d{3}Z$/, 'Z');

  const searchTicketmasterEvents = async (center: LatLon, radiusMiles = TICKETMASTER_EVENT_RADIUS_MILES, execution = new SearchExecution(0)): Promise<PlaceCard[]> => {
    execution.check();
    radiusMiles = areaSearchRadius(center, radiusMiles * METERS_PER_MILE) / METERS_PER_MILE;
    if (!TICKETMASTER_API_KEY) {
      showToast('Ticketmaster key missing. Showing local search events if available.');
      addLog('Ticketmaster key missing; event discovery skipped');
      return [];
    }

    const activeDateWindow = selectedDateWindowRef.current;
    const { start, end } = dateWindowRange(activeDateWindow, new Date(), customDateRangeRef.current);
    const cacheKey = [
      'ticketmaster-events',
      center.latitude.toFixed(4),
      center.longitude.toFixed(4),
      center.label ? normalizePlaceName(center.label) : 'unlabeled',
      radiusMiles,
      EVENT_PROVIDER_CACHE_VERSION,
      activeDateWindow,
      customDateRangeRef.current ? `${customDateRangeRef.current.start}-${customDateRangeRef.current.end}` : 'preset',
      ticketmasterDateParam(start).slice(0, 10),
      ticketmasterDateParam(end).slice(0, 10),
    ].join('|');
    const cached = execution.refresh ? undefined : await readCachedSearch(STORAGE_TEXT_SEARCH_CACHE, cacheKey, EVENT_SEARCH_CACHE_TTL_MS, 'Ticketmaster event search');
    execution.check();
    if (cached) return cached;

    const params = new URLSearchParams({
      apikey: TICKETMASTER_API_KEY,
      latlong: `${center.latitude},${center.longitude}`,
      radius: String(radiusMiles),
      unit: 'miles',
      startDateTime: ticketmasterDateParam(start),
      endDateTime: ticketmasterDateParam(end),
      countryCode: 'US',
      sort: 'date,asc',
    });

    addLog(`Ticketmaster event search: ${center.latitude.toFixed(4)},${center.longitude.toFixed(4)} ${radiusMiles}mi`);
    const { events, truncated } = await collectEventPages<any>(async (page, size) => {
      execution.check();
      params.set('page', String(page));
      params.set('size', String(size));
      return execution.json('Ticketmaster', `https://app.ticketmaster.com/discovery/v2/events.json?${params.toString()}`);
    });
    if (truncated) execution.notices.push('Showing the first 1,000 event listings. Choose a shorter date range to see all matches.');
    const now = Date.now();
    const cards = deduplicateEvents(events)
      .map(({ event, addressConflict }): PlaceCard | undefined => {
        const card = ticketmasterEventToCard(event);
        return card ? { ...card, eventAddressConflict: addressConflict } : undefined;
      })
      .filter((card: PlaceCard | undefined): card is PlaceCard => Boolean(card))
      .filter((card: PlaceCard) => !memory.neverRecommend.includes(card.id))
      .filter((card: PlaceCard) => !card.eventStartMs || card.eventStartMs >= now - 60 * 60 * 1000)
      .sort((a: PlaceCard, b: PlaceCard) => {
        const timeA = a.eventStartMs || Number.POSITIVE_INFINITY;
        const timeB = b.eventStartMs || Number.POSITIVE_INFINITY;
        if (timeA !== timeB) return timeA - timeB;
        return distanceMeters(center, a) - distanceMeters(center, b);
      });
    addLog(`Ticketmaster events returned ${cards.length}`);
    if (!truncated) await writeCachedSearch(STORAGE_TEXT_SEARCH_CACHE, cacheKey, cards, 20, 'Ticketmaster event search');
    return cards;
  };

  const runPlacesSearch = async (
    slot: PlanSlot,
    center: LatLon,
    types: string[],
    radiusMeters: number,
    forceRefresh = false,
    foodSelections = selectedFoods,
    requestId = searchRequestIdRef.current,
    selectedDietaryPreferences = selectedDietary,
    activitySelections = selectedActivities,
    routeBias?: SearchRouteBias,
  ) => {
    const execution = searchExecutionRef.current;
    if (!execution || execution.id !== requestId) return;
    execution.check();
    setLastSearchLocationCenter(center);
    const wantsEvents = slot === 'activity' && activitySelections.includes('Events');
    const eventsFocused = slot === 'activity' && activitySelections.includes('Events');
    const chargerFocused = slot === 'activity' && wantsChargerActivity(activitySelections);
    const effectiveRadiusMeters = areaSearchRadius(center, walkingAdjustedRadius(radiusMeters, routeBias));
    const preferenceKey = slot === 'food'
      ? `${wantsNoFastFood(foodSelections) ? '|no-fast-food' : ''}${wantsCloseBy(foodSelections) ? '|close-by' : ''}${wantsOpenNow(foodSelections) ? '|open-now' : ''}${cuisineSelections(foodSelections).join(',')}|dietary:${dietarySelections(selectedDietaryPreferences).join(',')}`
      : `${nonEventActivitySelections(activitySelections).join(',')}|${wantsEvents ? `events|${EVENT_PROVIDER_CACHE_VERSION}|${selectedDateWindowRef.current}|${customDateRangeRef.current ? `${customDateRangeRef.current.start}-${customDateRangeRef.current.end}` : 'preset'}${eventsFocused ? '|focused' : ''}` : ''}`;
    const activeTiming = activePlanTimingRef.current;
    const timingKey = `|timing:${activeTiming.dateRange.start}:${activeTiming.dateRange.end}:${activeTiming.timeWindow || 'now'}`;
    const cacheKey = `${searchCacheKey(slot, center, types, effectiveRadiusMeters)}${preferenceKey}${timingKey}${routeBiasCacheKey(routeBias)}|area:${center.areaFocus?.placeId || 'whole'}:${center.areaFocus?.radiusMeters || ''}`;
    if (routeBias?.mode === 'walk') {
      addLog('Walking route bias active: favoring places near the stop and start');
    }
    const resultRadiusMeters = areaSearchRadius(center, slot === 'food'
      ? EXPANDED_FOOD_RADIUS_METERS
      : wantsEvents
        ? TICKETMASTER_EVENT_RADIUS_MILES * 1609.344
        : Math.max(effectiveRadiusMeters, DEFAULT_ACTIVITY_RADIUS_METERS));
    const planStartMs = new Date(`${activeTiming.dateRange.start}T00:00:00`).getTime();
    const planEndMs = new Date(`${activeTiming.dateRange.end}T23:59:59`).getTime();
    const applyResultFilters = (nextCards: PlaceCard[]) => nextCards.map(cardForActivePlanTiming).filter((card) => {
      if (!isInsideSearchArea(center, card)) return false;
      if (memory.neverRecommend.includes(card.id)) return false;
      if (!hasKnownHours(card) && !(chargerFocused && isEvCharger(card))) return false;
      const cardDistance = distanceMeters(center, card);
      if (Number.isFinite(cardDistance) && cardDistance > resultRadiusMeters) return false;
      if (card.kind === 'event' && card.eventStartMs) {
        if (card.eventStartMs < planStartMs || card.eventStartMs > planEndMs) return false;
        if (activeTiming.timePreference === 'Now' && card.eventStartMs < Date.now() - 5 * 60 * 1000) return false;
      }
      if (slot === 'food' && !isLikelyFoodVenue(card)) return false;
      if (slot === 'food' && wantsNoFastFood(foodSelections) && isLikelyFastFood(card)) return false;
      if (slot === 'food' && !isLikelyFoodPreferenceMatch(card, foodSelections)) return false;
      if (slot === 'food' && card.isOpen === false) return false;
      if (slot === 'activity' && isBadActivityResult(card)) return false;
      if (slot === 'activity' && !isRelevantActivityResult(card, activitySelections)) return false;
      if (slot === 'activity' && chargerFocused && !matchesActivitySelection(card, activitySelections)) return false;
      return true;
    });
    const mergeCards = (primaryCards: PlaceCard[], extraCards: PlaceCard[]) => {
      const merged = new Map<string, PlaceCard>();
      [...primaryCards, ...extraCards].forEach((card) => {
        if (!memory.neverRecommend.includes(card.id)) merged.set(card.id, card);
      });
      return applyResultFilters(Array.from(merged.values()));
    };
    const shouldExpand = (count: number) =>
      slot === 'food' &&
      !center.areaFocus &&
      routeBias?.mode !== 'walk' &&
      !wantsCloseBy(foodSelections) &&
      effectiveRadiusMeters < EXPANDED_FOOD_RADIUS_METERS &&
      count < MIN_FOOD_RESULTS_BEFORE_EXPAND;
    const searchAndFilter = async (searchRadius: number) => {
      const merged = new Map<string, PlaceCard>();
      execution.check();
      if (!GOOGLE_API_KEY) {
        execution.failures += 1;
        return [];
      }
      const batches = await mapConcurrent(types, async (type) => {
        execution.check();
        try {
          return await searchNearbyType(type, center, searchRadius, execution);
        } catch (err) {
          execution.check();
          addLog(`Google Places ${type} error: ${compactError(err)}`);
          return [];
        }
      });
      batches.flat().forEach((card) => {
        if (!memory.neverRecommend.includes(card.id)) merged.set(card.id, card);
      });
      return applyResultFilters(Array.from(merged.values()));
    };

    let unblockedCards = forceRefresh
      ? undefined
      : await readCachedSearch(STORAGE_SEARCH_CACHE, cacheKey, SEARCH_CACHE_TTL_MS, 'Nearby search');
    if (unblockedCards) {
      unblockedCards = applyResultFilters(unblockedCards);
      execution.check();
      addLog(`Nearby cache after filters: ${unblockedCards.length} cards`);
      setResultMode(slot);
      setHasInitiatedSearch(true);
      setCards(unblockedCards);
      setVisibleCount(PAGE_SIZE);
      return;
    } else {
      unblockedCards = await searchAndFilter(effectiveRadiusMeters);
      if (routeBias?.mode === 'walk' && effectiveRadiusMeters < radiusMeters && unblockedCards.length < PAGE_SIZE) {
        const broadCards = await searchAndFilter(radiusMeters);
        unblockedCards = mergeCards(unblockedCards, broadCards);
        addLog(`Walking broader fallback merged: ${unblockedCards.length} cards`);
      }
    }

    if (slot === 'food') {
      try {
        const textFoodCards = await searchFoodByTextPreferences(center, foodSelections, selectedDietaryPreferences, execution);
        unblockedCards = mergeCards(unblockedCards, textFoodCards);
        addLog(`Food text discovery merged: ${unblockedCards.length} cards`);
      } catch (err) {
        execution.check();
        addLog(`Food text discovery error: ${compactError(err)}`);
      }
    }

    if (slot === 'activity' && chargerFocused) {
      const chargerQueries = wantsTeslaSupercharger(activitySelections)
        ? ['Tesla Supercharger']
        : ['EV charging station', 'electric vehicle charging station'];
      for (const query of chargerQueries) {
        try {
          const chargerTextCards = await searchPlaceByText(query, 'activity', center, {
            maxResults: 20,
            radiusMeters: walkingAdjustedRadius(DEFAULT_ACTIVITY_RADIUS_METERS, routeBias),
          }, execution);
          unblockedCards = mergeCards(unblockedCards, chargerTextCards);
          addLog(`${query} text discovery merged: ${unblockedCards.length} activity cards`);
        } catch (err) {
        execution.check();
          addLog(`${query} text discovery error: ${compactError(err)}`);
        }
      }
    }

    if (shouldExpand(unblockedCards.length)) {
      addLog(`Food results sparse (${unblockedCards.length}); expanding radius to ${Math.round(EXPANDED_FOOD_RADIUS_METERS / 1609)} miles`);
      const expandedCacheKey = `${searchCacheKey(slot, center, types, EXPANDED_FOOD_RADIUS_METERS)}${preferenceKey}${timingKey}${routeBiasCacheKey(routeBias)}|expanded`;
      const expandedCachedCards = forceRefresh
        ? undefined
        : await readCachedSearch(STORAGE_SEARCH_CACHE, expandedCacheKey, SEARCH_CACHE_TTL_MS, 'Expanded food search');
      if (expandedCachedCards) {
        unblockedCards = mergeCards(unblockedCards, expandedCachedCards);
        addLog(`Expanded cache after filters: ${unblockedCards.length} cards`);
      } else {
        const expandedCards = await searchAndFilter(EXPANDED_FOOD_RADIUS_METERS);
        unblockedCards = mergeCards(unblockedCards, expandedCards);
        if (!execution.failures) await writeCachedSearch(STORAGE_SEARCH_CACHE, expandedCacheKey, expandedCards, 32, 'Expanded food search');
      }
      if (unblockedCards.length < MIN_FOOD_RESULTS_BEFORE_EXPAND && !activeTiming.timeWindow) {
        try {
          const openFoodTextCards = await searchOpenFoodByText(center, execution);
          unblockedCards = mergeCards(unblockedCards, openFoodTextCards);
          addLog(`Open food text fallback merged: ${unblockedCards.length} cards`);
        } catch (err) {
        execution.check();
          addLog(`Open food text fallback error: ${compactError(err)}`);
        }
      }
    } else if (slot === 'food' && wantsCloseBy(foodSelections)) {
      addLog('Food radius expansion skipped: Close by selected');
    } else if (slot === 'food') {
      addLog(`Food radius expansion not needed: ${unblockedCards.length} results`);
    }

    if (wantsEvents && !chargerFocused) {
      let ticketmasterEventCount = unblockedCards.filter((card) => card.kind === 'event' && card.source === 'Ticketmaster').length;
      try {
        const ticketmasterCards = await searchTicketmasterEvents(center, TICKETMASTER_EVENT_RADIUS_MILES, execution);
        ticketmasterEventCount = applyResultFilters(ticketmasterCards).length;
        unblockedCards = mergeCards(unblockedCards, ticketmasterCards);
        addLog(`Ticketmaster event results merged: ${unblockedCards.length} activity cards`);
      } catch (err) {
        execution.check();
        addLog(`Ticketmaster event search failed: ${compactError(err)}`);
      }

      if (eventsFocused && ticketmasterEventCount < 4) {
        try {
          const ticketmasterNames = new Set(
            unblockedCards
              .filter((card) => card.kind === 'event' && card.source === 'Ticketmaster')
              .map((card) => normalizePlaceName(card.title)),
          );
          const localEventCards = (await searchLocalEventPlaces(center, execution))
            .filter((card) => !ticketmasterNames.has(normalizePlaceName(card.title)));
          unblockedCards = mergeCards(unblockedCards, localEventCards);
          addLog(`Local event fallback merged: ${unblockedCards.length} activity cards`);
        } catch (err) {
        execution.check();
          addLog(`Local event fallback failed: ${compactError(err)}`);
        }
      }
    }

    execution.check();
    const sortedCards = unblockedCards.sort((a, b) => {
      if (wantsEvents) {
        if (eventsFocused) {
          const sourceA = a.source === 'Ticketmaster' ? 0 : a.kind === 'event' ? 1 : 2;
          const sourceB = b.source === 'Ticketmaster' ? 0 : b.kind === 'event' ? 1 : 2;
          if (sourceA !== sourceB) return sourceA - sourceB;
          const routeScoreDiff = routeBiasScore(b, routeBias) - routeBiasScore(a, routeBias);
          if (routeScoreDiff !== 0) return routeScoreDiff;
          const timeA = a.eventStartMs || Number.POSITIVE_INFINITY;
          const timeB = b.eventStartMs || Number.POSITIVE_INFINITY;
          if (timeA !== timeB) return timeA - timeB;
          return distanceMeters(center, a) - distanceMeters(center, b);
        }

        return activityCardScore(b, center, memory, selectedMoods, activitySelections, eventsFocused, routeBias) -
          activityCardScore(a, center, memory, selectedMoods, activitySelections, eventsFocused, routeBias);
      }

      if (slot === 'food') {
        return foodCardScore(b, center, memory, selectedMoods, foodSelections, selectedDietaryPreferences, routeBias) +
          foodTimePreferenceScore(b, activeTiming.timePreference) -
          (foodCardScore(a, center, memory, selectedMoods, foodSelections, selectedDietaryPreferences, routeBias) +
            foodTimePreferenceScore(a, activeTiming.timePreference));
      }

      return scoreCard(b, memory, selectedMoods) + routeBiasScore(b, routeBias) -
        (scoreCard(a, memory, selectedMoods) + routeBiasScore(a, routeBias));
    });
    const finalCards = wantsEvents && !eventsFocused
      ? promoteActivityEvents(capActivityEventBlend(sortedCards, activitySelections), activitySelections)
      : sortedCards;
    addLog(`Final card count: ${finalCards.length}`);
    addLog(`Top results: ${finalCards.slice(0, 5).map((card) => card.title).join(' | ') || 'none'}`);
    if (requestId !== searchRequestIdRef.current) {
      addLog('Ignoring stale search results');
      return;
    }
    setResultMode(slot);
    setHasInitiatedSearch(true);
    setCards(finalCards);
    setSearchFailed(execution.failures > 0 && finalCards.length === 0);
    setSearchNotice([execution.failures ? (finalCards.length
      ? 'Some results could not be loaded. You can use these matches or try again.'
      : 'Search is temporarily unavailable. Try again or add a place manually.') : '', ...execution.notices].filter(Boolean).join(' '));
    setVisibleCount(PAGE_SIZE);
    await rememberFavoriteCardsFromResults(slot, finalCards);
    if (!execution.failures && !execution.notices.length) await writeCachedSearch(STORAGE_SEARCH_CACHE, cacheKey, finalCards, 32, 'Nearby search');
  };

  const searchForSlot = async (
    slot: PlanSlot,
    shouldScroll = false,
    forceRefresh = false,
    centerOverride?: LatLon,
    preferenceOverride?: SearchPreferenceOverride,
    routeBiasOverride?: SearchRouteBias,
  ) => {
    const execution = beginSearch(forceRefresh);
    const requestId = execution.id;
    const foodSelections = preferenceOverride?.foodSelections || selectedFoods;
    const activitySelections = preferenceOverride?.activitySelections || selectedActivities;
    const dietaryPreferences = preferenceOverride?.dietarySelections || selectedDietary;
    if (resultFilter === 'favorites' && !cards.length && memory.favorites.length > 0) {
      addLog('Favorites filter needs a search before saved places can be shown');
    }
    addLog(`Find button tapped: ${slot}`);
    if (!keyLoaded && !(slot === 'activity' && activitySelections.includes('Events') && TICKETMASTER_API_KEY)) {
      setResultMode(slot);
      setResultFilter('all');
      setHasInitiatedSearch(true);
      setCards([]);
      setVisibleCount(PAGE_SIZE);
      setSearchFailed(true);
      setLoading(false);
      setSearchNotice('Search is temporarily unavailable. You can add a place manually.');
      notifyGooglePlacesMissing('Search stopped: Google Places key missing');
      return;
    }

    setResultMode(slot);
    setResultFilter('all');
    setHasInitiatedSearch(true);
    setCards([]);
    setVisibleCount(PAGE_SIZE);
    setSearchNotice('');
    setLoading(true);
    if (shouldScroll) scrollToResults();
    try {
      const center = centerOverride || await getSearchLocation();
      if (requestId !== searchRequestIdRef.current) return;
      setLastSearchLocationCenter(center);
      if (slot === 'activity') {
        const types = typesForSelection(activitySelections, ACTIVITY_TYPE_MAP, DEFAULT_ACTIVITY_TYPES);
        addLog(`Selected activity types: ${types.join(', ')}`);
        const anchorIndex = centerOverride || center.areaFocus
          ? -1
          : plan.stops.findIndex((stop) => stop.slot === 'food' && typeof stop.item !== 'string' && Boolean(stop.item.lat && stop.item.lng));
        const anchor = anchorIndex >= 0 && typeof plan.stops[anchorIndex].item !== 'string'
          ? (plan.stops[anchorIndex].item as PlaceCard)
          : null;
        const routeBias = routeBiasOverride || searchRouteBiasForAnchorIndex(anchorIndex);
        if (anchor) {
          const activityRadius = activitySelections.includes('Movies') ? DEFAULT_ACTIVITY_RADIUS_METERS : PAIRING_RADIUS_METERS;
          await runPlacesSearch('activity', { latitude: anchor.lat!, longitude: anchor.lng!, label: anchor.title }, types, activityRadius, forceRefresh, foodSelections, requestId, dietaryPreferences, activitySelections, routeBias);
        } else {
          await runPlacesSearch('activity', center, types, DEFAULT_ACTIVITY_RADIUS_METERS, forceRefresh, foodSelections, requestId, dietaryPreferences, activitySelections, routeBiasOverride);
        }
      } else {
        const types = typesForSelection(foodSelections, FOOD_TYPE_MAP, DEFAULT_FOOD_TYPES);
        addLog(`Selected food types: ${types.join(', ')}`);
        await runPlacesSearch('food', center, types, wantsCloseBy(foodSelections) ? CLOSE_BY_RADIUS_METERS : DEFAULT_RADIUS_METERS, forceRefresh, foodSelections, requestId, dietaryPreferences, activitySelections, routeBiasOverride);
      }
    } catch (err) {
      if (execution.id !== searchRequestIdRef.current || isSearchCancelled(err)) return;
      setSearchFailed(true);
      addLog(`Find failed: ${compactError(err)}`);
      const searchError = compactError(err);
      const needsLocation = /location|gps|geolocation|secure origin/i.test(searchError);
      setSearchNotice(needsLocation
        ? 'Location is unavailable. Enter a ZIP, neighborhood, or city under Search area and try again.'
        : 'Search is temporarily unavailable. Try again or add a place manually.');
    } finally {
      if (requestId === searchRequestIdRef.current) setLoading(false);
    }
  };

  const findThings = async () => {
    await searchForSlot(resultMode);
  };

  const chooseDateWindow = (next: DateWindowId, label: string) => {
    if (next === 'custom') {
      setCustomDateOpen((prev) => !prev);
      return;
    }

    selectedDateWindowRef.current = next;
    setSelectedDateWindow(next);
    const nextDateRange = dateRangeKeysForWindow(next, null);
    activePlanTimingRef.current = { ...activePlanTimingRef.current, dateRange: nextDateRange };
    setPlan((prev) => {
      if (prev.status === 'locked') return prev;
      const nextPlanType = inferPlanType({
        planDateStart: nextDateRange.start,
        planDateEnd: nextDateRange.end,
        destinationLabel: searchLocationLabel,
        title: prev.title,
      });
      const nextRoadTripMode = inferRoadTripMode({
        planType: nextPlanType,
        destinationLabel: searchLocationLabel,
        startingLocationLabel,
        routeProvider: prev.routeProvider,
        sourceUrl: prev.sourceUrl,
        stops: prev.stops,
        currentRoadTripMode: prev.roadTripMode,
      });
      return {
        ...prev,
        dateWindow: next,
        customDateRange: null,
        planDateStart: nextDateRange.start,
        planDateEnd: nextDateRange.end,
        planType: nextPlanType,
        roadTripMode: nextRoadTripMode,
        vehicleProfile: vehicleProfileForPlan(nextRoadTripMode, prev.vehicleProfile, prev.stops, searchLocationLabel),
        chargingStops: chargingStopIdeasFromStops(prev.stops, prev.chargingStops || []),
        nearbyPlacesDuringCharging: prev.nearbyPlacesDuringCharging || [],
        lockedArrivalTimes: undefined,
        savedPlanId: undefined,
      };
    });
    setCustomDateOpen(false);
    if (activePlanningSession) void updateActiveSessionDate(next, null);
    addLog(`Date window selected: ${label}`);
    if (!hasInitiatedSearch) {
      resetResultsUntilSearch();
      return;
    }

    setResultFilter('all');
    setCards([]);
    setVisibleCount(PAGE_SIZE);
    setLoading(true);
    const pending = beginSearch();
    setTimeout(() => {
      if (pending.id === searchRequestIdRef.current) void searchForSlot(resultMode, true, false);
    }, 25);
  };

  const applyCustomDateWindow = () => {
    const start = parseDateInput(customDateStartInput);
    const end = parseDateInput(customDateEndInput);
    if (!start || !end) {
      showAppNotice('Check dates', 'Use dates like 2026-06-12.');
      return;
    }
    if (end < start) {
      showAppNotice('Check dates', 'End date must be the same as or after the start date.');
      return;
    }

    const nextRange = {
      start: formatDateInput(start),
      end: formatDateInput(end),
    };
    activePlanTimingRef.current = { ...activePlanTimingRef.current, dateRange: nextRange };
    customDateRangeRef.current = nextRange;
    setCustomDateRange(nextRange);
    setCustomDateOpen(false);
    selectedDateWindowRef.current = 'custom';
    setSelectedDateWindow('custom');
    setPlan((prev) => {
      if (prev.status === 'locked') return prev;
      const nextPlanType = inferPlanType({
        planDateStart: nextRange.start,
        planDateEnd: nextRange.end,
        destinationLabel: searchLocationLabel,
        title: prev.title,
      });
      const nextRoadTripMode = inferRoadTripMode({
        planType: nextPlanType,
        destinationLabel: searchLocationLabel,
        startingLocationLabel,
        routeProvider: prev.routeProvider,
        sourceUrl: prev.sourceUrl,
        stops: prev.stops,
        currentRoadTripMode: prev.roadTripMode,
      });
      return {
        ...prev,
        dateWindow: 'custom',
        customDateRange: nextRange,
        planDateStart: nextRange.start,
        planDateEnd: nextRange.end,
        planType: nextPlanType,
        roadTripMode: nextRoadTripMode,
        vehicleProfile: vehicleProfileForPlan(nextRoadTripMode, prev.vehicleProfile, prev.stops, searchLocationLabel),
        chargingStops: chargingStopIdeasFromStops(prev.stops, prev.chargingStops || []),
        nearbyPlacesDuringCharging: prev.nearbyPlacesDuringCharging || [],
        lockedArrivalTimes: undefined,
        savedPlanId: undefined,
      };
    });
    if (activePlanningSession) void updateActiveSessionDate('custom', nextRange);
    addLog(`Custom date window selected: ${nextRange.start} to ${nextRange.end}`);

    if (!hasInitiatedSearch) {
      resetResultsUntilSearch();
      return;
    }

    setResultFilter('all');
    setCards([]);
    setVisibleCount(PAGE_SIZE);
    setLoading(true);
    const pending = beginSearch();
    setTimeout(() => {
      if (pending.id === searchRequestIdRef.current) void searchForSlot(resultMode, true, false);
    }, 25);
  };

  const refreshAfterSearchContextChange = (centerOverride?: LatLon) => {
    if (!hasInitiatedSearch) {
      resetResultsUntilSearch();
      return;
    }

    setResultFilter('all');
    setCards([]);
    setVisibleCount(PAGE_SIZE);
    setLoading(true);
    const pending = beginSearch();
    setTimeout(() => {
      if (pending.id === searchRequestIdRef.current) void searchForSlot(resultMode, true, false, centerOverride);
    }, 25);
  };

  const beginSettingsLocationSearch = () => {
    setResultFilter('all');
    setHasInitiatedSearch(true);
    setCards([]);
    setVisibleCount(PAGE_SIZE);
    setSearchNotice('');
    setLoading(true);
    scrollToResults();
  };

  const searchAfterSettingsLocationChange = (centerOverride?: LatLon) => {
    if (!hasInitiatedSearch) {
      void searchForSlot(resultMode, true, false, centerOverride);
      return;
    }

    refreshAfterSearchContextChange(centerOverride);
  };

  const rememberFavoriteCardsFromResults = async (slot: PlanSlot, nextCards: PlaceCard[]) => {
    const missingFavorites = nextCards.filter((card) =>
      memory.favorites.includes(card.id) && !memory.favoriteCards?.[card.id],
    );
    if (!missingFavorites.length) return;

    const favoriteCards = { ...(memory.favoriteCards || {}) };
    missingFavorites.forEach((card) => {
      favoriteCards[card.id] = { slot, card, location: lastSearchLocationCenter || searchLocation || location || undefined };
    });
    await saveMemory({ ...memory, favoriteCards });
    addLog(`Backfilled favorite cards: ${missingFavorites.length}`);
  };

  const searchFromPlan = async (slot: PlanSlot, visualType: ItineraryStopKind = slot) => {
    const anchorIndex = plan.stops.length - 1;
    setPendingVisualType(undefined);
    setSearchVisualType(visualType);
    setAddStopMenuOpen(false);
    setResultMode(slot);
    const preferenceOverride: SearchPreferenceOverride = visualType === 'dessert'
      ? { foodSelections: ['Dessert'] }
      : slot === 'food'
        ? { foodSelections: [...DEFAULT_FOOD_SELECTIONS] }
      : { activitySelections: [...DEFAULT_ACTIVITY_SELECTIONS] };
    if (slot === 'food') {
      setSelectedFoods(preferenceOverride.foodSelections || [...DEFAULT_FOOD_SELECTIONS]);
    } else {
      setSelectedActivities(preferenceOverride.activitySelections || [...DEFAULT_ACTIVITY_SELECTIONS]);
    }
    setPreferencesOpen(false);
    scrollToResults();
    await searchForSlot(
      slot,
      true,
      false,
      activeSearchLocation?.areaFocus ? activeSearchLocation : anchorIndex >= 0 ? stopSearchCenter(plan.stops[anchorIndex]) : undefined,
      preferenceOverride,
      searchRouteBiasForAnchorIndex(anchorIndex),
    );
  };

  const refreshFromPreferences = async () => {
    setPreferencesOpen(false);
    scrollToResults();
    await searchForSlot(resultMode, true, true);
  };

  const searchFromLocationOverride = async () => {
    const value = routeOriginOverride.trim();
    if (!value) {
      showAppNotice('Location needed', 'Enter a ZIP, address, or place first.');
      return;
    }

    addLog(`Location override tapped: ${value}`);
    const shouldDeferSearch = !hasInitiatedSearch && !plan.stops.length;
    if (!shouldDeferSearch) beginSettingsLocationSearch();
    const execution = beginSearch();
    try {
      const next = await resolveLocationInput(value);
      execution.check();
      if (!next) {
        setLoading(false);
        showAppNotice('Location not found', `Could not find a location for ${value}.`);
        addLog(`Location geocode returned no results: ${value}`);
        return;
      }

      const stamped = { ...next, ts: Date.now() };
      if (activePlanningSession) {
        setLocation(stamped);
        await updateSessionRouteContext(value, stamped);
      } else {
        await saveLocation(next);
      }
      addLog(`Location override saved: ${value} ${next.latitude.toFixed(4)}, ${next.longitude.toFixed(4)}`);
      setLocationOverrideOpen(false);
      setPreferencesOpen(false);
      if (shouldDeferSearch) {
        resetResultsUntilSearch();
        addLog('Starting location saved; waiting for Food or Activity search');
        return;
      }
      const refreshCenter = activePlanningSession?.searchLocation || searchLocation || (searchLocationOverride.trim() ? undefined : next);
      searchAfterSettingsLocationChange(refreshCenter);
      addLog('Starting location saved; refreshing active results');
    } catch (err) {
      if (execution.id !== searchRequestIdRef.current || isSearchCancelled(err)) return;
      setLoading(false);
      addLog(`Location override failed: ${compactError(err)}`);
      showAppNotice('Location search failed', compactError(err));
    }
  };

  const clearLocationOverride = async () => {
    setRouteOriginOverride('');
    setLocation(null);
    setLocationOverrideOpen(false);
    if (activePlanningSession) {
      await updateSessionRouteContext('Current location');
    } else {
      await AsyncStorage.removeItem(STORAGE_LOCATION);
    }
    refreshAfterSearchContextChange(activePlanningSession?.searchLocation || searchLocation || undefined);
    addLog('Starting location override cleared');
  };

  const searchFromSearchLocationOverride = async () => {
    const value = searchLocationOverride.trim();
    if (!value) {
      showAppNotice('Search location needed', 'Enter a ZIP, address, or place first.');
      return;
    }

    addLog(`Search location tapped: ${value}`);
    const shouldDeferSearch = !hasInitiatedSearch && !plan.stops.length;
    if (!shouldDeferSearch) beginSettingsLocationSearch();
    const execution = beginSearch();
    try {
      const next = await resolveLocationInput(value);
      execution.check();
      if (!next) {
        setLoading(false);
        showAppNotice('Location not found', `Could not find a location for ${value}.`);
        addLog(`Search location geocode returned no results: ${value}`);
        return;
      }

      if (activePlanningSession) {
        const stamped = { ...next, ts: Date.now() };
        setSearchLocation(stamped);
        setLastSearchLocationCenter(stamped);
        await updateActiveSessionSearchLocation(stamped);
      } else {
        await saveSearchLocation(next);
      }
      addLog(`Search location saved: ${value} ${next.latitude.toFixed(4)}, ${next.longitude.toFixed(4)}`);
      setSearchLocationOverrideOpen(false);
      setPreferencesOpen(false);
      if (shouldDeferSearch) {
        resetResultsUntilSearch();
        addLog('Search location saved; waiting for Food or Activity search');
        return;
      }
      searchAfterSettingsLocationChange(next);
      addLog('Search location saved; refreshing active results');
    } catch (err) {
      if (execution.id !== searchRequestIdRef.current || isSearchCancelled(err)) return;
      setLoading(false);
      addLog(`Search location failed: ${compactError(err)}`);
      showAppNotice('Search location failed', compactError(err));
    }
  };

  const clearSearchLocationOverride = async () => {
    if (activePlanningSession) {
      showAppNotice('Shared location required', 'A planning session needs a shared search location. Edit it instead of clearing it.');
      return;
    }
    setSearchLocationOverride('');
    setSearchLocation(null);
    setLastSearchLocationCenter(null);
    setSearchLocationOverrideOpen(false);
    await AsyncStorage.removeItem(STORAGE_SEARCH_LOCATION);
    refreshAfterSearchContextChange(location || undefined);
    addLog('Search location override cleared');
  };

  const getAreaBaseLocation = async () => {
    if (activePlanningSession) return activePlanningSession.searchLocation.areaFocus?.base || activePlanningSession.searchLocation;
    const input = searchLocationOverride.trim();
    if (searchLocation && (!input || searchLocation.label?.trim().toLowerCase() === input.toLowerCase())) {
      return searchLocation.areaFocus?.base || searchLocation;
    }
    const query = input || routeOriginOverride.trim();
    if (query) {
      const resolved = await resolveLocationInput(query);
      if (!resolved) throw new Error('Search location not found.');
      return resolved;
    }
    return getLocation();
  };

  const loadSearchAreas = async (kind: AreaKind, execution: SearchExecution) => {
    const base = await getAreaBaseLocation();
    execution.check();
    if (kind !== 'freeway') await recordPlacesUsage('text');
    const matches = await findSearchAreas(GOOGLE_API_KEY || '', kind, '', base, execution);
    execution.check();
    return { base, matches };
  };

  const selectSearchArea = async (selection: AreaLocation | null) => {
    const execution = beginSearch();
    setAreaSelection({ kind: selection?.areaFocus?.kind || 'whole', requestId: execution.id });
    setHasInitiatedSearch(true);
    setLoading(true);
    setResultFilter('all');
    try {
      const next = selection || await getAreaBaseLocation();
      execution.check();
      setSearchLocationOverride(next.label || '');
      if (activePlanningSession) {
        const stamped = { ...next, ts: Date.now() };
        setSearchLocation(stamped);
        setLastSearchLocationCenter(stamped);
        await updateActiveSessionSearchLocation(stamped);
      } else {
        await saveSearchLocation(next);
      }
      execution.check();
      if (manualSearchSubmitted && manualSearch.trim()) {
        void runManualSearch(resultMode, next);
      } else {
        void searchForSlot(resultMode, true, false, next);
      }
    } catch (error) {
      if (execution.id !== searchRequestIdRef.current || isSearchCancelled(error)) return;
      setCards([]);
      setSearchFailed(true);
      setSearchNotice('Could not update the area. Check your city or ZIP, then choose the area again.');
    } finally {
      if (execution.id === searchRequestIdRef.current) {
        setAreaSelection(null);
        setLoading(false);
      }
    }
  };

  const renderSearchAreaPicker = () => (
    <SearchAreaPicker
      location={activeSearchLocation}
      contextKey={`${activePlanningSession?.id || ''}:${searchLocationOverride}:${activeSearchLocation?.areaFocus?.base.latitude ?? activeSearchLocation?.latitude ?? location?.latitude ?? ''}:${activeSearchLocation?.areaFocus?.base.longitude ?? activeSearchLocation?.longitude ?? location?.longitude ?? ''}:${routeOriginOverride}`}
      pendingKind={areaSelection?.requestId === searchRequestIdRef.current ? areaSelection.kind : undefined}
      onLoad={loadSearchAreas}
      onSelect={selectSearchArea}
    />
  );

  const patchPlanningSession = async (id: string, updater: (session: PlanningSession) => PlanningSession) => {
    const existing = planningSessions.find((session) => session.id === id);
    if (!existing) return;
    const updated = { ...updater(existing), updatedAt: Date.now() };
    await savePlanningSessions(planningSessions.map((session) => session.id === id ? updated : session));
  };

  const createPlanningSession = async () => {
    if (!sessionInvitees.length) {
      showAppNotice('Invite testers', 'Choose at least one local tester user for this planning session.');
      return;
    }

    const locationInput = sessionLocationInput.trim();
    try {
      const resolvedLocation = locationInput
        ? await resolveLocationInput(locationInput)
        : searchLocation || location || await getLocation();
      if (!resolvedLocation) {
        showAppNotice('Shared location needed', 'Enter a ZIP, address, or place for the shared session search.');
        return;
      }

      const labeledLocation = await labelApproximateLocation({ ...resolvedLocation, label: locationInput || resolvedLocation.label || 'Shared search' });
      const stampedLocation = { ...labeledLocation, ts: Date.now() };
      const participants = unique([currentTesterName, ...sessionInvitees]);
      const title = `${planningIntentLabel(sessionIntent)} near ${stampedLocation.label || 'shared location'}`;
      const routeContext: PlanningRouteContext = {
        originLabel: routeOriginOverride.trim() || location?.label || 'Current location',
        location: location || undefined,
        updatedAt: Date.now(),
      };
      const nextSession: PlanningSession = {
        id: `planning-session-${Date.now()}`,
        owner: currentTesterName,
        participants,
        title,
        locationLabel: stampedLocation.label || 'Shared search',
        searchLocation: stampedLocation,
        dateWindow: selectedDateWindow,
        customDateRange,
        timeWindow: sessionTimeWindowInput.trim() || defaultTimeWindowForPreference(selectedTime),
        intent: sessionIntent,
        suggestions: [],
        finalizedSuggestionIds: [],
        finalPlan: [],
        routeContexts: { [currentTesterName]: routeContext },
        status: 'planning',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await savePlanningSessions([nextSession, ...planningSessions]);
      await saveActivePlanningSession(nextSession.id);
      setSessionBuilderOpen(false);
      setSessionInvitees([]);
      setSearchLocation(stampedLocation);
      setLastSearchLocationCenter(stampedLocation);
      setSearchLocationOverride(stampedLocation.label || '');
      setResultMode(sessionIntent === 'activity' ? 'activity' : 'food');
      setHasInitiatedSearch(false);
      setCards([]);
      addLog(`Planning session created: ${title}`);
      showToast('Planning session started');
    } catch (err) {
      addLog(`Planning session create failed: ${compactError(err)}`);
      showAppNotice('Could not create session', compactError(err));
    }
  };

  const resumePlanningSession = async (id: string) => {
    await saveActivePlanningSession(id);
    setSessionBuilderOpen(false);
    addLog('Planning session resumed');
  };

  const exitPlanningSession = async () => {
    await saveActivePlanningSession(null);
    setSessionBuilderOpen(false);
    const [rawLocation, rawSearchLocation] = await Promise.all([
      AsyncStorage.getItem(STORAGE_LOCATION),
      AsyncStorage.getItem(STORAGE_SEARCH_LOCATION),
    ]);
    if (rawLocation) setLocation(JSON.parse(rawLocation) as LatLon);
    if (rawSearchLocation) {
      const cached = JSON.parse(rawSearchLocation) as LatLon;
      setSearchLocation(cached);
      setLastSearchLocationCenter(cached);
      setSearchLocationOverride(cached.label || '');
    }
    addLog('Planning session closed');
  };

  const updateSessionRouteContext = async (originLabel: string, routeLocation?: LatLon) => {
    if (!activePlanningSession) return;
    await patchPlanningSession(activePlanningSession.id, (session) => ({
      ...session,
      routeContexts: {
        ...(session.routeContexts || {}),
        [currentTesterName]: {
          originLabel,
          location: routeLocation,
          updatedAt: Date.now(),
        },
      },
    }));
  };

  const updateActiveSessionSearchLocation = async (nextLocation: LatLon) => {
    if (!activePlanningSession) return;
    const labeled = await labelApproximateLocation(nextLocation);
    const stamped = { ...labeled, ts: Date.now() };
    await patchPlanningSession(activePlanningSession.id, (session) => ({
      ...session,
      locationLabel: stamped.label || session.locationLabel,
      searchLocation: stamped,
      recommendation: undefined,
    }));
  };

  const updateActiveSessionDate = async (dateWindow: DateWindowId, nextCustomRange: CustomDateRange | null = null) => {
    if (!activePlanningSession) return;
    await patchPlanningSession(activePlanningSession.id, (session) => ({
      ...session,
      dateWindow,
      customDateRange: nextCustomRange,
      recommendation: undefined,
    }));
  };

  const addPlanningSuggestion = async (slot: PlanSlot, item: PlaceCard | string, source: PlanningSuggestionSource) => {
    if (!activePlanningSession) return false;
    const existing = activePlanningSession.suggestions.find((suggestion) => samePlanningSuggestion(suggestion, slot, item));
    if (existing) {
      if (!existing.votes.includes(currentTesterName)) {
        await patchPlanningSession(activePlanningSession.id, (session) => ({
          ...session,
          recommendation: undefined,
          suggestions: session.suggestions.map((suggestion) =>
            suggestion.id === existing.id
              ? { ...suggestion, votes: unique([...suggestion.votes, currentTesterName]) }
              : suggestion,
          ),
        }));
        showToast('Vote added to existing suggestion');
      } else {
        showToast('Already suggested');
      }
      return true;
    }

    const suggestion: PlanningSuggestion = {
      id: makePlanningSuggestionId(slot, item),
      slot,
      item,
      source,
      addedBy: currentTesterName,
      createdAt: Date.now(),
      votes: [currentTesterName],
    };
    await patchPlanningSession(activePlanningSession.id, (session) => ({
      ...session,
      recommendation: undefined,
      status: 'planning',
      suggestions: [suggestion, ...session.suggestions],
    }));
    addLog(`Planning suggestion added: ${cardToName(item) || slot}`);
    return true;
  };

  const addManualPlanningSuggestion = async (slot: PlanSlot) => {
    const value = sessionManualSuggestion.trim();
    if (!value) return;
    const added = await addPlanningSuggestion(slot, value, 'manual');
    if (added) setSessionManualSuggestion('');
  };

  const togglePlanningVote = async (suggestionId: string) => {
    if (!activePlanningSession) return;
    await patchPlanningSession(activePlanningSession.id, (session) => ({
      ...session,
      recommendation: undefined,
      suggestions: session.suggestions.map((suggestion) => {
        if (suggestion.id !== suggestionId) return suggestion;
        const voted = suggestion.votes.includes(currentTesterName);
        return {
          ...suggestion,
          votes: voted
            ? suggestion.votes.filter((user) => user !== currentTesterName)
            : unique([...suggestion.votes, currentTesterName]),
        };
      }),
    }));
  };

  const removePlanningSuggestion = async (suggestion: PlanningSuggestion) => {
    if (!activePlanningSession) return;
    if (suggestion.addedBy !== currentTesterName && activePlanningSession.owner !== currentTesterName) return;
    await patchPlanningSession(activePlanningSession.id, (session) => ({
      ...session,
      recommendation: undefined,
      suggestions: session.suggestions.filter((item) => item.id !== suggestion.id),
      finalizedSuggestionIds: session.finalizedSuggestionIds.filter((id) => id !== suggestion.id),
    }));
    addLog(`Planning suggestion removed: ${cardToName(suggestion.item) || suggestion.slot}`);
  };

  const buildFinalPlanRecommendation = async () => {
    if (!activePlanningSession || !isPlanningOwner) return;
    if (!activePlanningSession.suggestions.length) {
      showAppNotice('Add suggestions first', 'Food or activity suggestions are needed before building a final plan.');
      return;
    }
    const recommendation = buildPlanningRecommendation(activePlanningSession);
    if (!recommendation.suggestionIds.length) {
      showAppNotice('No matching suggestions', 'Add suggestions that match the session intent first.');
      return;
    }
    await patchPlanningSession(activePlanningSession.id, (session) => ({
      ...session,
      recommendation,
    }));
    addLog('Planning final recommendation built');
  };

  const acceptFinalPlanRecommendation = async () => {
    if (!activePlanningSession || !isPlanningOwner || !activePlanningSession.recommendation) return;
    const suggestionMap = new Map(activePlanningSession.suggestions.map((suggestion) => [suggestion.id, suggestion]));
    const selectedSuggestions = activePlanningSession.recommendation.suggestionIds
      .map((id) => suggestionMap.get(id))
      .filter(Boolean) as PlanningSuggestion[];
    const finalStops = selectedSuggestions.map((suggestion) => suggestionToStop(suggestion, `-final-${activePlanningSession.id}`));
    if (!finalStops.length) return;

    setPlan({
      ...currentPlanContext(finalStops),
      stops: finalStops,
      status: 'draft',
    });
    setPlanTimes({});
    setArrivalTimes({});
    setTimeEditorKey(null);
    setHasInitiatedSearch(false);
    setCards([]);
    finalStops.forEach((stop) => {
      void refreshStopFeatures(stop.key, stop.slot, stop.item);
    });
    await patchPlanningSession(activePlanningSession.id, (session) => ({
      ...session,
      status: 'finalized',
      finalizedSuggestionIds: activePlanningSession.recommendation?.suggestionIds || [],
      finalPlan: finalStops.map((stop) => cloneStopForSavedPlan(stop, '-session')),
    }));
    setTimeout(() => scrollRef.current?.scrollTo({ y: 0, animated: true }), 100);
    addLog('Planning session locked into itinerary');
  };

  const loadFinalSessionPlan = () => {
    if (!activePlanningSession?.finalPlan.length) return;
    const loadSuffix = `-session-load-${Date.now()}`;
    const loadedStops = activePlanningSession.finalPlan.map((stop) => cloneStopForSavedPlan(stop, loadSuffix));
    setPlan({
      ...currentPlanContext(loadedStops),
      stops: loadedStops,
      status: 'draft',
    });
    setPlanTimes({});
    setArrivalTimes({});
    loadedStops.forEach((stop) => {
      void refreshStopFeatures(stop.key, stop.slot, stop.item);
    });
    setTimeout(() => scrollRef.current?.scrollTo({ y: 0, animated: true }), 100);
  };

  const planningSessionShareText = (session: PlanningSession) => {
    const leading = session.suggestions
      .map((suggestion) => scorePlanningSuggestion(suggestion, session))
      .sort((a, b) => b.score - a.score)
      .slice(0, 4)
      .map(({ suggestion }) => {
        const voteCount = unique(suggestion.votes).length;
        return `- ${suggestion.slot === 'food' ? 'Food' : 'Activity'}: ${cardToName(suggestion.item) || 'Suggestion'} (${voteCount} vote${voteCount === 1 ? '' : 's'})`;
      });
    return [
      `NomNomGo planning session: ${session.title}`,
      `${dateWindowLabel(session.dateWindow, new Date(), session.customDateRange)} | ${session.timeWindow} | ${planningIntentLabel(session.intent)}`,
      `Participants: ${session.participants.join(', ')}`,
      '',
      leading.length ? 'Leading options:' : 'No suggestions yet.',
      ...leading,
      '',
      'Shared from NomNomGo',
    ].join('\n');
  };

  const sharePlanningSessionUpdate = async () => {
    if (!activePlanningSession) return;
    try {
      await Share.share({ message: planningSessionShareText(activePlanningSession) });
      addLog('Planning session update shared');
    } catch (err) {
      addLog(`Planning session share failed: ${compactError(err)}`);
    }
  };

  const openPlanningSuggestionMap = async (suggestion: PlanningSuggestion) => {
    if (typeof suggestion.item === 'string') {
      await openExternalUrl(mapsSearchUrl(suggestion.item, activePlanningSession?.searchLocation || searchLocation || location));
      return;
    }
    await openExternalUrl(suggestion.item.mapsUri || mapsSearchUrl(suggestion.item.title, suggestion.item));
  };

  const openPlaceDetails = async (card: PlaceCard) => {
    const request = ++placeDetailRequestRef.current;
    setPlaceDetailCard(cardForActivePlanTiming(card));
    if (!canResolvePlaceWebsite(card) || !GOOGLE_API_KEY) return;
    // Search already returns special hours. Avoid paying for a duplicate lookup
    // while that status is fresh and before its next opening/closing boundary.
    if (card.currentHoursStartDate && currentHoursDisplay(card).isOpen !== null) return;
    try {
      await recordPlacesUsage('text');
      const response = await withTimeout(
        fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeDetailsLookupId(card))}?languageCode=en`, {
          headers: {
            'X-Goog-Api-Key': GOOGLE_API_KEY,
            'X-Goog-FieldMask': PLACE_HOURS_FIELDS.join(','),
          },
          cache: 'no-store',
        }),
        12000,
        'Google Places hours lookup',
      );
      if (!response.ok) throw new Error(`Google Places hours status ${response.status}`);
      const hours = readPlaceHours(await response.json());
      if (request !== placeDetailRequestRef.current) return;
      setPlaceDetailCard((current) => current?.id === card.id
        ? cardForActivePlanTiming({ ...current, ...hours }) : current);
      setCards((previous) => previous.map((item) => item.id === card.id
        ? cardForActivePlanTiming({ ...item, ...hours }) : item));
    } catch {
      if (request !== placeDetailRequestRef.current) return;
      // Do not retain a cached green badge when fresh verification failed.
      setPlaceDetailCard((current) => current?.id === card.id
        ? cardForActivePlanTiming({ ...current, openNow: null, hoursFetchedAt: undefined }) : current);
      addLog('Google Places hours refresh failed');
    }
  };

  const hydrateCardWebsite = (cardId: string, websiteUri: string) => {
    setCards((prev) => prev.map((card) => card.id === cardId ? { ...card, websiteUri } : card));
    setPlan((prev) => ({
      ...prev,
      stops: prev.stops.map((stop) => {
        if (typeof stop.item === 'string' || stop.item.id !== cardId) return stop;
        return { ...stop, item: { ...stop.item, websiteUri } };
      }),
    }));
  };

  const resolveCardWebsite = async (card: PlaceCard) => {
    if (card.websiteUri) return card.websiteUri;
    if (!canResolvePlaceWebsite(card) || !GOOGLE_API_KEY) return undefined;

    try {
      addLog(`Google Places website lookup: ${card.title}`);
      await recordPlacesUsage('text');
      const response = await withTimeout(
        fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeDetailsLookupId(card))}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': GOOGLE_API_KEY,
            'X-Goog-FieldMask': PLACE_WEBSITE_FIELD_MASK,
          },
        }),
        12000,
        `Google Places website lookup ${card.title}`,
      );

      const text = await response.text();
      addLog(`Google Places website status: ${response.status}`);
      if (!response.ok) {
        addLog(`Google Places website lookup failed: ${response.status} ${text.slice(0, 140)}`);
        return undefined;
      }

      const json = JSON.parse(text);
      const websiteUri = typeof json?.websiteUri === 'string' ? json.websiteUri : undefined;
      if (websiteUri) hydrateCardWebsite(card.id, websiteUri);
      return websiteUri;
    } catch (err) {
      addLog(`Google Places website lookup failed: ${compactError(err)}`);
      return undefined;
    }
  };

  const openPlaceWebsite = async (card: PlaceCard, logLabel: string) => {
    const websiteUri = await resolveCardWebsite(card);
    if (!websiteUri) {
      showToast('Website not found');
      return;
    }
    addLog(`${logLabel}: ${card.title}`);
    await openExternalUrl(websiteUri);
  };

  const openPlanningSuggestionEvent = async (suggestion: PlanningSuggestion) => {
    if (typeof suggestion.item === 'string' || !suggestion.item.eventUrl) return;
    await openExternalUrl(suggestion.item.eventUrl);
  };

  const openPlanningSuggestionWebsite = async (suggestion: PlanningSuggestion) => {
    if (typeof suggestion.item === 'string') return;
    await openPlaceWebsite(suggestion.item, 'Planning suggestion Website action');
  };

  const runSuggestion = async (suggestion: PairingSuggestion) => {
    if (isPlanLocked) {
      showToast('Unlock the plan to edit it');
      return;
    }
    addLog(`Suggested pairing tapped: ${suggestion.label}`);
    if (suggestion.combo?.length) {
      const nextStops = suggestion.combo.map((stop) => ({
        key: makeStopKey(stop.slot, stop.item),
        slot: stop.slot,
        item: stop.item,
        featureOptions: [],
        selectedFeatures: [],
        featuresExpanded: false,
      }));
      setPlan({
        ...currentPlanContext(nextStops),
        stops: nextStops,
        status: 'draft',
      });
      nextStops.forEach((stop) => {
        void refreshStopFeatures(stop.key, stop.slot, stop.item);
      });
      setPlanTimes({});
      setArrivalTimes({});
      setTimeEditorKey(null);
      setPreferencesOpen(false);
      setHasInitiatedSearch(false);
      setTimeout(() => scrollRef.current?.scrollTo({ y: 0, animated: true }), 100);
      addLog(`Favorite combo populated itinerary: ${suggestion.combo.map((stop) => cardToName(stop.item)).filter(Boolean).join(' | ')}`);
      return;
    }

    setResultMode(suggestion.slot);
    setPreferencesOpen(false);

    if (suggestion.slot === 'activity') {
      setSelectedActivities(suggestion.selections);
    } else {
      setSelectedFoods(suggestion.selections);
    }

    if (!keyLoaded) {
      await searchForSlot(suggestion.slot, true);
      return;
    }
    const execution = beginSearch();
    setHasInitiatedSearch(true);
    setCards([]);
    setVisibleCount(PAGE_SIZE);
    setLoading(true);
    scrollToResults();
    try {
      const center = await getSearchLocation();
      execution.check();
      const lastCompatibleIndex = plan.stops.length > 0 && plan.stops[plan.stops.length - 1].slot !== suggestion.slot
        ? plan.stops.length - 1
        : -1;
      const fallbackAnchorIndex = suggestion.slot === 'activity'
        ? plan.stops.findIndex((stop) => stop.slot === 'food' && typeof stop.item !== 'string' && Boolean(stop.item.lat && stop.item.lng))
        : plan.stops.findIndex((stop) => stop.slot === 'activity' && typeof stop.item !== 'string' && Boolean(stop.item.lat && stop.item.lng));
      const anchorIndex = lastCompatibleIndex >= 0 ? lastCompatibleIndex : fallbackAnchorIndex;
      const anchor = anchorIndex >= 0 ? stopSearchCenter(plan.stops[anchorIndex]) : undefined;
      const routeBias = searchRouteBiasForAnchorIndex(anchorIndex);
      const searchCenter = anchor || center;
      const types =
        suggestion.slot === 'activity'
          ? typesForSelection(suggestion.selections, ACTIVITY_TYPE_MAP, DEFAULT_ACTIVITY_TYPES)
          : typesForSelection(suggestion.selections, FOOD_TYPE_MAP, DEFAULT_FOOD_TYPES);
      const suggestionRadius =
        suggestion.slot === 'activity'
          ? suggestion.selections.includes('Movies')
            ? DEFAULT_ACTIVITY_RADIUS_METERS
            : anchor
              ? PAIRING_RADIUS_METERS
              : DEFAULT_ACTIVITY_RADIUS_METERS
          : DEFAULT_RADIUS_METERS;
      await runPlacesSearch(
        suggestion.slot,
        searchCenter,
        types,
        suggestionRadius,
        false,
        suggestion.slot === 'food' ? suggestion.selections : selectedFoods,
        execution.id,
        selectedDietary,
        suggestion.slot === 'activity' ? suggestion.selections : selectedActivities,
        routeBias,
      );
    } catch (err) {
      if (execution.id !== searchRequestIdRef.current || isSearchCancelled(err)) return;
      setSearchFailed(true);
      setSearchNotice('Search is temporarily unavailable. Try again or add a place manually.');
      addLog(`Suggested pairing search failed: ${compactError(err)}`);
    } finally {
      if (execution.id === searchRequestIdRef.current) setLoading(false);
    }
  };

  const insertStopIntoPlan = (
    slot: PlanSlot,
    item: PlaceCard | string,
    requestedVisualType?: ItineraryStopKind,
    searchCenter?: AreaLocation | null,
  ) => {
    if (isPlanLocked) {
      showToast('Unlock the plan to edit it');
      return undefined;
    }
    const existingStop = plan.stops.find((stop) => stop.slot === slot && cardToId(stop.item) === cardToId(item));
    if (existingStop) {
      return undefined;
    }

    const visualType = inferItineraryStopKind({
      explicitKind: requestedVisualType,
      slot,
      title: cardToName(item),
      types: typeof item === 'string' ? [] : item.types,
    });
    const nextStop: ItineraryStop = {
      key: makeStopKey(slot, item),
      slot,
      item,
      visualType,
      featureOptions: [],
      selectedFeatures: [],
      featuresExpanded: false,
    };
    nextStop.durationMinutes = defaultStopDurationMinutes(nextStop);
    const companion = searchSuperchargerStop(searchCenter);
    setPlan((prev) => {
      if (prev.status === 'locked') return prev;
      const nextStops = appendPlanSelection(prev.stops, nextStop, companion);
      if (nextStops === prev.stops) return prev;
      return {
        ...prev,
        ...currentPlanContext(nextStops),
        stops: nextStops,
        lockedArrivalTimes: undefined,
        savedPlanId: undefined,
      };
    });
    setRecentlyAddedStopKey(nextStop.key);
    setTimeout(() => setRecentlyAddedStopKey((current) => current === nextStop.key ? null : current), 320);
    void refreshStopFeatures(nextStop.key, slot, item);
    return nextStop;
  };

  const addIdeaStop = () => {
    const value = ideaDraft.trim();
    if (!value || isPlanLocked) return;
    const insertedStop = insertStopIntoPlan('activity', value, 'idea');
    setIdeaDraft('');
    setPendingVisualType(undefined);
    setAddStopMenuOpen(false);
    if (insertedStop) scrollToPlanStop(insertedStop.key);
  };

  const toggleExpandedStop = (key: string) => {
    setExpandedStopKey((current) => {
      const next = current === key ? null : key;
      if (next !== key || timeEditorKey !== key) setTimeEditorKey(null);
      return next;
    });
  };

  const updateStopDuration = (key: string, durationMinutes: number) => {
    if (isPlanLocked) return;
    const nextDuration = Math.max(15, Math.round(durationMinutes / 15) * 15);
    setPlan((prev) => ({
      ...prev,
      stops: prev.stops.map((stop) => stop.key === key ? { ...stop, durationMinutes: nextDuration } : stop),
      lockedArrivalTimes: undefined,
      savedPlanId: undefined,
    }));
    setPlanTimes((prev) => ({ ...prev, [key]: stopTimeFromMinutes(nextDuration) }));
  };

  const reorderPlanStops = ({ order, fromIndex, toIndex }: SortableFlexDragEndParams) => {
    if (isPlanLocked || fromIndex === toIndex) return;
    setPlan((prev) => {
      const stops = order(prev.stops);
      return {
        ...prev,
        ...currentPlanContext(stops),
        stops,
        lockedArrivalTimes: undefined,
        savedPlanId: undefined,
      };
    });
    setArrivalTimes({});
    addLog(`Plan stop moved from ${fromIndex + 1} to ${toIndex + 1}`);
  };

  const selectNowDestination = async (slot: PlanSlot, item: PlaceCard | string) => {
    const category = slot === 'food' ? nowFoodCategory : nowActivityCategory;
    await createNowPlanFromDestination({ slot, item, category });
    setManualSearch('');
    setManualSearchSubmitted(false);
  };

  const selectCard = async (card: PlaceCard) => {
    if (isPlanLocked && !planningSuggestionMode) {
      showToast('Unlock the plan to edit it');
      return;
    }
    addLog(`Card Select action: ${card.title}`);
    const nextMemory = {
      ...memory,
      selectedHistory: unique([card.id, ...memory.selectedHistory]).slice(0, 80),
    };
    await saveMemory(nextMemory);

    if (planningSuggestionMode) {
      await addPlanningSuggestion(resultMode, card, planningSourceForCard(resultMode, card));
      setManualSearch('');
      setManualSearchSubmitted(false);
      return;
    }

    if (nowDiscovering) {
      await selectNowDestination(resultMode, card);
      return;
    }

    const alreadySelected = plan.stops.some((stop) => stop.slot === resultMode && cardToId(stop.item) === card.id);
    const resultVisualType = searchVisualType === 'dessert' && resultMode === 'food' && !selectedFoods.includes('Dessert')
      ? 'food'
      : searchVisualType;
    const insertedStop = insertStopIntoPlan(resultMode, card, resultVisualType, lastSearchLocationCenter);
    addLog(alreadySelected ? `Already in plan: ${card.title}` : `Added ${resultMode} choice: ${card.title}`);
    if (insertedStop) scrollToPlanStop(insertedStop.key);
    setManualSearch('');
    setManualSearchSubmitted(false);
  };

  const openCardMaps = async (card: PlaceCard) => {
    addLog(`Card Open Maps action: ${card.title}`);
    await openExternalUrl(card.mapsUri || mapsSearchUrl(card.title));
  };

  const openCardEvent = async (card: PlaceCard) => {
    if (!card.eventUrl) return;
    addLog(`Card Open Event action: ${card.title}`);
    await openExternalUrl(card.eventUrl);
  };

  const openCardWebsite = async (card: PlaceCard) => {
    await openPlaceWebsite(card, 'Card Website action');
  };

  const openStopMaps = async (stop: ItineraryStop) => {
    const name = cardToName(stop.item);
    addLog(`Plan Map action: ${name || stop.slot}`);
    if (typeof stop.item !== 'string') {
      await openExternalUrl(stop.item.mapsUri || mapsSearchUrl(stop.item.title, stop.item));
      return;
    }
    await openExternalUrl(mapsSearchUrl(stop.item, activeSearchLocation || location));
  };

  const openStopWebsite = async (stop: ItineraryStop) => {
    if (typeof stop.item === 'string') return;
    await openPlaceWebsite(stop.item, 'Plan Website action');
  };

  const quickShareTitle = (target: QuickShareTarget) => {
    if (target.kind === 'card') return target.card.title;
    return cardToName(target.stop.item) || `${itineraryKindLabel(itineraryKindForStop(target.stop))} stop`;
  };

  const titleForPlanStops = (stops: ItineraryStop[]) => {
    if (!stops.length) return 'Untitled plan';
    const names = stops.slice(0, 2).map((stop) => cardToName(stop.item)).filter(Boolean);
    return names.length ? names.join(' + ') + (stops.length > 2 ? ` + ${stops.length - 2} more` : '') : 'Saved plan';
  };

  const dateRangeForSavedPlan = (saved: SavedPlan) => {
    if (saved.planDateStart && saved.planDateEnd) {
      return { start: saved.planDateStart, end: saved.planDateEnd };
    }
    if (saved.dateWindow) {
      return dateRangeKeysForWindow(saved.dateWindow, saved.customDateRange, new Date(saved.createdAt));
    }
    const createdDate = formatDateInput(new Date(saved.createdAt));
    return { start: createdDate, end: createdDate };
  };

  const savedPlanDateLabel = (saved: SavedPlan) => {
    const range = dateRangeForSavedPlan(saved);
    return absoluteDateRangeLabel(range.start, range.end) || new Date(saved.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const currentPlanContext = (contextStops: ItineraryStop[] = plan.stops) => {
    const contextPlanType = inferPlanType({
      planDateStart: activePlanDateRange.start,
      planDateEnd: activePlanDateRange.end,
      destinationLabel: searchLocationLabel,
      title: plan.title,
    });
    const contextRoadTripMode = inferRoadTripMode({
      planType: contextPlanType,
      destinationLabel: searchLocationLabel,
      startingLocationLabel,
      routeProvider: plan.routeProvider,
      sourceUrl: plan.sourceUrl,
      stops: contextStops,
      currentRoadTripMode: plan.roadTripMode,
    });
    const contextChargingStops = chargingStopIdeasFromStops(contextStops, plan.chargingStops || []);
    return {
      dateWindow: activePlanDateWindow,
      customDateRange: activePlanCustomDateRange,
      planDateStart: activePlanDateRange.start,
      planDateEnd: activePlanDateRange.end,
      planType: contextPlanType,
      timeWindow: activePlanTimeWindow || timeWindowFromStartClock(clockTimeFromDate(new Date(activePlanTimelineBaseMs))),
      routeOriginLabel: startingLocationLabel,
      routeStartLocation,
      searchLocation: activeSearchLocation || routeStartLocation,
      searchLocationLabel,
      roadTripMode: contextRoadTripMode,
      vehicleProfile: vehicleProfileForPlan(contextRoadTripMode, plan.vehicleProfile, contextStops, searchLocationLabel),
      chargingStops: contextChargingStops,
      nearbyPlacesDuringCharging: plan.nearbyPlacesDuringCharging || [],
    };
  };

  const planTitle = plan.title || activeBetaPlan?.title || titleForPlanStops(plan.stops);
  const isPlanLocked = plan.status === 'locked';
  const isImportedGoogleMapsPlan = plan.routeProvider === 'google_maps';
  const planInvitees = plan.invitees || [];
  const currentContextSignature = currentPlanContext();
  const savedPlanContentSignature = (saved: SavedPlan) => JSON.stringify({
    title: saved.title,
    planDateStart: dateRangeForSavedPlan(saved).start,
    planDateEnd: dateRangeForSavedPlan(saved).end,
    timeWindow: saved.timeWindow || '',
    stops: saved.stops.map((stop) => ({
      slot: stop.slot,
      itemId: cardToId(stop.item),
      visualType: stop.visualType,
      durationMinutes: stop.durationMinutes ?? (saved.planTimes?.[stop.key]
        ? clockMinutes(saved.planTimes[stop.key]!)
        : defaultStopDurationMinutes(stop)),
      travelMode: stop.travelMode,
      selectedFeatures: stop.selectedFeatures || [],
    })),
  });
  const currentPlanContentSignature = JSON.stringify({
    title: planTitle,
    planDateStart: currentContextSignature.planDateStart,
    planDateEnd: currentContextSignature.planDateEnd,
    timeWindow: currentContextSignature.timeWindow || '',
    stops: plan.stops.map((stop) => ({
      slot: stop.slot,
      itemId: cardToId(stop.item),
      visualType: stop.visualType,
      durationMinutes: durationForStop(stop),
      travelMode: stop.travelMode,
      selectedFeatures: stop.selectedFeatures || [],
    })),
  });
  const isCurrentPlanSaved = Boolean(plan.savedPlanId) ||
    visibleSavedPlans.some((saved) =>
    saved.source === 'saved' && savedPlanContentSignature(saved) === currentPlanContentSignature,
  );

  const cloneStopForSavedPlan = (stop: ItineraryStop, suffix = ''): ItineraryStop => ({
    ...stop,
    key: `${stop.key}${suffix}`,
    featureOptions: [...(stop.featureOptions || [])],
    selectedFeatures: [...(stop.selectedFeatures || [])],
    featuresExpanded: false,
  });

  const betaPlanRecordFromCurrentState = (base?: BetaPlanRecord | null): BetaPlanRecord => {
    const stamp = Date.now();
    const context = currentPlanContext(plan.stops);
    const status: BetaPlanRecord['status'] = plan.status === 'locked' ? 'finalized' : base?.status || 'planning';
    return {
      id: base?.id || plan.sharedPlanId || `beta-plan-${stamp}`,
      owner: base?.owner || plan.owner || currentTesterName,
      participants: unique([...(base?.participants || []), currentTesterName, ...(plan.invitees || [])]),
      title: plan.title?.trim() || base?.title || titleForPlanStops(plan.stops),
      source: base?.source || 'now',
      locationLabel: context.searchLocationLabel || base?.locationLabel || 'Current location',
      searchLocation: context.searchLocation || base?.searchLocation,
      routeOriginLabel: context.routeOriginLabel || base?.routeOriginLabel || 'Current location',
      routeStartLocation: context.routeStartLocation || base?.routeStartLocation,
      dateWindow: context.dateWindow,
      customDateRange: context.customDateRange || null,
      planDateStart: context.planDateStart,
      planDateEnd: context.planDateEnd,
      timeWindow: context.timeWindow,
      intent: plan.intent || base?.intent || 'both',
      stops: plan.stops.map((stop) => cloneStopForSavedPlan(stop)),
      suggestions: base?.suggestions || plan.participantSuggestions || [],
      finalizedSuggestionIds: base?.finalizedSuggestionIds || plan.finalizedSuggestionIds || [],
      rsvps: base?.rsvps || plan.rsvps || { [currentTesterName]: 'going' },
      status,
      savedPlanId: plan.savedPlanId,
      createdAt: base?.createdAt || stamp,
      updatedAt: stamp,
    };
  };
  betaPlanRecordBuilderRef.current = betaPlanRecordFromCurrentState;

  useEffect(() => {
    const recordId = activeBetaPlanId || plan.sharedPlanId;
    if (!recordId) return;
    const base = betaPlansRef.current.find((record) => record.id === recordId);
    if (!base) return;
    const nextRecord = betaPlanRecordBuilderRef.current?.(base);
    if (!nextRecord) return;
    void saveBetaPlans((current) => [nextRecord, ...current.filter((record) => record.id !== nextRecord.id)]);
  }, [activeBetaPlanId, plan]);

  const ensureActiveBetaPlanRecord = async () => {
    const existing = activeBetaPlan || betaPlansRef.current.find((record) => record.id === plan.sharedPlanId) || null;
    const nextRecord = betaPlanRecordFromCurrentState(existing);
    await saveBetaPlans((current) => [nextRecord, ...current.filter((record) => record.id !== nextRecord.id)]);
    if (activeBetaPlanId !== nextRecord.id) await saveActiveBetaPlan(nextRecord.id);
    if (plan.sharedPlanId !== nextRecord.id) {
      setPlan((prev) => ({ ...prev, sharedPlanId: nextRecord.id, owner: nextRecord.owner }));
    }
    return nextRecord;
  };

  const createNowPlanFromDestination = async (selection: NowDestinationSelection) => {
    if (nowPlanCreating) return;

    setNowPlanCreating(true);
    try {
      const { slot, item, category } = selection;
      const effectiveDateWindow: DateWindowId = 'today';
      const nextDateRange = dateRangeKeysForWindow(effectiveDateWindow, null, new Date());
      const nextTitle = contextualNowPlanTitle(slot, item, category);
      const selectedSearchLocation = lastSearchLocationCenter || activeSearchLocation || searchLocation || location || undefined;
      const selectedLocationLabel = selectedSearchLocation?.label || searchLocationLabel || 'Current location';
      const nextStop: ItineraryStop = {
        key: makeStopKey(slot, item),
        slot,
        item,
        featureOptions: [],
        selectedFeatures: [],
        featuresExpanded: false,
      };
      const nextStops = appendPlanSelection([], nextStop, searchSuperchargerStop(selectedSearchLocation));
      const nextPlanType = inferPlanType({
        planDateStart: nextDateRange.start,
        planDateEnd: nextDateRange.end,
        destinationLabel: selectedLocationLabel,
        title: nextTitle,
      });
      const betaRecord = await createBetaPlanRecord({
        source: 'now',
        title: nextTitle,
        dateWindow: effectiveDateWindow,
        customDateRange: null,
        planDateStart: nextDateRange.start,
        planDateEnd: nextDateRange.end,
        timeWindow: undefined,
        timePreference: 'Now',
        intent: 'both',
        locationLabel: selectedLocationLabel,
        searchLocation: selectedSearchLocation,
        routeOriginLabel: startingLocationLabel,
        routeStartLocation,
        participants: nowSelectedPeople,
        stops: nextStops.map((stop) => cloneStopForSavedPlan(stop)),
      });

      selectedDateWindowRef.current = effectiveDateWindow;
      customDateRangeRef.current = null;
      setSelectedDateWindow(effectiveDateWindow);
      setCustomDateRange(null);
      setSelectedTime('Now');
      setResultMode(slot);
      setPlan({
        ...EMPTY_PLAN,
        title: nextTitle,
        sharedPlanId: betaRecord.id,
        owner: betaRecord.owner,
        intent: 'both',
        status: 'draft',
        stops: nextStops,
        dateWindow: effectiveDateWindow,
        customDateRange: null,
        planDateStart: nextDateRange.start,
        planDateEnd: nextDateRange.end,
        planType: nextPlanType,
        timeWindow: undefined,
        routeOriginLabel: startingLocationLabel,
        routeStartLocation,
        searchLocation: selectedSearchLocation,
        searchLocationLabel: selectedLocationLabel,
        roadTripMode: false,
        vehicleProfile: undefined,
        invitees: nowSelectedPeople,
        chargingStops: [],
        nearbyPlacesDuringCharging: [],
        rsvps: betaRecord.rsvps,
        participantSuggestions: [],
        finalizedSuggestionIds: [],
      });
      setPlanTimes({});
      setArrivalTimes({});
      setTimeEditorKey(null);
      setNowMode('closed');
      setPlanSetupOpen(false);
      setHomeOpen(false);
      setSavedPlansLandingOpen(false);
      setSavedPlansOpen(false);
      setPlanSettingsOpen(false);
      setPreferencesOpen(false);
      setAdvancedPreferencesOpen(false);
      setCards([]);
      setHasInitiatedSearch(false);
      void refreshStopFeatures(nextStop.key, slot, item);
      scrollToPlan();
      addLog(`NOW plan created: ${nextTitle}`);
    } catch (err) {
      addLog(`NOW plan creation failed: ${compactError(err)}`);
      showAppNotice('Could not create plan', compactError(err));
    } finally {
      setNowPlanCreating(false);
    }
  };

  const renamePlan = (title: string) => {
    if (isPlanLocked) return;
    setPlan((prev) => ({ ...prev, title, savedPlanId: undefined }));
    if (activeBetaPlanId) {
      void patchBetaPlan(activeBetaPlanId, (record) => ({
        ...record,
        title: title.trim() || record.title,
      }));
    }
  };

  const refreshResultsForParticipantChange = () => {
    if (!hasInitiatedSearch || loading) return;
    setResultFilter('all');
    setCards([]);
    setVisibleCount(PAGE_SIZE);
    setLoading(true);
    setTimeout(() => {
      void searchForSlot(resultMode, true, true);
    }, 25);
  };

  const togglePlanInvitee = (user: string) => {
    const nextInvitees = planInvitees.includes(user)
      ? planInvitees.filter((item) => item !== user)
      : unique([...planInvitees, user]);
    setPlan((prev) => {
      return {
        ...prev,
        invitees: nextInvitees,
        savedPlanId: undefined,
      };
    });
    if (activeBetaPlanId) {
      void patchBetaPlan(activeBetaPlanId, (record) => ({
        ...record,
        participants: unique([record.owner, currentTesterName, ...nextInvitees]),
      }));
    }
    refreshResultsForParticipantChange();
  };

  const moveStop = (key: string, direction: -1 | 1) => {
    if (isPlanLocked) return;
    setPlan((prev) => {
      const index = prev.stops.findIndex((stop) => stop.key === key);
      const targetIndex = index + direction;
      if (index < 0 || targetIndex < 0 || targetIndex >= prev.stops.length) return prev;

      const stops = [...prev.stops];
      [stops[index], stops[targetIndex]] = [stops[targetIndex], stops[index]];
      return { ...prev, ...currentPlanContext(stops), stops, lockedArrivalTimes: undefined, savedPlanId: undefined };
    });
    setArrivalTimes({});
    addLog(`Plan stop moved ${direction < 0 ? 'up' : 'down'}`);
  };

  const lockPlan = async () => {
    cancelSearch();
    if (!plan.stops.length) {
      showAppNotice('Choose a final option', 'Add a food place, activity, or participant suggestion before finalizing.');
      return;
    }
    const lockedArrivalTimes = currentDisplayedArrivalTimes();
    const context = currentPlanContext(plan.stops);
    setPlan((prev) => ({
      ...prev,
      ...context,
      title: prev.title || titleForPlanStops(prev.stops),
      status: 'locked',
      lockedArrivalTimes,
      savedPlanId: undefined,
    }));
    const nextRecord = betaPlanRecordFromCurrentState(activeBetaPlan);
    await saveBetaPlans((current) => [{
      ...nextRecord,
      status: 'finalized',
      stops: plan.stops.map((stop) => cloneStopForSavedPlan(stop)),
      updatedAt: Date.now(),
    }, ...current.filter((record) => record.id !== nextRecord.id)]);
    if (activeBetaPlanId !== nextRecord.id) await saveActiveBetaPlan(nextRecord.id);
    setTimeEditorKey(null);
    setExpandedStopKey(null);
    setAddStopMenuOpen(false);
    setIdeaDraft('');
    setPendingVisualType(undefined);
    setSearchVisualType(undefined);
    setRecentlyAddedStopKey(null);
    setLocationOverrideOpen(false);
    setSearchLocationOverrideOpen(false);
    setCustomDateOpen(false);
    setPreferencesOpen(false);
    setRouteImportOpen(false);
    addLog('Plan locked');
  };

  const unlockPlan = () => {
    setPlan((prev) => ({ ...prev, status: 'draft', lockedArrivalTimes: undefined, savedPlanId: undefined }));
    if (activeBetaPlanId) {
      void patchBetaPlan(activeBetaPlanId, (record) => ({ ...record, status: 'planning' }));
    }
    addLog('Plan unlocked');
  };

  const importGoogleMapsRoute = async () => {
    const pastedUrl = routeImportUrl.trim();
    if (!pastedUrl) {
      setRouteImportError(GOOGLE_MAPS_ROUTE_IMPORT_ERROR);
      return;
    }

    setRouteImporting(true);
    setRouteImportError('');
    try {
      const expandedUrl = await expandGoogleMapsRouteUrlForImport(pastedUrl);
      const routeImport = parseGoogleMapsRouteUrl(expandedUrl, pastedUrl);
      if (!routeImport || !routeImport.stops.length) throw new Error(GOOGLE_MAPS_ROUTE_IMPORT_ERROR);

      const importedStops = routeImportToPlanStops(routeImport);
      const importedDateRange = dateRangeKeysForWindow(selectedDateWindow, customDateRange);
      const importedDestinationLabel = routeImport.stops[routeImport.stops.length - 1]?.label || searchLocationLabel;
      const importedPlanType = inferPlanType({
        planDateStart: importedDateRange.start,
        planDateEnd: importedDateRange.end,
        destinationLabel: importedDestinationLabel,
        title: defaultImportedRouteTitle(routeImport, selectedDateWindow, customDateRange),
      });
      const importedRoadTripMode = inferRoadTripMode({
        planType: importedPlanType,
        destinationLabel: importedDestinationLabel,
        startingLocationLabel,
        routeProvider: routeImport.routeProvider,
        sourceUrl: routeImport.sourceUrl,
        stops: importedStops,
      });
      setPlan({
        title: defaultImportedRouteTitle(routeImport, selectedDateWindow, customDateRange),
        stops: importedStops,
        sourceUrl: routeImport.sourceUrl,
        routeProvider: routeImport.routeProvider,
        status: routeImport.status,
        importedAt: Date.now(),
        invitees: [],
        dateWindow: selectedDateWindow,
        customDateRange,
        planDateStart: importedDateRange.start,
        planDateEnd: importedDateRange.end,
        planType: importedPlanType,
        timeWindow: selectedPreferenceTimeWindow,
        routeOriginLabel: startingLocationLabel,
        routeStartLocation,
        searchLocation: activeSearchLocation || routeStartLocation,
        searchLocationLabel,
        roadTripMode: importedRoadTripMode,
        vehicleProfile: vehicleProfileForPlan(importedRoadTripMode, undefined, importedStops, importedDestinationLabel),
        chargingStops: chargingStopIdeasFromStops(importedStops),
        nearbyPlacesDuringCharging: [],
      });
      setPlanTimes({});
      setArrivalTimes({});
      setTimeEditorKey(null);
      setHasInitiatedSearch(false);
      setCards([]);
      setRouteImportOpen(false);
      setRouteImportUrl('');
      addLog(`Google Maps route imported: ${routeImport.stops.length} stops`);
      setTimeout(() => scrollRef.current?.scrollTo({ y: 0, animated: true }), 100);
    } catch (err) {
      const message = err instanceof Error && err.message === GOOGLE_MAPS_ROUTE_IMPORT_ERROR
        ? err.message
        : GOOGLE_MAPS_ROUTE_IMPORT_ERROR;
      setRouteImportError(message);
      addLog(`Google Maps route import failed: ${compactError(err)}`);
      showAppNotice('Could not import route', message);
    } finally {
      setRouteImporting(false);
    }
  };

  const openImportedGoogleRoute = async () => {
    if (!plan.sourceUrl) return;
    addLog('Imported Google Maps route opened');
    await openExternalUrl(plan.sourceUrl);
  };

  const openPlanRoute = async () => {
    if (isImportedGoogleMapsPlan && plan.sourceUrl) {
      await openImportedGoogleRoute();
      return;
    }
    await openDirections();
  };

  const openRouteOptions = () => {
    if (!plan.stops.length) {
      showAppNotice('No plan yet', 'Select food or activity first.');
      return;
    }
    setRouteOptionsOpen(true);
    addLog('Route options opened');
  };

  const openGoogleRouteFromOptions = async () => {
    setRouteOptionsOpen(false);
    await openPlanRoute();
  };

  const sendPlanToTesla = async () => {
    const payload = teslaDestinationPayload({
      ...planToRouteHandoffPlan(plan, routeOriginOverride.trim() || startingLocationLabel),
      title: planTitle,
    });
    if (!payload) {
      showAppNotice('No destination yet', 'Select food or activity first.');
      return;
    }

    setRouteOptionsOpen(false);
    try {
      await Share.share({ message: payload });
      addLog('Tesla route handoff opened');
    } catch (err) {
      addLog(`Tesla route handoff failed: ${compactError(err)}`);
      showAppNotice('Could not open Tesla handoff', compactError(err));
    }
  };

  const makeSavedPlan = (
    stops: ItineraryStop[],
    source: SavedPlan['source'],
    options: { sharedTo?: string; sharedBy?: string; title?: string } = {},
  ): SavedPlan => {
    const stamp = Date.now();
    const suffix = `-saved-${stamp}`;
    const savedStops = stops.map((stop) => cloneStopForSavedPlan(stop, suffix));
    const savedPlanTimes: Record<string, StopTime | undefined> = {};
    const savedArrivalTimes: Record<string, StopTime | undefined> = {};
    const savedArrivalOverrides: Record<string, StopTime | undefined> = {};
    const context = currentPlanContext(stops);
    stops.forEach((stop, index) => {
      const savedKey = savedStops[index].key;
      const planIndex = plan.stops.findIndex((item) => item.key === stop.key);
      if (planTimes[stop.key]) savedPlanTimes[savedKey] = planTimes[stop.key];
      if (arrivalTimes[stop.key]) savedArrivalOverrides[savedKey] = arrivalTimes[stop.key];
      savedArrivalTimes[savedKey] = planIndex >= 0
        ? displayedArrivalTimeForStop(stop, planIndex)
        : arrivalTimes[stop.key] || clockTimeFromOffsetMinutes(estimateDriveMinutes(routeStartLocation, stop.item), activePlanTimelineBaseMs);
    });
    return {
      id: `plan-${stamp}`,
      title: options.title || plan.title || titleForPlanStops(stops),
      stops: savedStops,
      planTimes: savedPlanTimes,
      arrivalTimes: savedArrivalTimes,
      arrivalOverrides: savedArrivalOverrides,
      createdAt: stamp,
      source,
      sourceUrl: plan.sourceUrl,
      routeProvider: plan.routeProvider,
      status: plan.status,
      timeSchema: 'clock-arrivals-v1',
      invitees: plan.invitees,
      dateWindow: context.dateWindow,
      customDateRange: context.customDateRange,
      planDateStart: context.planDateStart,
      planDateEnd: context.planDateEnd,
      planType: context.planType,
      timeWindow: context.timeWindow,
      routeOriginLabel: context.routeOriginLabel,
      routeStartLocation: context.routeStartLocation,
      searchLocation: context.searchLocation,
      searchLocationLabel: context.searchLocationLabel,
      roadTripMode: context.roadTripMode,
      vehicleProfile: context.vehicleProfile,
      chargingStops: context.chargingStops,
      nearbyPlacesDuringCharging: context.nearbyPlacesDuringCharging,
      owner: source === 'saved' ? currentTesterName : options.sharedTo,
      sharedBy: options.sharedBy,
      sharedTo: options.sharedTo,
    };
  };

  const saveCurrentPlan = async () => {
    if (!plan.stops.length) return;
    const saved = makeSavedPlan(plan.stops, 'saved');
    const signature = savedPlanContentSignature(saved);
    await saveSavedPlans((current) => [
      saved,
      ...current.filter((item) => item.source !== 'saved' || savedPlanContentSignature(item) !== signature),
    ]);
    setPlan((prev) => ({
      ...prev,
      ...currentPlanContext(),
      savedPlanId: saved.id,
    }));
    addLog(`Plan saved: ${saved.title}`);
  };

  const loadSavedPlan = (saved: SavedPlan) => {
    cancelSearch();
    const loadSuffix = `-load-${Date.now()}`;
    const loadedStops = saved.stops.map((stop) => cloneStopForSavedPlan(stop, loadSuffix));
    const loadedPlanTimes: Record<string, StopTime | undefined> = {};
    const loadedArrivalOverrides: Record<string, StopTime | undefined> = {};
    const loadedLockedArrivalTimes: Record<string, StopTime | undefined> = {};
    saved.stops.forEach((stop, index) => {
      const loadedKey = loadedStops[index].key;
      if (saved.planTimes?.[stop.key]) loadedPlanTimes[loadedKey] = saved.planTimes[stop.key];
      if (saved.arrivalOverrides?.[stop.key]) loadedArrivalOverrides[loadedKey] = saved.arrivalOverrides[stop.key];
      const savedArrival = saved.arrivalTimes?.[stop.key];
      if (savedArrival) {
        loadedLockedArrivalTimes[loadedKey] = saved.timeSchema === 'clock-arrivals-v1'
          ? savedArrival
          : clockTimeFromRelativeStopTime(savedArrival, saved.createdAt);
      }
    });
    const loadedDateRange = dateRangeForSavedPlan(saved);
    const firstLoadedArrival = loadedStops[0] ? loadedLockedArrivalTimes[loadedStops[0].key] : undefined;
    const inferredTimelineStart = firstLoadedArrival
      ? clockTimePlusMinutes(firstLoadedArrival, -estimateDriveMinutes(saved.routeStartLocation || saved.searchLocation, loadedStops[0].item))
      : undefined;
    const loadedDateWindow: DateWindowId = 'custom';
    const loadedCustomDateRange = loadedDateRange;
    const loadedTimeWindow = saved.timeWindow || (inferredTimelineStart ? timeWindowFromStartClock(inferredTimelineStart) : undefined);
    const loadedPlanType = saved.planType || inferPlanType({
      planDateStart: loadedDateRange.start,
      planDateEnd: loadedDateRange.end,
      destinationLabel: saved.searchLocationLabel,
      title: saved.title,
    });
    const loadedRoadTripMode = inferRoadTripMode({
      planType: loadedPlanType,
      destinationLabel: saved.searchLocationLabel,
      startingLocationLabel: saved.routeOriginLabel,
      routeProvider: saved.routeProvider,
      sourceUrl: saved.sourceUrl,
      stops: loadedStops,
      currentRoadTripMode: saved.roadTripMode,
    });
    const loadedChargingStops = chargingStopIdeasFromStops(loadedStops, saved.chargingStops || []);

    setSelectedDateWindow(loadedDateWindow);
    selectedDateWindowRef.current = loadedDateWindow;
    setCustomDateRange(loadedCustomDateRange);
    customDateRangeRef.current = loadedCustomDateRange;
    if (saved.searchLocation) {
      setSearchLocation(saved.searchLocation);
      setLastSearchLocationCenter(saved.searchLocation);
      setSearchLocationOverride(saved.searchLocationLabel || saved.searchLocation.label || '');
    } else if (saved.searchLocationLabel) {
      setSearchLocationOverride(saved.searchLocationLabel);
    }
    if (saved.routeStartLocation) {
      setLocation(saved.routeStartLocation);
      setRouteOriginOverride(saved.routeOriginLabel && saved.routeOriginLabel !== 'Current location' ? saved.routeOriginLabel : '');
    } else if (saved.routeOriginLabel) {
      setRouteOriginOverride(saved.routeOriginLabel === 'Current location' ? '' : saved.routeOriginLabel);
    }
    setPlan({
      stops: loadedStops,
      title: saved.title,
      sourceUrl: saved.sourceUrl,
      routeProvider: saved.routeProvider,
      status: saved.status || 'draft',
      savedPlanId: saved.source === 'saved' ? saved.id : undefined,
      invitees: saved.invitees,
      dateWindow: loadedDateWindow,
      customDateRange: loadedCustomDateRange,
      planDateStart: loadedDateRange.start,
      planDateEnd: loadedDateRange.end,
      planType: loadedPlanType,
      timeWindow: loadedTimeWindow,
      routeOriginLabel: saved.routeOriginLabel,
      routeStartLocation: saved.routeStartLocation,
      searchLocation: saved.searchLocation,
      searchLocationLabel: saved.searchLocationLabel,
      roadTripMode: loadedRoadTripMode,
      vehicleProfile: vehicleProfileForPlan(loadedRoadTripMode, saved.vehicleProfile, loadedStops, saved.searchLocationLabel),
      chargingStops: loadedChargingStops,
      nearbyPlacesDuringCharging: saved.nearbyPlacesDuringCharging || [],
      lockedArrivalTimes: saved.status === 'locked' ? loadedLockedArrivalTimes : undefined,
    });
    setPlanTimes(loadedPlanTimes);
    setArrivalTimes(loadedArrivalOverrides);
    setTimeEditorKey(null);
    setExpandedStopKey(null);
    setAddStopMenuOpen(false);
    setIdeaDraft('');
    setPendingVisualType(undefined);
    setSearchVisualType(undefined);
    setRecentlyAddedStopKey(null);
    setHasInitiatedSearch(false);
    setCards([]);
    setNowMode('closed');
    setNowPeoplePickerOpen(false);
    setHomeOpen(false);
    setSavedPlansLandingOpen(false);
    setPlanSetupOpen(false);
    setTimeout(() => scrollRef.current?.scrollTo({ y: 0, animated: true }), 100);
    addLog(`Saved plan loaded: ${saved.title}`);
  };

  const deleteSavedPlan = async (id: string) => {
    await saveSavedPlans((current) => current.filter((item) => item.id !== id));
    setPlan((current) => current.savedPlanId === id ? { ...current, savedPlanId: undefined } : current);
    addLog('Saved plan removed');
    showToast('Saved plan deleted');
  };

  const confirmAction = (title: string, message: string, confirmLabel: string, action: () => void) => {
    setPendingConfirmation({ title, message, confirmLabel, action });
  };

  const requestDeleteSavedPlan = (saved: SavedPlan) => {
    confirmAction('Delete saved plan?', `Delete “${saved.title}”? This cannot be undone.`, 'Delete', () => {
      void deleteSavedPlan(saved.id);
    });
  };

  const clearCurrentPlan = () => {
    setPlan(EMPTY_PLAN);
    setPlanTimes({});
    setArrivalTimes({});
    setTimeEditorKey(null);
    setExpandedStopKey(null);
    setAddStopMenuOpen(false);
    setIdeaDraft('');
    setPendingVisualType(undefined);
    setSearchVisualType(undefined);
    setRecentlyAddedStopKey(null);
    setHasInitiatedSearch(false);
    setCards([]);
    addLog('Plan cleared');
  };

  const requestClearCurrentPlan = () => {
    confirmAction('Clear this plan?', 'Remove every stop from the current plan?', 'Clear plan', clearCurrentPlan);
  };

  const quickShareMessage = (target: QuickShareTarget) => {
    const title = quickShareTitle(target);
    if (target.kind === 'stop') return shareStopLine(target.stop, target.index);
    return title;
  };

  const openQuickShare = (target: QuickShareTarget) => {
    setQuickShareTarget(target);
    addLog(`Quick share opened: ${quickShareTitle(target)}`);
  };

  const shareQuickTargetToUser = async (user: string) => {
    if (!quickShareTarget) return;
    const stop = quickShareTarget.kind === 'card'
      ? {
          key: makeStopKey(quickShareTarget.slot, quickShareTarget.card),
          slot: quickShareTarget.slot,
          item: quickShareTarget.card,
          featureOptions: [],
          selectedFeatures: [],
          featuresExpanded: false,
        }
      : quickShareTarget.stop;
    const shared = makeSavedPlan([stop], 'shared', {
      sharedBy: currentTesterName,
      sharedTo: user,
      title: quickShareTitle(quickShareTarget),
    });
    await saveSavedPlans((current) => [shared, ...current.filter((item) => item.id !== shared.id)]);
    addLog(`Dev share to ${user}: ${quickShareTitle(quickShareTarget)}`);
    showToast(`Shared to ${user}`);
    setQuickShareTarget(null);
  };

  const textQuickTarget = async () => {
    if (!quickShareTarget) return;
    try {
      await Share.share({
        message: quickShareMessage(quickShareTarget),
      });
      addLog(`Quick share text opened: ${quickShareTitle(quickShareTarget)}`);
    } catch (err) {
      addLog(`Quick share failed: ${compactError(err)}`);
    }
  };

  const toggleFavorite = async (card: PlaceCard) => {
    const isFavorite = memory.favorites.includes(card.id);
    const favorites = isFavorite
      ? memory.favorites.filter((id) => id !== card.id)
      : [card.id, ...memory.favorites];
    const favoriteCards = { ...(memory.favoriteCards || {}) };
    if (isFavorite) {
      delete favoriteCards[card.id];
    } else {
      favoriteCards[card.id] = { slot: resultMode, card, location: lastSearchLocationCenter || searchLocation || location || undefined };
    }
    await saveMemory({ ...memory, favorites, favoriteCards });
    addLog(`Favorite toggled: ${card.title}`);
  };

  const neverRecommendCard = async (card: PlaceCard) => {
    const neverRecommend = unique([card.id, ...memory.neverRecommend]);
    await saveMemory({ ...memory, neverRecommend });
    setCards((prev) => prev.filter((item) => item.id !== card.id));
    addLog(`Never recommend again: ${card.title}`);
  };

  const clearManualSearch = () => {
    cancelSearch();
    setSearchNotice('');
    setSearchFailed(false);
    setManualSearch('');
    setManualSearchSubmitted(false);
    setCards([]);
    setVisibleCount(PAGE_SIZE);
    setHasInitiatedSearch(false);
    setTimeout(() => manualSearchRef.current?.focus(), 50);
  };

  const addManualPlace = async (slot: PlanSlot) => {
    const value = manualSearch.trim();
    if (!value || (isPlanLocked && !planningSuggestionMode)) return;
    cancelSearch();
    if (planningSuggestionMode) {
      await addPlanningSuggestion(slot, value, 'manual');
    } else if (nowDiscovering) {
      await selectNowDestination(slot, value);
    } else {
      const visualType = searchVisualType === 'dessert' && slot === 'food' ? 'dessert' : slot;
      const inserted = insertStopIntoPlan(slot, value, visualType, lastSearchLocationCenter);
      if (inserted) scrollToPlanStop(inserted.key);
    }
    setManualSearch('');
    setManualSearchSubmitted(false);
    setSearchNotice('');
    setSearchFailed(false);
  };

  const runManualSearch = async (slot: PlanSlot, centerOverride?: LatLon) => {
    if (isPlanLocked && !planningSuggestionMode) {
      showToast('Unlock the plan to edit it');
      return;
    }
    const value = manualSearch.trim();
    if (!value) return;
    const execution = beginSearch();
    const requestId = execution.id;
    setManualSearchSubmitted(true);
    setHasInitiatedSearch(true);
    setResultMode(slot);
    setResultFilter('all');
    setCards([]);
    if (!keyLoaded) {
      await addManualPlace(slot);
      return;
    }

    setLoading(true);
    try {
      const center = centerOverride || await getSearchLocation().catch((err) => {
        addLog(`Manual lookup location unavailable: ${compactError(err)}`);
        return null;
      });
      execution.check();
      const matches = (await searchPlaceByText(value, slot, center, undefined, execution)).map(cardForActivePlanTiming);
      execution.check();
      setResultMode(slot);
      setHasInitiatedSearch(true);
      setCards(matches);
      setVisibleCount(PAGE_SIZE);
      setPreferencesOpen(false);
      setSearchNotice(matches.length ? '' : 'No matching place found. Try a more specific name or address.');
      setLoading(false);
      scrollToResults();
      addLog(matches.length
        ? `Manual ${slot} needs choice: ${matches.slice(0, 3).map((card) => card.title).join(' | ')}`
        : `Manual ${slot} lookup found no match: ${value}`);
    } catch (err) {
      if (requestId !== searchRequestIdRef.current || isSearchCancelled(err)) return;
      setSearchFailed(true);
      setResultMode(slot);
      setHasInitiatedSearch(true);
      setCards([]);
      setSearchNotice('Place search is temporarily unavailable. Try again or add this place manually.');
      addLog(`Manual ${slot} lookup failed: ${compactError(err)}`);
    } finally {
      if (requestId === searchRequestIdRef.current) setLoading(false);
    }
  };

  const removeStop = (stop: ItineraryStop) => {
    if (isPlanLocked) return;
    setPlan((prev) => {
      const nextStops = prev.stops.filter((item) => item.key !== stop.key);
      return {
        ...prev,
        ...currentPlanContext(nextStops),
        stops: nextStops,
        savedPlanId: undefined,
      };
    });
    setPlanTimes((prev) => ({ ...prev, [stop.key]: undefined }));
    setArrivalTimes((prev) => ({ ...prev, [stop.key]: undefined }));
    if (timeEditorKey === stop.key) setTimeEditorKey(null);
    if (expandedStopKey === stop.key) setExpandedStopKey(null);
    addLog(`Removed ${stop.slot}: ${cardToName(stop.item)}`);
  };

  const toggleStopFeature = (key: string, feature: string) => {
    if (isPlanLocked) return;
    setPlan((prev) => ({
      ...prev,
      stops: prev.stops.map((stop) => {
        if (stop.key !== key) return stop;
        const selectedFeatures = stop.selectedFeatures || [];
        return {
          ...stop,
          selectedFeatures: selectedFeatures.includes(feature)
            ? selectedFeatures.filter((item) => item !== feature)
            : [...selectedFeatures, feature],
        };
      }),
      savedPlanId: undefined,
    }));
  };

  const setStopTravelMode = (key: string, travelMode: StopTravelMode) => {
    if (isPlanLocked) return;
    setPlan((prev) => ({
      ...prev,
      stops: prev.stops.map((stop) => stop.key === key ? { ...stop, travelMode } : stop),
      lockedArrivalTimes: undefined,
      savedPlanId: undefined,
    }));
    addLog(`Stop travel mode set: ${travelModeLabel(travelMode)}`);
  };

  const openDirections = async () => {
    let origin = routeOriginOverride.trim();
    if (!origin) {
      try {
        const nextLocation = await getLocation();
        origin = `${nextLocation.latitude},${nextLocation.longitude}`;
      } catch (err) {
        addLog(`GPS route origin failed: ${compactError(err)}`);
        origin = 'Current Location';
      }
    }
    const url = mapsDirectionsUrl(plan, origin);
    if (!url) {
      showAppNotice('No plan yet', 'Select food or activity first.');
      return;
    }
    addLog('Directions to plan opened');
    await openExternalUrl(url);
  };

  const sharePlan = async () => {
    try {
      if (getAlphaAccount()) { await openCurrentSharedPlan(); return; }
      if (activeBetaPlanId || plan.sharedPlanId) {
        await shareActiveBetaPlan();
        return;
      }
      await Share.share({ message: sharePlanText() });
      addLog('Plan shared as text');
    } catch (err) {
      addLog(`Plan share failed: ${compactError(err)}`);
      showAppNotice('Could not share plan', compactError(err));
    }
  };

  const sharePlanToUser = async (user: string) => {
    if (!plan.stops.length) return;
    const shared = makeSavedPlan(plan.stops, 'shared', {
      sharedBy: currentTesterName,
      sharedTo: user,
      title: planTitle,
    });
    await saveSavedPlans((current) => [shared, ...current.filter((item) => item.id !== shared.id)]);
    setSharePreviewOpen(false);
    setPlan((prev) => ({ ...prev, invitees: unique([...(prev.invitees || []), user]) }));
    addLog(`Plan shared in-app to ${user}: ${shared.title}`);
    showToast(`Shared to ${user}`);
  };

  const setActiveBetaRsvp = async (status: RsvpStatus) => {
    const record = await ensureActiveBetaPlanRecord();
    await patchBetaPlan(record.id, (current) => ({
      ...current,
      rsvps: {
        ...current.rsvps,
        [currentTesterName]: status,
      },
      participants: unique([...current.participants, currentTesterName]),
    }));
    setPlan((prev) => ({
      ...prev,
      rsvps: {
        ...(prev.rsvps || {}),
        [currentTesterName]: status,
      },
    }));
  };

  const addActiveBetaSuggestion = async (slot: PlanSlot) => {
    const value = betaSuggestionInput.trim();
    if (!value) return;
    const record = await ensureActiveBetaPlanRecord();
    const existing = record.suggestions.find((suggestion) => samePlanningSuggestion(suggestion, slot, value));
    if (existing) {
      showToast('Suggestion already added');
      setBetaSuggestionInput('');
      return;
    }
    const suggestion: PlanningSuggestion = {
      id: makePlanningSuggestionId(slot, value),
      slot,
      item: value,
      source: 'manual',
      addedBy: currentTesterName,
      createdAt: Date.now(),
      votes: [],
    };
    await patchBetaPlan(record.id, (current) => ({
      ...current,
      suggestions: [suggestion, ...current.suggestions],
      status: current.status === 'finalized' ? current.status : 'planning',
    }));
    setPlan((prev) => ({
      ...prev,
      participantSuggestions: [suggestion, ...(prev.participantSuggestions || [])],
    }));
    setBetaSuggestionInput('');
  };

  const addSuggestionToCurrentPlan = (suggestion: PlanningSuggestion) => {
    if (isPlanLocked) return;
    const insertedStop = insertStopIntoPlan(suggestion.slot, suggestion.item);
    if (insertedStop) {
      scrollToPlanStop(insertedStop.key);
    }
  };

  const shareActiveBetaPlan = async () => {
    try {
      if (getAlphaAccount()) { await openCurrentSharedPlan(); return; }
      const record = await ensureActiveBetaPlanRecord();
      await Share.share({ message: plan.stops.length ? sharePlanText() : betaPlanShareMessage(record) });
      addLog('Beta plan shared');
    } catch (err) {
      addLog(`Beta plan share failed: ${compactError(err)}`);
      showAppNotice('Could not share plan', compactError(err));
    }
  };

  const openCurrentSharedPlan = async () => {
    if (sharedPublishingRef.current) return;
    sharedPublishingRef.current = true;
    try {
      const record = await ensureActiveBetaPlanRecord();
      const details: SharedPlanDraft = {
        title: record.title, intent: record.intent, locationLabel: record.locationLabel,
        dateStart: record.planDateStart || activePlanDateRange.start,
        dateEnd: record.planDateEnd || activePlanDateRange.end, timeWindow: record.timeWindow,
        stops: record.stops.map((stop, index) => ({
          id: stop.key, planId: '', position: index,
          place: typeof stop.item === 'string' ? { provider: 'manual', title: stop.item } : {
            provider: stop.item.kind === 'event' ? 'ticketmaster' : 'google_places',
            providerId: stop.item.id, title: stop.item.title, address: stop.item.address,
            latitude: stop.item.lat, longitude: stop.item.lng,
          },
          travelMode: stop.travelMode, durationMinutes: durationForStop(stop),
          arrivalTime: formatClockTime(displayedArrivalTimeForStop(stop, index)),
        })),
      };
      const shared = await createSharedPlan(record.id, details);
      setSharePreviewOpen(false); setPlanPeopleOpen(false);
      setSharedWorkspace({ plan: shared });
    } catch (error) { showAppNotice('Could not open shared plan', compactError(error)); }
    finally { sharedPublishingRef.current = false; }
  };

  const addActiveBetaPlanToCalendar = async () => {
    try {
      const record = await ensureActiveBetaPlanRecord();
      const shareUrl = betaPlanShareUrl(record);
      const ics = betaPlanIcs(record, shareUrl);
      const fileName = safeCalendarFileName(record.title);
      if (Platform.OS === 'web' && typeof document !== 'undefined' && typeof URL !== 'undefined' && typeof Blob !== 'undefined') {
        const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        showToast('Calendar file downloaded');
      } else {
        await Share.share({ title: fileName, message: ics });
        showToast('Calendar export opened');
      }
      addLog('Calendar export created');
    } catch (err) {
      addLog(`Calendar export failed: ${compactError(err)}`);
      showAppNotice('Could not create calendar file', compactError(err));
    }
  };

  const patchVisitorBetaPlan = async (updater: (record: BetaPlanRecord) => BetaPlanRecord) => {
    if (!visitorBetaPlan) return null;
    const updated = { ...updater(visitorBetaPlan), updatedAt: Date.now() };
    setVisitorBetaPlan(updated);
    await saveBetaPlans((current) => [updated, ...current.filter((record) => record.id !== updated.id)]);
    return updated;
  };

  const visitorDisplayName = () => visitorName.trim() || (testerAuthenticated ? currentTesterName : 'Guest');

  const setVisitorRsvp = async (status: RsvpStatus) => {
    const name = visitorDisplayName();
    await patchVisitorBetaPlan((record) => ({
      ...record,
      participants: unique([...record.participants, name]),
      rsvps: {
        ...record.rsvps,
        [name]: status,
      },
    }));
    showToast(`RSVP: ${rsvpStatusLabel(status)}`);
  };

  const addVisitorSuggestion = async () => {
    if (!visitorBetaPlan) return;
    const value = betaSuggestionInput.trim();
    if (!value) return;
    const name = visitorDisplayName();
    const slot: PlanSlot = visitorBetaPlan.intent === 'activity' ? 'activity' : 'food';
    const suggestion: PlanningSuggestion = {
      id: makePlanningSuggestionId(slot, value),
      slot,
      item: value,
      source: 'manual',
      addedBy: name,
      createdAt: Date.now(),
      votes: [],
    };
    await patchVisitorBetaPlan((record) => ({
      ...record,
      participants: unique([...record.participants, name]),
      suggestions: [suggestion, ...record.suggestions.filter((item) => !samePlanningSuggestion(item, slot, value))],
    }));
    setBetaSuggestionInput('');
  };

  const shareVisitorBetaPlan = async () => {
    if (!visitorBetaPlan) return;
    try {
      await Share.share({ message: betaPlanShareMessage(visitorBetaPlan) });
      addLog('Visitor beta plan shared');
    } catch (err) {
      addLog(`Visitor beta plan share failed: ${compactError(err)}`);
      showAppNotice('Could not share plan', compactError(err));
    }
  };

  const addVisitorPlanToCalendar = async () => {
    if (!visitorBetaPlan) return;
    const ics = betaPlanIcs(visitorBetaPlan, betaPlanShareUrl(visitorBetaPlan));
    const fileName = safeCalendarFileName(visitorBetaPlan.title);
    if (Platform.OS === 'web' && typeof document !== 'undefined' && typeof URL !== 'undefined' && typeof Blob !== 'undefined') {
      const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showToast('Calendar file downloaded');
      return;
    }
    await Share.share({ title: fileName, message: ics });
  };

  const suggestedPairings = useMemo<PairingSuggestion[]>(() => {
    const suggestions: PairingSuggestion[] = [];
    const favoriteRouteBias = plan.stops.length ? searchRouteBiasForAnchorIndex(plan.stops.length - 1) : undefined;
    const favoriteSuggestionCenter = favoriteRouteBias?.anchor || activeSearchLocation || lastSearchLocationCenter || location;
    const isOpenSuggestion = (card: PlaceCard) => hasKnownHours(card) && card.isOpen === true;
    const distanceFromSearchLocation = (card: PlaceCard) =>
      favoriteSuggestionCenter ? distanceMeters(favoriteSuggestionCenter, card) : Number.POSITIVE_INFINITY;
    const favoriteSortScore = (card: PlaceCard) =>
      favoriteRouteBias?.mode === 'walk' ? routeBiasScore(card, favoriteRouteBias) : -distanceFromSearchLocation(card);
    const savedFavorites = Object.values(memory.favoriteCards || {}).filter((entry) =>
      memory.favorites.includes(entry.card.id) &&
      isOpenSuggestion(entry.card) &&
      favoriteMatchesSearchLocation(entry, favoriteSuggestionCenter) &&
      !(entry.slot === 'activity' && isBadActivityResult(entry.card)),
    );
    const favoriteFoods = savedFavorites
      .filter((entry) => entry.slot === 'food')
      .map((entry) => entry.card)
      .sort((a, b) => favoriteSortScore(b) - favoriteSortScore(a));
    const favoriteActivities = savedFavorites
      .filter((entry) => entry.slot === 'activity')
      .map((entry) => entry.card)
      .sort((a, b) => favoriteSortScore(b) - favoriteSortScore(a));

    if (!plan.stops.length) {
      favoriteFoods.slice(0, 3).forEach((foodCard) => {
        suggestions.push({
          label: `★ Start with ${foodCard.title}`,
          slot: 'food',
          selections: [],
          searchText: '',
          combo: [{ slot: 'food', item: foodCard }],
        });
      });
      favoriteActivities.slice(0, 3).forEach((activityCard) => {
        suggestions.push({
          label: `★ Start with ${activityCard.title}`,
          slot: 'activity',
          selections: [],
          searchText: '',
          combo: [{ slot: 'activity', item: activityCard }],
        });
      });
    }

    const favoriteCombos = favoriteFoods.flatMap((foodCard) =>
      favoriteActivities.map((activityCard) => ({
        foodCard,
        activityCard,
        distance: distanceMeters(
          { latitude: foodCard.lat!, longitude: foodCard.lng!, label: foodCard.title },
          activityCard,
        ),
        routeScore: routeBiasScore(foodCard, favoriteRouteBias) + routeBiasScore(activityCard, favoriteRouteBias),
      })),
    )
      .filter((combo) => Number.isFinite(combo.distance) && combo.distance <= PAIRING_RADIUS_METERS)
      .sort((a, b) => favoriteRouteBias?.mode === 'walk' ? b.routeScore - a.routeScore : a.distance - b.distance);

    favoriteCombos.slice(0, 4).forEach(({ foodCard, activityCard }) => {
      suggestions.unshift({
        label: `★ ${foodCard.title} + ${activityCard.title}`,
        slot: 'food',
        selections: [],
        searchText: '',
        combo: [
          { slot: 'food', item: foodCard },
          { slot: 'activity', item: activityCard },
        ],
      });
    });

    favoriteFoods.slice(0, 0).forEach((foodCard) => {
      favoriteActivities.slice(0, 0).forEach((activityCard) => {
        suggestions.unshift({
          label: `★ ${foodCard.title} + ${activityCard.title}`,
          slot: 'food',
          selections: [],
          searchText: '',
          combo: [
            { slot: 'food', item: foodCard },
            { slot: 'activity', item: activityCard },
          ],
        });
      });
    });

    const lastStop = plan.stops[plan.stops.length - 1];
    const lastName = cardToName(lastStop?.item);
    const hasMainFood = foodItems.some((item) => {
      const card = typeof item === 'string' ? undefined : item;
      const types = card?.types?.join(' ').toLowerCase() || '';
      return !types.includes('coffee') && !types.includes('cafe') && !types.includes('bakery') && !types.includes('dessert');
    });
    const hasDessertOrCoffee = plan.stops.some((stop) => {
      const card = typeof stop.item === 'string' ? undefined : stop.item;
      const blob = [card?.title, ...(card?.types || [])].join(' ').toLowerCase();
      return blob.includes('coffee') || blob.includes('cafe') || blob.includes('dessert') || blob.includes('bakery') || blob.includes('ice_cream');
    });
    const hasActivityStop = activityItems.length > 0;

    if (lastStop?.slot === 'food') {
      if (hasMainFood && !hasDessertOrCoffee) {
        suggestions.push(
          { label: `Dessert after ${lastName}`, slot: 'activity', selections: ['Dessert'], searchText: 'Dessert' },
          { label: `Coffee after ${lastName}`, slot: 'activity', selections: ['Coffee'], searchText: 'Coffee' },
        );
      }
      suggestions.push(
        { label: `Movie after ${lastName}`, slot: 'activity', selections: ['Movies'], searchText: 'Movies' },
        selectedMoods.includes('Active') || selectedWeather === 'Nice'
          ? { label: `Walk or park after ${lastName}`, slot: 'activity', selections: ['Park'], searchText: 'Park' }
          : { label: `Shopping after ${lastName}`, slot: 'activity', selections: ['Shopping'], searchText: 'Shopping' },
      );
    } else if (lastStop?.slot === 'activity') {
      if (hasMainFood) {
        suggestions.push(
          { label: `Dessert after ${lastName}`, slot: 'activity', selections: ['Dessert'], searchText: 'Dessert' },
          { label: `Coffee after ${lastName}`, slot: 'food', selections: ['Coffee'], searchText: 'Coffee' },
        );
      } else {
        suggestions.push(
          { label: `Dinner after ${lastName}`, slot: 'food', selections: ['Any'], searchText: 'Any food' },
          { label: `Pizza after ${lastName}`, slot: 'food', selections: ['Pizza'], searchText: 'Pizza' },
        );
      }
    } else if (hasMainFood && !hasActivityStop) {
      const food = cardToName(foodItems[foodItems.length - 1]);
      suggestions.push(
        { label: `Movie after ${food}`, slot: 'activity', selections: ['Movies'], searchText: 'Movies' },
        { label: `Dessert after ${food}`, slot: 'activity', selections: ['Dessert'], searchText: 'Dessert' },
      );
    }

    if (!suggestions.length) {
      suggestions.push(
        { label: 'Easy dinner first', slot: 'food', selections: ['Any'], searchText: 'Any food' },
        { label: 'Movie or activity first', slot: 'activity', selections: ['Movies'], searchText: 'Movies' },
        { label: 'Coffee and low effort', slot: 'food', selections: ['Coffee'], searchText: 'Coffee' },
      );
    }

    return suggestions.slice(0, 6);
  }, [plan.stops, foodItems, activityItems, memory.favoriteCards, memory.favorites, selectedMoods, selectedWeather, activeSearchLocation, searchLocation, lastSearchLocationCenter, location, routeStartLocation]);

  const visibleSuggestedPairings = suggestedPairingsExpanded
    ? suggestedPairings
    : suggestedPairings.slice(0, SUGGESTED_PAIRING_PREVIEW_COUNT);
  const hiddenSuggestedPairingCount = Math.max(0, suggestedPairings.length - SUGGESTED_PAIRING_PREVIEW_COUNT);
  const toggleSuggestedPairingsOpen = () => {
    if (suggestedPairingsOpen) setSuggestedPairingsExpanded(false);
    setSuggestedPairingsOpen((prev) => !prev);
  };
  const togglePreferenceGroupExpanded = (group: string) => {
    setExpandedPreferenceGroups((prev) => ({ ...prev, [group]: !prev[group] }));
  };
  const summarizeSelection = (label: string, values: string[]) => {
    const activeValues = values.filter((item) => item !== 'Any');
    if (!activeValues.length) return '';
    const shownValues = activeValues.slice(0, 2).join(', ');
    return `${label}: ${shownValues}${activeValues.length > 2 ? ` +${activeValues.length - 2}` : ''}`;
  };
  const preferenceSummaryParts = [
    selectedMoods.slice(0, 2).join(', '),
    activePlanTimePreference,
    resultMode === 'food'
      ? summarizeSelection('Food', selectedFoods)
      : summarizeSelection('Activity', selectedActivities),
    resultMode === 'food' ? summarizeSelection('Dietary', selectedDietary) : '',
  ].filter(Boolean);

  const betaPlanRsvps = activeBetaPlan?.rsvps || plan.rsvps || {};
  const betaPlanSuggestions = activeBetaPlan?.suggestions || plan.participantSuggestions || [];
  const betaPlanRsvpSummary = rsvpSummaryText(betaPlanRsvps);
  const currentBetaRsvp = betaPlanRsvps[currentTesterName];
  const showDiscoveryTools = !savedPlansLandingOpen && !isPlanLocked && (!nowExperienceActive || nowDiscovering);
  const showPlanningTools = !savedPlansLandingOpen && !isPlanLocked && !nowExperienceActive;
  const activeNavigationKey: MainNavigationKey | undefined = accountSettingsOpen
    ? 'profile'
    : homeOpen && !planSetupOpen
      ? 'home'
      : savedPlansLandingOpen
        ? savedPlansNavigationSource
        : planSetupOpen
          ? undefined
          : 'plans';

  const quickShareUsers = getAlphaAccount() ? [] : unique(TEST_USERS.filter((user) => user !== currentTesterName));
  const recentPeople = quickShareUsers.slice(0, 2);
  const favoritePeople = quickShareUsers.filter((user) => !recentPeople.includes(user)).slice(0, 3);
  const planPeopleSummary = activePlanPeopleSummary;
  const planSetupPeopleSummary = planSetupInvitees.length ? unique([currentTesterName, ...planSetupInvitees]).join(', ') : 'Just me';
  const nowPeopleSummary = nowSelectedPeople.length ? unique([currentTesterName, ...nowSelectedPeople]).join(', ') : 'Just me';
  const placeDetailIsSelected = Boolean(placeDetailCard && !nowDiscovering && plan.stops.some(
    (stop) => stop.slot === resultMode && cardToId(stop.item) === placeDetailCard.id,
  ));
  const placeDetailIsSuggested = Boolean(placeDetailCard && planningSuggestionMode && activePlanningSession?.suggestions.some(
    (suggestion) => samePlanningSuggestion(suggestion, resultMode, placeDetailCard),
  ));
  const placeDetailActionLabel = nowDiscovering
    ? 'Use'
    : planningSuggestionMode
      ? placeDetailIsSuggested ? 'Suggested' : 'Suggest'
      : placeDetailIsSelected ? 'Deselect' : 'Add to Plan';
  const placeDetailActionIcon: React.ComponentProps<typeof Ionicons>['name'] = nowDiscovering
    ? 'navigate-outline'
    : planningSuggestionMode
      ? placeDetailIsSuggested ? 'checkmark-done-outline' : 'chatbubble-ellipses-outline'
      : placeDetailIsSelected ? 'remove-circle-outline' : 'add';
  const togglePlanSetupInvitee = (user: string) => {
    setPlanSetupInvitees((prev) => prev.includes(user) ? prev.filter((item) => item !== user) : unique([...prev, user]));
  };

  if (accountSaveError) {
    return (
      <SafeAreaView style={[styles.safeArea, styles.darkScreen]}>
        <View style={styles.alphaGateShell}>
          <View style={[styles.authCard, styles.darkPanel]}>
            <Text style={[styles.authTitle, styles.darkText]}>Your changes could not be saved</Text>
            <Text accessibilityRole="alert" selectable style={[styles.authCopy, styles.darkMutedText]}>{accountSaveError}</Text>
            <Button label="Reload cloud saves" onPress={() => { if (Platform.OS === 'web') window.location.reload(); }} primary />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (!authLoaded) {
    return (
      <SafeAreaView style={[styles.safeArea, isLightMode && styles.lightScreen, isDarkMode && styles.darkScreen]} edges={['top', 'bottom', 'left', 'right']}>
        <View style={styles.authCentered}>
          <ActivityIndicator color={colors.coral} />
          <Text style={styles.authHint}>Loading NomNomGo</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (sharedWorkspace && getAlphaAccount() && authLoaded) {
    return <SharedPlansScreen initialPlan={sharedWorkspace.plan} initialPlanId={sharedWorkspace.id} onClose={() => {
      setSharedWorkspace(null);
      if (Platform.OS === 'web') {
        const url = new URL(window.location.href);
        url.searchParams.delete('plan');
        window.history.replaceState({}, '', url.toString());
      }
    }} />;
  }

  if (visitorBetaPlan) {
    const visitorRsvps = visitorBetaPlan.rsvps || {};
    const visitorNameValue = visitorDisplayName();
    const visitorRsvp = visitorRsvps[visitorNameValue];
    const visitorFinal = betaPlanFinalLabel(visitorBetaPlan);
    const visitorSummaryLine = [
      betaPlanDateLabel(visitorBetaPlan),
      betaPlanLocationLabel(visitorBetaPlan),
      planningIntentLabel(visitorBetaPlan.intent),
      `${rsvpCountsFor(visitorRsvps).going} Going`,
    ].filter(Boolean).join(' | ');
    const openVisitorStopMaps = async (stop: ItineraryStop) => {
      const name = cardToName(stop.item) || stop.slot;
      addLog(`Shared Plan Map action: ${name}`);
      if (typeof stop.item !== 'string') {
        await openExternalUrl(stop.item.mapsUri || mapsSearchUrl(stop.item.title, stop.item));
        return;
      }
      await openExternalUrl(mapsSearchUrl(
        stop.item,
        visitorBetaPlan.searchLocation || visitorBetaPlan.routeStartLocation,
      ));
    };
    return (
      <SafeAreaView style={[styles.safeArea, isLightMode && styles.lightScreen, isDarkMode && styles.darkScreen]} edges={['top', 'bottom', 'left', 'right']}>
        <KeyboardAvoidingView
          style={styles.keyboardAvoider}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={0}
        >
          <ScrollView
            style={[styles.screen, isLightMode && styles.lightScreen, isDarkMode && styles.darkScreen]}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
          >
            <AppHeader
              style={[styles.appBanner, styles.darkPanel]}
              onBrandPress={() => setVisitorBetaPlan(null)}
              brandAccessibilityLabel="Open NomNomGo"
              logo={(
                <Image
                  source={require('./assets/nom-nom-go-mark-transparent-v19.png')}
                  style={styles.bannerLogoMark}
                  resizeMode="contain"
                />
              )}
              content={(
                <View style={styles.bannerBrandText}>
                  <View style={styles.bannerNameRow}>
                    <Text style={[styles.bannerName, styles.bannerNameMain, styles.bannerNameMainDark]} numberOfLines={1}>NomNom</Text>
                    <Text style={[styles.bannerName, styles.bannerNameGo]} numberOfLines={1}>Go</Text>
                  </View>
                  <Text style={[styles.bannerTagline, styles.darkMutedText]} numberOfLines={1}>Come together</Text>
                </View>
              )}
            />

            {toastMessage ? (
              <View style={styles.toastBox}>
                <Text style={styles.toastText}>{toastMessage}</Text>
              </View>
            ) : null}

            <View style={[styles.visitorPlanBox, isDarkMode && styles.darkPanel]}>
              <View style={styles.betaPlanHeader}>
                <View style={styles.betaPlanTitleBlock}>
                  <Text style={[styles.betaPlanEyebrow, isDarkMode && styles.darkMutedText]}>Shared Plan</Text>
                  {getAlphaAccount() ? <Text style={[styles.authCopy, styles.darkMutedText]}>This is a shared copy. Your changes, votes and RSVP are saved only to your account.</Text> : null}
                  <Text style={[styles.betaPlanTitle, isDarkMode && styles.darkText]}>{visitorBetaPlan.title}</Text>
                  <Text style={[styles.betaSummaryLine, isDarkMode && styles.darkMutedText]} numberOfLines={2}>
                    {visitorSummaryLine}
                  </Text>
                </View>
                <View style={[styles.betaStatusPill, visitorBetaPlan.status === 'finalized' && styles.betaStatusPillLocked]}>
                  <Text style={styles.betaStatusText}>{visitorBetaPlan.status === 'finalized' ? 'Finalized' : 'Planning'}</Text>
                </View>
              </View>

              {visitorBetaPlan.status === 'finalized' && visitorFinal ? (
                <View style={styles.betaFinalBox}>
                  <Text style={styles.betaFinalLabel}>Final plan</Text>
                  <Text style={styles.betaFinalValue}>{visitorFinal}</Text>
                </View>
              ) : null}

              {visitorBetaPlan.status === 'finalized' && visitorBetaPlan.stops.length ? (
                <View style={styles.visitorRouteSection}>
                  <View style={styles.betaSectionHeader}>
                    <View style={styles.visitorRouteHeading}>
                      <Text style={[styles.sessionSubhead, styles.darkText]}>Your route</Text>
                      <Text style={[styles.betaSuggestionMeta, styles.darkMutedText]}>
                        {visitorBetaPlan.stops.length} stop{visitorBetaPlan.stops.length === 1 ? '' : 's'}
                      </Text>
                    </View>
                    <Ionicons name="navigate-outline" size={20} color={colors.teal} />
                  </View>
                  <View style={styles.visitorRouteList}>
                    {visitorBetaPlan.stops.map((stop, index) => {
                      const stopLocation = cityStateLabel(cityStateForPlace(stop.item));
                      const stopKind = itineraryKindForStop(stop);
                      const stopTone = semanticTones[stopKind];
                      return (
                        <TouchableOpacity
                          key={`visitor-route-${stop.key}`}
                          style={styles.visitorRouteStop}
                          onPress={() => openVisitorStopMaps(stop)}
                          accessibilityRole="button"
                          accessibilityLabel={`Open route to stop ${index + 1}, ${cardToName(stop.item) || 'Stop'}`}
                        >
                          <Text style={[styles.visitorRouteIndex, { backgroundColor: stopTone.solid, color: stopTone.foreground }]}>{index + 1}</Text>
                          <View style={styles.visitorRouteStopText}>
                            <Text style={[styles.visitorRouteType, { color: stopTone.accent }]}>{itineraryKindLabel(stopKind)}</Text>
                            <Text style={styles.visitorRouteName} numberOfLines={1}>{cardToName(stop.item) || 'Stop'}</Text>
                            {stopLocation ? <Text style={styles.visitorRouteMeta} numberOfLines={1}>{stopLocation}</Text> : null}
                          </View>
                          <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              ) : null}

              <View style={styles.betaSection}>
                <Text style={[styles.sessionSubhead, isDarkMode && styles.darkText]}>Your name</Text>
                <TextInput
                  style={[styles.input, isDarkMode && styles.darkPanelInput, Platform.OS === 'web' && styles.webInput]}
                  value={visitorName}
                  onChangeText={setVisitorName}
                  accessibilityLabel="Your name"
                  placeholder={testerAuthenticated ? currentTesterName : 'Guest'}
                  placeholderTextColor={isLightMode ? colors.textTertiary : colors.textSecondary}
                  returnKeyType="done"
                />
              </View>

              {visitorBetaPlan.status !== 'finalized' ? (
                <View style={[styles.betaPrimaryActionBox, isDarkMode && styles.darkChip]}>
                  <Text style={[styles.betaPrimaryPrompt, isDarkMode && styles.darkText]}>Have an idea?</Text>
                  <View style={styles.inputRow}>
                    <TextInput
                      style={[styles.input, isDarkMode && styles.darkPanelInput, Platform.OS === 'web' && styles.webInput]}
                      value={betaSuggestionInput}
                      onChangeText={setBetaSuggestionInput}
                      accessibilityLabel="Suggest a place or idea"
                      placeholder="Place or idea"
                      placeholderTextColor={isLightMode ? colors.textTertiary : colors.textSecondary}
                      returnKeyType="done"
                      onSubmitEditing={addVisitorSuggestion}
                    />
                    <Button label="Suggest" onPress={addVisitorSuggestion} compact />
                  </View>
                </View>
              ) : null}

              <View style={styles.betaSection}>
                <View style={styles.betaSectionHeader}>
                  <Text style={[styles.sessionSubhead, isDarkMode && styles.darkText]}>Suggestions</Text>
                  <Text style={[styles.betaSuggestionMeta, isDarkMode && styles.darkMutedText]}>
                    {visitorBetaPlan.suggestions.length ? `${visitorBetaPlan.suggestions.length} option${visitorBetaPlan.suggestions.length === 1 ? '' : 's'}` : 'Add an idea'}
                  </Text>
                </View>
                {visitorBetaPlan.suggestions.length ? visitorBetaPlan.suggestions.map((suggestion) => (
                  <View key={suggestion.id} style={[styles.betaSuggestionRow, isDarkMode && styles.darkCard]}>
                    <View style={styles.betaSuggestionTextBlock}>
                      <Text style={[styles.betaSuggestionTitle, isDarkMode && styles.darkText]}>{cardToName(suggestion.item) || 'Suggestion'}</Text>
                      <Text style={[styles.betaSuggestionMeta, isDarkMode && styles.darkMutedText]}>
                        {suggestion.slot === 'food' ? 'Food' : 'Activity'} by {suggestion.addedBy}
                      </Text>
                    </View>
                  </View>
                )) : (
                  <Text style={[styles.empty, isDarkMode && styles.darkMutedText]}>No suggestions yet.</Text>
                )}
              </View>

              <View style={styles.betaSection}>
                <Text style={[styles.sessionSubhead, isDarkMode && styles.darkText]}>Share</Text>
                <View style={styles.betaActions}>
                  <Button label="Share Plan" onPress={shareVisitorBetaPlan} primary compact />
                  <Button label="Add to Calendar" onPress={addVisitorPlanToCalendar} compact />
                  <Button label="Open App" onPress={() => setVisitorBetaPlan(null)} compact />
                </View>
              </View>

              <View style={styles.betaSection}>
                <View style={styles.betaSectionHeader}>
                  <Text style={[styles.sessionSubhead, isDarkMode && styles.darkText]}>Your RSVP</Text>
                  {visitorRsvp ? (
                    <Text style={[styles.betaSuggestionMeta, isDarkMode && styles.darkMutedText]}>{rsvpStatusLabel(visitorRsvp)}</Text>
                  ) : null}
                </View>
                <RsvpControl value={visitorRsvp} onChange={setVisitorRsvp} />
              </View>

              <View style={[styles.betaDetailsBox, isDarkMode && styles.darkChip]}>
                <TouchableOpacity
                  style={styles.betaDetailsHeader}
                  onPress={() => setPlanSettingsOpen((prev) => !prev)}
                  accessibilityRole="button"
                  accessibilityLabel={`${planSettingsOpen ? 'Hide' : 'Show'} details`}
                  accessibilityState={{ expanded: planSettingsOpen }}
                >
                  <View style={styles.betaSuggestionTextBlock}>
                    <Text style={[styles.sessionSubhead, isDarkMode && styles.darkText]}>Details</Text>
                    <Text style={[styles.betaSuggestionMeta, isDarkMode && styles.darkMutedText]} numberOfLines={1}>
                      Date, place, and RSVP count
                    </Text>
                  </View>
                  <HeaderAction label={planSettingsOpen ? 'Hide' : 'Show'} />
                </TouchableOpacity>
                {planSettingsOpen ? (
                  <View style={styles.betaDetailGrid}>
                    <PlanLine label="When" value={`${betaPlanDateLabel(visitorBetaPlan)} | ${visitorBetaPlan.timeWindow || 'Time TBD'}`} />
                    <PlanLine label="Where" value={betaPlanLocationLabel(visitorBetaPlan)} />
                    <PlanLine label="Looking for" value={planningIntentLabel(visitorBetaPlan.intent)} />
                    <PlanLine label="RSVP" value={rsvpSummaryText(visitorRsvps)} />
                  </View>
                ) : null}
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  if (!testerAuthenticated) {
    return (
      <SafeAreaView style={[styles.safeArea, isLightMode && styles.lightScreen, isDarkMode && styles.darkScreen]} edges={['top', 'bottom', 'left', 'right']}>
        <KeyboardAvoidingView
          style={styles.keyboardAvoider}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={0}
        >
          <ScrollView
            style={[styles.screen, isLightMode && styles.lightScreen, isDarkMode && styles.darkScreen]}
            contentContainerStyle={styles.authContent}
            keyboardShouldPersistTaps="handled"
          >
            <View style={[styles.hero, isLightMode && styles.lightHero, isDarkMode && styles.darkHero, Platform.OS === 'web' && styles.webHero]}>
              <Image source={require('./assets/nom-nom-go-wordmark-v19.png')} style={styles.wordmarkImage} resizeMode="contain" />
            </View>
            <View style={[styles.authCard, Platform.OS === 'web' && styles.webAuthCard, isDarkMode && styles.darkPanel]}>
              <Text style={[styles.authTitle, isDarkMode && styles.darkText]}>Choose tester</Text>
              <Text style={[styles.authCopy, isDarkMode && styles.darkMutedText]}>
                Select a local test user. This keeps development sharing simple until backend accounts are added.
              </Text>
              <View style={[styles.testerDropdown, Platform.OS === 'web' && styles.webTesterDropdown]}>
                {TEST_USERS.map((name) => (
                  <TouchableOpacity
                    key={name}
                    style={[styles.testerOption, Platform.OS === 'web' && styles.webTesterOption]}
                    onPress={() => selectTester(name)}
                    accessibilityRole="button"
                    accessibilityLabel={`Choose tester ${name}`}
                  >
                    <Text style={styles.testerOptionText}>{name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.authFinePrint}>
                Local tester selector only. Real account security and cross-device metering should move to the proxy/backend.
              </Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, isLightMode && styles.lightScreen, isDarkMode && styles.darkScreen]} edges={['top', 'left', 'right']}>
    <KeyboardAvoidingView
      style={styles.keyboardAvoider}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
    <View style={styles.appShell}>
    <Animated.ScrollView
      ref={scrollRef}
      style={[styles.screen, isLightMode && styles.lightScreen, isDarkMode && styles.darkScreen]}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
    >
      <AppHeader
        style={[styles.appBanner, styles.darkPanel]}
        onBrandPress={openHome}
        brandAccessibilityLabel="Go to NomNomGo home"
        logo={(
          <Image
            source={require('./assets/nom-nom-go-mark-transparent-v19.png')}
            style={styles.bannerLogoMark}
            resizeMode="contain"
          />
        )}
        content={(
          <View style={styles.bannerBrandText}>
            <View style={styles.bannerNameRow}>
              <Text style={[styles.bannerName, styles.bannerNameMain, styles.bannerNameMainDark]} numberOfLines={1}>NomNom</Text>
              <Text style={[styles.bannerName, styles.bannerNameGo]} numberOfLines={1}>Go</Text>
            </View>
            <Text style={[styles.bannerTagline, styles.darkMutedText]} numberOfLines={1}>Come together</Text>
          </View>
        )}
        trailing={(
          <TouchableOpacity
            style={[styles.accountIconButton, styles.darkChip]}
            onPress={() => setAccountMenuOpen((prev) => !prev)}
            accessibilityRole="button"
            accessibilityLabel="Open user menu"
          >
            <Ionicons name="person-circle-outline" size={28} color={colors.textPrimary} />
          </TouchableOpacity>
        )}
      />

      {toastMessage ? (
        <View style={styles.toastBox}>
          <Text style={styles.toastText}>{toastMessage}</Text>
        </View>
      ) : null}

      <Modal
        visible={accountMenuOpen}
        animationType="fade"
        transparent
        onRequestClose={() => setAccountMenuOpen(false)}
      >
        <TouchableOpacity style={styles.accountOverlay} activeOpacity={1} onPress={() => setAccountMenuOpen(false)}>
          <TouchableOpacity style={[styles.accountCard, isDarkMode && styles.darkModalCard]} activeOpacity={1} onPress={(event) => event.stopPropagation()}>
            <View style={styles.accountHeader}>
              <View style={styles.accountAvatar}>
                <Ionicons name="person-circle-outline" size={36} color={colors.textPrimary} />
              </View>
              <View style={styles.accountTextBlock}>
                <Text style={[styles.accountName, isDarkMode && styles.darkText]}>{testerUser?.name || 'Tester'}</Text>
                <Text style={[styles.accountUsage, isDarkMode && styles.darkMutedText]}>
                  Places calls: {usageMeter.nearbySearchesToday + usageMeter.textSearchesToday} today - {usageMeter.nearbySearchesMonth + usageMeter.textSearchesMonth} month
                </Text>
              </View>
            </View>
            <View style={styles.accountActions}>
              {getAlphaAccount() ? <Button label="Shared plans & RSVPs" onPress={() => { setAccountMenuOpen(false); setSharedWorkspace({}); }} compact /> : null}
              <Button
                label={getAlphaAccount() ? 'Account, invites & usage' : 'User settings'}
                onPress={() => {
                  setAccountMenuOpen(false);
                  setAccountSettingsOpen(true);
                }}
                compact
              />
              <Button
                label={getAlphaAccount() ? 'Sign out of NomNomGo' : 'Switch user'}
                onPress={() => {
                  setAccountMenuOpen(false);
                  void signOutTester();
                }}
                compact
              />
              <Button label="Close" onPress={() => setAccountMenuOpen(false)} compact />
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      <Modal
        visible={accountSettingsOpen}
        animationType="fade"
        transparent
        onRequestClose={() => setAccountSettingsOpen(false)}
      >
        <TouchableOpacity style={styles.accountOverlay} activeOpacity={1} onPress={() => setAccountSettingsOpen(false)}>
          <TouchableOpacity style={[styles.accountCard, isDarkMode && styles.darkModalCard]} activeOpacity={1} onPress={(event) => event.stopPropagation()}>
            <Text style={[styles.accountName, isDarkMode && styles.darkText]}>User settings</Text>
            <ScrollView style={{ maxHeight: 420 }} keyboardShouldPersistTaps="handled">
            <View style={styles.accountSettingList}>
              <View>
                <Text style={[styles.accountSettingLabel, isDarkMode && styles.darkMutedText]}>Active user</Text>
                <Text style={[styles.accountSettingValue, isDarkMode && styles.darkText]}>{testerUser?.name || 'Tester'}</Text>
              </View>
              <View>
                <Text style={[styles.accountSettingLabel, isDarkMode && styles.darkMutedText]}>Places usage</Text>
                <Text style={[styles.accountSettingValue, isDarkMode && styles.darkText]}>
                  {usageMeter.nearbySearchesToday + usageMeter.textSearchesToday} today - {usageMeter.nearbySearchesMonth + usageMeter.textSearchesMonth} month
                </Text>
              </View>
            </View>
            <View style={styles.accountActions}>
              <Button
                label={getAlphaAccount() ? 'Sign out of NomNomGo' : 'Switch user'}
                onPress={() => {
                  setAccountSettingsOpen(false);
                  void signOutTester();
                }}
                compact
              />
              <Button label="Close" onPress={() => setAccountSettingsOpen(false)} compact />
            </View>
            <AlphaAccountPanel onOpenSharedPlans={() => { setAccountSettingsOpen(false); setSharedWorkspace({}); }} />
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {homeOpen ? (
        <View style={[styles.homeBox, isLightMode && styles.lightPanel, isDarkMode && styles.darkPanel]}>
          {!planSetupOpen ? (
            <>
              <View style={styles.homeTitleBlock}>
                <Text style={[styles.homeTitle, isDarkMode && styles.darkText]}>Come together</Text>
                <Text style={[styles.homeSubtitle, isDarkMode && styles.darkMutedText]}>What do you want to do?</Text>
              </View>
              <View style={styles.homePeoplePill}>
                <Ionicons name="person-outline" size={16} color={colors.teal} />
                <Text style={styles.homePeoplePillText}>Just me</Text>
              </View>
              <View style={styles.nowActionGrid}>
                <TouchableOpacity
                  style={[styles.nowActionCard, styles.nowFoodAction]}
                  onPress={() => { void startNowDiscoveryFromHome('food'); }}
                  accessibilityRole="button"
                  accessibilityLabel="Find food now"
                >
                  <Ionicons name="restaurant-outline" size={28} color={semanticTones.food.foreground} />
                  <Text style={[styles.nowActionTitle, styles.nowActionTitleLight]}>Food</Text>
                  <Ionicons name="chevron-forward" size={22} color={semanticTones.food.foreground} style={styles.homeActionChevron} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.nowActionCard, styles.nowActivityAction]}
                  onPress={() => { void startNowDiscoveryFromHome('activity'); }}
                  accessibilityRole="button"
                  accessibilityLabel="Find an activity now"
                >
                  <Ionicons name="sparkles-outline" size={28} color={colors.textInverse} />
                  <Text style={[styles.nowActionTitle, styles.nowActionTitleDark]}>Activity</Text>
                  <Ionicons name="chevron-forward" size={22} color={colors.textInverse} style={styles.homeActionChevron} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.nowActionCard, styles.nowPeopleAction]}
                  onPress={() => { void openNowPeopleFromHome(); }}
                  accessibilityRole="button"
                  accessibilityLabel="Include someone"
                >
                  <Ionicons name="people-outline" size={28} color={semanticTones.people.foreground} />
                  <Text style={styles.nowActionTitle}>Include Someone</Text>
                  <Ionicons name="chevron-forward" size={22} color={semanticTones.people.foreground} style={styles.homeActionChevron} />
                </TouchableOpacity>
              </View>
              <View style={styles.homeUtilityRow}>
                <TouchableOpacity style={styles.homeUtilityButton} onPress={() => openPlanSetup('later')} accessibilityRole="button" accessibilityLabel="Plan for later">
                  <Ionicons name="calendar-outline" size={20} color={colors.coral} />
                  <Text style={styles.homeUtilityButtonText}>Plan for later</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.homeUtilityButton} onPress={() => openSavedPlansHomeAction('saved')} accessibilityRole="button" accessibilityLabel="Open saved and shared plans">
                  <Ionicons name="albums-outline" size={20} color={colors.teal} />
                  <Text style={styles.homeUtilityButtonText}>Saved plans</Text>
                </TouchableOpacity>
              </View>
              {BETA_FEATURES.peopleGroups ? (
                <TouchableOpacity
                  style={[styles.peopleGroupsEntry, isDarkMode && styles.darkChip]}
                  onPress={openPeopleGroupsHomeAction}
                  accessibilityRole="button"
                  accessibilityLabel="People and groups. Plan with friends, family, and groups."
                >
                  <View style={styles.peopleGroupsIcon}>
                    <Ionicons name="people-outline" size={21} color={colors.teal} />
                  </View>
                  <View style={styles.peopleGroupsTextBlock}>
                    <Text style={[styles.peopleGroupsTitle, isDarkMode && styles.darkText]}>People & Groups</Text>
                    <Text style={[styles.peopleGroupsSubtitle, isDarkMode && styles.darkMutedText]}>
                      Plan with friends, family, and groups
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={isDarkMode ? colors.textPrimary : colors.textSecondary} />
                </TouchableOpacity>
              ) : null}
            </>
          ) : (
            <>
              <View style={styles.setupHeaderRow}>
                <View>
                  <Text style={[styles.homeTitle, isDarkMode && styles.darkText]}>
                    {planSetupTiming === 'now' ? 'Now' : 'Later'}
                  </Text>
                  <Text style={[styles.homeSubtitle, isDarkMode && styles.darkMutedText]}>Set it up</Text>
                </View>
                <Button label="Back" onPress={() => setPlanSetupOpen(false)} compact />
              </View>

              {planSetupTiming === 'later' ? (
                <View style={styles.setupField}>
                  <Text style={[styles.setupLabel, isDarkMode && styles.darkMutedText]}>Plan name (optional)</Text>
                  <TextInput
                    style={[styles.input, isDarkMode && styles.darkPanelInput, Platform.OS === 'web' && styles.webInput]}
                    value={planSetupName}
                    onChangeText={setPlanSetupName}
                    placeholder="Give this plan a name"
                    placeholderTextColor={isLightMode ? colors.textTertiary : colors.textSecondary}
                    accessibilityLabel="Plan name"
                    returnKeyType="next"
                  />
                </View>
              ) : null}

              {planSetupTiming === 'now' ? (
                <View style={styles.setupPreferenceBlock}>
                  <View style={styles.setupField}>
                    <Text style={[styles.setupLabel, isDarkMode && styles.darkMutedText]}>Looking for</Text>
                    <View style={[styles.filterTabs, styles.setupIntentTabs]}>
                      {(['food', 'activity', 'both'] as PlanningIntent[]).map((intent) => (
                        <FilterTab
                          key={`setup-intent-${intent}`}
                          label={planningIntentLabel(intent)}
                          active={planSetupIntent === intent}
                          onPress={() => {
                            setPlanSetupIntent(intent);
                            setResultMode(intent === 'activity' ? 'activity' : 'food');
                            addLog(`Now setup intent selected: ${planningIntentLabel(intent)}`);
                          }}
                        />
                      ))}
                    </View>
                  </View>
                  {planningIntentIncludesSlot(planSetupIntent, 'food') ? (
                    <>
                      <PreferenceGroup
                        label="Food filters"
                        items={FOOD_QUICK_FILTERS}
                        selected={selectedFoods}
                        onPress={(value) => toggleMulti(value, selectedFoods, setSelectedFoods, 'Food')}
                      />
                      <PreferenceGroup
                        label="Cuisine"
                        items={CUISINES}
                        selected={selectedFoods}
                        previewCount={8}
                        expanded={Boolean(expandedPreferenceGroups.setupCuisine)}
                        onToggleExpanded={() => togglePreferenceGroupExpanded('setupCuisine')}
                        onPress={(value) => toggleMulti(value, selectedFoods, setSelectedFoods, 'Food')}
                      />
                      <PreferenceGroup
                        label="Dietary needs"
                        items={DIETARY_PREFERENCES}
                        selected={selectedDietary}
                        previewCount={4}
                        expanded={Boolean(expandedPreferenceGroups.setupDietary)}
                        onToggleExpanded={() => togglePreferenceGroupExpanded('setupDietary')}
                        onPress={(value) => toggleMulti(value, selectedDietary, setSelectedDietary, 'Dietary')}
                      />
                    </>
                  ) : null}
                  {planningIntentIncludesSlot(planSetupIntent, 'activity') ? (
                    <PreferenceGroup
                      label="Activity type"
                      items={ACTIVITIES}
                      selected={selectedActivities}
                      previewCount={8}
                      expanded={Boolean(expandedPreferenceGroups.setupActivity)}
                      onToggleExpanded={() => togglePreferenceGroupExpanded('setupActivity')}
                      onPress={(value) => toggleMulti(value, selectedActivities, setSelectedActivities, 'Activity')}
                    />
                  ) : null}
                </View>
              ) : (
                <>
                  <View style={styles.setupField}>
                    <Text style={[styles.setupLabel, isDarkMode && styles.darkMutedText]}>When?</Text>
                    <View style={styles.dateChipWrap}>
                      {setupDateWindowOptions.map((option) => {
                        const active = planSetupDateWindow === option.id;
                        return (
                          <TouchableOpacity
                            key={`setup-date-${option.id}`}
                            style={[styles.dateChip, active && styles.dateChipActive]}
                            onPress={() => setPlanSetupDateWindow(option.id)}
                            accessibilityRole="button"
                            accessibilityLabel={option.label}
                            accessibilityState={{ selected: active }}
                          >
                            <Text style={[styles.dateChipText, active && styles.dateChipTextActive]}>{option.label}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                    {planSetupDateWindow === 'custom' ? (
                      <View style={styles.customDateBox}>
                        <View style={styles.customDateInputs}>
                          <TextInput
                            style={[styles.input, styles.customDateInput]}
                            value={planSetupCustomDateStartInput}
                            onChangeText={setPlanSetupCustomDateStartInput}
                            accessibilityLabel="Plan start date"
                            placeholder="Start YYYY-MM-DD"
                            placeholderTextColor={colors.textTertiary}
                            keyboardType="numbers-and-punctuation"
                          />
                          <TextInput
                            style={[styles.input, styles.customDateInput]}
                            value={planSetupCustomDateEndInput}
                            onChangeText={setPlanSetupCustomDateEndInput}
                            accessibilityLabel="Plan end date"
                            placeholder="End YYYY-MM-DD"
                            placeholderTextColor={colors.textTertiary}
                            keyboardType="numbers-and-punctuation"
                          />
                        </View>
                      </View>
                    ) : null}
                  </View>

                  <View style={styles.setupField}>
                    <Text style={[styles.setupLabel, isDarkMode && styles.darkMutedText]}>Time?</Text>
                    <View style={styles.chipWrap}>
                      {TIMES.filter((time) => planSetupDateWindow === 'today' || time !== 'Now').map((time) => {
                        const active = planSetupTime === time;
                        return (
                          <TouchableOpacity
                            key={`setup-time-${time}`}
                            style={[styles.chip, isDarkMode && styles.darkChip, active && styles.chipActive]}
                            onPress={() => setPlanSetupTime(time)}
                            accessibilityRole="button"
                            accessibilityLabel={time}
                            accessibilityState={{ selected: active }}
                          >
                            <Text style={[styles.chipText, isDarkMode && styles.darkMutedText, active && styles.chipTextActive]}>{time}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                </>
              )}

              <View style={styles.setupField}>
                <Text style={[styles.setupLabel, isDarkMode && styles.darkMutedText]}>Where?</Text>
                <TextInput
                  style={[styles.input, isDarkMode && styles.darkPanelInput, Platform.OS === 'web' && styles.webInput]}
                  value={planSetupWhere}
                  onChangeText={setPlanSetupWhere}
                  accessibilityLabel="Plan location"
                  placeholder="Current location, neighborhood, or city"
                  placeholderTextColor={isLightMode ? colors.textTertiary : colors.textSecondary}
                  returnKeyType="done"
                  onSubmitEditing={submitPlanSetup}
                />
              </View>

              <View style={styles.setupField}>
                <Text style={[styles.setupLabel, styles.darkMutedText]}>Plan type</Text>
                <View style={styles.inferredPlanTypeBox}>
                  <Ionicons
                    name={planSetupPreviewType === 'trip_plan' ? 'airplane-outline' : 'location-outline'}
                    size={20}
                    color={colors.teal}
                  />
                  <View style={styles.inferredPlanTypeTextBlock}>
                    <Text style={styles.inferredPlanTypeText}>{planTypeLabel(planSetupPreviewType)}</Text>
                    <Text style={styles.inferredPlanTypeHint}>Set automatically from your dates and destination.</Text>
                  </View>
                </View>
              </View>

              <View style={styles.setupField}>
                <View style={styles.setupFieldHeader}>
                    <Text style={[styles.setupLabel, isDarkMode && styles.darkMutedText]}>Who’s going?</Text>
                  <Text style={[styles.setupPeopleSummary, isDarkMode && styles.darkMutedText]} numberOfLines={1}>
                    {planSetupPeopleSummary}
                  </Text>
                </View>
                <View style={styles.quickShareUserList}>
                  {quickShareUsers.map((user) => {
                    const selected = planSetupInvitees.includes(user);
                    return (
                      <TouchableOpacity
                        key={`setup-person-${user}`}
                        style={[styles.quickShareUserButton, selected && styles.quickShareUserButtonSelected]}
                        onPress={() => togglePlanSetupInvitee(user)}
                        accessibilityRole="button"
                        accessibilityLabel={`${selected ? 'Remove' : 'Add'} ${user}`}
                        accessibilityState={{ selected }}
                      >
                        <Text style={styles.quickShareUserText}>{user}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <View style={styles.setupActions}>
                <Button
                  label={planSetupSubmitting ? 'Starting' : 'Start Planning'}
                  onPress={submitPlanSetup}
                  primary
                  disabled={planSetupSubmitting}
                />
              </View>
            </>
          )}
        </View>
      ) : (
      <>

      {!savedPlansLandingOpen ? (
      <>

      {nowExperienceActive ? (
        <View style={[styles.nowBox, isLightMode && styles.lightPanel, isDarkMode && styles.darkPanel]}>
          <View style={styles.nowHeaderRow}>
            <View style={styles.nowHeaderTextBlock}>
              <Text style={[styles.nowTitle, isDarkMode && styles.darkText]}>
                {nowMode === 'home' ? 'What do you want to do?' : resultMode === 'food' ? 'Food nearby' : 'Activities nearby'}
              </Text>
              <Text style={[styles.nowSubtitle, isDarkMode && styles.darkMutedText]} numberOfLines={1}>
                {nowMode === 'home' ? nowPeopleSummary : `${nowCategoryLabel} | ${nowPeopleSummary}`}
              </Text>
            </View>
            <Button label="Back" onPress={openHome} compact />
          </View>

          {nowMode === 'home' ? (
            <View style={styles.nowActionGrid}>
              <TouchableOpacity
                style={[styles.nowActionCard, styles.nowFoodAction]}
                onPress={() => { void startNowDiscovery('food', nowFoodCategory); }}
                accessibilityRole="button"
                accessibilityLabel="Food"
              >
                <Ionicons name="restaurant-outline" size={28} color={semanticTones.food.foreground} />
                <Text style={[styles.nowActionTitle, styles.nowActionTitleLight]}>Food</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.nowActionCard, styles.nowActivityAction]}
                onPress={() => { void startNowDiscovery('activity', nowActivityCategory); }}
                accessibilityRole="button"
                accessibilityLabel="Activity"
              >
                <Ionicons name="sparkles-outline" size={28} color={colors.textInverse} />
                <Text style={styles.nowActionTitle}>Activity</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.nowActionCard, styles.nowPeopleAction]}
                onPress={() => setNowPeoplePickerOpen(true)}
                accessibilityRole="button"
                accessibilityLabel="Include Someone"
              >
                <Ionicons name="people-outline" size={28} color={colors.textInverse} />
                <Text style={styles.nowActionTitle}>Include Someone</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.nowDiscoveryPanel}>
              <View style={styles.nowModeSwitcher}>
                <FilterTab label="Food" active={nowMode === 'food'} onPress={() => { void startNowDiscovery('food', nowFoodCategory); }} />
                <FilterTab label="Activity" active={nowMode === 'activity'} onPress={() => { void startNowDiscovery('activity', nowActivityCategory); }} />
                <TouchableOpacity
                  style={[styles.nowPeopleMiniButton, isDarkMode && styles.darkChip]}
                  onPress={() => setNowPeoplePickerOpen(true)}
                  accessibilityRole="button"
                  accessibilityLabel="Include Someone"
                >
                  <Ionicons name="people-outline" size={17} color={isDarkMode ? colors.textPrimary : colors.textInverse} />
                  <Text style={[styles.nowPeopleMiniText, isDarkMode && styles.darkMutedText]} numberOfLines={1}>
                    {nowSelectedPeople.length ? `${nowSelectedPeople.length + 1}` : 'Add'}
                  </Text>
                </TouchableOpacity>
              </View>
              <View style={styles.nowCategoryWrap}>
                {(nowMode === 'food' ? NOW_FOOD_CATEGORIES : NOW_ACTIVITY_CATEGORIES).map((category) => {
                  const active = nowMode === 'food' ? nowFoodCategory === category : nowActivityCategory === category;
                  return (
                    <TouchableOpacity
                      key={`now-category-${category}`}
                      style={[styles.nowCategoryChip, isDarkMode && styles.darkChip, active && styles.nowCategoryChipActive]}
                      onPress={() => { void startNowDiscovery(nowMode === 'food' ? 'food' : 'activity', category); }}
                      accessibilityRole="button"
                      accessibilityLabel={`${category} ${nowMode === 'food' ? 'food' : 'activity'} category`}
                      accessibilityState={{ selected: active }}
                    >
                      <Text style={[styles.nowCategoryText, isDarkMode && styles.darkMutedText, active && styles.nowCategoryTextActive]}>
                        {category}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <View style={styles.setupField}>
                <Text style={[styles.setupLabel, isDarkMode && styles.darkMutedText]}>Search area</Text>
                <View style={styles.inputRow}>
                  <TextInput
                    style={[styles.input, isDarkMode && styles.darkPanelInput, Platform.OS === 'web' && styles.webInput]}
                    value={searchLocationOverride}
                    onChangeText={(value) => {
                      setSearchLocationOverride(value);
                      setSearchNotice('');
                    }}
                    accessibilityLabel="Search area"
                    placeholder="ZIP, neighborhood, or city"
                    placeholderTextColor={isLightMode ? colors.textTertiary : colors.textSecondary}
                    returnKeyType="search"
                    onSubmitEditing={searchFromSearchLocationOverride}
                  />
                  <Button label="Use" onPress={searchFromSearchLocationOverride} compact />
                </View>
                {renderSearchAreaPicker()}
              </View>
            </View>
          )}
        </View>
      ) : null}

      {GROUP_SESSION_ENABLED && !activePlanningSession && sessionBuilderOpen ? (
        <View style={[styles.sessionBox, isDarkMode && styles.darkPanel]}>
          <View style={styles.sessionHeaderRow}>
            <View style={styles.sessionTitleBlock}>
              <Text style={[styles.sectionTitle, isLightMode && styles.lightSectionTitle, isDarkMode && styles.darkText]}>Planning Session</Text>
              <Text style={[styles.sessionMetaText, isDarkMode && styles.darkMutedText]}>
                Invite local testers, set shared context, then collect suggestions and votes.
              </Text>
            </View>
            <Button label="Close" onPress={() => setSessionBuilderOpen(false)} compact />
          </View>

          {userPlanningSessions.length ? (
            <View style={styles.sessionResumeBox}>
              <Text style={[styles.sessionSubhead, isDarkMode && styles.darkText]}>Resume</Text>
              <View style={styles.sessionResumeList}>
                {userPlanningSessions.slice(0, 3).map((session) => (
                  <TouchableOpacity key={session.id} style={styles.sessionResumeItem} onPress={() => resumePlanningSession(session.id)}>
                    <Text style={styles.sessionResumeTitle}>{session.title}</Text>
                    <Text style={styles.sessionResumeMeta}>
                      {planningIntentLabel(session.intent)} | {dateWindowLabel(session.dateWindow, new Date(), session.customDateRange)} | {session.suggestions.length} suggestions
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ) : null}

          <Text style={[styles.sessionSubhead, isDarkMode && styles.darkText]}>Invite testers</Text>
          <View style={styles.chipWrap}>
            {TEST_USERS.filter((name) => name !== currentTesterName).map((name) => {
              const selected = sessionInvitees.includes(name);
              return (
                <TouchableOpacity
                  key={name}
                  style={[styles.chip, isDarkMode && styles.darkChip, selected && styles.chipActive]}
                  onPress={() => setSessionInvitees((prev) => selected ? prev.filter((item) => item !== name) : [...prev, name])}
                >
                  <Text style={[styles.chipText, isDarkMode && styles.darkMutedText, selected && styles.chipTextActive]}>{name}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={[styles.sessionSubhead, isDarkMode && styles.darkText]}>Shared search location</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={sessionLocationInput}
              onChangeText={setSessionLocationInput}
              accessibilityLabel="Shared search location"
              placeholder={searchLocationLabel}
              placeholderTextColor={colors.textTertiary}
              returnKeyType="done"
            />
            <Button label="Use current" onPress={() => setSessionLocationInput(searchLocationLabel)} compact />
          </View>

          <Text style={[styles.sessionSubhead, isDarkMode && styles.darkText]}>Shared date</Text>
          <View style={styles.dateChipWrap}>
            {dateWindowOptions.map((option) => {
              const active = selectedDateWindow === option.id;
              return (
                <TouchableOpacity
                  key={`session-date-${option.id}`}
                  style={[styles.dateChip, active && styles.dateChipActive]}
                  onPress={() => chooseDateWindow(option.id, option.label)}
                  accessibilityRole="button"
                  accessibilityLabel={option.label}
                  accessibilityState={{ selected: active }}
                >
                  <Text style={[styles.dateChipText, active && styles.dateChipTextActive]}>{option.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={[styles.sessionSubhead, isDarkMode && styles.darkText]}>Shared time window</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={sessionTimeWindowInput}
              onChangeText={setSessionTimeWindowInput}
              accessibilityLabel="Shared time window"
              placeholder="6:00 PM - 9:00 PM"
              placeholderTextColor={colors.textTertiary}
              returnKeyType="done"
            />
          </View>

          <Text style={[styles.sessionSubhead, isDarkMode && styles.darkText]}>Intent</Text>
          <View style={styles.filterTabs}>
            {(['food', 'activity', 'both'] as PlanningIntent[]).map((intent) => (
              <FilterTab
                key={intent}
                label={planningIntentLabel(intent)}
                active={sessionIntent === intent}
                onPress={() => setSessionIntent(intent)}
              />
            ))}
          </View>
          <View style={styles.buttonRow}>
            <Button label="Create session" onPress={createPlanningSession} primary />
          </View>
        </View>
      ) : null}

      {GROUP_SESSION_ENABLED && activePlanningSession ? (
        <View style={[styles.sessionBox, isDarkMode && styles.darkPanel]}>
          <View style={styles.sessionHeaderRow}>
            <View style={styles.sessionTitleBlock}>
              <Text style={[styles.sectionTitle, isLightMode && styles.lightSectionTitle, isDarkMode && styles.darkText]}>
                {activePlanningSession.title}
              </Text>
              <Text style={[styles.sessionMetaText, isDarkMode && styles.darkMutedText]}>
                {planningIntentLabel(activePlanningSession.intent)} | {dateWindowLabel(activePlanningSession.dateWindow, new Date(), activePlanningSession.customDateRange)} | {activePlanningSession.timeWindow}
              </Text>
              <Text style={[styles.sessionMetaText, isDarkMode && styles.darkMutedText]}>
                Shared search: {activePlanningSession.locationLabel}
              </Text>
              <Text style={[styles.sessionMetaText, isDarkMode && styles.darkMutedText]}>
                My route origin: {startingLocationLabel}
              </Text>
            </View>
            <View style={styles.sessionHeaderActions}>
              <Button label="Update" onPress={sharePlanningSessionUpdate} compact />
              <Button label="Exit" onPress={exitPlanningSession} compact />
            </View>
          </View>

          <View style={styles.sessionParticipantRow}>
            {activePlanningSession.participants.map((participant) => (
              <View key={participant} style={[styles.sessionParticipantPill, participant === activePlanningSession.owner && styles.sessionOwnerPill]}>
                <Text style={styles.sessionParticipantText}>
                  {participant}{participant === activePlanningSession.owner ? ' owner' : ''}
                </Text>
              </View>
            ))}
          </View>

          {activePlanningSession.status === 'planning' ? (
            <>
              <View style={styles.sessionSearchActions}>
                {activePlanningSession.intent !== 'activity' ? (
                  <Button label="Find food" onPress={() => searchFromPlan('food')} compact />
                ) : null}
                {activePlanningSession.intent !== 'food' ? (
                  <Button label="Find activity" onPress={() => searchFromPlan('activity')} compact />
                ) : null}
              </View>

              <View style={styles.sessionManualBox}>
                <Text style={[styles.sessionSubhead, isDarkMode && styles.darkText]}>Manual suggestion</Text>
                <View style={styles.inputRow}>
                  <TextInput
                    style={styles.input}
                    value={sessionManualSuggestion}
                    onChangeText={setSessionManualSuggestion}
                    accessibilityLabel="Manual place or activity suggestion"
                    placeholder="Place or idea"
                    placeholderTextColor={colors.textTertiary}
                    returnKeyType="done"
                  />
                  <Button label="Food" onPress={() => addManualPlanningSuggestion('food')} compact />
                  <Button label="Activity" onPress={() => addManualPlanningSuggestion('activity')} compact />
                </View>
              </View>
            </>
          ) : null}

          <View style={styles.sessionSuggestionGroup}>
            <Text style={[styles.sessionSubhead, isDarkMode && styles.darkText]}>Food options</Text>
            {foodSuggestions.length ? foodSuggestions
              .slice()
              .sort((a, b) => scorePlanningSuggestion(b, activePlanningSession).score - scorePlanningSuggestion(a, activePlanningSession).score)
              .map((suggestion) => (
                <PlanningSuggestionCard
                  key={suggestion.id}
                  suggestion={suggestion}
                  currentUser={currentTesterName}
                  canRemove={suggestion.addedBy === currentTesterName || isPlanningOwner}
                  onVote={() => togglePlanningVote(suggestion.id)}
                  onRemove={() => removePlanningSuggestion(suggestion)}
                  onOpenMap={() => openPlanningSuggestionMap(suggestion)}
                  onOpenEvent={typeof suggestion.item !== 'string' && suggestion.item.eventUrl ? () => openPlanningSuggestionEvent(suggestion) : undefined}
                  onOpenWebsite={canOpenPlaceWebsite(suggestion.item) ? () => openPlanningSuggestionWebsite(suggestion) : undefined}
                />
              )) : (
              <Text style={[styles.empty, isDarkMode && styles.darkMutedText]}>No food suggestions yet.</Text>
            )}
          </View>

          <View style={styles.sessionSuggestionGroup}>
            <Text style={[styles.sessionSubhead, isDarkMode && styles.darkText]}>Activity options</Text>
            {activitySuggestions.length ? activitySuggestions
              .slice()
              .sort((a, b) => scorePlanningSuggestion(b, activePlanningSession).score - scorePlanningSuggestion(a, activePlanningSession).score)
              .map((suggestion) => (
                <PlanningSuggestionCard
                  key={suggestion.id}
                  suggestion={suggestion}
                  currentUser={currentTesterName}
                  canRemove={suggestion.addedBy === currentTesterName || isPlanningOwner}
                  onVote={() => togglePlanningVote(suggestion.id)}
                  onRemove={() => removePlanningSuggestion(suggestion)}
                  onOpenMap={() => openPlanningSuggestionMap(suggestion)}
                  onOpenEvent={typeof suggestion.item !== 'string' && suggestion.item.eventUrl ? () => openPlanningSuggestionEvent(suggestion) : undefined}
                  onOpenWebsite={canOpenPlaceWebsite(suggestion.item) ? () => openPlanningSuggestionWebsite(suggestion) : undefined}
                />
              )) : (
              <Text style={[styles.empty, isDarkMode && styles.darkMutedText]}>No activity suggestions yet.</Text>
            )}
          </View>

          <View style={styles.sessionFinalBox}>
            <View style={styles.sessionHeaderRow}>
              <View style={styles.sessionTitleBlock}>
                <Text style={[styles.sessionSubhead, isDarkMode && styles.darkText]}>Final plan</Text>
                <Text style={[styles.sessionMetaText, isDarkMode && styles.darkMutedText]}>
                  {activePlanningSession.status === 'finalized'
                    ? 'Locked into normal itinerary stops.'
                    : isPlanningOwner
                      ? 'Build from votes plus timing, distance, event time, and hours.'
                      : `${activePlanningSession.owner} can lock this in.`}
                </Text>
              </View>
              {isPlanningOwner && activePlanningSession.status === 'planning' ? (
                <Button label={activePlanningSession.recommendation ? 'Rebuild' : 'Lock it in'} onPress={buildFinalPlanRecommendation} primary compact />
              ) : null}
            </View>

            {activePlanningSession.recommendation ? (
              <View style={styles.sessionRecommendationBox}>
                {activePlanningSession.recommendation.suggestionIds.map((id, index) => {
                  const suggestion = activePlanningSession.suggestions.find((item) => item.id === id);
                  if (!suggestion) return null;
                  return (
                    <Text key={id} style={[styles.sessionRecommendationLine, isDarkMode && styles.darkText]}>
                      {index + 1}. {suggestion.slot === 'food' ? 'Food' : 'Activity'}: {cardToName(suggestion.item) || 'Suggestion'}
                    </Text>
                  );
                })}
                {activePlanningSession.recommendation.notes.slice(0, 3).map((note) => (
                  <Text key={note} style={[styles.sessionMetaText, isDarkMode && styles.darkMutedText]}>{note}</Text>
                ))}
                {isPlanningOwner && activePlanningSession.status === 'planning' ? (
                  <View style={styles.buttonRow}>
                    <Button label="Accept plan" onPress={acceptFinalPlanRecommendation} primary compact />
                  </View>
                ) : null}
              </View>
            ) : null}

            {activePlanningSession.status === 'finalized' && activePlanningSession.finalPlan.length ? (
              <View style={styles.sessionRecommendationBox}>
                {activePlanningSession.finalPlan.map((stop, index) => {
                  const stopKind = itineraryKindForStop(stop);
                  return (
                    <Text key={stop.key} style={[styles.sessionRecommendationLine, isDarkMode && styles.darkText]}>
                      {index + 1}. {itineraryKindLabel(stopKind)}: {cardToName(stop.item) || 'Stop'}
                    </Text>
                  );
                })}
                <View style={styles.buttonRow}>
                  <Button label="Load final plan" onPress={loadFinalSessionPlan} compact />
                </View>
              </View>
            ) : null}
          </View>
        </View>
      ) : null}

      {!nowExperienceActive ? (
      <View
        style={[styles.planBox, isDarkMode && styles.darkPanel]}
        onLayout={(event) => { planBoxYRef.current = event.nativeEvent.layout.y; }}
      >
        {!isPlanLocked ? (
          <View style={styles.itineraryBuilder}>
            <View style={styles.itineraryPlanHeader}>
              <TextInput
                style={styles.itineraryPlanTitleInput}
                value={plan.title ?? planTitle}
                onChangeText={renamePlan}
                accessibilityLabel="Plan name"
                placeholder="Plan title"
                placeholderTextColor={colors.textTertiary}
                numberOfLines={1}
              />
              <Text style={styles.itineraryPlanMeta} numberOfLines={1}>
                {planHeaderMeta || 'Build a plan one stop at a time'}
              </Text>
            </View>

            {getAlphaAccount() ? (
              <View style={styles.itineraryCollaborationStrip}>
                <Text style={styles.itineraryCollaborationSummary}>Invite people and manage live RSVPs in your shared plan. Once shared, edit the group itinerary there.</Text>
                <Button label="Open shared plan & RSVPs" onPress={openCurrentSharedPlan} compact />
              </View>
            ) : null}
            {!getAlphaAccount() && (activeBetaPlan || plan.sharedPlanId) ? (
              <View style={styles.itineraryCollaborationStrip}>
                <View style={styles.itineraryCollaborationHeader}>
                  <View style={styles.itineraryCollaborationLabel}>
                    <Ionicons name="people-outline" size={iconSizes.sm} color={colors.cyan} />
                    <Text style={styles.itineraryCollaborationTitle}>RSVP</Text>
                  </View>
                  <Text
                    style={styles.itineraryCollaborationSummary}
                    numberOfLines={1}
                    accessibilityLabel={`Shared plan RSVP. ${betaPlanRsvpSummary}`}
                  >
                    {betaPlanRsvpSummary}
                  </Text>
                </View>
                <View style={styles.itineraryRsvpActions}>
                  {COMPACT_RSVP_OPTIONS.map((option) => {
                    const selected = currentBetaRsvp === option.status;
                    return (
                      <TouchableOpacity
                        key={option.status}
                        activeOpacity={0.72}
                        accessibilityLabel={`RSVP ${option.label}`}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                        onPress={() => { void setActiveBetaRsvp(option.status); }}
                        style={[styles.itineraryRsvpButton, selected && styles.itineraryRsvpButtonSelected]}
                      >
                        {selected ? (
                          <Ionicons name="checkmark" size={14} color={colors.cyan} />
                        ) : null}
                        <Text style={[styles.itineraryRsvpButtonText, selected && styles.itineraryRsvpButtonTextSelected]} numberOfLines={1}>
                          {option.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ) : null}

            <View style={styles.itinerarySectionHeader}>
              <View style={styles.itinerarySectionCopy}>
                <Text style={styles.itinerarySectionTitle}>Plan stops</Text>
                <Text style={styles.itinerarySectionHint}>Drag the handle to reorder · Tap a stop to expand</Text>
              </View>
              <TouchableOpacity
                activeOpacity={0.72}
                accessibilityLabel={addStopMenuOpen ? 'Close add stop options' : 'Add stop'}
                accessibilityRole="button"
                accessibilityState={{ expanded: addStopMenuOpen }}
                onPress={() => {
                  setAddStopMenuOpen((current) => !current);
                  if (addStopMenuOpen) setPendingVisualType(undefined);
                }}
                style={[styles.itineraryAddStopButton, addStopMenuOpen && styles.itineraryAddStopButtonActive]}
              >
                <Ionicons name={addStopMenuOpen ? 'close' : 'add'} size={iconSizes.sm} color={colors.coral} />
                <Text style={styles.itineraryAddStopText}>Add stop</Text>
              </TouchableOpacity>
            </View>

            {addStopMenuOpen ? (
              <View style={styles.itineraryAddMenu}>
                <View style={styles.itineraryTypeGrid}>
                  <TouchableOpacity
                    activeOpacity={0.72}
                    accessibilityLabel="Search for a food stop"
                    accessibilityRole="button"
                    onPress={() => searchFromPlan('food', 'food')}
                    style={[styles.itineraryTypeButton, styles.itineraryTypeButtonFood]}
                  >
                    <Ionicons name="restaurant-outline" size={iconSizes.md} color={semanticTones.food.accent} />
                    <Text style={[styles.itineraryTypeText, { color: semanticTones.food.accent }]}>Food</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    activeOpacity={0.72}
                    accessibilityLabel="Search for an activity stop"
                    accessibilityRole="button"
                    onPress={() => searchFromPlan('activity', 'activity')}
                    style={[styles.itineraryTypeButton, styles.itineraryTypeButtonActivity]}
                  >
                    <Ionicons name="walk-outline" size={iconSizes.md} color={semanticTones.activity.accent} />
                    <Text style={[styles.itineraryTypeText, { color: semanticTones.activity.accent }]}>Activity</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    activeOpacity={0.72}
                    accessibilityLabel="Search for a dessert stop"
                    accessibilityRole="button"
                    onPress={() => searchFromPlan('food', 'dessert')}
                    style={[styles.itineraryTypeButton, styles.itineraryTypeButtonDessert]}
                  >
                    <Ionicons name="ice-cream-outline" size={iconSizes.md} color={semanticTones.dessert.accent} />
                    <Text style={[styles.itineraryTypeText, { color: semanticTones.dessert.accent }]}>Dessert</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    activeOpacity={0.72}
                    accessibilityLabel="Add an idea or other stop"
                    accessibilityRole="button"
                    accessibilityState={{ selected: pendingVisualType === 'idea' }}
                    onPress={() => setPendingVisualType((current) => current === 'idea' ? undefined : 'idea')}
                    style={[
                      styles.itineraryTypeButton,
                      styles.itineraryTypeButtonIdea,
                      pendingVisualType === 'idea' && styles.itineraryTypeButtonSelected,
                    ]}
                  >
                    <Ionicons name="bulb-outline" size={iconSizes.md} color={semanticTones.idea.accent} />
                    <Text style={[styles.itineraryTypeText, { color: semanticTones.idea.accent }]}>Idea / Other</Text>
                  </TouchableOpacity>
                </View>

                {pendingVisualType === 'idea' ? (
                  <View style={styles.itineraryIdeaComposer}>
                    <TextInput
                      style={styles.itineraryIdeaInput}
                      value={ideaDraft}
                      onChangeText={setIdeaDraft}
                      accessibilityLabel="Idea or other stop name"
                      placeholder="Place or idea"
                      placeholderTextColor={colors.textTertiary}
                      returnKeyType="done"
                      onSubmitEditing={addIdeaStop}
                    />
                    <TouchableOpacity
                      activeOpacity={0.72}
                      accessibilityLabel="Add idea to the end of the plan"
                      accessibilityRole="button"
                      accessibilityState={{ disabled: !ideaDraft.trim() }}
                      disabled={!ideaDraft.trim()}
                      onPress={addIdeaStop}
                      style={[styles.itineraryIdeaAddButton, !ideaDraft.trim() && styles.itineraryControlDisabled]}
                    >
                      <Ionicons name="arrow-forward" size={iconSizes.sm} color={colors.textInverse} />
                      <Text style={styles.itineraryIdeaAddText}>Add</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}

                {betaPlanSuggestions.length ? (
                  <View style={styles.itineraryCandidateList}>
                    <Text style={styles.itineraryCandidateHeading}>Suggestions</Text>
                    {betaPlanSuggestions.map((suggestion) => {
                      const suggestionInPlan = plan.stops.some((stop) =>
                        stop.slot === suggestion.slot && cardToId(stop.item) === cardToId(suggestion.item),
                      );
                      return (
                        <View key={`builder-${suggestion.id}`} style={styles.itineraryCandidateRow}>
                          <View style={styles.itineraryCandidateCopy}>
                            <Text style={styles.itineraryCandidateName} numberOfLines={1}>
                              {cardToName(suggestion.item) || 'Suggestion'}
                            </Text>
                            <Text style={styles.itineraryCandidateMeta} numberOfLines={1}>
                              {suggestion.slot === 'food' ? 'Food' : 'Activity'} · {suggestion.addedBy}
                            </Text>
                          </View>
                          <TouchableOpacity
                            activeOpacity={0.72}
                            accessibilityLabel={suggestionInPlan ? 'Already in plan' : `Add ${cardToName(suggestion.item) || 'suggestion'}`}
                            accessibilityRole="button"
                            accessibilityState={{ disabled: suggestionInPlan }}
                            disabled={suggestionInPlan}
                            onPress={() => addSuggestionToCurrentPlan(suggestion)}
                            style={[styles.itineraryCandidateAdd, suggestionInPlan && styles.itineraryControlDisabled]}
                          >
                            <Text style={styles.itineraryCandidateAddText}>{suggestionInPlan ? 'In plan' : 'Add'}</Text>
                          </TouchableOpacity>
                        </View>
                      );
                    })}
                  </View>
                ) : null}

                <View style={styles.itineraryGroupSuggestion}>
                  <Text style={styles.itineraryCandidateHeading}>Suggest to the group</Text>
                  <TextInput
                    style={styles.itineraryIdeaInput}
                    value={betaSuggestionInput}
                    onChangeText={setBetaSuggestionInput}
                    accessibilityLabel="Plan suggestion"
                    placeholder="Place or idea"
                    placeholderTextColor={colors.textTertiary}
                    returnKeyType="done"
                    onSubmitEditing={() => addActiveBetaSuggestion(resultMode)}
                  />
                  <View style={styles.itinerarySuggestionActions}>
                    <TouchableOpacity
                      activeOpacity={0.72}
                      accessibilityLabel="Suggest as food"
                      accessibilityRole="button"
                      accessibilityState={{ disabled: !betaSuggestionInput.trim() }}
                      disabled={!betaSuggestionInput.trim()}
                      onPress={() => addActiveBetaSuggestion('food')}
                      style={[styles.itinerarySuggestionButton, !betaSuggestionInput.trim() && styles.itineraryControlDisabled]}
                    >
                      <Ionicons name="restaurant-outline" size={iconSizes.xs} color={semanticTones.food.accent} />
                      <Text style={styles.itinerarySuggestionButtonText}>Food</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      activeOpacity={0.72}
                      accessibilityLabel="Suggest as an activity"
                      accessibilityRole="button"
                      accessibilityState={{ disabled: !betaSuggestionInput.trim() }}
                      disabled={!betaSuggestionInput.trim()}
                      onPress={() => addActiveBetaSuggestion('activity')}
                      style={[styles.itinerarySuggestionButton, !betaSuggestionInput.trim() && styles.itineraryControlDisabled]}
                    >
                      <Ionicons name="walk-outline" size={iconSizes.xs} color={semanticTones.activity.accent} />
                      <Text style={styles.itinerarySuggestionButtonText}>Activity</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ) : null}

            <View
              style={styles.itineraryList}
              onLayout={(event) => {
                const { width, y } = event.nativeEvent.layout;
                timelineYRef.current = y;
                setItineraryListWidth((current) => (
                  current !== undefined && Math.abs(current - width) < 1 ? current : width
                ));
              }}
            >
              {plan.stops.length ? (
                <Sortable.Flex
                  activeItemOpacity={1}
                  activeItemScale={1}
                  activeItemShadowOpacity={0.22}
                  alignItems="flex-start"
                  autoScrollActivationOffset={[96, 132]}
                  autoScrollMaxVelocity={900}
                  customHandle
                  dragActivationDelay={0}
                  dragActivationFailOffset={10}
                  DropIndicatorComponent={ItineraryInsertionIndicator}
                  dropIndicatorStyle={{}}
                  flexDirection="column"
                  flexWrap="nowrap"
                  inactiveItemOpacity={1}
                  itemEntering={null}
                  onDragEnd={reorderPlanStops}
                  overDrag="vertical"
                  rowGap={spacing.xs}
                  scrollableRef={scrollRef}
                  showDropIndicator
                  strategy="insert"
                  width={itineraryListWidth}
                >
                  {plan.stops.map((stop, index) => {
                    const nextStop = plan.stops[index + 1];
                    const nextTravelMeta = nextStop ? travelMetaForStop(nextStop, index + 1) : undefined;
                    const stopLocation = typeof stop.item === 'string'
                      ? undefined
                      : stop.item.address || stop.item.subtitle || cityStateLabel(cityStateForPlace(stop.item));
                    const kind = itineraryKindForStop(stop);
                    return (
                      <View
                        key={stop.key}
                        onLayout={(event) => { stopLayoutYRef.current[stop.key] = event.nativeEvent.layout.y; }}
                        style={[
                          styles.itinerarySortableItem,
                          itineraryListWidth !== undefined && { width: itineraryListWidth },
                        ]}
                      >
                        <ItineraryStopRow
                          animateEntrance={recentlyAddedStopKey === stop.key}
                          arrivalTime={formatClockAfterMinutes(itineraryArrivalMinutes(index), activePlanTimelineBaseMs)}
                          durationEditorExpanded={timeEditorKey === stop.key}
                          durationMinutes={durationForStop(stop)}
                          expanded={expandedStopKey === stop.key}
                          featureOptions={stop.featureOptions || []}
                          kind={kind}
                          location={stopLocation}
                          name={cardToName(stop.item) || `${kind === 'idea' ? 'Idea' : kind} stop`}
                          number={index + 1}
                          onDeletePress={() => removeStop(stop)}
                          onDurationChange={(minutes) => updateStopDuration(stop.key, minutes)}
                          onDurationEditorExpandedChange={(expanded) => {
                            setExpandedStopKey(stop.key);
                            setTimeEditorKey(expanded ? stop.key : null);
                          }}
                          onMapPress={() => openStopMaps(stop)}
                          onMoveDown={index < plan.stops.length - 1 ? () => moveStop(stop.key, 1) : undefined}
                          onMoveUp={index > 0 ? () => moveStop(stop.key, -1) : undefined}
                          onSharePress={() => openQuickShare({ kind: 'stop', stop, index })}
                          onToggleExpanded={() => toggleExpandedStop(stop.key)}
                          onToggleFeature={(feature) => toggleStopFeature(stop.key, feature)}
                          onTravelModeChange={nextStop ? (mode) => setStopTravelMode(nextStop.key, mode) : undefined}
                          onWebsitePress={canOpenPlaceWebsite(stop.item) ? () => openStopWebsite(stop) : undefined}
                          selectedFeatures={stop.selectedFeatures || []}
                          testID={`itinerary-stop-${stop.key}`}
                          travelMode={nextTravelMeta?.mode}
                          travelToNext={nextStop && nextTravelMeta ? {
                            durationMinutes: travelMinutesForStop(nextStop, index + 1),
                            label: nextTravelMeta.label.toLowerCase(),
                            mode: nextTravelMeta.mode,
                          } : null}
                        />
                      </View>
                    );
                  })}
                </Sortable.Flex>
              ) : (
                <View style={styles.itineraryEmptyState}>
                  <Ionicons name="list-outline" size={iconSizes.lg} color={colors.textTertiary} />
                  <Text style={styles.itineraryEmptyTitle}>No stops yet</Text>
                  <Text style={styles.itineraryEmptyCopy}>Add food, an activity, dessert, or an idea. New stops go to the end.</Text>
                </View>
              )}
            </View>

            {plan.stops.length ? (
              <>
                <View style={styles.itinerarySummary}>
                  <View style={styles.itinerarySummaryValues}>
                    <View style={styles.itinerarySummaryColumn}>
                      <Text style={styles.itinerarySummaryLabel}>Est. start</Text>
                      <Text style={styles.itinerarySummaryValue}>{planStartTimeLabel}</Text>
                    </View>
                    <View style={styles.itinerarySummaryDivider} />
                    <View style={styles.itinerarySummaryColumn}>
                      <Text style={styles.itinerarySummaryLabel}>Total time</Text>
                      <Text style={styles.itinerarySummaryValue}>{planTotalTimeLabel}</Text>
                    </View>
                    <View style={styles.itinerarySummaryDivider} />
                    <View style={styles.itinerarySummaryColumn}>
                      <Text style={styles.itinerarySummaryLabel}>Est. finish</Text>
                      <Text style={styles.itinerarySummaryValue}>{planFinishTimeLabel}</Text>
                    </View>
                  </View>
                  {targetStatus ? (
                    <View style={styles.itineraryTargetStatus}>
                      <Ionicons
                        name={targetStatus.tone === 'over' ? 'alert-circle-outline' : 'checkmark-circle-outline'}
                        size={iconSizes.xs}
                        color={targetStatus.tone === 'over' ? colors.red : targetStatus.tone === 'near' ? colors.amber : colors.green}
                      />
                      <Text style={[
                        styles.itineraryTargetStatusText,
                        targetStatus.tone === 'over'
                          ? styles.itineraryTargetStatusOver
                          : targetStatus.tone === 'near'
                            ? styles.itineraryTargetStatusNear
                            : styles.itineraryTargetStatusUnder,
                      ]}>
                        {targetStatus.label}
                      </Text>
                    </View>
                  ) : null}
                </View>

                <View style={styles.itineraryFooterActions}>
                  <TouchableOpacity
                    activeOpacity={0.72}
                    accessibilityLabel="Invite people"
                    accessibilityRole="button"
                    accessibilityState={{ expanded: planPeopleOpen }}
                    onPress={() => { if (getAlphaAccount()) void openCurrentSharedPlan(); else setPlanPeopleOpen((current) => !current); }}
                    style={[styles.itinerarySecondaryAction, planPeopleOpen && styles.itinerarySecondaryActionActive]}
                  >
                    <Ionicons name="person-add-outline" size={iconSizes.sm} color={colors.textPrimary} />
                    <Text style={styles.itinerarySecondaryActionText}>Invite</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    activeOpacity={0.72}
                    accessibilityLabel={isCurrentPlanSaved ? 'Plan saved' : 'Save plan'}
                    accessibilityRole="button"
                    accessibilityState={{ disabled: isCurrentPlanSaved }}
                    disabled={isCurrentPlanSaved}
                    onPress={saveCurrentPlan}
                    style={[styles.itinerarySecondaryAction, isCurrentPlanSaved && styles.itineraryControlDisabled]}
                  >
                    <Ionicons name={isCurrentPlanSaved ? 'checkmark-outline' : 'bookmark-outline'} size={iconSizes.sm} color={colors.textPrimary} />
                    <Text style={styles.itinerarySecondaryActionText}>{isCurrentPlanSaved ? 'Saved' : 'Save'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    activeOpacity={0.82}
                    accessibilityLabel="Review and finalize plan"
                    accessibilityRole="button"
                    onPress={lockPlan}
                    style={styles.itineraryPrimaryAction}
                  >
                    <Text style={styles.itineraryPrimaryActionText}>Review plan</Text>
                    <Ionicons name="arrow-forward" size={iconSizes.sm} color={colors.textInverse} />
                  </TouchableOpacity>
                </View>

                {planPeopleOpen ? (
                  <View style={styles.itineraryInvitePanel}>
                    <Text style={styles.itineraryCandidateHeading}>Invite people</Text>
                    <View style={styles.quickShareUserList}>
                      {quickShareUsers.map((user) => {
                        const selected = planInvitees.includes(user);
                        return (
                          <TouchableOpacity
                            key={`plan-person-${user}`}
                            accessibilityLabel={`${selected ? 'Remove' : 'Invite'} ${user}`}
                            accessibilityRole="button"
                            accessibilityState={{ selected }}
                            style={[styles.quickShareUserButton, selected && styles.quickShareUserButtonSelected]}
                            onPress={() => togglePlanInvitee(user)}
                          >
                            <Text style={styles.quickShareUserText}>{user}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                ) : null}

                <View style={styles.itineraryUtilityActions}>
                  <TouchableOpacity
                    accessibilityLabel="Share plan"
                    accessibilityRole="button"
                    onPress={() => { if (getAlphaAccount()) void openCurrentSharedPlan(); else setSharePreviewOpen(true); }}
                    style={styles.itineraryUtilityButton}
                  >
                    <Ionicons name="share-outline" size={iconSizes.xs} color={colors.textSecondary} />
                    <Text style={styles.itineraryUtilityText}>Share</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    accessibilityLabel={isImportedGoogleMapsPlan && plan.sourceUrl ? 'Open route' : 'Route options'}
                    accessibilityRole="button"
                    onPress={openRouteOptions}
                    style={styles.itineraryUtilityButton}
                  >
                    <Ionicons name="map-outline" size={iconSizes.xs} color={colors.textSecondary} />
                    <Text style={styles.itineraryUtilityText}>{isImportedGoogleMapsPlan && plan.sourceUrl ? 'Open route' : 'Route'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    accessibilityLabel="Clear plan"
                    accessibilityRole="button"
                    onPress={requestClearCurrentPlan}
                    style={styles.itineraryUtilityButton}
                  >
                    <Ionicons name="trash-outline" size={iconSizes.xs} color={colors.textTertiary} />
                    <Text style={styles.itineraryUtilityText}>Clear plan</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : null}
          </View>
        ) : null}

        {hasAnyActiveStop && isPlanLocked ? (
          <>
          <View style={[styles.lockedPlanCard, isDarkMode && styles.darkCard]}>
            <View style={styles.lockedPlanCardHeader}>
              <View style={styles.lockedPlanTitleBlock}>
                <Text style={[styles.lockedPlanTitle, isDarkMode && styles.darkText]} numberOfLines={2}>
                  {planTitle}
                </Text>
                <Text style={[styles.lockedPlanMeta, isDarkMode && styles.darkMutedText]} numberOfLines={1}>
                  {activePlanDateTimeLabel} | {searchLocationLabel}
                </Text>
              </View>
              <View style={styles.lockedPlanCardTools}>
                <TouchableOpacity
                  style={[styles.lockedPlanIconButton, isDarkMode && styles.darkChip]}
                  onPress={() => setPlanPreviewOpen(true)}
                  accessibilityRole="button"
                  accessibilityLabel="View larger plan"
                >
                  <Ionicons name="expand-outline" size={18} color={isDarkMode ? colors.textPrimary : colors.textInverse} />
                </TouchableOpacity>
                <Text style={[styles.lockedPlanMeta, isDarkMode && styles.darkMutedText]}>{plan.stops.length} stops</Text>
              </View>
            </View>
            <View style={styles.planStats}>
              <Stat label="Stops" value={plan.stops.length} tone="primary" />
              <Stat label="Total time" value={planTotalTimeLabel} tone="route" />
              <Stat label="Est. finish" value={planFinishTimeLabel} tone="success" />
            </View>
            {leaveForFirstStopText ? (
              <Text style={[styles.lockedPlanLeave, isDarkMode && styles.darkMutedText]} numberOfLines={1}>
                {leaveForFirstStopText}
              </Text>
            ) : null}
            <Text style={[styles.lockedPlanInvitees, isDarkMode && styles.darkMutedText]} numberOfLines={1}>
              With {planPeopleSummary}
            </Text>
            <View style={styles.lockedPlanRsvp}>
              <View style={styles.betaSectionHeader}>
                <Text style={[styles.sessionSubhead, styles.darkText]}>RSVP</Text>
                <Text style={[styles.betaSuggestionMeta, styles.darkMutedText]}>{betaPlanRsvpSummary}</Text>
              </View>
              <RsvpControl value={currentBetaRsvp} onChange={setActiveBetaRsvp} />
            </View>
            <View style={styles.lockedStopList}>
              {plan.stops.map((stop, index) => {
                const stopCityState = cityStateLabel(cityStateForPlace(stop.item));
                const travelMeta = travelMetaForStop(stop, index);
                const walkableAfterTesla = travelMeta.mode === 'walk' && isWalkableAfterTeslaStop(plan.stops[index - 1], stop);
                const stopTone = semanticTones[itineraryKindForStop(stop)];
                return (
                  <TouchableOpacity key={`locked-${stop.key}`} style={styles.lockedStopRow} onPress={() => openStopMaps(stop)}>
                    <Text style={[styles.lockedStopIndex, { backgroundColor: stopTone.solid, color: stopTone.foreground }]}>{index + 1}</Text>
                    <View style={styles.lockedStopTravelBlock}>
                      <Ionicons name={travelMeta.icon} size={16} color={colors.teal} />
                      <Text style={styles.lockedStopTravelText} numberOfLines={1}>{travelMeta.duration}</Text>
                    </View>
                    <Text style={styles.lockedStopTime}>{formatClockTime(displayedArrivalTimeForStop(stop, index))}</Text>
                    {walkableAfterTesla ? (
                      <Ionicons name="walk-outline" size={14} color={colors.teal} />
                    ) : null}
                    <View style={styles.lockedStopTextBlock}>
                      <Text style={styles.lockedStopName} numberOfLines={1}>{cardToName(stop.item) || 'Stop'}</Text>
                      {stopCityState ? (
                        <View style={styles.lockedStopCityPill}>
                          <Text style={styles.lockedStopCityText} numberOfLines={1}>{stopCityState}</Text>
                        </View>
                      ) : null}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
          <View style={styles.lockedPlanActions}>
            <Button label={isImportedGoogleMapsPlan && plan.sourceUrl ? 'Open route' : 'Route'} onPress={openRouteOptions} primary compact />
            <Button label="Add to Calendar" onPress={addActiveBetaPlanToCalendar} success compact />
            <Button label="Share" onPress={() => { if (getAlphaAccount()) void openCurrentSharedPlan(); else setSharePreviewOpen(true); }} compact />
            {!isCurrentPlanSaved ? <Button label="Save" onPress={saveCurrentPlan} compact /> : null}
            <Button label="Unlock/Edit" onPress={unlockPlan} compact />
          </View>
          </>
        ) : null}

        {!isPlanLocked ? (
        <View style={styles.routeOriginBox}>
          <TouchableOpacity
            style={styles.planSettingsHeader}
            onPress={() => setPlanSettingsOpen((prev) => !prev)}
            accessibilityRole="button"
            accessibilityLabel={`${planSettingsOpen ? 'Hide' : 'Show'} plan settings`}
            accessibilityState={{ expanded: planSettingsOpen }}
          >
            <View style={styles.locationSummaryText}>
              <Text style={[styles.bridgeTitle, isDarkMode && styles.darkText]}>Plan Settings</Text>
              <Text style={[styles.routeOriginHint, isDarkMode && styles.darkMutedText]} numberOfLines={1} ellipsizeMode="tail">
                {planSettingsSummary}
              </Text>
            </View>
            <HeaderAction label={planSettingsOpen ? 'Hide' : 'Show'} />
          </TouchableOpacity>
          {planSettingsOpen ? (
          <>
          <View style={styles.locationSummaryRow}>
            <View style={styles.locationSummaryText}>
              <Text style={[styles.bridgeTitle, isDarkMode && styles.darkText]}>Starting location</Text>
              <Text style={[styles.routeOriginHint, isDarkMode && styles.darkMutedText]}>{startingLocationLabel}</Text>
            </View>
            <Button label={locationOverrideOpen ? 'Hide' : 'Edit'} onPress={() => setLocationOverrideOpen((prev) => !prev)} compact />
          </View>
          {locationOverrideOpen ? (
            <>
              <Text style={[styles.routeOriginHint, isDarkMode && styles.darkMutedText]}>
                Use a ZIP, address, or place to route from somewhere else.
              </Text>
              <View style={styles.settingsLocationInputGroup}>
                <TextInput
                  style={styles.input}
                  value={routeOriginOverride}
                  onChangeText={setRouteOriginOverride}
                  accessibilityLabel="Starting location"
                  placeholder="ZIP, address, or place"
                  placeholderTextColor={colors.textTertiary}
                  returnKeyType="search"
                  onSubmitEditing={searchFromLocationOverride}
                />
                <View style={styles.settingsLocationActionRow}>
                  {routeOriginOverride.trim() || location ? (
                    <Button label="Clear" onPress={clearLocationOverride} compact />
                  ) : null}
                  <Button label="Use" onPress={searchFromLocationOverride} compact />
                </View>
              </View>
            </>
          ) : null}

          <View style={styles.locationSummaryRow}>
            <View style={styles.locationSummaryText}>
              <Text style={[styles.bridgeTitle, isDarkMode && styles.darkText]}>Search location</Text>
              <Text style={[styles.routeOriginHint, isDarkMode && styles.darkMutedText]}>{searchLocationLabel}</Text>
            </View>
            <Button label={searchLocationOverrideOpen ? 'Hide' : 'Edit'} onPress={() => setSearchLocationOverrideOpen((prev) => !prev)} compact />
          </View>
          {searchLocationOverrideOpen ? (
            <>
              <Text style={[styles.routeOriginHint, isDarkMode && styles.darkMutedText]}>
                Use this when you want to find places somewhere different from where the plan starts.
              </Text>
              <View style={styles.settingsLocationInputGroup}>
                <TextInput
                  style={styles.input}
                  value={searchLocationOverride}
                  onChangeText={setSearchLocationOverride}
                  accessibilityLabel="Search location"
                  placeholder="ZIP, address, or place"
                  placeholderTextColor={colors.textTertiary}
                  returnKeyType="search"
                  onSubmitEditing={searchFromSearchLocationOverride}
                />
                <View style={styles.settingsLocationActionRow}>
                  {searchLocationOverride.trim() || searchLocation ? (
                    <Button label="Clear" onPress={clearSearchLocationOverride} compact />
                  ) : null}
                  <Button label="Use" onPress={searchFromSearchLocationOverride} compact />
                </View>
              </View>
            </>
          ) : null}

          {BETA_FEATURES.routeImport ? (
            <>
              <View style={styles.locationSummaryRow}>
                <View style={styles.locationSummaryText}>
                  <Text style={[styles.bridgeTitle, isDarkMode && styles.darkText]}>Import route</Text>
                  <Text style={[styles.routeOriginHint, isDarkMode && styles.darkMutedText]}>
                    {isImportedGoogleMapsPlan ? `Google Maps route | ${plan.stops.length} stops` : 'Paste a Google Maps directions URL.'}
                  </Text>
                </View>
                <Button
                  label={routeImportOpen ? 'Hide' : 'Edit'}
                  onPress={() => {
                    setRouteImportOpen((prev) => !prev);
                    setRouteImportError('');
                  }}
                  compact
                />
              </View>
              {routeImportOpen ? (
                <View style={styles.routeImportBox}>
                  <TextInput
                    style={styles.input}
                    value={routeImportUrl}
                    onChangeText={(value) => {
                      setRouteImportUrl(value);
                      setRouteImportError('');
                    }}
                    accessibilityLabel="Google Maps route URL"
                    placeholder="Paste Google Maps route URL"
                    placeholderTextColor={colors.textTertiary}
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="done"
                    onSubmitEditing={importGoogleMapsRoute}
                  />
                  {routeImportError ? (
                    <Text style={styles.routeImportError}>{routeImportError}</Text>
                  ) : null}
                  <View style={styles.buttonRow}>
                    <Button
                      label={routeImporting ? 'Importing' : 'Import'}
                      onPress={importGoogleMapsRoute}
                      primary
                      compact
                      disabled={routeImporting}
                    />
                    <Button
                      label="Cancel"
                      onPress={() => {
                        setRouteImportOpen(false);
                        setRouteImportError('');
                      }}
                      compact
                    />
                  </View>
                </View>
              ) : null}
            </>
          ) : null}

          {showChargingStopIdeas ? (
            <View style={[styles.chargingIdeasBox, isDarkMode && styles.darkChip]}>
              <View style={styles.locationSummaryText}>
                <Text style={[styles.bridgeTitle, isDarkMode && styles.darkText]}>Charging stop ideas</Text>
                <Text style={[styles.routeOriginHint, isDarkMode && styles.darkMutedText]}>
                  Useful stops and places near likely charging stops. Confirm charging route in Tesla before departure.
                </Text>
              </View>
              {activeVehicleProfile ? (
                <Text style={[styles.chargingIdeaMeta, isDarkMode && styles.darkMutedText]}>
                  Vehicle profile: {activeVehicleProfile.label || 'Travel profile'}
                </Text>
              ) : null}
              {activeChargingStops.length ? (
                <View style={styles.chargingIdeaList}>
                  {activeChargingStops.slice(0, 4).map((idea) => (
                    <View key={idea.id} style={styles.chargingIdeaRow}>
                      <Ionicons name="flash-outline" size={16} color={colors.teal} />
                      <View style={styles.chargingIdeaTextBlock}>
                        <Text style={[styles.chargingIdeaName, isDarkMode && styles.darkText]} numberOfLines={1}>{idea.name}</Text>
                        <Text style={[styles.chargingIdeaMeta, isDarkMode && styles.darkMutedText]} numberOfLines={2}>
                          {[
                            idea.locationLabel,
                            idea.estimatedDwellMinutes ? `${idea.estimatedDwellMinutes} min dwell idea` : undefined,
                            idea.source === 'itinerary' ? 'Manual itinerary stop' : undefined,
                          ].filter(Boolean).join(' | ') || 'Suggested stop'}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={[styles.chargingIdeaMeta, isDarkMode && styles.darkMutedText]}>
                  Add Tesla Supercharger or EV Charger as activity stops when useful.
                </Text>
              )}
              {activeNearbyPlacesDuringCharging.length ? (
                <Text style={[styles.chargingIdeaMeta, isDarkMode && styles.darkMutedText]} numberOfLines={2}>
                  Nearby ideas: {activeNearbyPlacesDuringCharging.slice(0, 3).map((item) => item.name).join(', ')}
                </Text>
              ) : null}
            </View>
          ) : null}

          <View style={styles.dateWindowBox}>
            <View style={styles.locationSummaryText}>
              <Text style={[styles.bridgeTitle, isDarkMode && styles.darkText]}>Date</Text>
              <Text style={[styles.routeOriginHint, isDarkMode && styles.darkMutedText]}>
                {selectedDateWindowText}. Events use this window; food and places default to live nearby availability.
              </Text>
            </View>
            <View style={styles.dateChipWrap}>
              {dateWindowOptions.map((option) => {
                const active = selectedDateWindow === option.id;
                return (
                  <TouchableOpacity
                    key={option.id}
                    style={[styles.dateChip, active && styles.dateChipActive]}
                    onPress={() => chooseDateWindow(option.id, option.label)}
                    accessibilityRole="button"
                    accessibilityLabel={option.label}
                    accessibilityState={{ selected: active }}
                  >
                    <Text style={[styles.dateChipText, active && styles.dateChipTextActive]}>{option.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {customDateOpen ? (
              <View style={styles.customDateBox}>
                <View style={styles.customDateInputs}>
                  <TextInput
                    style={[styles.input, styles.customDateInput]}
                    value={customDateStartInput}
                    onChangeText={setCustomDateStartInput}
                    accessibilityLabel="Custom start date"
                    placeholder="Start YYYY-MM-DD"
                    placeholderTextColor={colors.textTertiary}
                    keyboardType="numbers-and-punctuation"
                  />
                  <TextInput
                    style={[styles.input, styles.customDateInput]}
                    value={customDateEndInput}
                    onChangeText={setCustomDateEndInput}
                    accessibilityLabel="Custom end date"
                    placeholder="End YYYY-MM-DD"
                    placeholderTextColor={colors.textTertiary}
                    keyboardType="numbers-and-punctuation"
                  />
                </View>
                <View style={styles.buttonRow}>
                  <Button label="Use dates" onPress={applyCustomDateWindow} primary compact />
                  <Button label="Cancel" onPress={() => setCustomDateOpen(false)} compact />
                </View>
              </View>
            ) : null}
          </View>
          </>
          ) : null}
        </View>
        ) : null}

      </View>
      ) : null}

      </>
      ) : null}

      {savedPlansLandingOpen ? (
        <View
          style={[styles.savedPlansBox, isLightMode && styles.lightPanel, isDarkMode && styles.darkPanel]}
          onLayout={(event) => { savedPlansYRef.current = event.nativeEvent.layout.y; }}
        >
          <TouchableOpacity style={styles.savedPlansHeader} onPress={openHome} accessibilityRole="button" accessibilityLabel="Open NomNomGo home">
            <View style={styles.sectionHeaderTextBlock}>
              <Text style={[styles.sectionTitle, isLightMode && styles.lightSectionTitle, isDarkMode && styles.darkText]}>
                {savedPlansNavigationSource === 'plans' ? 'Plans' : 'Saved/Shared Plans'}
              </Text>
              <Text style={[styles.savedPlansHint, isLightMode && styles.lightMutedText, isDarkMode && styles.darkMutedText]}>
                {visibleSavedPlans.length ? `${visibleSavedPlans.length} saved or shared for ${currentTesterName}` : 'Saved and shared plans will show here.'}
              </Text>
            </View>
            <HeaderAction label="Back" />
          </TouchableOpacity>
          {savedPlansOpen ? (
            <View style={styles.savedPlansList}>
              {visibleSavedPlans.length ? visibleSavedPlans.map((saved) => (
                <View key={saved.id} style={styles.savedPlanItem}>
                  <View style={styles.savedPlanTextBlock}>
                    <Text style={styles.savedPlanTitle}>{saved.title}</Text>
                    <Text style={styles.savedPlanMeta}>
                      {saved.source === 'shared'
                        ? `Shared by ${saved.sharedBy || 'Tester'} to ${saved.sharedTo || 'tester'}`
                        : 'Saved plan'} | {savedPlanDateLabel(saved)}
                    </Text>
                    <Text style={styles.savedPlanStops} numberOfLines={2}>
                      {savedPlanStopsLabel(saved)}
                    </Text>
                  </View>
                  <View style={styles.savedPlanActions}>
                    <Button label="Load" onPress={() => loadSavedPlan(saved)} primary compact />
                    <Button label="Delete" onPress={() => requestDeleteSavedPlan(saved)} danger compact />
                  </View>
                </View>
              )) : (
                <EmptyState
                  title="No saved plans yet"
                  description="Plans you save or receive from friends will appear here."
                  icon={<Ionicons name="heart-outline" size={30} color={colors.textSecondary} />}
                />
              )}
            </View>
          ) : null}
        </View>
      ) : null}

      {showPlanningTools ? (
      <>
      <View style={[styles.pairingBox, isLightMode && styles.lightPairingBox, isDarkMode && styles.darkAccentPanel]}>
          <TouchableOpacity
            style={styles.pairingHeader}
            onPress={toggleSuggestedPairingsOpen}
            accessibilityRole="button"
            accessibilityLabel={`${suggestedPairingsOpen ? 'Hide' : 'Show'} suggested pairings`}
            accessibilityState={{ expanded: suggestedPairingsOpen }}
          >
            <View style={styles.pairingHeaderText}>
              <Text style={[styles.sectionTitle, styles.pairingTitle, isLightMode && styles.lightSectionTitle, isDarkMode && styles.darkText]}>
                Suggested pairings
              </Text>
              {!suggestedPairingsOpen ? (
                <Text
                  style={[styles.pairingHint, isLightMode && styles.lightMutedText, isDarkMode && styles.darkMutedText]}
                  numberOfLines={1}
                >
                  {`${suggestedPairings.length} suggestions available`}
                </Text>
              ) : null}
            </View>
            <HeaderAction label={suggestedPairingsOpen ? 'Hide' : 'Show'} />
          </TouchableOpacity>
          {suggestedPairingsOpen ? (
            <View style={styles.pairingBody}>
              <View style={styles.chipWrap}>
                {visibleSuggestedPairings.map((suggestion, index) => (
                  <TouchableOpacity
                    key={`${suggestion.slot}-${suggestion.label}-${index}`}
                    style={[
                      styles.mapChip,
                      suggestion.slot === 'food' ? styles.mapChipFood : styles.mapChipActivity,
                    ]}
                    onPress={() => runSuggestion(suggestion)}
                    accessibilityRole="button"
                    accessibilityLabel={`${suggestion.slot === 'food' ? 'Food' : 'Activity'} pairing: ${suggestion.label}`}
                  >
                    <Text style={[
                      styles.mapChipText,
                      suggestion.slot === 'food' ? styles.mapChipTextFood : styles.mapChipTextActivity,
                    ]}>{suggestion.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              {hiddenSuggestedPairingCount > 0 ? (
                <View style={styles.pairingActions}>
                  <Button
                    label={suggestedPairingsExpanded ? 'Less' : `More (${hiddenSuggestedPairingCount})`}
                    onPress={() => setSuggestedPairingsExpanded((prev) => !prev)}
                    compact
                  />
                </View>
              ) : null}
            </View>
          ) : null}
      </View>

      <View style={[styles.preferencesBox, isLightMode && styles.lightPanel, isDarkMode && styles.darkPanel]}>
        <TouchableOpacity
          style={styles.preferencesHeader}
          onPress={() => setPreferencesOpen((prev) => !prev)}
          accessibilityRole="button"
          accessibilityLabel={`${preferencesOpen ? 'Hide' : 'Edit'} preferences`}
          accessibilityState={{ expanded: preferencesOpen }}
        >
          <View style={styles.sectionHeaderTextBlock}>
            <Text style={[styles.sectionTitle, isLightMode && styles.lightSectionTitle, isDarkMode && styles.darkText]}>Preferences</Text>
            <Text style={[styles.preferenceSummary, isLightMode && styles.lightMutedText, isDarkMode && styles.darkMutedText]}>
              {preferenceSummaryParts.join(' - ')}
            </Text>
          </View>
          <HeaderAction label={preferencesOpen ? 'Hide' : 'Edit'} />
        </TouchableOpacity>

        {preferencesOpen ? (
          <View style={styles.preferencesContent}>
            <PreferenceGroup
              label="Vibe"
              items={MOODS}
              selected={selectedMoods}
              previewCount={8}
              expanded={Boolean(expandedPreferenceGroups.vibe)}
              onToggleExpanded={() => togglePreferenceGroupExpanded('vibe')}
              onPress={(value) =>
                setSelectedMoods((prev) => {
                  addLog(`Mood chip tapped: ${value}`);
                  return prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value];
                })
              }
            />
            <PreferenceGroup
              label="Time"
              items={activePlanDateWindow === 'today' ? TIMES : TIMES.filter((time) => time !== 'Now')}
              selected={[activePlanTimePreference]}
              onPress={(value) => {
                addLog(`Time chip tapped: ${value}`);
                const nextTimeWindow = value === 'Now' ? undefined : defaultTimeWindowForPreference(value);
                activePlanTimingRef.current = {
                  ...activePlanTimingRef.current,
                  timeWindow: nextTimeWindow,
                  timePreference: value,
                };
                setSelectedTime(value);
                setPlan((prev) => prev.status !== 'locked' ? {
                  ...prev,
                  timeWindow: nextTimeWindow,
                  lockedArrivalTimes: undefined,
                  savedPlanId: undefined,
                } : prev);
                if (hasInitiatedSearch) {
                  setResultFilter('all');
                  setCards([]);
                  setVisibleCount(PAGE_SIZE);
                  setLoading(true);
                  setTimeout(() => { void searchForSlot(resultMode, true, false); }, 25);
                }
              }}
            />
            {resultMode === 'food' ? (
              <>
                <PreferenceGroup
                  label="Food filters"
                  items={FOOD_QUICK_FILTERS}
                  selected={selectedFoods}
                  onPress={(value) => toggleMulti(value, selectedFoods, setSelectedFoods, 'Food')}
                />
                <PreferenceGroup
                  label="Cuisine"
                  items={CUISINES}
                  selected={selectedFoods}
                  previewCount={8}
                  expanded={Boolean(expandedPreferenceGroups.cuisine)}
                  onToggleExpanded={() => togglePreferenceGroupExpanded('cuisine')}
                  onPress={(value) => toggleMulti(value, selectedFoods, setSelectedFoods, 'Food')}
                />
                <PreferenceGroup
                  label="Dietary needs"
                  items={DIETARY_PREFERENCES}
                  selected={selectedDietary}
                  previewCount={4}
                  expanded={Boolean(expandedPreferenceGroups.dietary)}
                  onToggleExpanded={() => togglePreferenceGroupExpanded('dietary')}
                  onPress={(value) => toggleMulti(value, selectedDietary, setSelectedDietary, 'Dietary')}
                />
              </>
            ) : (
              <>
                <PreferenceGroup
                  label="Activity type"
                  items={ACTIVITIES}
                  selected={selectedActivities}
                  previewCount={8}
                  expanded={Boolean(expandedPreferenceGroups.activity)}
                  onToggleExpanded={() => togglePreferenceGroupExpanded('activity')}
                  onPress={(value) => toggleMulti(value, selectedActivities, setSelectedActivities, 'Activity')}
                />
                {selectedActivities.includes('Events') ? (
                  <Text style={[styles.preferenceSummary, isDarkMode && styles.darkMutedText]}>
                    Events search uses Ticketmaster first, then lower-confidence local search if needed.
                  </Text>
                ) : null}
              </>
            )}
            <TouchableOpacity
              style={styles.advancedPreferenceHeader}
              onPress={() => setAdvancedPreferencesOpen((prev) => !prev)}
              accessibilityRole="button"
              accessibilityLabel={`${advancedPreferencesOpen ? 'Hide' : 'Show'} advanced preferences`}
              accessibilityState={{ expanded: advancedPreferencesOpen }}
            >
              <Text style={[styles.filterLabel, styles.advancedPreferenceLabel]}>Advanced preferences</Text>
              <HeaderAction label={advancedPreferencesOpen ? 'Hide' : 'Show'} />
            </TouchableOpacity>
            {advancedPreferencesOpen ? (
              <PreferenceGroup
                label="Weather"
                items={WEATHER}
                selected={[selectedWeather]}
                onPress={(value) => {
                  addLog(`Weather chip tapped: ${value}`);
                  setSelectedWeather(value);
                }}
              />
            ) : null}
            <TouchableOpacity style={styles.bottomHideButton} onPress={refreshFromPreferences} accessibilityRole="button" accessibilityLabel="Refresh results">
              <Text style={styles.bottomHideText}>Refresh Results</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>

      </>
      ) : null}

      {showDiscoveryTools ? (
      <>
      {!nowDiscovering ? (
        <View style={[styles.bridgeBox, isDarkMode && styles.darkPanel]}>
          <Text style={[styles.bridgeTitle, isDarkMode && styles.darkText]}>Search area</Text>
          <View style={styles.inputRow}>
            <TextInput style={[styles.input, styles.darkPanelInput, Platform.OS === 'web' && styles.webInput]}
              value={searchLocationOverride} onChangeText={setSearchLocationOverride}
              accessibilityLabel="Search area" placeholder="ZIP, neighborhood, or city" placeholderTextColor={colors.textSecondary}
              returnKeyType="search" onSubmitEditing={searchFromSearchLocationOverride} />
            <Button label="Use" onPress={searchFromSearchLocationOverride} compact />
          </View>
          {renderSearchAreaPicker()}
        </View>
      ) : null}
      <View style={[styles.bridgeBox, isLightMode && styles.lightPanel, Platform.OS === 'web' && styles.webBridgeBox, isDarkMode && styles.darkPanel]}>
        <Text style={[styles.bridgeTitle, styles.bridgeTitleDarkPanel, isLightMode && styles.lightSectionTitle, isDarkMode && styles.darkText]}>Find a specific place</Text>
        <View style={styles.inputRow}>
          <TextInput
            ref={manualSearchRef}
            style={[styles.input, styles.darkPanelInput, isLightMode && styles.input, Platform.OS === 'web' && styles.webInput]}
            value={manualSearch}
            onChangeText={(value) => {
              setManualSearch(value);
              setManualSearchSubmitted(false);
            }}
            accessibilityLabel="Find a specific place"
            placeholder="restaurant, activity, or place"
            placeholderTextColor={isLightMode ? colors.textTertiary : colors.textSecondary}
            returnKeyType="search"
            onSubmitEditing={() => runManualSearch(resultMode)}
          />
          {manualSearchSubmitted ? (
            <Button label="Clear" onPress={clearManualSearch} compact />
          ) : (
            <Button label="Search" onPress={() => runManualSearch(resultMode)} disabled={!manualSearch.trim()} compact />
          )}
        </View>
        <Text style={[styles.preferenceSummary, isDarkMode && styles.darkMutedText]}>Search shows matches first. Choose Add, Suggest, or Use to select one.</Text>
        {!loading && manualSearch.trim() && manualSearchSubmitted && (searchFailed || cards.length === 0) ? (
          <Button label={planningSuggestionMode ? 'Suggest this place manually' : 'Add this place manually'} onPress={() => addManualPlace(resultMode)} compact />
        ) : null}
      </View>

      {!hasInitiatedSearch ? (
        <View onLayout={(event) => { resultsYRef.current = event.nativeEvent.layout.y; }}>
          <EmptyState
            style={styles.preSearchEmptyState}
            title="Ready when you are"
            description={`Choose Search Food or Search Activities to find options for ${activePlanDateLabel} at ${activePlanTimeLabel}.`}
            icon={<Ionicons name="compass-outline" size={32} color={colors.textSecondary} />}
          />
        </View>
      ) : (
        <View onLayout={(event) => { resultsYRef.current = event.nativeEvent.layout.y; }}>
        <Section title={titleForResults}>
          {resultMode === 'activity' && selectedActivities.includes('Events') && !manualSearchSubmitted ? (
            <Text style={[styles.preferenceSummary, isDarkMode && styles.darkMutedText]}>
              Upcoming events within {Math.round(areaSearchRadius(lastSearchLocationCenter, TICKETMASTER_EVENT_RADIUS_MILES * METERS_PER_MILE) / METERS_PER_MILE)} miles of {lastSearchLocationCenter?.label || searchLocationLabel} for {activePlanDateLabel}. Ticketmaster does not list every local show. Local search suggestions have unverified dates.
            </Text>
          ) : null}
          <View style={styles.filterTabs}>
            <FilterTab label="All" active={resultFilter === 'all'} onPress={() => setResultFilter('all')} />
            <FilterTab label="Favorites" active={resultFilter === 'favorites'} onPress={() => setResultFilter('favorites')} />
          </View>
          {loading ? (
            <EmptyState
              status="loading"
              tone={resultMode === 'food' ? 'food' : 'activity'}
              title={`Searching ${resultMode === 'food' ? 'food places' : 'activities'}…`}
              description="Gathering the best nearby matches."
              action={<Button label="Cancel search" onPress={cancelSearch} compact />}
            />
          ) : null}
          {!loading && shownCards.length === 0 && resultFilter === 'favorites' ? (
            <EmptyState
              title="No favorites in this search"
              description="Save places from the results, then use Favorites to narrow this list."
              icon={<Ionicons name="heart-outline" size={30} color={colors.textSecondary} />}
            />
          ) : !loading && shownCards.length === 0 ? (
            <EmptyState
              status={searchFailed ? 'error' : 'empty'}
              title={searchFailed ? 'Search unavailable' : 'No results found'}
              description={searchNotice || 'Try a different category, search area, or preference.'}
              icon={<Ionicons name={searchFailed ? 'alert-circle-outline' : 'search-outline'} size={30} color={searchFailed ? colors.red : colors.textSecondary} />}
              action={<Button label="Try again" onPress={() => manualSearchSubmitted && manualSearch.trim() ? runManualSearch(resultMode) : searchForSlot(resultMode, true, true)} compact />}
            />
          ) : null}
          {!loading && shownCards.length > 0 && searchNotice ? (
            <Text style={styles.preferenceSummary} accessibilityLiveRegion="polite">{searchNotice}</Text>
          ) : null}
          {!loading && shownCards.map((card, index) => {
            const isSelected = !nowDiscovering && selectedCards.some((item) => cardToId(item) === card.id);
            const isSuggested = planningSuggestionMode && Boolean(activePlanningSession?.suggestions.some((suggestion) => samePlanningSuggestion(suggestion, resultMode, card)));
            const isFavorite = memory.favorites.includes(card.id);
            const distanceText = resultDistanceAnchor && resultDistanceContext
              ? formatDistanceFromMeters(distanceMeters(resultDistanceAnchor, card))
              : undefined;
            const showWalkingStartDistance = Boolean(resultRouteBias?.mode === 'walk' && resultRouteBias.start &&
              (!resultRouteBias.anchor || distanceMeters(resultRouteBias.start, { lat: resultRouteBias.anchor.latitude, lng: resultRouteBias.anchor.longitude }) > 80));
            const startDistanceText = showWalkingStartDistance && resultRouteBias?.start
              ? formatDistanceFromMeters(distanceMeters(resultRouteBias.start, card))
              : undefined;
            const distanceLabel = [
              distanceText ? `${distanceText} ${resultDistanceContext}` : undefined,
              startDistanceText ? `${startDistanceText} from start` : undefined,
            ].filter(Boolean).join(' | ') || undefined;
            const resultActionLabel = nowDiscovering
              ? nowPlanCreating
                ? 'Adding'
                : 'Use'
              : planningSuggestionMode
                ? isSuggested
                  ? 'Suggested'
                  : 'Suggest'
                : isSelected
                  ? 'In plan'
                  : 'Add';
            const resultActionIcon: React.ComponentProps<typeof Ionicons>['name'] = nowDiscovering
              ? 'navigate-outline'
              : planningSuggestionMode
                ? isSuggested
                  ? 'checkmark-done-outline'
                  : 'chatbubble-ellipses-outline'
                : isSelected
                  ? 'checkmark-circle-outline'
                  : 'add-outline';
            const imageUri = cardImageUri(card);
            return (
            <View key={`${card.id}-${index}`} style={[
              styles.card,
              resultMode === 'food' ? styles.cardFood : styles.cardActivity,
              isDarkMode && styles.darkCard,
              (isSelected || isSuggested) && styles.cardSelected,
            ]}>
              <View style={styles.placeCardBody}>
                <View style={styles.placeCardMedia}>
                  <TouchableOpacity
                    style={styles.placeCardMediaTap}
                    onPress={() => { void openPlaceDetails(card); }}
                    accessibilityRole="button"
                    accessibilityLabel={`Open details for ${card.title}`}
                  >
                    {imageUri ? (
                      <Image source={{ uri: imageUri }} style={styles.placeCardImage} resizeMode="cover" />
                    ) : (
                      <View style={[styles.placeCardImage, styles.placeCardImageFallback]}>
                        <Ionicons
                          name={card.kind === 'event' ? 'ticket-outline' : resultMode === 'food' ? 'restaurant-outline' : 'sparkles-outline'}
                          size={30}
                          color={resultMode === 'food' ? colors.coral : colors.amber}
                        />
                      </View>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.placeCardInfoTouchTarget}
                    onPress={() => { void openPlaceDetails(card); }}
                    accessibilityRole="button"
                    accessibilityLabel={`Show information for ${card.title}`}
                  >
                    <View style={styles.placeCardInfoButton}>
                      <Ionicons name="information-circle-outline" size={17} color={colors.textPrimary} />
                    </View>
                  </TouchableOpacity>
                </View>
                <View style={styles.placeCardContent}>
                  <View style={styles.cardHeaderGrid}>
                    <View style={styles.cardHeaderMain}>
                      <Text style={[styles.cardRank, isSelected && styles.cardRankSelected]}>
                        {resultBadgeForCard(card, isSelected, index)}
                      </Text>
                      <Text style={[
                        styles.cardTitle,
                        isDarkMode && !(isSelected || isSuggested) && styles.darkText,
                        (isSelected || isSuggested) && styles.cardTitleSelected,
                      ]} numberOfLines={2}>{card.title}</Text>
                    </View>
                  </View>
                  <Text
                    style={[styles.cardCategory, resultMode === 'food' ? styles.cardCategoryFood : styles.cardCategoryActivity]}
                    numberOfLines={1}
                  >{cardCategoryLabel(card)}</Text>
                  <View style={styles.cardMetadataRow}>
                    {typeof card.rating === 'number' ? (
                      <View style={styles.cardMetadataPill}>
                        <Ionicons name="star" size={13} color={colors.amber} />
                        <Text style={styles.cardMetadataText}>{card.rating.toFixed(1)}{card.ratingCount ? ` (${card.ratingCount})` : ''}</Text>
                      </View>
                    ) : null}
                    {distanceText ? (
                      <View style={styles.cardMetadataPill}>
                        <Ionicons name="navigate-outline" size={13} color={colors.teal} />
                        <Text style={styles.cardMetadataText}>{distanceText}</Text>
                      </View>
                    ) : null}
                    <Text style={[
                      styles.cardHours,
                      card.isOpen ? styles.open : card.isOpen === false ? styles.closed : styles.darkMutedText,
                    ]} numberOfLines={1}>
                      {card.kind === 'event' ? card.eventDateText || 'Date TBA' : card.hoursText || 'Hours unknown'}
                    </Text>
                  </View>
                  {card.address ? <Text style={[styles.address, styles.darkMutedText]} numberOfLines={2}>{card.address}</Text> : null}
                  {card.eventAddressConflict ? <Text style={[styles.address, styles.darkMutedText]}>Venue addresses differ between listings. Confirm on the event website.</Text> : null}
                </View>
              </View>
              <View style={[styles.buttonRow, styles.resultCardActionRow]}>
                <CardIconButton
                  label={resultActionLabel}
                  icon={resultActionIcon}
                  onPress={() => selectCard(card)}
                  success={nowDiscovering ? true : !isSelected && !isSuggested}
                  disabled={(nowDiscovering && nowPlanCreating) || isSelected || isSuggested}
                />
                <CardIconButton
                  label={isFavorite ? `Unstar ${card.title}` : `Star ${card.title}`}
                  icon={isFavorite ? 'star' : 'star-outline'}
                  onPress={() => toggleFavorite(card)}
                  active={isFavorite}
                />
                {card.kind === 'event' && card.eventUrl ? (
                  <CardIconButton label="Open event" icon="ticket-outline" onPress={() => openCardEvent(card)} />
                ) : null}
                {card.kind !== 'event' || card.mapsUri || (typeof card.lat === 'number' && typeof card.lng === 'number') ? (
                  <CardIconButton label="Map" icon="map-outline" onPress={() => openCardMaps(card)} />
                ) : null}
                {canOpenPlaceWebsite(card) ? (
                  <CardIconButton label="Website" icon="globe-outline" onPress={() => openCardWebsite(card)} />
                ) : null}
                {!nowDiscovering ? (
                  <CardIconButton label="Share" icon="share-outline" onPress={() => openQuickShare({ kind: 'card', slot: resultMode, card })} />
                ) : null}
                <CardIconButton label="Don't recommend again" icon="ban-outline" onPress={() => neverRecommendCard(card)} danger />
              </View>
              {distanceLabel && startDistanceText ? (
                <Text style={[styles.cardDistance, styles.darkMutedText]}>{distanceLabel}</Text>
              ) : null}
            </View>
            );
          })}
          {filteredCards.length > visibleCount ? (
            <Button label="Load more" onPress={() => setVisibleCount((prev) => prev + PAGE_SIZE)} />
          ) : null}
        </Section>
        </View>
      )}
      </>
      ) : null}
      </>
      )}

      <Modal
        visible={Boolean(placeDetailCard)}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setPlaceDetailCard(null)}
      >
        <SafeAreaView style={[styles.safeArea, styles.darkScreen]} edges={['top', 'bottom', 'left', 'right']}>
          {placeDetailCard ? (
            <ScrollView style={styles.placeDetailScreen} contentContainerStyle={styles.placeDetailContent}>
              <View style={styles.placeDetailHeader}>
                <TouchableOpacity
                  style={styles.placeDetailHeaderButton}
                  onPress={() => setPlaceDetailCard(null)}
                  accessibilityRole="button"
                  accessibilityLabel="Close place details"
                >
                  <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.placeDetailHeaderTitle} numberOfLines={1}>Place details</Text>
                <TouchableOpacity
                  style={[styles.placeDetailHeaderButton, memory.favorites.includes(placeDetailCard.id) && styles.placeDetailHeaderButtonActive]}
                  onPress={() => toggleFavorite(placeDetailCard)}
                  accessibilityRole="button"
                  accessibilityLabel={memory.favorites.includes(placeDetailCard.id) ? 'Remove from saved places' : 'Save place'}
                >
                  <Ionicons
                    name={memory.favorites.includes(placeDetailCard.id) ? 'heart' : 'heart-outline'}
                    size={22}
                    color={memory.favorites.includes(placeDetailCard.id) ? colors.coral : colors.textPrimary}
                  />
                </TouchableOpacity>
              </View>

              <View style={styles.placeDetailHero}>
                {cardImageUri(placeDetailCard) ? (
                  <Image source={{ uri: cardImageUri(placeDetailCard)! }} style={styles.placeDetailHeroImage} resizeMode="cover" />
                ) : (
                  <View style={[styles.placeDetailHeroImage, styles.placeDetailHeroFallback]}>
                    <Ionicons
                      name={placeDetailCard.kind === 'event' ? 'ticket-outline' : resultMode === 'food' ? 'restaurant-outline' : 'sparkles-outline'}
                      size={54}
                      color={resultMode === 'food' ? colors.coral : colors.amber}
                    />
                  </View>
                )}
                {placeDetailCard.photoAttribution ? (
                  <Text style={styles.placeDetailAttribution}>Photo: {placeDetailCard.photoAttribution}</Text>
                ) : null}
              </View>

              <View style={styles.placeDetailTitleBlock}>
                <Text style={[
                  styles.placeDetailEyebrow,
                  resultMode === 'food' ? styles.placeDetailEyebrowFood : styles.placeDetailEyebrowActivity,
                ]}>{cardCategoryLabel(placeDetailCard)}</Text>
                <Text style={styles.placeDetailTitle}>{placeDetailCard.title}</Text>
                <View style={styles.placeDetailMetaRow}>
                  {typeof placeDetailCard.rating === 'number' ? (
                    <View style={styles.placeDetailMetaItem}>
                      <Ionicons name="star" size={16} color={colors.amber} />
                      <Text style={styles.placeDetailMetaText}>
                        {placeDetailCard.rating.toFixed(1)}{placeDetailCard.ratingCount ? ` (${placeDetailCard.ratingCount})` : ''}
                      </Text>
                    </View>
                  ) : null}
                  {placeDetailCard.priceLevel ? <Text style={styles.placeDetailMetaText}>{placeDetailCard.priceLevel}</Text> : null}
                  <Text style={[styles.placeDetailMetaText, placeDetailCard.isOpen ? styles.open : placeDetailCard.isOpen === false ? styles.closed : undefined]}>
                    {placeDetailCard.kind === 'event'
                      ? placeDetailCard.eventDateText || 'Date TBA'
                      : placeDetailCard.hoursText || 'Hours unknown'}
                  </Text>
                </View>
                {placeDetailCard.address ? (
                  <View style={styles.placeDetailAddressRow}>
                    <Ionicons name="location-outline" size={18} color={colors.teal} />
                    <Text style={styles.placeDetailAddress}>{placeDetailCard.address}</Text>
                  </View>
                ) : null}
                {placeDetailCard.todayHours ? <Text style={styles.placeDetailHours}>{placeDetailCard.todayHours}</Text> : null}
                {placeDetailCard.eventAddressConflict ? <Text style={styles.placeDetailAddress}>Venue addresses differ between listings. Confirm on the event website.</Text> : null}
              </View>

              <View style={styles.placeDetailPrimaryActions}>
                <TouchableOpacity
                  style={[styles.placeDetailAction, styles.placeDetailRouteAction]}
                  onPress={() => openCardMaps(placeDetailCard)}
                  accessibilityRole="button"
                  accessibilityLabel={`Route to ${placeDetailCard.title}`}
                >
                  <Ionicons name="navigate" size={22} color={semanticTones.route.foreground} />
                  <Text style={styles.placeDetailActionText}>Route</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.placeDetailAction, styles.placeDetailSaveAction]}
                  onPress={() => toggleFavorite(placeDetailCard)}
                  accessibilityRole="button"
                  accessibilityLabel={memory.favorites.includes(placeDetailCard.id) ? 'Remove from saved places' : 'Save place'}
                  accessibilityState={{ selected: memory.favorites.includes(placeDetailCard.id) }}
                >
                  <Ionicons name={memory.favorites.includes(placeDetailCard.id) ? 'heart' : 'heart-outline'} size={22} color={colors.textInverse} />
                  <Text style={[styles.placeDetailActionText, styles.placeDetailActionTextDark]}>
                    {memory.favorites.includes(placeDetailCard.id) ? 'Saved' : 'Save'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.placeDetailAction,
                    placeDetailIsSelected ? styles.placeDetailRemoveAction : styles.placeDetailAddAction,
                  ]}
                  onPress={() => {
                    void selectCard(placeDetailCard);
                    setPlaceDetailCard(null);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`${placeDetailActionLabel}: ${placeDetailCard.title}`}
                  accessibilityState={{ selected: placeDetailIsSelected || placeDetailIsSuggested }}
                >
                  <Ionicons
                    name={placeDetailActionIcon}
                    size={24}
                    color={placeDetailIsSelected ? semanticTones.danger.foreground : semanticTones.primary.foreground}
                  />
                  <Text style={styles.placeDetailActionText}>{placeDetailActionLabel}</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.placeDetailSecondaryActions}>
                {placeDetailCard.kind === 'event' && placeDetailCard.eventUrl ? (
                  <Button label="Open event" onPress={() => openCardEvent(placeDetailCard)} compact />
                ) : null}
                {canOpenPlaceWebsite(placeDetailCard) ? (
                  <Button label="Website" onPress={() => openCardWebsite(placeDetailCard)} compact />
                ) : null}
              </View>
            </ScrollView>
          ) : null}
        </SafeAreaView>
      </Modal>

      <Modal
        visible={nowPeoplePickerOpen}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setNowPeoplePickerOpen(false)}
      >
        <SafeAreaView style={[styles.safeArea, isLightMode && styles.lightScreen, isDarkMode && styles.darkScreen]} edges={['top', 'bottom', 'left', 'right']}>
          <View style={[styles.nowPeopleScreen, isDarkMode && styles.darkScreen]}>
            <View style={styles.nowPeopleHeader}>
              <View style={styles.nowHeaderTextBlock}>
                <Text style={[styles.nowTitle, isDarkMode && styles.darkText]}>Include someone</Text>
                <Text style={[styles.nowSubtitle, isDarkMode && styles.darkMutedText]} numberOfLines={1}>
                  {nowPeopleSummary}
                </Text>
              </View>
              <Button label="Done" onPress={() => setNowPeoplePickerOpen(false)} primary compact />
            </View>

            <ScrollView contentContainerStyle={styles.nowPeopleContent} keyboardShouldPersistTaps="handled">
              <View style={styles.nowPeopleSection}>
                <Text style={[styles.nowPeopleSectionTitle, isDarkMode && styles.darkText]}>Recent</Text>
                <View style={styles.nowPeopleList}>
                  {recentPeople.map((user) => (
                    <PersonRow
                      key={`now-recent-${user}`}
                      name={user}
                      subtitle="Recently planned with"
                      selected={nowSelectedPeople.includes(user)}
                      onPress={() => toggleNowPerson(user)}
                    />
                  ))}
                </View>
              </View>

              <View style={styles.nowPeopleSection}>
                <Text style={[styles.nowPeopleSectionTitle, isDarkMode && styles.darkText]}>Favorites</Text>
                <View style={styles.nowPeopleList}>
                  {favoritePeople.map((user) => (
                    <PersonRow
                      key={`now-favorite-${user}`}
                      name={user}
                      subtitle="Favorite planning partner"
                      selected={nowSelectedPeople.includes(user)}
                      onPress={() => toggleNowPerson(user)}
                    />
                  ))}
                </View>
              </View>

              {BETA_FEATURES.peopleGroups ? (
                <View style={styles.nowPeopleSection}>
                  <Text style={[styles.nowPeopleSectionTitle, isDarkMode && styles.darkText]}>Groups</Text>
                  <View style={styles.nowPeopleList}>
                    {PEOPLE_PICKER_GROUPS.map((group) => {
                      const selected = group.members.every((member) => nowSelectedPeople.includes(member));
                      return (
                        <TouchableOpacity
                          key={`now-group-${group.name}`}
                          style={[styles.nowPersonRow, isDarkMode && styles.darkCard, selected && styles.nowPersonRowSelected]}
                          onPress={() => toggleNowGroup(group)}
                        >
                          <View style={styles.nowGroupAvatar}>
                            <Ionicons name="people-outline" size={18} color={colors.teal} />
                          </View>
                          <View style={styles.nowGroupTextBlock}>
                            <Text style={[styles.nowPersonName, isDarkMode && styles.darkText]}>{group.name}</Text>
                            <Text style={[styles.nowGroupMembers, isDarkMode && styles.darkMutedText]} numberOfLines={1}>
                              {group.members.join(', ')}
                            </Text>
                          </View>
                          <Ionicons name={selected ? 'checkmark-circle' : 'add-circle-outline'} size={22} color={selected ? colors.teal : colors.textSecondary} />
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              ) : null}
            </ScrollView>
          </View>
        </SafeAreaView>
      </Modal>

      <Modal
        visible={peopleGroupsOpen}
        animationType="fade"
        transparent
        onRequestClose={() => setPeopleGroupsOpen(false)}
      >
        <View style={styles.shareOverlay}>
          <View style={[styles.quickShareCard, isDarkMode && styles.darkModalCard]}>
            <Text style={[styles.quickShareTitle, isDarkMode && styles.darkText]}>People & Groups</Text>
            <Text style={[styles.peopleGroupsModalSubtitle, isDarkMode && styles.darkMutedText]}>
              Plan with friends, family, and groups
            </Text>
            <View style={[styles.peopleGroupsComingSoonBox, isDarkMode && styles.darkChip]}>
              <Ionicons name="people-outline" size={24} color={isDarkMode ? colors.textPrimary : colors.teal} />
              <View style={styles.peopleGroupsTextBlock}>
                <Text style={[styles.peopleGroupsComingSoonTitle, isDarkMode && styles.darkText]}>Coming soon</Text>
                <Text style={[styles.peopleGroupsComingSoonText, isDarkMode && styles.darkMutedText]}>
                  Profiles, reusable groups, and invite management will live here.
                </Text>
              </View>
            </View>
            <View style={styles.shareActions}>
              <Button label="Close" onPress={() => setPeopleGroupsOpen(false)} primary />
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={routeOptionsOpen}
        animationType="fade"
        transparent
        onRequestClose={() => setRouteOptionsOpen(false)}
      >
        <View style={styles.shareOverlay}>
          <View style={[styles.quickShareCard, isDarkMode && styles.darkModalCard]}>
            <Text style={[styles.quickShareTitle, isDarkMode && styles.darkText]}>Route</Text>
            <Text style={styles.quickSharePlace} numberOfLines={2}>
              {planTitle}
            </Text>
            <Text style={[styles.routeOptionHint, isDarkMode && styles.darkMutedText]}>
              {BETA_FEATURES.roadTrips
                ? 'Tesla/app navigation remains the source of truth. NomNomGo shares destinations only; confirm route and charging in Tesla before departure.'
                : 'Open the current plan in Google Maps for final routing and navigation.'}
            </Text>
              <View style={styles.routeOptionList}>
              <TouchableOpacity style={styles.routeOptionButton} onPress={openGoogleRouteFromOptions} accessibilityRole="button" accessibilityLabel="Open plan in Google Maps">
                <Ionicons name="map-outline" size={18} color={colors.teal} />
                <Text style={styles.routeOptionButtonText}>
                  {isImportedGoogleMapsPlan && plan.sourceUrl ? 'Open Google route' : 'Google Maps'}
                </Text>
              </TouchableOpacity>
              {BETA_FEATURES.roadTrips ? (
                <TouchableOpacity style={styles.routeOptionButton} onPress={sendPlanToTesla}>
                  <Ionicons name="car-sport-outline" size={18} color={colors.teal} />
                  <Text style={styles.routeOptionButtonText}>Send to Tesla</Text>
                </TouchableOpacity>
              ) : null}
            </View>
            <View style={styles.shareActions}>
              <Button label="Cancel" onPress={() => setRouteOptionsOpen(false)} />
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={planPreviewOpen}
        animationType="fade"
        transparent
        onRequestClose={() => setPlanPreviewOpen(false)}
      >
        <ScrollView
          style={styles.shareOverlayScroll}
          contentContainerStyle={styles.shareOverlayContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.planPreviewShell}>
            <View style={[styles.planPreviewCard, isDarkMode && styles.darkModalCard]}>
              <Text style={[styles.planPreviewTitle, isDarkMode && styles.darkText]} numberOfLines={2}>
                {planTitle}
              </Text>
              <View style={styles.planPreviewMetaRow}>
                <Text style={[styles.planPreviewMeta, styles.planPreviewMetaPrimary, isDarkMode && styles.darkMutedText]} numberOfLines={2}>
                  {activePlanDateTimeLabel}
                </Text>
                <Text style={[styles.planPreviewMeta, styles.planPreviewMetaCount, isDarkMode && styles.darkMutedText]}>{plan.stops.length} stops</Text>
              </View>
              {leaveForFirstStopText ? (
                <Text style={styles.shareLeaveTime}>{leaveForFirstStopText}</Text>
              ) : null}
              {planInvitees.length ? (
                <Text style={[styles.planPreviewMeta, isDarkMode && styles.darkMutedText]} numberOfLines={1}>
                  With {unique([currentTesterName, ...planInvitees]).join(', ')}
                </Text>
              ) : null}
              <View style={styles.planPreviewStopList}>
                {plan.stops.map((stop, index) => {
                  const stopTone = semanticTones[itineraryKindForStop(stop)];
                  return (
                  <View key={`preview-${stop.key}`} style={styles.planPreviewStopRow}>
                    <Text style={[styles.planPreviewStopIndex, { backgroundColor: stopTone.solid, color: stopTone.foreground }]}>{index + 1}</Text>
                    <View style={styles.planPreviewStopContent}>
                      <Text style={styles.planPreviewStopName} numberOfLines={2}>{cardToName(stop.item) || 'Stop'}</Text>
                      <View style={styles.planPreviewStopMetadata}>
                        <Text style={styles.planPreviewStopTime}>{formatClockTime(displayedArrivalTimeForStop(stop, index))}</Text>
                        <View style={styles.planPreviewTravelBlock}>
                          <Ionicons name={travelMetaForStop(stop, index).icon} size={15} color={colors.teal} />
                          <Text style={styles.planPreviewTravelText} numberOfLines={1}>{travelMetaForStop(stop, index).duration}</Text>
                        </View>
                      </View>
                    </View>
                  </View>
                  );
                })}
              </View>
            </View>
            <View style={[styles.shareControlPanel, isDarkMode && styles.darkModalCard]}>
              <View style={styles.shareActions}>
                <Button label="Close" onPress={() => setPlanPreviewOpen(false)} primary />
              </View>
            </View>
          </View>
        </ScrollView>
      </Modal>

      <Modal
        visible={sharePreviewOpen}
        animationType="fade"
        transparent
        onRequestClose={() => setSharePreviewOpen(false)}
      >
        <ScrollView
          style={styles.shareOverlayScroll}
          contentContainerStyle={styles.shareOverlayContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.shareModalShell}>
          <View style={[styles.shareCard, isDarkMode && styles.darkModalCard]}>
            <View style={styles.shareHeader}>
              <Text style={[styles.shareBrand, isDarkMode && styles.darkText]}>NomNomGo</Text>
              <Text style={[styles.shareTagline, isDarkMode && styles.darkMutedText]}>Come together</Text>
            </View>
            <Text style={[styles.shareTitle, isDarkMode && styles.darkText]} numberOfLines={2}>
              {planTitle}
            </Text>
            <Text style={[styles.shareMetaLine, isDarkMode && styles.darkMutedText]} numberOfLines={1}>
              {activePlanDateTimeLabel}
            </Text>
            {leaveForFirstStopText ? (
              <Text style={styles.shareLeaveTime}>{leaveForFirstStopText}</Text>
            ) : null}
            {isPlanLocked ? (
              <View style={styles.shareLockedStopList}>
                {plan.stops.map((stop, index) => {
                  const stopTone = semanticTones[itineraryKindForStop(stop)];
                  return (
                  <View key={`share-locked-${stop.key}`} style={styles.shareLockedStopRow}>
                    <Text style={[styles.shareLockedStopIndex, { backgroundColor: stopTone.solid, color: stopTone.foreground }]}>{index + 1}</Text>
                    <View style={styles.shareLockedTravelBlock}>
                      <Ionicons name={travelMetaForStop(stop, index).icon} size={15} color={colors.teal} />
                      <Text style={styles.shareLockedTravelText} numberOfLines={1}>{travelMetaForStop(stop, index).duration}</Text>
                    </View>
                    <Text style={styles.shareLockedStopTime}>{formatClockTime(displayedArrivalTimeForStop(stop, index))}</Text>
                    <Text style={styles.shareLockedStopName} numberOfLines={1}>{cardToName(stop.item) || 'Stop'}</Text>
                  </View>
                  );
                })}
              </View>
            ) : (
              plan.stops.map((stop, index) => {
                const stopKind = itineraryKindForStop(stop);
                const stopTone = semanticTones[stopKind];
                return (
                <View key={`share-${stop.key}`} style={styles.shareStop}>
                  <View style={[styles.shareStopNumber, { backgroundColor: stopTone.solid }]}>
                    <Text style={[styles.shareStopNumberText, { color: stopTone.foreground }]}>{index + 1}</Text>
                  </View>
                  <View style={styles.shareStopBody}>
                    <Text style={[styles.shareStopType, { color: stopTone.accent }]}>{itineraryKindLabel(stopKind)}</Text>
                    <Text style={[styles.shareStopName, isDarkMode && styles.darkText]}>{cardToName(stop.item) || 'Stop'}</Text>
                    <Text style={[styles.shareStopTime, isDarkMode && styles.darkMutedText]}>{stepDetail(stop, index)}</Text>
                    {stop.selectedFeatures?.length ? (
                      <Text style={[styles.shareStopTime, isDarkMode && styles.darkMutedText]}>Includes: {stop.selectedFeatures.join(', ')}</Text>
                    ) : null}
                  </View>
                </View>
                );
              })
            )}
            {planInvitees.length ? (
              <Text style={[styles.shareMetaLine, isDarkMode && styles.darkMutedText]} numberOfLines={1}>
                With {unique([currentTesterName, ...planInvitees]).join(', ')}
              </Text>
            ) : null}
          </View>
          <View style={[styles.shareControlPanel, isDarkMode && styles.darkModalCard]}>
            <Text style={styles.quickShareHint}>Share with NNG users</Text>
            <View style={styles.quickShareUserList}>
              {quickShareUsers.map((user) => {
                const selected = planInvitees.includes(user);
                return (
                  <TouchableOpacity
                    key={`plan-invite-${user}`}
                    style={[styles.quickShareUserButton, selected && styles.quickShareUserButtonSelected]}
                    onPress={() => togglePlanInvitee(user)}
                  >
                    <Text style={styles.quickShareUserText}>{user}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={styles.quickShareHint}>In-app dev share</Text>
            <View style={styles.quickShareUserList}>
              {quickShareUsers.map((user) => (
                <TouchableOpacity key={`plan-share-${user}`} style={styles.quickShareUserButton} onPress={() => sharePlanToUser(user)}>
                  <Text style={styles.quickShareUserText}>{user}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.shareActions}>
              <Button label="Share Plan" onPress={sharePlan} primary />
              <Button label="Close" onPress={() => setSharePreviewOpen(false)} />
            </View>
          </View>
          </View>
        </ScrollView>
      </Modal>

      <Modal
        visible={Boolean(pendingConfirmation)}
        animationType="fade"
        transparent
        onRequestClose={() => setPendingConfirmation(null)}
      >
        <View style={styles.shareOverlay}>
          <View style={[styles.quickShareCard, isDarkMode && styles.darkModalCard]}>
            <Text style={[styles.quickShareTitle, isDarkMode && styles.darkText]}>{pendingConfirmation?.title || 'Confirm action'}</Text>
            <Text style={[styles.quickSharePlace, isDarkMode && styles.darkMutedText]}>{pendingConfirmation?.message || ''}</Text>
            <View style={styles.shareActions}>
              <Button
                label={pendingConfirmation?.confirmLabel || 'Confirm'}
                onPress={() => {
                  const action = pendingConfirmation?.action;
                  setPendingConfirmation(null);
                  action?.();
                }}
                primary
              />
              <Button label="Cancel" onPress={() => setPendingConfirmation(null)} />
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={Boolean(quickShareTarget)}
        animationType="fade"
        transparent
        onRequestClose={() => setQuickShareTarget(null)}
      >
        <View style={styles.shareOverlay}>
          <View style={[styles.quickShareCard, isDarkMode && styles.darkModalCard]}>
            <Text style={styles.quickShareTitle}>Share</Text>
            <Text style={styles.quickSharePlace} numberOfLines={2}>
              {quickShareTarget ? quickShareTitle(quickShareTarget) : ''}
            </Text>
            <Text style={styles.quickShareHint}>Dev users</Text>
            <View style={styles.quickShareUserList}>
              {quickShareUsers.map((user) => (
                <TouchableOpacity key={user} style={styles.quickShareUserButton} onPress={() => shareQuickTargetToUser(user)}>
                  <Text style={styles.quickShareUserText}>{user}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.shareActions}>
              <Button label="Share" onPress={textQuickTarget} primary />
              <Button label="Close" onPress={() => setQuickShareTarget(null)} />
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={Boolean(appNotice)}
        animationType="fade"
        transparent
        onRequestClose={() => setAppNotice(null)}
      >
        <View style={styles.shareOverlay}>
          <View style={[styles.quickShareCard, isDarkMode && styles.darkModalCard]} accessibilityRole="alert">
            <Text style={[styles.quickShareTitle, isDarkMode && styles.darkText]}>{appNotice?.title}</Text>
            <Text style={[styles.quickShareHint, isDarkMode && styles.darkMutedText]}>{appNotice?.message}</Text>
            <View style={styles.shareActions}>
              <Button label="OK" onPress={() => setAppNotice(null)} primary />
            </View>
          </View>
        </View>
      </Modal>
    </Animated.ScrollView>
    <BottomNavigation<MainNavigationKey>
      style={styles.bottomNavigation}
      activeKey={activeNavigationKey}
      onSelect={handleMainNavigation}
      items={[
        {
          key: 'home',
          label: 'Home',
          icon: <Ionicons name="home-outline" size={iconSizes.md} color={colors.textTertiary} />,
          selectedIcon: <Ionicons name="home" size={iconSizes.md} color={colors.coral} />,
        },
        {
          key: 'plans',
          label: 'Plans',
          icon: <Ionicons name="calendar-outline" size={iconSizes.md} color={colors.textTertiary} />,
          selectedIcon: <Ionicons name="calendar" size={iconSizes.md} color={colors.coral} />,
        },
        {
          key: 'saved',
          label: 'Saved',
          icon: <Ionicons name="heart-outline" size={iconSizes.md} color={colors.textTertiary} />,
          selectedIcon: <Ionicons name="heart" size={iconSizes.md} color={colors.coral} />,
        },
        {
          key: 'profile',
          label: 'Profile',
          icon: <Ionicons name="person-outline" size={iconSizes.md} color={colors.textTertiary} />,
          selectedIcon: <Ionicons name="person" size={iconSizes.md} color={colors.coral} />,
        },
      ]}
      createAction={{
        label: 'Create',
        icon: <Ionicons name="add" size={iconSizes.xl} color={semanticTones.primary.foreground} />,
        onPress: () => openPlanSetup('later'),
        accessibilityLabel: 'Create a plan',
      }}
    />
    </View>
    </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export default function App() {
  const [iconsLoaded, iconsError] = useFonts(Ionicons.font);
  useWebDocumentSurface(DARK_WEB_BACKGROUND);

  if (!iconsLoaded && !iconsError) {
    return (
      <SafeAreaProvider>
        <StatusBar style="light" backgroundColor={colors.background} />
        <SafeAreaView style={[styles.safeArea, styles.darkScreen]} edges={['top', 'bottom', 'left', 'right']}>
          <View style={styles.authCentered}>
            <ActivityIndicator color={colors.coral} />
            <Text style={[styles.authHint, styles.darkMutedText]}>Loading NomNomGo</Text>
          </View>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="light" backgroundColor={colors.background} />
      <AlphaAccessGate>
        <NomNomGoApp />
      </AlphaAccessGate>
    </SafeAreaProvider>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const isDarkMode = true;
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, isDarkMode && styles.darkText]}>{title}</Text>
      {children}
    </View>
  );
}

function ChipRow<T extends string>({
  items,
  selected,
  onPress,
}: {
  items: T[];
  selected: string[];
  onPress: (value: T) => void;
}) {
  const isDarkMode = true;
  return (
    <View style={styles.chipWrap}>
      {items.map((item) => {
        const active = selected.includes(item);
        return (
          <TouchableOpacity
            key={item}
            style={[styles.chip, isDarkMode && styles.darkChip, active && styles.chipActive]}
            onPress={() => onPress(item)}
            accessibilityRole="button"
            accessibilityLabel={item}
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.chipText, isDarkMode && styles.darkMutedText, active && styles.chipTextActive]}>{item}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function PreferenceGroup<T extends string>({
  label,
  items,
  selected,
  onPress,
  previewCount,
  expanded,
  onToggleExpanded,
}: {
  label: string;
  items: T[];
  selected: string[];
  onPress: (value: T) => void;
  previewCount?: number;
  expanded?: boolean;
  onToggleExpanded?: () => void;
}) {
  const isDarkMode = true;
  const limit = previewCount || items.length;
  const canExpand = items.length > limit && Boolean(onToggleExpanded);
  const visibleItems = expanded || !canExpand ? items : items.slice(0, limit);
  const hiddenCount = Math.max(0, items.length - limit);

  return (
    <View style={styles.preferenceGroup}>
      <Text style={styles.filterLabel}>{label}</Text>
      <View style={styles.chipWrap}>
        {visibleItems.map((item) => {
          const active = selected.includes(item);
          return (
            <TouchableOpacity
              key={item}
              style={[styles.chip, isDarkMode && styles.darkChip, active && styles.chipActive]}
              onPress={() => onPress(item)}
              accessibilityRole="button"
              accessibilityLabel={`${label}: ${item}`}
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.chipText, isDarkMode && styles.darkMutedText, active && styles.chipTextActive]}>{item}</Text>
            </TouchableOpacity>
          );
        })}
        {canExpand ? (
          <TouchableOpacity
            style={[styles.chip, isDarkMode && styles.darkChip, styles.preferenceMoreChip]}
            onPress={() => onToggleExpanded?.()}
            accessibilityRole="button"
            accessibilityLabel={expanded ? `Show fewer ${label} options` : `Show ${hiddenCount} more ${label} options`}
            accessibilityState={{ expanded: Boolean(expanded) }}
          >
            <Text style={[styles.chipText, isDarkMode && styles.darkMutedText, styles.preferenceMoreText]}>
              {expanded ? 'Less' : `More (${hiddenCount})`}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

function FilterTab({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const isDarkMode = true;
  return (
    <TouchableOpacity
      style={[styles.filterTab, isDarkMode && styles.darkChip, active && styles.filterTabActive]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
    >
      <Text style={[styles.filterTabText, isDarkMode && styles.darkMutedText, active && styles.filterTabTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function PlanLine({ label, value }: { label: string; value: string }) {
  const isDarkMode = true;
  return (
    <View style={styles.planLine}>
      <Text style={[styles.planLabel, isDarkMode && styles.darkMutedText]}>{label}:</Text>
      <Text style={[styles.planValue, isDarkMode && styles.darkText]}>{value}</Text>
    </View>
  );
}

function PlanningSuggestionCard({
  suggestion,
  currentUser,
  canRemove,
  onVote,
  onRemove,
  onOpenMap,
  onOpenEvent,
  onOpenWebsite,
}: {
  suggestion: PlanningSuggestion;
  currentUser: string;
  canRemove: boolean;
  onVote: () => void;
  onRemove: () => void;
  onOpenMap?: () => void;
  onOpenEvent?: () => void;
  onOpenWebsite?: () => void;
}) {
  const isDarkMode = true;
  const voted = suggestion.votes.includes(currentUser);
  const voteCount = unique(suggestion.votes).length;
  const item = suggestion.item;
  const sourceLabel = suggestion.source === 'event' ? 'Event' : suggestion.source === 'manual' ? 'Manual' : suggestion.slot === 'food' ? 'Food' : 'Activity';
  return (
    <View style={[styles.sessionSuggestionCard, isDarkMode && styles.darkCard]}>
      <View style={styles.sessionSuggestionTopRow}>
        <Text style={[styles.sessionSuggestionTitle, isDarkMode && styles.darkText]}>{cardToName(item) || 'Suggestion'}</Text>
        <Text style={styles.sessionVoteCount}>{voteCount}</Text>
      </View>
      <Text style={[styles.sessionSuggestionMeta, isDarkMode && styles.darkMutedText]}>
        {sourceLabel} by {suggestion.addedBy}
      </Text>
      {typeof item !== 'string' && item.subtitle ? (
        <Text style={[styles.sessionSuggestionMeta, isDarkMode && styles.darkMutedText]} numberOfLines={2}>{item.subtitle}</Text>
      ) : null}
      {typeof item !== 'string' && (item.eventDateText || item.hoursText || item.todayHours) ? (
        <Text style={[styles.sessionSuggestionMeta, item.isOpen ? styles.open : item.isOpen === false ? styles.closed : isDarkMode && styles.darkMutedText]}>
          {item.kind === 'event' ? item.eventDateText || 'Date TBA' : item.todayHours || item.hoursText || 'Hours unknown'}
        </Text>
      ) : null}
      <View style={styles.buttonRow}>
        <CardIconButton label={voted ? 'Unvote' : 'Vote'} icon={voted ? 'thumbs-up' : 'thumbs-up-outline'} onPress={onVote} success={!voted} />
        {onOpenEvent ? <CardIconButton label="Open event" icon="ticket-outline" onPress={onOpenEvent} /> : null}
        {onOpenMap ? <CardIconButton label="Map" icon="map-outline" onPress={onOpenMap} /> : null}
        {onOpenWebsite ? <CardIconButton label="Website" icon="globe-outline" onPress={onOpenWebsite} /> : null}
        {canRemove ? <CardIconButton label="Remove" icon="trash-outline" onPress={onRemove} danger /> : null}
      </View>
    </View>
  );
}

function CardIconButton({
  label,
  icon,
  onPress,
  primary,
  success,
  danger,
  active,
  disabled,
}: {
  label: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  onPress: () => void;
  primary?: boolean;
  success?: boolean;
  danger?: boolean;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[
        styles.cardIconButton,
        primary && styles.primaryButton,
        success && styles.successButton,
        danger && styles.dangerButton,
        active && styles.cardIconButtonActive,
        disabled && styles.disabledButton,
      ]}
      onPress={() => {
        Keyboard.dismiss();
        void onPress();
      }}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(disabled) }}
    >
      <Ionicons
        name={icon}
        size={20}
        color={active ? colors.amber : (primary || success || danger) ? colors.textInverse : colors.textPrimary}
      />
    </TouchableOpacity>
  );
}

function Button({
  label,
  onPress,
  primary,
  success,
  danger,
  disabled,
  compact,
}: {
  label: string;
  onPress: () => void;
  primary?: boolean;
  success?: boolean;
  danger?: boolean;
  disabled?: boolean;
  compact?: boolean;
}) {
  return (
    <ActionButton
      label={label}
      tone={danger ? 'danger' : success ? 'success' : primary ? 'primary' : 'secondary'}
      size={compact ? 'compact' : 'regular'}
      style={compact ? styles.compactButton : undefined}
      onPress={() => {
        Keyboard.dismiss();
        void onPress();
      }}
      disabled={disabled}
    />
  );
}

function HeaderAction({ label }: { label: string }) {
  return (
    <View style={styles.headerActionButton}>
      <Text style={styles.headerActionText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboardAvoider: {
    flex: 1,
  },
  appShell: {
    flex: 1,
    backgroundColor: colors.background,
  },
  bottomNavigation: {
    width: '100%',
    maxWidth: layout.contentMaxWidth,
    alignSelf: 'center',
  },
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  lightScreen: {
    backgroundColor: colors.background,
  },
  darkScreen: {
    backgroundColor: colors.background,
  },
  content: {
    flexGrow: 1,
    width: '100%',
    maxWidth: layout.contentMaxWidth,
    alignSelf: 'center',
    paddingHorizontal: layout.screenPaddingHorizontal,
    paddingTop: spacing.sm,
    paddingBottom: layout.bottomNavigationContentInset,
  },
  appBanner: {
    minHeight: layout.headerMinHeight,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    ...elevations.low,
  },
  bannerBrand: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bannerLogoMark: {
    width: 48,
    height: 46,
    flexShrink: 0,
  },
  bannerBrandText: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  bannerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
  },
  bannerName: {
    color: colors.textPrimary,
    fontSize: 23,
    lineHeight: 27,
    fontWeight: '900',
    flexShrink: 1,
  },
  bannerNameMain: {
    color: colors.textPrimary,
    fontWeight: '900',
  },
  bannerNameMainDark: {
    color: colors.textPrimary,
  },
  bannerNameGo: {
    color: colors.teal,
    fontWeight: '900',
    flexShrink: 0,
  },
  bannerTagline: {
    color: colors.textSecondary,
    ...typography.caption,
    marginTop: 1,
  },
  bannerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    flexShrink: 0,
  },
  accountIconButton: {
    width: controls.iconButtonSize,
    height: controls.iconButtonSize,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  homeBox: {
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.xl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    gap: spacing.md,
    ...elevations.low,
  },
  homeTitleBlock: {
    gap: spacing.micro,
    alignItems: 'center',
  },
  homeTitle: {
    color: colors.textPrimary,
    ...typography.title,
    textAlign: 'center',
  },
  homeSubtitle: {
    color: colors.textSecondary,
    ...typography.body,
    textAlign: 'center',
  },
  homePeoplePill: {
    minHeight: controls.minimumTouchTarget,
    alignSelf: 'center',
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: semanticTones.people.border,
    backgroundColor: semanticTones.people.soft,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  homePeoplePillText: {
    color: colors.textPrimary,
    ...typography.label,
  },
  homeActionChevron: {
    marginLeft: 'auto',
  },
  homeUtilityRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  homeUtilityButton: {
    flex: 1,
    minWidth: 140,
    minHeight: controls.buttonHeight,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  homeUtilityButtonText: {
    color: colors.textPrimary,
    ...typography.label,
  },
  homeActionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  homeMainButton: {
    flex: 1,
    minWidth: 142,
    minHeight: 82,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'transparent',
    paddingHorizontal: 14,
    paddingVertical: 12,
    alignItems: 'flex-start',
    justifyContent: 'center',
    gap: 8,
  },
  homePrimaryAction: {
    flexBasis: '100%',
    minHeight: 110,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  homeSecondaryAction: {
    flexBasis: '48%',
    minHeight: 96,
  },
  homeActionLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    maxWidth: '100%',
  },
  homeNowButton: {
    backgroundColor: colors.teal,
  },
  homeLaterButton: {
    backgroundColor: colors.surfaceInteractive,
  },
  homeSavedButton: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  homeMainButtonText: {
    color: colors.textPrimary,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '900',
    textAlign: 'left',
  },
  homeMainButtonSubtext: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '800',
  },
  homeSavedButtonText: {
    color: colors.textPrimary,
  },
  homeSavedButtonSubtext: {
    color: colors.textSecondary,
  },
  peopleGroupsEntry: {
    minHeight: 70,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  peopleGroupsIcon: {
    width: 38,
    height: 38,
    borderRadius: radii.pill,
    backgroundColor: colors.tealSoft,
    borderWidth: 1,
    borderColor: colors.teal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  peopleGroupsTextBlock: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  peopleGroupsTitle: {
    color: colors.textPrimary,
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '900',
  },
  peopleGroupsSubtitle: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '800',
  },
  nowBox: {
    borderWidth: 1,
    borderColor: colors.teal,
    borderRadius: radii.xl,
    backgroundColor: colors.surfaceRaised,
    padding: spacing.md,
    marginBottom: spacing.lg,
    gap: spacing.md,
  },
  nowHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  nowHeaderTextBlock: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  nowTitle: {
    color: colors.textPrimary,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '900',
  },
  nowSubtitle: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '800',
  },
  nowActionGrid: {
    gap: spacing.sm,
  },
  nowActionCard: {
    minHeight: 68,
    borderRadius: radii.lg,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  nowFoodAction: {
    backgroundColor: semanticTones.food.solid,
    borderColor: semanticTones.food.border,
  },
  nowActivityAction: {
    backgroundColor: semanticTones.activity.solid,
    borderColor: semanticTones.activity.border,
  },
  nowPeopleAction: {
    backgroundColor: semanticTones.people.solid,
    borderColor: semanticTones.people.border,
  },
  nowActionTitle: {
    flex: 1,
    color: semanticTones.people.foreground,
    fontSize: 20,
    lineHeight: 25,
    fontWeight: '900',
  },
  nowActionTitleLight: {
    color: semanticTones.food.foreground,
  },
  nowActionTitleDark: {
    color: semanticTones.activity.foreground,
  },
  nowDiscoveryPanel: {
    gap: 12,
  },
  nowModeSwitcher: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  nowPeopleMiniButton: {
    minHeight: controls.minimumTouchTarget,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  nowPeopleMiniText: {
    color: colors.textPrimary,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '900',
  },
  nowCategoryWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  nowCategoryChip: {
    minHeight: controls.chipHeight,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  nowCategoryChipActive: {
    backgroundColor: colors.surfaceInteractive,
    borderColor: colors.borderStrong,
  },
  nowCategoryText: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '900',
  },
  nowCategoryTextActive: {
    color: colors.textPrimary,
  },
  nowDecisionBar: {
    borderWidth: 1,
    borderColor: colors.teal,
    borderRadius: radii.md,
    backgroundColor: colors.tealSoft,
    padding: 10,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  nowDecisionTextBlock: {
    flex: 1,
    minWidth: 0,
  },
  nowDecisionLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  nowDecisionTitle: {
    color: colors.textPrimary,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '900',
  },
  nowCreatedPlanCard: {
    borderWidth: 1,
    borderColor: colors.teal,
    borderRadius: radii.md,
    backgroundColor: colors.tealSoft,
    padding: 12,
    gap: 12,
  },
  nowCreatedHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  nowCreatedEyebrow: {
    color: colors.teal,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  nowCreatedTitle: {
    color: colors.textPrimary,
    fontSize: 20,
    lineHeight: 25,
    fontWeight: '900',
  },
  nowCreatedMeta: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '800',
  },
  nowCreatedIcon: {
    width: 42,
    height: 42,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nowDestinationRow: {
    minHeight: controls.minimumTouchTarget,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  nowDestinationName: {
    flex: 1,
    minWidth: 0,
    color: colors.textPrimary,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '900',
  },
  nowCreatedActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  nowPeopleScreen: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  nowPeopleHeader: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  nowPeopleContent: {
    padding: 16,
    gap: 18,
  },
  nowPeopleSection: {
    gap: 10,
  },
  nowPeopleSectionTitle: {
    color: colors.textPrimary,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '900',
  },
  nowPeopleList: {
    gap: 8,
  },
  nowPersonRow: {
    minHeight: 60,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  nowPersonRowSelected: {
    borderColor: colors.teal,
    backgroundColor: colors.tealSoft,
  },
  nowPersonAvatar: {
    width: 36,
    height: 36,
    borderRadius: radii.xl,
    backgroundColor: colors.surfaceInteractive,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nowPersonAvatarText: {
    color: colors.textPrimary,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '900',
  },
  nowPersonName: {
    flex: 1,
    minWidth: 0,
    color: colors.textPrimary,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '900',
  },
  nowGroupAvatar: {
    width: 36,
    height: 36,
    borderRadius: radii.md,
    backgroundColor: colors.tealSoft,
    borderWidth: 1,
    borderColor: colors.teal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nowGroupTextBlock: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  nowGroupMembers: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
  },
  setupHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  setupField: {
    gap: 8,
  },
  setupPreferenceBlock: {
    gap: 14,
  },
  setupIntentTabs: {
    flexWrap: 'wrap',
    marginBottom: 0,
  },
  setupLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  setupFieldHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  setupPeopleSummary: {
    flex: 1,
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
    textAlign: 'right',
  },
  inferredPlanTypeBox: {
    minHeight: controls.inputHeight,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceRaised,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  inferredPlanTypeTextBlock: {
    flex: 1,
    minWidth: 0,
    gap: spacing.hairline,
  },
  inferredPlanTypeText: {
    color: colors.textPrimary,
    ...typography.bodyStrong,
  },
  inferredPlanTypeHint: {
    color: colors.textSecondary,
    ...typography.caption,
  },
  setupActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  hero: {
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    paddingHorizontal: 10,
    paddingTop: 12,
    paddingBottom: 12,
    marginTop: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  lightHero: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  darkHero: {
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.borderStrong,
  },
  webHero: {
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.borderStrong,
  },
  darkPanel: {
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.borderStrong,
  },
  darkAccentPanel: {
    backgroundColor: semanticTones.people.soft,
    borderColor: colors.teal,
  },
  darkCard: {
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.borderStrong,
  },
  darkModalCard: {
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.borderStrong,
  },
  darkText: {
    color: colors.textPrimary,
  },
  darkMutedText: {
    color: colors.textSecondary,
  },
  darkChip: {
    backgroundColor: colors.surfaceInteractive,
    borderColor: colors.borderStrong,
  },
  wordmarkBlock: {
    alignItems: 'center',
  },
  wordmarkImage: {
    width: '100%',
    height: 128,
  },
  authContent: {
    flexGrow: 1,
    padding: 16,
    paddingTop: 34,
    paddingBottom: 42,
  },
  authCentered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  authCard: {
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: 16,
    ...elevations.low,
  },
  webAuthCard: {
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.borderStrong,
  },
  authTitle: {
    color: colors.textPrimary,
    fontSize: 24,
    fontWeight: '900',
    marginBottom: 8,
  },
  authCopy: {
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 21,
    marginBottom: 14,
  },
  authHint: {
    color: colors.textSecondary,
    fontWeight: '800',
  },
  alphaGateShell: {
    flex: 1,
    justifyContent: 'center',
    padding: 18,
  },
  testerDropdown: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  webTesterDropdown: {
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceRaised,
  },
  testerOption: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  webTesterOption: {
    borderBottomColor: colors.borderStrong,
  },
  testerOptionText: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '900',
  },
  authFinePrint: {
    color: colors.textTertiary,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 12,
  },
  usageBox: {
    backgroundColor: colors.surfaceInteractive,
    borderWidth: 1,
    borderColor: semanticTones.primary.border,
    borderRadius: radii.md,
    padding: 12,
    marginBottom: 14,
    alignItems: 'stretch',
    gap: 10,
  },
  usageTextBlock: {
    gap: 3,
  },
  usageName: {
    color: colors.textPrimary,
    fontWeight: '900',
    fontSize: 15,
  },
  usageText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  usageActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    gap: 8,
  },
  accountOverlay: {
    flex: 1,
    position: 'relative',
    backgroundColor: colors.scrim,
    alignItems: 'flex-end',
    paddingTop: 76,
    paddingHorizontal: 16,
  },
  accountCard: {
    width: '100%',
    maxWidth: 320,
    zIndex: 1,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 12,
    gap: 12,
  },
  accountHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  accountAvatar: {
    width: 42,
    height: 42,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountTextBlock: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  accountName: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '900',
  },
  accountUsage: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '800',
  },
  accountSettingList: {
    gap: 10,
  },
  accountSettingLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  accountSettingValue: {
    color: colors.textPrimary,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '900',
    marginTop: 2,
  },
  accountActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  toastBox: {
    alignSelf: 'center',
    backgroundColor: colors.coralSoft,
    borderWidth: 1,
    borderColor: semanticTones.primary.border,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 14,
  },
  toastText: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '900',
  },
  eyebrow: {
    color: colors.coral,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  lightEyebrow: {
    color: colors.coral,
  },
  eyebrowDark: {
    color: colors.coral,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0,
    textTransform: 'uppercase',
    marginBottom: 3,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 31,
    fontWeight: '900',
  },
  brandTitle: {
    fontSize: 44,
    fontWeight: '900',
  },
  brandTitleMain: {
    color: colors.textPrimary,
    fontWeight: '900',
  },
  brandTitleGo: {
    color: colors.red,
    fontWeight: '900',
  },
  lightTitle: {
    color: colors.textPrimary,
  },
  taglineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 10,
  },
  taglineText: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 4,
  },
  taglinePin: {
    width: 16,
    height: 21,
    borderRadius: radii.md,
    backgroundColor: colors.red,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '45deg' }],
  },
  taglinePinDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.surface,
  },
  heroCopy: {
    color: colors.greenSoft,
    marginTop: 10,
    marginBottom: 14,
    fontSize: 15,
    lineHeight: 21,
  },
  lightHeroCopy: {
    color: colors.textSecondary,
  },
  filterTabs: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 2,
    marginBottom: 14,
  },
  filterTab: {
    minHeight: controls.minimumTouchTarget,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterTabActive: {
    backgroundColor: colors.coralSoft,
    borderColor: colors.coral,
  },
  filterTabText: {
    color: colors.textSecondary,
    fontWeight: '900',
  },
  filterTabTextActive: {
    color: colors.textPrimary,
  },
  statusPill: {
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  statusGood: {
    backgroundColor: colors.greenSoft,
  },
  statusBad: {
    backgroundColor: colors.redSoft,
  },
  statusText: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '900',
  },
  provider: {
    color: colors.textTertiary,
    marginTop: 5,
    fontSize: 14,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: 17,
    fontWeight: '900',
    marginBottom: 10,
  },
  lightSectionTitle: {
    color: colors.textPrimary,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    minHeight: controls.chipHeight,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.pill,
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: colors.surface,
  },
  chipActive: {
    backgroundColor: colors.tealSoft,
    borderColor: colors.teal,
  },
  chipText: {
    color: colors.textSecondary,
    fontWeight: '700',
  },
  chipTextActive: {
    color: colors.textPrimary,
  },
  sessionBox: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.teal,
    borderRadius: radii.md,
    padding: 14,
    marginBottom: 18,
    gap: 12,
  },
  sessionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  sessionTitleBlock: {
    flex: 1,
    minWidth: 0,
  },
  sessionHeaderActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: 8,
  },
  sessionMetaText: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  sessionSubhead: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '900',
    marginBottom: 2,
  },
  sessionResumeBox: {
    gap: 8,
  },
  sessionResumeList: {
    gap: 8,
  },
  sessionResumeItem: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceRaised,
    padding: 10,
  },
  sessionResumeTitle: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '900',
  },
  sessionResumeMeta: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 3,
  },
  sessionParticipantRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sessionParticipantPill: {
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceRaised,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  sessionOwnerPill: {
    backgroundColor: colors.coralSoft,
    borderColor: colors.coral,
  },
  sessionParticipantText: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '900',
  },
  sessionSearchActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sessionManualBox: {
    gap: 8,
  },
  sessionSuggestionGroup: {
    gap: 8,
  },
  sessionSuggestionCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.background,
    padding: 12,
    gap: 7,
  },
  sessionSuggestionTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  sessionSuggestionTitle: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '900',
    flex: 1,
  },
  sessionVoteCount: {
    minWidth: 32,
    minHeight: 28,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceInteractive,
    color: colors.textPrimary,
    textAlign: 'center',
    textAlignVertical: 'center',
    paddingTop: Platform.OS === 'ios' ? 5 : 4,
    fontSize: 13,
    fontWeight: '900',
  },
  sessionSuggestionMeta: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
  },
  sessionFinalBox: {
    borderTopWidth: 1,
    borderTopColor: colors.borderStrong,
    paddingTop: 12,
    gap: 10,
  },
  sessionRecommendationBox: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceRaised,
    padding: 12,
    gap: 7,
  },
  sessionRecommendationLine: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '900',
  },
  planBox: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radii.md,
    padding: spacing.sm,
    marginBottom: 16,
  },
  visitorPlanBox: {
    borderWidth: 1,
    borderColor: colors.teal,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    padding: 14,
    gap: 14,
  },
  betaPlanDetailCard: {
    borderWidth: 1,
    borderColor: colors.teal,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceRaised,
    padding: 12,
    gap: 12,
    marginBottom: 14,
  },
  betaPlanHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  betaPlanTitleBlock: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  betaPlanEyebrow: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  betaPlanTitle: {
    color: colors.textPrimary,
    fontSize: 22,
    lineHeight: 27,
    fontWeight: '900',
  },
  betaSummaryLine: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '800',
  },
  betaPlanTitleInput: {
    minHeight: controls.inputHeight,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    color: colors.textPrimary,
    paddingHorizontal: 10,
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '900',
  },
  betaStatusPill: {
    borderRadius: radii.pill,
    backgroundColor: colors.amberSoft,
    borderWidth: 1,
    borderColor: colors.amber,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  betaStatusPillLocked: {
    backgroundColor: colors.tealSoft,
    borderColor: colors.teal,
  },
  betaStatusText: {
    color: colors.textPrimary,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  betaDetailGrid: {
    gap: 2,
  },
  betaDetailsBox: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceRaised,
    padding: 10,
    gap: 10,
  },
  betaDetailsHeader: {
    minHeight: controls.minimumTouchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  betaDetailsBody: {
    gap: 10,
  },
  betaFinalBox: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.background,
    padding: 10,
    gap: 3,
  },
  betaFinalLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  betaFinalValue: {
    color: colors.textPrimary,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '900',
  },
  visitorRouteSection: {
    borderWidth: 1,
    borderColor: semanticTones.route.border,
    borderRadius: radii.lg,
    backgroundColor: semanticTones.route.soft,
    padding: spacing.sm,
    gap: spacing.sm,
  },
  visitorRouteHeading: {
    flex: 1,
    minWidth: 0,
    gap: spacing.hairline,
  },
  visitorRouteList: {
    gap: spacing.xs,
  },
  visitorRouteStop: {
    minHeight: 64,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceRaised,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  visitorRouteIndex: {
    ...typography.label,
    width: 32,
    height: 32,
    borderRadius: radii.pill,
    color: colors.textInverse,
    textAlign: 'center',
    lineHeight: 32,
  },
  visitorRouteStopText: {
    flex: 1,
    minWidth: 0,
    gap: spacing.hairline,
  },
  visitorRouteType: {
    ...typography.eyebrow,
  },
  visitorRouteTypeFood: {
    color: semanticTones.food.accent,
  },
  visitorRouteTypeActivity: {
    color: semanticTones.activity.accent,
  },
  visitorRouteName: {
    color: colors.textPrimary,
    ...typography.bodyStrong,
  },
  visitorRouteMeta: {
    color: colors.textSecondary,
    ...typography.caption,
  },
  betaPrimaryActionBox: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceRaised,
    padding: 12,
    gap: 10,
  },
  betaPrimaryPrompt: {
    color: colors.textPrimary,
    fontSize: 18,
    lineHeight: 23,
    fontWeight: '900',
  },
  betaSearchActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  betaSearchButton: {
    flexGrow: 1,
    minWidth: 145,
    minHeight: controls.buttonHeight,
    borderRadius: radii.lg,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  betaSearchButtonFood: {
    backgroundColor: semanticTones.food.solid,
  },
  betaSearchButtonActivity: {
    backgroundColor: semanticTones.activity.solid,
  },
  betaSearchButtonText: {
    color: colors.textInverse,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '900',
  },
  betaSearchButtonTextLight: {
    color: colors.textInverse,
  },
  betaSection: {
    gap: 8,
  },
  betaSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  rsvpButtonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  rsvpButton: {
    minHeight: controls.buttonHeight,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 8,
    justifyContent: 'center',
  },
  rsvpButtonActive: {
    borderColor: colors.teal,
    backgroundColor: colors.teal,
  },
  rsvpButtonText: {
    color: colors.textPrimary,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '900',
  },
  rsvpButtonTextActive: {
    color: colors.textPrimary,
  },
  betaSuggestionRow: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    padding: 10,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  betaSuggestionTextBlock: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  betaSuggestionTitle: {
    color: colors.textPrimary,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '900',
  },
  betaSuggestionMeta: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
  },
  betaSuggestionComposer: {
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    paddingTop: 10,
    gap: 8,
  },
  betaSuggestionComposerActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  betaActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  betaLocalOnlyText: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
  },
  planPeopleBox: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceRaised,
    padding: 12,
    marginBottom: 14,
    gap: 10,
  },
  planPeopleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  planPeopleTextBlock: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  planPeopleTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '900',
  },
  planPeopleSummary: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '900',
  },
  planPeopleAddButton: {
    minHeight: controls.minimumTouchTarget,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.teal,
    backgroundColor: colors.tealSoft,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    flexShrink: 0,
  },
  planPeopleAddText: {
    color: colors.textPrimary,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '900',
  },
  planPeoplePicker: {
    borderTopWidth: 1,
    borderTopColor: colors.borderStrong,
    paddingTop: 10,
    gap: 8,
  },
  planPeopleHint: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '800',
  },
  lightPanel: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  itineraryBuilder: {
    gap: spacing.sm,
  },
  itineraryPlanHeader: {
    gap: spacing.micro,
  },
  itineraryPlanTitleInput: {
    ...typography.subheading,
    backgroundColor: colors.backgroundRaised,
    borderColor: colors.border,
    borderRadius: radii.sm,
    borderWidth: 1,
    color: colors.textPrimary,
    minHeight: controls.minimumTouchTarget,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    width: '100%',
  },
  itineraryPlanMeta: {
    ...typography.caption,
    color: colors.textTertiary,
    paddingHorizontal: spacing.micro,
  },
  itineraryCollaborationStrip: {
    backgroundColor: colors.cyanSoft,
    borderColor: semanticTones.travel.border,
    borderRadius: radii.sm,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.xs,
  },
  itineraryCollaborationHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
    minWidth: 0,
  },
  itineraryCollaborationLabel: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.micro,
    flexShrink: 0,
  },
  itineraryCollaborationTitle: {
    ...typography.label,
    color: colors.textPrimary,
  },
  itineraryCollaborationSummary: {
    ...typography.caption,
    color: colors.textSecondary,
    flex: 1,
    minWidth: 0,
    textAlign: 'right',
  },
  itineraryRsvpActions: {
    flexDirection: 'row',
    gap: spacing.micro,
    width: '100%',
  },
  itineraryRsvpButton: {
    alignItems: 'center',
    backgroundColor: colors.backgroundRaised,
    borderColor: colors.borderStrong,
    borderRadius: radii.sm,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: spacing.micro,
    justifyContent: 'center',
    minHeight: controls.minimumTouchTarget,
    minWidth: 0,
    paddingHorizontal: spacing.micro,
  },
  itineraryRsvpButtonSelected: {
    backgroundColor: colors.surfaceInteractive,
    borderColor: colors.cyan,
  },
  itineraryRsvpButtonText: {
    ...typography.buttonCompact,
    color: colors.textSecondary,
    flexShrink: 1,
  },
  itineraryRsvpButtonTextSelected: {
    color: colors.textPrimary,
  },
  itinerarySectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
    justifyContent: 'space-between',
  },
  itinerarySectionCopy: {
    flex: 1,
    minWidth: 0,
  },
  itinerarySectionTitle: {
    ...typography.subheading,
    color: colors.textPrimary,
  },
  itinerarySectionHint: {
    ...typography.caption,
    color: colors.textTertiary,
  },
  itineraryAddStopButton: {
    alignItems: 'center',
    backgroundColor: colors.backgroundRaised,
    borderColor: semanticTones.food.border,
    borderRadius: radii.sm,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.micro,
    justifyContent: 'center',
    minHeight: controls.minimumTouchTarget,
    paddingHorizontal: spacing.sm,
  },
  itineraryAddStopButtonActive: {
    backgroundColor: colors.coralSoft,
    borderColor: colors.coral,
  },
  itineraryAddStopText: {
    ...typography.buttonCompact,
    color: colors.textPrimary,
  },
  itineraryAddMenu: {
    backgroundColor: colors.backgroundRaised,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.xs,
  },
  itineraryTypeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  itineraryTypeButton: {
    alignItems: 'center',
    borderRadius: radii.sm,
    borderWidth: 1,
    flexBasis: '47%',
    flexDirection: 'row',
    flexGrow: 1,
    gap: spacing.xs,
    minHeight: controls.buttonHeight,
    minWidth: 92,
    paddingHorizontal: spacing.sm,
  },
  itineraryTypeButtonFood: {
    backgroundColor: colors.coralSoft,
    borderColor: semanticTones.food.border,
  },
  itineraryTypeButtonActivity: {
    backgroundColor: colors.amberSoft,
    borderColor: semanticTones.activity.border,
  },
  itineraryTypeButtonDessert: {
    backgroundColor: colors.tealSoft,
    borderColor: semanticTones.dessert.border,
  },
  itineraryTypeButtonIdea: {
    backgroundColor: colors.violetSoft,
    borderColor: semanticTones.idea.border,
  },
  itineraryTypeButtonSelected: {
    borderColor: colors.violet,
  },
  itineraryTypeText: {
    ...typography.label,
  },
  itineraryIdeaComposer: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  itineraryIdeaInput: {
    ...typography.body,
    backgroundColor: colors.surface,
    borderColor: colors.borderStrong,
    borderRadius: radii.sm,
    borderWidth: 1,
    color: colors.textPrimary,
    flex: 1,
    minHeight: controls.inputHeight,
    minWidth: 0,
    paddingHorizontal: spacing.sm,
  },
  itineraryIdeaAddButton: {
    alignItems: 'center',
    backgroundColor: colors.violet,
    borderRadius: radii.sm,
    flexDirection: 'row',
    gap: spacing.micro,
    justifyContent: 'center',
    minHeight: controls.minimumTouchTarget,
    paddingHorizontal: spacing.sm,
  },
  itineraryIdeaAddText: {
    ...typography.buttonCompact,
    color: colors.textInverse,
  },
  itineraryCandidateList: {
    borderTopColor: colors.divider,
    borderTopWidth: 1,
    gap: spacing.micro,
    paddingTop: spacing.xs,
  },
  itineraryCandidateHeading: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  itineraryCandidateRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
    minHeight: controls.minimumTouchTarget,
  },
  itineraryCandidateCopy: {
    flex: 1,
    minWidth: 0,
  },
  itineraryCandidateName: {
    ...typography.label,
    color: colors.textPrimary,
  },
  itineraryCandidateMeta: {
    ...typography.caption,
    color: colors.textTertiary,
  },
  itineraryCandidateAdd: {
    alignItems: 'center',
    borderColor: colors.borderStrong,
    borderRadius: radii.sm,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: controls.minimumTouchTarget,
    minWidth: controls.minimumTouchTarget,
    paddingHorizontal: spacing.xs,
  },
  itineraryCandidateAddText: {
    ...typography.buttonCompact,
    color: colors.textPrimary,
  },
  itineraryGroupSuggestion: {
    borderTopColor: colors.divider,
    borderTopWidth: 1,
    gap: spacing.xs,
    paddingTop: spacing.xs,
  },
  itinerarySuggestionActions: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  itinerarySuggestionButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.borderStrong,
    borderRadius: radii.sm,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: spacing.micro,
    justifyContent: 'center',
    minHeight: controls.minimumTouchTarget,
    paddingHorizontal: spacing.xs,
  },
  itinerarySuggestionButtonText: {
    ...typography.buttonCompact,
    color: colors.textPrimary,
  },
  itineraryList: {
    marginHorizontal: -spacing.sm,
    minHeight: controls.minimumTouchTarget,
  },
  itinerarySortableItem: {
    width: '100%',
  },
  itineraryInsertionIndicator: {
    backgroundColor: colors.cyan,
    borderRadius: radii.pill,
    height: 3,
    left: controls.minimumTouchTarget,
    position: 'absolute',
    right: 0,
    shadowColor: colors.cyan,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 6,
    top: -5,
  },
  itineraryEmptyState: {
    alignItems: 'center',
    backgroundColor: colors.backgroundRaised,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderStyle: 'dashed',
    borderWidth: 1,
    gap: spacing.micro,
    justifyContent: 'center',
    minHeight: 132,
    padding: spacing.sm,
  },
  itineraryEmptyTitle: {
    ...typography.bodyStrong,
    color: colors.textPrimary,
  },
  itineraryEmptyCopy: {
    ...typography.caption,
    color: colors.textTertiary,
    maxWidth: 320,
    textAlign: 'center',
  },
  itinerarySummary: {
    backgroundColor: colors.backgroundRaised,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    overflow: 'hidden',
  },
  itinerarySummaryValues: {
    alignItems: 'stretch',
    flexDirection: 'row',
    minHeight: 68,
    paddingVertical: spacing.xs,
  },
  itinerarySummaryColumn: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    minWidth: 0,
    paddingHorizontal: spacing.micro,
  },
  itinerarySummaryDivider: {
    alignSelf: 'stretch',
    backgroundColor: colors.divider,
    width: 1,
  },
  itinerarySummaryLabel: {
    ...typography.caption,
    color: colors.textTertiary,
  },
  itinerarySummaryValue: {
    ...typography.bodyStrong,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  itineraryTargetStatus: {
    alignItems: 'center',
    borderTopColor: colors.divider,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: spacing.micro,
    justifyContent: 'center',
    minHeight: controls.minimumTouchTarget,
    paddingHorizontal: spacing.xs,
  },
  itineraryTargetStatusText: {
    ...typography.caption,
    flexShrink: 1,
    textAlign: 'center',
  },
  itineraryTargetStatusUnder: {
    color: colors.green,
  },
  itineraryTargetStatusNear: {
    color: colors.amber,
  },
  itineraryTargetStatusOver: {
    color: colors.red,
  },
  itineraryFooterActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  itinerarySecondaryAction: {
    alignItems: 'center',
    backgroundColor: colors.backgroundRaised,
    borderColor: colors.border,
    borderRadius: radii.sm,
    borderWidth: 1,
    flexBasis: 68,
    flexGrow: 1,
    flexDirection: 'row',
    gap: spacing.micro,
    justifyContent: 'center',
    minHeight: controls.minimumTouchTarget,
    minWidth: 0,
    paddingHorizontal: spacing.xs,
  },
  itinerarySecondaryActionActive: {
    borderColor: colors.teal,
  },
  itinerarySecondaryActionText: {
    ...typography.buttonCompact,
    color: colors.textPrimary,
  },
  itineraryPrimaryAction: {
    alignItems: 'center',
    backgroundColor: colors.coral,
    borderRadius: radii.sm,
    flexBasis: 124,
    flexGrow: 1.6,
    flexDirection: 'row',
    gap: spacing.micro,
    justifyContent: 'center',
    minHeight: controls.minimumTouchTarget,
    minWidth: 0,
    paddingHorizontal: spacing.xs,
  },
  itineraryPrimaryActionText: {
    ...typography.buttonCompact,
    color: colors.textInverse,
  },
  itineraryInvitePanel: {
    backgroundColor: colors.backgroundRaised,
    borderColor: colors.border,
    borderRadius: radii.sm,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.xs,
  },
  itineraryUtilityActions: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    justifyContent: 'flex-end',
  },
  itineraryUtilityButton: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.micro,
    justifyContent: 'center',
    minHeight: controls.minimumTouchTarget,
    paddingHorizontal: spacing.xs,
  },
  itineraryUtilityText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  itineraryControlDisabled: {
    opacity: 0.4,
  },
  planHeader: {
    alignItems: 'stretch',
    gap: 12,
    marginBottom: 14,
  },
  planHeaderActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    gap: 8,
  },
  planStats: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  planTitleBlock: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  planTitle: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: '900',
    maxWidth: 210,
  },
  lockedPlanTitle: {
    color: colors.textPrimary,
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '900',
  },
  planTitleInput: {
    width: '100%',
    minHeight: controls.inputHeight,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    color: colors.textPrimary,
    paddingHorizontal: 10,
    fontSize: 18,
    fontWeight: '900',
  },
  planMetaText: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '800',
  },
  savedPlansBox: {
    borderWidth: 1,
    borderColor: colors.teal,
    borderRadius: radii.md,
    padding: 14,
    marginBottom: 16,
    backgroundColor: colors.surface,
  },
  savedPlansHeader: {
    minHeight: controls.minimumTouchTarget,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  sectionHeaderTextBlock: {
    flex: 1,
    minWidth: 0,
  },
  savedPlansHint: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  savedPlansList: {
    gap: 10,
    marginTop: 12,
  },
  savedPlanItem: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.background,
    padding: 12,
    gap: 10,
  },
  savedPlanTextBlock: {
    gap: 4,
  },
  savedPlanTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '900',
  },
  savedPlanMeta: {
    color: colors.coral,
    fontSize: 12,
    fontWeight: '800',
  },
  savedPlanStops: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  savedPlanActions: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  startWithLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '900',
    textAlign: 'center',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  startChooser: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  startChoice: {
    flex: 1,
    minWidth: 118,
    minHeight: 86,
    borderRadius: radii.md,
    borderWidth: 2,
    paddingHorizontal: 14,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    ...elevations.low,
  },
  startChoiceFood: {
    backgroundColor: semanticTones.food.solid,
    borderColor: semanticTones.food.border,
  },
  startChoiceActivity: {
    backgroundColor: semanticTones.activity.solid,
    borderColor: semanticTones.activity.border,
  },
  startChoiceLabel: {
    fontSize: 18,
    lineHeight: 23,
    fontWeight: '900',
    textAlign: 'center',
  },
  startChoiceFoodLabel: {
    color: semanticTones.food.foreground,
  },
  startChoiceActivityLabel: {
    color: semanticTones.activity.foreground,
  },
  routeImportBox: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.background,
    padding: 12,
    gap: 8,
  },
  routeImportError: {
    color: colors.red,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '800',
  },
  lockedPlanCard: {
    borderWidth: 1,
    borderColor: semanticTones.success.border,
    borderRadius: radii.xl,
    backgroundColor: colors.surfaceRaised,
    padding: spacing.md,
    gap: spacing.sm,
    ...elevations.low,
  },
  lockedPlanCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  lockedPlanTitleBlock: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  lockedPlanCardTools: {
    alignItems: 'flex-end',
    gap: 6,
  },
  lockedPlanIconButton: {
    width: controls.iconButtonSize,
    height: controls.iconButtonSize,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockedPlanSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  lockedPlanMeta: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '900',
  },
  lockedPlanLeave: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
  },
  lockedPlanInvitees: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
  },
  lockedPlanRsvp: {
    marginTop: spacing.micro,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    paddingTop: spacing.sm,
    gap: spacing.xs,
  },
  lockedStopList: {
    gap: 6,
  },
  lockedPlanActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    gap: 8,
    marginTop: 10,
    marginBottom: 12,
  },
  lockedStopRow: {
    minHeight: controls.minimumTouchTarget,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    paddingHorizontal: 8,
    paddingVertical: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  lockedStopIndex: {
    width: 28,
    height: 28,
    borderRadius: radii.pill,
    color: colors.textInverse,
    textAlign: 'center',
    lineHeight: 28,
    fontSize: 12,
    fontWeight: '900',
  },
  stopIndexFood: {
    backgroundColor: semanticTones.food.solid,
  },
  stopIndexActivity: {
    backgroundColor: semanticTones.activity.solid,
  },
  lockedStopTime: {
    width: 68,
    color: colors.teal,
    fontSize: 12,
    fontWeight: '900',
  },
  lockedStopTravelBlock: {
    width: 42,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
  },
  lockedStopTravelText: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '900',
    textAlign: 'center',
  },
  lockedStopTextBlock: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  lockedStopName: {
    color: colors.textPrimary,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '900',
  },
  lockedStopCityPill: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
    borderRadius: radii.pill,
    backgroundColor: colors.tealSoft,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  lockedStopCityText: {
    color: colors.teal,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  bridgeBox: {
    borderWidth: 1,
    borderColor: semanticTones.food.border,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    marginBottom: 16,
    padding: 14,
    gap: 8,
  },
  webBridgeBox: {
    borderColor: colors.teal,
    backgroundColor: colors.tealSoft,
  },
  routeOriginBox: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: 10,
    paddingTop: 12,
    gap: 8,
  },
  chargingIdeasBox: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    padding: 12,
    gap: 8,
  },
  chargingIdeaList: {
    gap: 8,
  },
  chargingIdeaRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  chargingIdeaTextBlock: {
    flex: 1,
    minWidth: 0,
  },
  chargingIdeaName: {
    color: colors.textPrimary,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '900',
  },
  chargingIdeaMeta: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
  },
  planSettingsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 2,
  },
  dateWindowBox: {
    gap: 8,
    marginTop: 4,
  },
  dateChipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  dateChip: {
    minHeight: controls.chipHeight,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  dateChipActive: {
    borderColor: colors.teal,
    backgroundColor: colors.tealSoft,
  },
  dateChipText: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '900',
  },
  dateChipTextActive: {
    color: colors.teal,
  },
  customDateBox: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    padding: 10,
    gap: 8,
  },
  customDateInputs: {
    flexDirection: 'row',
    gap: 8,
  },
  customDateInput: {
    minWidth: 0,
  },
  locationSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  locationSummaryText: {
    flex: 1,
  },
  routeOriginHint: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
  bridgeTitle: {
    color: colors.textPrimary,
    fontWeight: '900',
  },
  bridgeTitleDarkPanel: {
    color: colors.textPrimary,
  },
  planLine: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 5,
  },
  planLabel: {
    width: 96,
    color: colors.teal,
    fontWeight: '800',
  },
  planValue: {
    flex: 1,
    color: colors.textPrimary,
  },
  inputLabel: {
    color: colors.textPrimary,
    fontWeight: '700',
    marginTop: 12,
    marginBottom: 6,
  },
  inputRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'center',
    marginTop: 6,
  },
  settingsLocationInputGroup: {
    gap: 8,
    marginTop: 6,
  },
  settingsLocationActionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'center',
  },
  input: {
    flex: 1,
    minWidth: 0,
    minHeight: controls.inputHeight,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
  },
  webInput: {
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceRaised,
  },
  darkPanelInput: {
    borderColor: colors.border,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
  },
  buttonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: 10,
    rowGap: 10,
    marginTop: 12,
  },
  resultCardActionRow: {
    width: 'auto',
    maxWidth: 320,
    alignSelf: 'stretch',
    marginHorizontal: -spacing.micro,
    justifyContent: 'space-between',
    columnGap: 0,
  },
  button: {
    minHeight: controls.buttonHeight,
    borderRadius: radii.md,
    paddingHorizontal: 13,
    paddingVertical: 10,
    backgroundColor: colors.surfaceInteractive,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardIconButton: {
    width: 44,
    height: controls.iconButtonSize,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceInteractive,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardIconButtonActive: {
    borderWidth: 1,
    borderColor: colors.amber,
  },
  compactButton: {
    minWidth: 76,
    minHeight: controls.minimumTouchTarget,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  primaryButton: {
    backgroundColor: semanticTones.primary.solid,
  },
  successButton: {
    backgroundColor: semanticTones.success.solid,
  },
  dangerButton: {
    backgroundColor: semanticTones.danger.solid,
  },
  disabledButton: {
    opacity: 0.55,
  },
  buttonText: {
    color: colors.textPrimary,
    fontWeight: '800',
  },
  primaryButtonText: {
    color: colors.textInverse,
  },
  spinner: {
    marginTop: 10,
  },
  pairingBox: {
    borderWidth: 1,
    borderColor: colors.teal,
    borderRadius: radii.md,
    padding: 14,
    marginBottom: 16,
    backgroundColor: colors.tealSoft,
  },
  lightPairingBox: {
    backgroundColor: colors.tealSoft,
    borderColor: colors.teal,
  },
  pairingHeader: {
    minHeight: controls.minimumTouchTarget,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  pairingHeaderText: {
    flex: 1,
    minWidth: 0,
  },
  pairingTitle: {
    marginBottom: 2,
  },
  pairingHint: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 0,
    marginBottom: 0,
  },
  pairingBody: {
    gap: 10,
    marginTop: 12,
  },
  pairingActions: {
    alignSelf: 'flex-start',
  },
  mapChip: {
    maxWidth: '100%',
    flexShrink: 1,
    minHeight: controls.minimumTouchTarget,
    borderRadius: radii.md,
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 9,
    justifyContent: 'center',
  },
  mapChipFood: {
    backgroundColor: semanticTones.food.soft,
    borderColor: semanticTones.food.border,
  },
  mapChipActivity: {
    backgroundColor: semanticTones.activity.soft,
    borderColor: semanticTones.activity.border,
  },
  mapChipText: {
    flexShrink: 1,
    fontWeight: '800',
  },
  mapChipTextFood: {
    color: semanticTones.food.accent,
  },
  mapChipTextActivity: {
    color: semanticTones.activity.accent,
  },
  preferencesBox: {
    borderWidth: 1,
    borderColor: colors.amber,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    marginBottom: 16,
    overflow: 'hidden',
  },
  preferencesHeader: {
    minHeight: controls.minimumTouchTarget,
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  preferenceSummary: {
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: -3,
  },
  lightMutedText: {
    color: colors.textSecondary,
  },
  headerActionButton: {
    minWidth: 76,
    minHeight: controls.minimumTouchTarget,
    borderRadius: radii.md,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: colors.surfaceInteractive,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  headerActionText: {
    color: colors.textPrimary,
    fontWeight: '900',
  },
  preferencesContent: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    padding: 14,
    paddingTop: 12,
    gap: 12,
  },
  preferenceGroup: {
    gap: 8,
  },
  bottomHideButton: {
    minHeight: controls.minimumTouchTarget,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    backgroundColor: colors.surfaceInteractive,
  },
  bottomHideText: {
    color: colors.textPrimary,
    fontWeight: '900',
  },
  filterLabel: {
    color: colors.coral,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    marginTop: 4,
  },
  preferenceMoreChip: {
    borderColor: colors.teal,
  },
  preferenceMoreText: {
    fontWeight: '900',
  },
  advancedPreferenceHeader: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 12,
    marginTop: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  advancedPreferenceLabel: {
    marginTop: 0,
  },
  empty: {
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 21,
  },
  emptyState: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: 14,
    backgroundColor: colors.surface,
  },
  preSearchEmptyState: {
    marginBottom: 16,
  },
  emptyTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 5,
  },
  loadingResults: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: 14,
    backgroundColor: colors.surface,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  loadingResultsText: {
    color: colors.textPrimary,
    fontWeight: '900',
  },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radii.lg,
    padding: spacing.sm,
    marginBottom: spacing.sm,
    ...elevations.low,
  },
  cardFood: {
    borderColor: semanticTones.food.border,
  },
  cardActivity: {
    borderColor: semanticTones.activity.border,
  },
  cardSelected: {
    borderWidth: 2,
    borderColor: colors.teal,
    backgroundColor: colors.surfaceRaised,
  },
  placeCardBody: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: spacing.sm,
  },
  placeCardMedia: {
    width: 112,
    minHeight: 112,
    borderRadius: radii.md,
    overflow: 'hidden',
    backgroundColor: colors.surfaceMuted,
    position: 'relative',
  },
  placeCardMediaTap: {
    flex: 1,
    width: '100%',
    position: 'relative',
  },
  placeCardImage: {
    width: '100%',
    height: '100%',
    minHeight: 112,
  },
  placeCardImageFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
  },
  placeCardInfoTouchTarget: {
    position: 'absolute',
    top: spacing.xs,
    right: spacing.xs,
    zIndex: 3,
    width: controls.minimumTouchTarget,
    height: controls.minimumTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeCardInfoButton: {
    width: 32,
    height: 32,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceInteractive,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeCardContent: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
    gap: spacing.micro,
  },
  cardCategory: {
    ...typography.eyebrow,
  },
  cardCategoryFood: {
    color: semanticTones.food.accent,
  },
  cardCategoryActivity: {
    color: semanticTones.activity.accent,
  },
  cardMetadataRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.xs,
  },
  cardMetadataPill: {
    minHeight: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.micro,
  },
  cardMetadataText: {
    color: colors.textSecondary,
    ...typography.caption,
  },
  cardHeaderGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  cardHeaderMain: {
    flex: 1,
    minWidth: 0,
  },
  cardHeaderActions: {
    width: 82,
    alignItems: 'center',
  },
  cardRank: {
    color: colors.coral,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  cardRankSelected: {
    color: colors.teal,
  },
  cardHours: {
    maxWidth: '100%',
    color: colors.textSecondary,
    ...typography.caption,
  },
  placeDetailScreen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  placeDetailContent: {
    width: '100%',
    maxWidth: layout.contentMaxWidth,
    alignSelf: 'center',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  placeDetailHeader: {
    minHeight: layout.headerMinHeight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  placeDetailHeaderButton: {
    width: controls.iconButtonSize,
    height: controls.iconButtonSize,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeDetailHeaderButtonActive: {
    borderColor: semanticTones.food.border,
    backgroundColor: semanticTones.food.soft,
  },
  placeDetailHeaderTitle: {
    flex: 1,
    color: colors.textPrimary,
    ...typography.subheading,
    textAlign: 'center',
  },
  placeDetailHero: {
    height: 280,
    borderRadius: radii.xl,
    overflow: 'hidden',
    backgroundColor: colors.surfaceMuted,
    position: 'relative',
  },
  placeDetailHeroImage: {
    width: '100%',
    height: '100%',
  },
  placeDetailHeroFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
  },
  placeDetailAttribution: {
    position: 'absolute',
    left: spacing.sm,
    bottom: spacing.sm,
    maxWidth: '82%',
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.micro,
    borderRadius: radii.sm,
    backgroundColor: colors.scrim,
    color: colors.textSecondary,
    ...typography.caption,
  },
  placeDetailTitleBlock: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceRaised,
    padding: spacing.md,
    gap: spacing.xs,
  },
  placeDetailEyebrow: {
    ...typography.eyebrow,
  },
  placeDetailEyebrowFood: {
    color: semanticTones.food.accent,
  },
  placeDetailEyebrowActivity: {
    color: semanticTones.activity.accent,
  },
  placeDetailTitle: {
    color: colors.textPrimary,
    ...typography.title,
  },
  placeDetailMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
  },
  placeDetailMetaItem: {
    minHeight: controls.minimumTouchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.micro,
  },
  placeDetailMetaText: {
    color: colors.textSecondary,
    ...typography.bodyStrong,
  },
  placeDetailAddressRow: {
    minHeight: controls.minimumTouchTarget,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
  },
  placeDetailAddress: {
    flex: 1,
    color: colors.textSecondary,
    ...typography.body,
  },
  placeDetailHours: {
    color: colors.textSecondary,
    ...typography.body,
  },
  placeDetailPrimaryActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  placeDetailAction: {
    flex: 1,
    flexBasis: 136,
    minWidth: 0,
    minHeight: 76,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  placeDetailRouteAction: {
    backgroundColor: semanticTones.route.solid,
  },
  placeDetailSaveAction: {
    backgroundColor: semanticTones.maybe.solid,
  },
  placeDetailAddAction: {
    backgroundColor: semanticTones.primary.solid,
  },
  placeDetailRemoveAction: {
    backgroundColor: semanticTones.danger.solid,
  },
  placeDetailActionText: {
    color: colors.textInverse,
    ...typography.label,
    textAlign: 'center',
  },
  placeDetailActionTextDark: {
    color: colors.textInverse,
  },
  placeDetailSecondaryActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  shareOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  shareOverlayScroll: {
    flex: 1,
    backgroundColor: colors.overlay,
  },
  shareOverlayContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
  },
  shareModalShell: {
    width: '100%',
    maxWidth: 420,
    gap: 10,
  },
  planPreviewShell: {
    width: '100%',
    maxWidth: 520,
    gap: 10,
  },
  planPreviewCard: {
    width: '100%',
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
    gap: 10,
  },
  planPreviewTitle: {
    color: colors.textPrimary,
    fontSize: 24,
    lineHeight: 29,
    fontWeight: '900',
  },
  planPreviewMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  planPreviewMeta: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '900',
  },
  planPreviewMetaPrimary: {
    flex: 1,
    minWidth: 0,
  },
  planPreviewMetaCount: {
    flexShrink: 0,
  },
  planPreviewStopList: {
    gap: 8,
  },
  planPreviewStopRow: {
    minHeight: controls.minimumTouchTarget,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  planPreviewStopIndex: {
    width: 28,
    height: 28,
    borderRadius: radii.lg,
    color: colors.textInverse,
    textAlign: 'center',
    lineHeight: 28,
    fontSize: 13,
    fontWeight: '900',
  },
  planPreviewStopTime: {
    color: colors.teal,
    fontSize: 13,
    fontWeight: '900',
  },
  planPreviewStopContent: {
    flex: 1,
    minWidth: 0,
    gap: spacing.micro,
  },
  planPreviewStopMetadata: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.xs,
  },
  planPreviewTravelBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.micro,
  },
  planPreviewTravelText: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '900',
    textAlign: 'center',
  },
  planPreviewStopName: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '900',
  },
  shareCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    padding: 18,
  },
  shareControlPanel: {
    width: '100%',
    maxWidth: 420,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
  },
  quickShareCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
  },
  quickShareTitle: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: '900',
  },
  quickSharePlace: {
    color: colors.coral,
    fontSize: 16,
    fontWeight: '900',
    marginTop: 6,
    marginBottom: 14,
  },
  peopleGroupsModalSubtitle: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '800',
    marginTop: 6,
    marginBottom: 14,
  },
  peopleGroupsComingSoonBox: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceRaised,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 14,
  },
  peopleGroupsComingSoonTitle: {
    color: colors.textPrimary,
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '900',
  },
  peopleGroupsComingSoonText: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '800',
  },
  quickShareHint: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  quickShareUserList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  quickShareUserButton: {
    minHeight: controls.minimumTouchTarget,
    borderRadius: radii.md,
    backgroundColor: colors.tealSoft,
    borderWidth: 1,
    borderColor: colors.teal,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  quickShareUserButtonSelected: {
    backgroundColor: colors.coralSoft,
    borderColor: colors.coral,
  },
  quickShareUserText: {
    color: colors.textPrimary,
    fontWeight: '900',
  },
  routeOptionHint: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '800',
    marginBottom: 12,
  },
  routeOptionList: {
    gap: 10,
    marginBottom: 14,
  },
  routeOptionButton: {
    minHeight: 48,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.teal,
    backgroundColor: colors.tealSoft,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  routeOptionButtonText: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '900',
    flexShrink: 1,
  },
  shareHeader: {
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: 12,
    marginBottom: 14,
  },
  shareBrand: {
    color: colors.textPrimary,
    fontSize: 31,
    fontWeight: '900',
  },
  shareTagline: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '900',
    marginTop: 3,
  },
  shareTitle: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: '900',
    marginBottom: 10,
  },
  shareMetaLine: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '900',
    marginTop: -4,
    marginBottom: 10,
  },
  shareLeaveTime: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '900',
    backgroundColor: colors.amberSoft,
    borderWidth: 1,
    borderColor: colors.amber,
    borderRadius: radii.md,
    paddingHorizontal: 10,
    paddingVertical: 9,
    marginBottom: 12,
  },
  shareStop: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  shareStopNumber: {
    width: 28,
    height: 28,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareStopNumberFood: {
    backgroundColor: semanticTones.food.solid,
  },
  shareStopNumberActivity: {
    backgroundColor: semanticTones.activity.solid,
  },
  shareStopNumberText: {
    color: colors.textInverse,
    fontWeight: '900',
  },
  shareStopBody: {
    flex: 1,
  },
  shareStopType: {
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  shareStopTypeFood: {
    color: semanticTones.food.accent,
  },
  shareStopTypeActivity: {
    color: semanticTones.activity.accent,
  },
  shareStopName: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '900',
    marginTop: 2,
  },
  shareStopTime: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  shareLockedStopList: {
    gap: 6,
    marginBottom: 14,
  },
  shareLockedStopRow: {
    minHeight: controls.minimumTouchTarget,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 8,
    paddingVertical: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  shareLockedStopIndex: {
    width: 24,
    height: 24,
    borderRadius: radii.lg,
    color: colors.textInverse,
    textAlign: 'center',
    lineHeight: 24,
    fontSize: 12,
    fontWeight: '900',
  },
  shareLockedStopTime: {
    width: 68,
    color: colors.teal,
    fontSize: 12,
    fontWeight: '900',
  },
  shareLockedTravelBlock: {
    width: 42,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
  },
  shareLockedTravelText: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '900',
    textAlign: 'center',
  },
  shareLockedStopName: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '900',
  },
  shareFooter: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '800',
    marginTop: 4,
    marginBottom: 14,
  },
  shareActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 4,
  },
  cardTitle: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 19,
    fontWeight: '900',
  },
  cardTitleSelected: {
    color: colors.textPrimary,
  },
  cardSubtitle: {
    color: colors.teal,
    fontWeight: '700',
    marginTop: 5,
  },
  cardDistance: {
    color: colors.textSecondary,
    marginTop: 6,
    fontSize: 12,
    fontWeight: '900',
  },
  address: {
    color: colors.textSecondary,
    marginTop: 7,
  },
  hoursDetail: {
    color: colors.textSecondary,
    marginTop: 8,
    fontWeight: '700',
    lineHeight: 18,
  },
  hours: {
    color: colors.textSecondary,
    marginTop: 7,
    fontWeight: '800',
  },
  open: {
    color: colors.green,
  },
  closed: {
    color: colors.red,
  },
  utilityBox: {
    marginTop: 4,
    marginBottom: 18,
  },
  muted: {
    color: colors.textSecondary,
    marginBottom: 8,
  },
  filterSpacer: {
    height: 8,
  },
});
