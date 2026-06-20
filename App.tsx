import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  GestureResponderEvent,
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
  useColorScheme,
  View,
} from 'react-native';
import * as Location from 'expo-location';
import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
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

type PlanSlot = 'food' | 'activity';
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
type DateWindowId = 'today' | 'tomorrow' | 'next3' | 'weekend' | 'nextWeekend' | 'custom';
type PlanStatus = 'draft' | 'locked';
type SavedPlanTimeSchema = 'clock-arrivals-v1';
type CustomDateRange = {
  start: string;
  end: string;
};

type LatLon = {
  latitude: number;
  longitude: number;
  label?: string;
  ts?: number;
};

type CityState = {
  city: string;
  state?: string;
};

type PlaceCard = {
  id: string;
  title: string;
  subtitle: string;
  kind?: 'place' | 'event';
  address?: string;
  rating?: number;
  ratingCount?: number;
  priceLevel?: string;
  isOpen?: boolean | null;
  hoursText?: string;
  eventDateText?: string;
  eventStartMs?: number;
  eventUrl?: string;
  source?: string;
  todayHours?: string;
  weeklyHours?: string[];
  mapsUri?: string;
  lat?: number;
  lng?: number;
  types?: string[];
};

type ItineraryStop = {
  key: string;
  slot: PlanSlot;
  item: PlaceCard | string;
  travelMode?: StopTravelMode;
  featureOptions?: string[];
  selectedFeatures?: string[];
  featuresExpanded?: boolean;
};

type ConfirmedPlan = {
  stops: ItineraryStop[];
  title?: string;
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
  timeWindow?: string;
  routeOriginLabel?: string;
  routeStartLocation?: LatLon;
  searchLocation?: LatLon;
  searchLocationLabel?: string;
  lockedArrivalTimes?: Record<string, StopTime | undefined>;
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
  timeWindow?: string;
  routeOriginLabel?: string;
  routeStartLocation?: LatLon;
  searchLocation?: LatLon;
  searchLocationLabel?: string;
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
const STORAGE_SEARCH_CACHE = 'thingsNearbyGooglePlacesSearchCacheV2';
const STORAGE_TEXT_SEARCH_CACHE = 'thingsNearbyGooglePlacesTextSearchCacheV1';
const STORAGE_ZIP_CACHE = 'thingsNearbyZipCacheV1';
const STORAGE_WEBSITE_FEATURE_CACHE = 'thingsNearbyWebsiteFeatureCacheV1';
const STORAGE_TESTER_USER = 'nomNomGoSelectedTesterV1';
const STORAGE_USAGE_METER = 'nomNomGoUsageMeterV1';
const STORAGE_SAVED_PLANS = 'nomNomGoSavedPlansV1';
const STORAGE_PLANNING_SESSIONS = 'nomNomGoPlanningSessionsV1';
const STORAGE_ACTIVE_PLANNING_SESSION = 'nomNomGoActivePlanningSessionV1';
const EVENT_PROVIDER_CACHE_VERSION = 'ticketmaster-v1';
const LOCATION_TTL_MS = 10 * 60 * 1000;
const SEARCH_CACHE_TTL_MS = 15 * 60 * 1000;
const TEXT_SEARCH_CACHE_TTL_MS = 30 * 60 * 1000;
const EVENT_SEARCH_CACHE_TTL_MS = 60 * 60 * 1000;
const ZIP_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const WEBSITE_FEATURE_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const DEFAULT_RADIUS_METERS = 8047;
const CLOSE_BY_RADIUS_METERS = 3219;
const EXPANDED_FOOD_RADIUS_METERS = 40234;
const MIN_FOOD_RESULTS_BEFORE_EXPAND = 10;
const DEFAULT_ACTIVITY_RADIUS_METERS = 16093;
const TICKETMASTER_EVENT_RADIUS_MILES = 35;
const PAIRING_RADIUS_METERS = 11265;
const FAVORITE_SUGGESTION_RADIUS_METERS = DEFAULT_RADIUS_METERS;
const VENUE_FEATURE_RADIUS_METERS = 805;
const WALKING_DISTANCE_METERS = 805;
const PAGE_SIZE = 8;
const SUGGESTED_PAIRING_PREVIEW_COUNT = 3;
const FACTORY_EXPERIENCE_URL = 'https://factoryatfranklin.com/experience/';
const DEV_SHARE_USERS = ['Alex', 'Jordan', 'Taylor', 'Morgan'];
const TEST_USERS = ['BDM', ...DEV_SHARE_USERS];
const GROUP_SESSION_ENABLED = false;
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
const ACTIVITIES = ['Any', 'Events', 'Movies', 'Bowling', 'Arcade', 'Park', 'Shopping', 'Museum', 'Dessert', 'Coffee', 'Tesla Supercharger', 'EV Charger'];
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

const DEFAULT_FOOD_TYPES = ['restaurant', 'cafe', 'bakery', 'bar', 'meal_takeaway'];
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
  'places.regularOpeningHours',
  'places.googleMapsUri',
  'places.priceLevel',
].join(',');

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

function isBadActivityResult(card: PlaceCard) {
  const blob = [card.title, card.subtitle, card.address, ...(card.types || [])].join(' ').toLowerCase();
  return BLOCKED_ACTIVITY_TERMS.some((term) => blob.includes(term));
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
  const openNow = place?.regularOpeningHours?.openNow;
  const weeklyHours = place?.regularOpeningHours?.weekdayDescriptions || [];
  const todayHours = todayHoursText(weeklyHours);
  const hoursText =
    typeof openNow === 'boolean' ? (openNow ? 'Open now' : 'Closed now') : undefined;

  return {
    id: place?.id || place?.name || `${title}-${place?.formattedAddress || ''}`,
    title,
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
    isOpen: typeof openNow === 'boolean' ? openNow : null,
    hoursText,
    todayHours,
    weeklyHours,
    mapsUri: place?.googleMapsUri,
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

  return {
    id: `ticketmaster-${event?.id || `${title}-${eventDateText}`}`,
    title,
    kind: 'event',
    subtitle: [venueName || [city, state].filter(Boolean).join(', '), 'Ticketmaster'].filter(Boolean).join(' - '),
    address: address || undefined,
    isOpen: null,
    hoursText: eventDateText,
    eventDateText,
    eventStartMs: Number.isFinite(eventStartMs) ? eventStartMs : undefined,
    eventUrl: typeof event?.url === 'string' ? event.url : undefined,
    source: 'Ticketmaster',
    mapsUri: venueName ? mapsSearchUrl(`${venueName} ${address || ''}`.trim()) : mapsSearchUrl(title),
    lat: Number.isFinite(lat) ? lat : undefined,
    lng: Number.isFinite(lng) ? lng : undefined,
    types: ['event', 'ticketmaster', event?.classifications?.[0]?.segment?.name, event?.classifications?.[0]?.genre?.name].filter(Boolean),
  };
}

function todayHoursText(weeklyHours: string[]) {
  if (!weeklyHours.length) return undefined;
  const jsDay = new Date().getDay();
  const googleDayIndex = jsDay === 0 ? 6 : jsDay - 1;
  return weeklyHours[googleDayIndex] || weeklyHours[0];
}

function cardToName(card?: PlaceCard | string) {
  if (!card) return undefined;
  return typeof card === 'string' ? card : card.title;
}

function cardToId(card: PlaceCard | string) {
  return typeof card === 'string' ? card : card.id;
}

function makeStopKey(slot: PlanSlot, item: PlaceCard | string) {
  return `${slot}-${cardToId(item)}-${Date.now()}`;
}

function planItems(plan: ConfirmedPlan, slot: PlanSlot) {
  return plan.stops.filter((stop) => stop.slot === slot).map((stop) => stop.item);
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

function cardToRouteHandoffStop(card: PlaceCard | string): RouteHandoffStop | undefined {
  const name = cardToName(card)?.trim() || '';
  if (!name) return undefined;
  if (typeof card !== 'string' && typeof card.lat === 'number' && typeof card.lng === 'number') {
    return { name, latitude: card.lat, longitude: card.lng };
  }
  return { name };
}

function planToRouteHandoffPlan(plan: ConfirmedPlan, origin = 'Current Location'): RouteHandoffPlan {
  return {
    title: plan.title,
    origin,
    stops: plan.stops
      .map((stop) => cardToRouteHandoffStop(stop.item))
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

function activityCardScore(
  card: PlaceCard,
  center: LatLon,
  memory: LocalMemory,
  selectedMoods: string[],
  selectedActivities: string[],
  eventsFocused: boolean,
) {
  let score = scoreCard(card, memory, selectedMoods) + distanceScore(center, card);
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
) {
  const cuisineStrength = foodCuisineMatchStrength(card, selectedFoods);
  const hasCuisineFilter = cuisineSelections(selectedFoods).length > 0;
  const dietaryStrength = foodDietaryMatchStrength(card, selectedDietary);
  const hasDietaryFilter = dietarySelections(selectedDietary).length > 0;
  let score = scoreCard(card, memory, selectedMoods) + distanceScore(center, card);

  if (hasCuisineFilter) {
    score += cuisineStrength * 26;
    if (isLikelyFastFood(card) && cuisineStrength <= 1) score -= 50;
    else if (isLikelyFastFood(card) && cuisineStrength < 5) score -= 18;
  }

  if (hasDietaryFilter) score += dietaryStrength * 20;

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
  const types = typeof item === 'string' ? [] : item.types || [];
  const title = (cardToName(item) || '').toLowerCase();
  const typeText = types.join(' ').toLowerCase();

  if (stop.slot === 'food') {
    if (typeText.includes('cafe') || typeText.includes('coffee') || typeText.includes('bakery') || typeText.includes('dessert')) return 35;
    return 75;
  }

  if (typeText.includes('movie_theater') || title.includes('movie') || title.includes('theater')) return 150;
  if (typeText.includes('bowling') || typeText.includes('amusement') || title.includes('arcade')) return 90;
  if (typeText.includes('shopping') || typeText.includes('museum') || typeText.includes('park')) return 75;
  if (typeText.includes('cafe') || typeText.includes('coffee') || typeText.includes('bakery') || typeText.includes('dessert')) return 35;
  return 90;
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

const DIFFERANCE_LOGIN_URL = 'https://differancelabs.com/login';
const LAUNCH_TOKEN_PARAM = 'dl_launch_token';
const LIGHT_WEB_BACKGROUND = '#fff7ed';
const DARK_WEB_BACKGROUND = '#071827';

type AlphaGateState = 'checking' | 'allowed' | 'locked';

function isLocalWebHost(hostname: string) {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0' || hostname === '::1';
}

function shouldApplyAlphaGate() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return false;
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

function openDifferanceLogin() {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.location.assign(DIFFERANCE_LOGIN_URL);
    return;
  }
  void Linking.openURL(DIFFERANCE_LOGIN_URL);
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
  const colorScheme = useColorScheme();
  const isLightMode = colorScheme === 'light';
  const isDarkMode = colorScheme === 'dark';
  useWebDocumentSurface(isDarkMode ? DARK_WEB_BACKGROUND : LIGHT_WEB_BACKGROUND);
  const [gateState, setGateState] = useState<AlphaGateState>(() => (shouldApplyAlphaGate() ? 'checking' : 'allowed'));

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
        if (active) setGateState(response.ok ? 'allowed' : 'locked');
      } catch {
        if (active) setGateState('locked');
      }
    }

    void checkAccess();

    return () => {
      active = false;
    };
  }, []);

  if (gateState === 'allowed') return <>{children}</>;

  return (
    <SafeAreaView style={[styles.safeArea, isLightMode && styles.lightScreen, isDarkMode && styles.darkScreen]} edges={['top', 'left', 'right']}>
      <View style={styles.alphaGateShell}>
        <View style={[styles.authCard, Platform.OS === 'web' && styles.webAuthCard, isDarkMode && styles.darkPanel]}>
          {gateState === 'checking' ? (
            <View style={styles.authCentered}>
              <ActivityIndicator color="#f23b35" />
              <Text style={[styles.authHint, isDarkMode && styles.darkMutedText]}>Checking NomNomGo alpha access</Text>
            </View>
          ) : (
            <>
              <Text style={[styles.authTitle, isDarkMode && styles.darkText]}>NomNomGo is currently in private alpha.</Text>
              <Text style={[styles.authCopy, isDarkMode && styles.darkMutedText]}>
                Launch NomNomGo from Differance Labs to continue.
              </Text>
              <Button label="Sign in with Differance Labs" onPress={openDifferanceLogin} primary />
            </>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

function NomNomGoApp() {
  const colorScheme = useColorScheme();
  const scrollRef = useRef<ScrollView | null>(null);
  const manualSearchRef = useRef<TextInput | null>(null);
  const resultsYRef = useRef(0);
  const planBoxYRef = useRef(0);
  const savedPlansYRef = useRef(0);
  const timelineYRef = useRef(0);
  const stopLayoutYRef = useRef<Record<string, number>>({});
  const searchRequestIdRef = useRef(0);
  const isLightMode = colorScheme === 'light';
  const isDarkMode = colorScheme === 'dark';
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
  const [logs, setLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [location, setLocation] = useState<LatLon | null>(null);
  const [searchLocation, setSearchLocation] = useState<LatLon | null>(null);
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
  const [draftArrivalTime, setDraftArrivalTime] = useState<StopTime>({ hours: 0, minutes: 0 });
  const [draftTime, setDraftTime] = useState<StopTime>({ hours: 0, minutes: 0 });
  const [arrivalDraftDirty, setArrivalDraftDirty] = useState(false);
  const [durationDraftDirty, setDurationDraftDirty] = useState(false);
  const [pendingInsertIndex, setPendingInsertIndex] = useState<number | null>(null);
  const [selectedStopKey, setSelectedStopKey] = useState<string | null>(null);
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
  const [routeOptionsOpen, setRouteOptionsOpen] = useState(false);
  const [savedPlans, setSavedPlans] = useState<SavedPlan[]>([]);
  const savedPlansRef = useRef<SavedPlan[]>([]);
  const [savedPlansOpen, setSavedPlansOpen] = useState(false);
  const [homeOpen, setHomeOpen] = useState(true);
  const [savedPlansLandingOpen, setSavedPlansLandingOpen] = useState(false);
  const [planSetupOpen, setPlanSetupOpen] = useState(false);
  const [planSetupTiming, setPlanSetupTiming] = useState<'now' | 'later'>('now');
  const [planSetupName, setPlanSetupName] = useState('');
  const [planSetupDateWindow, setPlanSetupDateWindow] = useState<DateWindowId>('today');
  const [planSetupCustomDateStartInput, setPlanSetupCustomDateStartInput] = useState(formatDateInput(new Date()));
  const [planSetupCustomDateEndInput, setPlanSetupCustomDateEndInput] = useState(formatDateInput(addLocalDays(new Date(), 6)));
  const [planSetupTime, setPlanSetupTime] = useState('Now');
  const [planSetupWhere, setPlanSetupWhere] = useState('');
  const [planSetupStartingLocation, setPlanSetupStartingLocation] = useState('');
  const [planSetupSubmitting, setPlanSetupSubmitting] = useState(false);
  const [suggestedPairingsOpen, setSuggestedPairingsOpen] = useState(true);
  const [suggestedPairingsExpanded, setSuggestedPairingsExpanded] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [accountSettingsOpen, setAccountSettingsOpen] = useState(false);
  const [authLoaded, setAuthLoaded] = useState(false);
  const [testerUser, setTesterUser] = useState<TesterUser | null>(null);
  const [testerAuthenticated, setTesterAuthenticated] = useState(false);
  const [usageMeter, setUsageMeter] = useState<UsageMeter>(emptyUsageMeter());
  const [planningSessions, setPlanningSessions] = useState<PlanningSession[]>([]);
  const [activePlanningSessionId, setActivePlanningSessionId] = useState<string | null>(null);
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
  const foodItems = planItems(plan, 'food');
  const activityItems = planItems(plan, 'activity');
  const hasFood = foodItems.length > 0;
  const hasActivity = activityItems.length > 0;
  const activeFood = hasFood;
  const activeActivity = hasActivity;
  const activeStopCount = plan.stops.length;
  const hasAnyActiveStop = activeFood || activeActivity;
  const titleForResults = resultMode === 'food' ? 'Food places' : activeFood ? 'Activities near your food' : 'Activity options';
  const selectedCards = resultMode === 'food' ? foodItems : activityItems;
  const dateWindowOptions = useMemo(() => DATE_WINDOW_IDS.map((id) => ({ id, label: dateWindowLabel(id, new Date(), customDateRange) })), [customDateRange]);
  const setupDateWindowOptions = useMemo(() => DATE_WINDOW_IDS.map((id) => ({
    id,
    label: id === 'custom' ? 'Choose dates' : dateWindowLabel(id, new Date(), null),
  })), []);
  const selectedDateWindowText = dateWindowLabel(selectedDateWindow, new Date(), customDateRange);
  const currentTesterName = testerUser?.name || 'Tester';
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
  const activePlanTimelineBaseMs = (() => {
    const parsedWindow = activePlanTimeWindow ? parsePlanningTimeWindow(activePlanTimeWindow) : undefined;
    if (parsedWindow) return localDateClockMs(activePlanDateRange.start, parsedWindow.start);
    const now = new Date();
    return localDateClockMs(activePlanDateRange.start, now.getHours() * 60 + now.getMinutes());
  })();
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

  const durationForStop = (stop: ItineraryStop) =>
    (planTimes[stop.key]?.hours || 0) * 60 + (planTimes[stop.key]?.minutes || 0) || defaultStopDurationMinutes(stop);

  const effectiveTravelModeForStop = (stop: ItineraryStop, index: number): StopTravelMode => {
    if (stop.travelMode) return stop.travelMode;
    return isWalkableAfterTeslaStop(plan.stops[index - 1], stop) ? 'walk' : 'car';
  };

  const travelOriginForStop = (index: number) =>
    index > 0 ? stopCoords(plan.stops[index - 1].item) : routeStartLocation;

  const travelMinutesForStop = (stop: ItineraryStop, index: number) =>
    estimateTravelMinutes(travelOriginForStop(index), stop.item, effectiveTravelModeForStop(stop, index));

  const arrivalOverrideForStop = (stop: ItineraryStop) => {
    const override = arrivalTimes[stop.key];
    return override ? minutesUntilClockTime(override, activePlanTimelineBaseMs) : undefined;
  };

  const itineraryArrivalMinutes = (targetIndex: number) => {
    let elapsed = 0;
    let from = routeStartLocation;
    let previousArrival: number | undefined;
    let previousCoords: LatLon | undefined;

    for (let index = 0; index <= targetIndex; index += 1) {
      const stop = plan.stops[index];
      const travelMode = effectiveTravelModeForStop(stop, index);
      const walkableAfterTesla = travelMode === 'walk' && isWalkableAfterTeslaStop(plan.stops[index - 1], stop);
      const estimatedArrival = walkableAfterTesla && typeof previousArrival === 'number'
        ? previousArrival
        : elapsed + estimateTravelMinutes(from, stop.item, travelMode);
      const arrival = arrivalOverrideForStop(stop) ?? estimatedArrival;
      if (index === targetIndex) return arrival;
      elapsed = walkableAfterTesla
        ? Math.max(elapsed, arrival + durationForStop(stop))
        : arrival + durationForStop(stop);
      previousArrival = arrival;
      const currentCoords = stopCoords(stop.item);
      from = walkableAfterTesla && previousCoords ? previousCoords : currentCoords;
      previousCoords = currentCoords;
    }

    return elapsed;
  };

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
  const displayedArrivalTimeForStop = (stop: ItineraryStop, index: number) =>
    arrivalTimes[stop.key] ||
    (plan.status === 'locked' ? plan.lockedArrivalTimes?.[stop.key] : undefined) ||
    clockTimeFromOffsetMinutes(itineraryArrivalMinutes(index), activePlanTimelineBaseMs);
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
  const activePlanDateTimeLabel = firstStop
    ? `${activePlanDateLabel} | First stop ${formatClockTime(displayedArrivalTimeForStop(firstStop, 0))}`
    : activePlanDateLabel;
  const sharePlanText = () => {
    const lines = [plan.title || 'NomNomGo plan'];
    if (plan.sourceUrl) lines.push('', plan.sourceUrl);
    plan.stops.forEach((stop) => {
      const name = cardToName(stop.item) || 'Stop';
      const url = typeof stop.item !== 'string'
        ? stop.item.mapsUri || mapsSearchUrl(stop.item.title, stop.item)
        : mapsSearchUrl(stop.item, activeSearchLocation || location);
      lines.push('', name, url);
    });
    lines.push('', 'Shared from NomNomGo');
    return lines.join('\n');
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

  const notifyGooglePlacesMissing = (logLine: string, message = 'Google Places key missing. Import a route or add stops manually.') => {
    showToast(message);
    addLog(logLine);
  };

  const resetResultsUntilSearch = () => {
    searchRequestIdRef.current += 1;
    setHasInitiatedSearch(false);
    setCards([]);
    setVisibleCount(PAGE_SIZE);
    setSearchNotice('');
    setLoading(false);
  };

  const saveTesterUser = async (next: TesterUser | null) => {
    setTesterUser(next);
    if (next) {
      await AsyncStorage.setItem(STORAGE_TESTER_USER, JSON.stringify(next));
    } else {
      await AsyncStorage.removeItem(STORAGE_TESTER_USER);
    }
  };

  const saveUsageMeter = async (next: UsageMeter) => {
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

  const recordPlacesUsage = async (kind: 'nearby' | 'text') => {
    const current = normalizeUsageMeter(usageMeter);
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

  const signOutTester = () => {
    setTesterAuthenticated(false);
    addLog('Tester signed out');
  };

  const scrollToResults = () => {
    [90, 280, 650].forEach((delay) => {
      setTimeout(() => scrollRef.current?.scrollTo({ y: Math.max(resultsYRef.current - 8, 0), animated: true }), delay);
    });
  };

  const scrollToTop = () => {
    [70, 220].forEach((delay) => {
      setTimeout(() => scrollRef.current?.scrollTo({ y: 0, animated: true }), delay);
    });
  };

  const scrollToPlan = () => {
    [90, 280, 650].forEach((delay) => {
      setTimeout(() => scrollRef.current?.scrollTo({ y: Math.max(planBoxYRef.current - 8, 0), animated: true }), delay);
    });
  };

  const scrollToSavedPlans = () => {
    [90, 280, 650].forEach((delay) => {
      setTimeout(() => scrollRef.current?.scrollTo({ y: Math.max(savedPlansYRef.current - 8, 0), animated: true }), delay);
    });
  };

  const scrollToPlanStop = (key: string) => {
    [90, 280, 650].forEach((delay) => {
      setTimeout(() => {
        const stopY = stopLayoutYRef.current[key];
        const targetY = typeof stopY === 'number'
          ? planBoxYRef.current + timelineYRef.current + stopY
          : planBoxYRef.current;
        scrollRef.current?.scrollTo({ y: Math.max(targetY - 8, 0), animated: true });
      }, delay);
    });
  };

  const closeTransientSurfaces = () => {
    setAccountMenuOpen(false);
    setAccountSettingsOpen(false);
    setSharePreviewOpen(false);
    setPlanPreviewOpen(false);
    setQuickShareTarget(null);
    setRouteOptionsOpen(false);
    setLocationOverrideOpen(false);
    setSearchLocationOverrideOpen(false);
    setCustomDateOpen(false);
    setRouteImportOpen(false);
  };

  const openHome = () => {
    closeTransientSurfaces();
    setHomeOpen(true);
    setSavedPlansLandingOpen(false);
    setPlanSetupOpen(false);
    setSavedPlansOpen(false);
    setPlanSettingsOpen(false);
    setPreferencesOpen(false);
    setAdvancedPreferencesOpen(false);
    scrollToTop();
    addLog('Home opened');
  };

  const openPlanSetup = (timing: 'now' | 'later') => {
    closeTransientSurfaces();
    const nextDateWindow: DateWindowId = timing === 'now' ? 'today' : 'tomorrow';
    const nextTime = timing === 'now' ? 'Now' : 'Dinner';
    const defaultCustomStart = formatDateInput(new Date());
    const defaultCustomEnd = formatDateInput(addLocalDays(new Date(), 6));
    setPlanSetupTiming(timing);
    setPlanSetupName('');
    setPlanSetupDateWindow(nextDateWindow);
    setPlanSetupCustomDateStartInput(defaultCustomStart);
    setPlanSetupCustomDateEndInput(defaultCustomEnd);
    setPlanSetupTime(nextTime);
    setPlanSetupWhere(searchLocationOverride.trim());
    setPlanSetupStartingLocation(routeOriginOverride.trim());
    setPlanSetupOpen(true);
    setHomeOpen(true);
    setSavedPlansLandingOpen(false);
    setSavedPlansOpen(false);
    scrollToTop();
    addLog(`Home action: ${timing}`);
  };

  const submitPlanSetup = async () => {
    if (planSetupSubmitting) return;

    const nextName = planSetupName.trim();
    const whereInput = planSetupWhere.trim();
    const startingInput = planSetupStartingLocation.trim();
    const nextTimeWindow = planSetupTime === 'Now' ? undefined : defaultTimeWindowForPreference(planSetupTime);
    let nextCustomDateRange: CustomDateRange | null = null;

    if (planSetupDateWindow === 'custom') {
      const start = parseDateInput(planSetupCustomDateStartInput);
      const end = parseDateInput(planSetupCustomDateEndInput);
      if (!start || !end) {
        Alert.alert('Check dates', 'Use dates like 2026-06-12.');
        return;
      }
      if (end < start) {
        Alert.alert('Check dates', 'End date must be the same as or after the start date.');
        return;
      }
      nextCustomDateRange = {
        start: formatDateInput(start),
        end: formatDateInput(end),
      };
    }

    const nextDateRange = dateRangeKeysForWindow(planSetupDateWindow, nextCustomDateRange);
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
      selectedDateWindowRef.current = planSetupDateWindow;
      customDateRangeRef.current = nextCustomDateRange;
      setSelectedDateWindow(planSetupDateWindow);
      setCustomDateRange(nextCustomDateRange);
      if (nextCustomDateRange) {
        setCustomDateStartInput(nextCustomDateRange.start);
        setCustomDateEndInput(nextCustomDateRange.end);
      }
      setSelectedTime(planSetupTime);
      setResultMode('food');
      setPlan({
        ...EMPTY_PLAN,
        title: nextName || undefined,
        status: 'draft',
        dateWindow: planSetupDateWindow,
        customDateRange: nextCustomDateRange,
        planDateStart: nextDateRange.start,
        planDateEnd: nextDateRange.end,
        timeWindow: nextTimeWindow,
        routeOriginLabel: startingInput || 'Current location',
        routeStartLocation: startingInput ? undefined : location || undefined,
        searchLocation: undefined,
        searchLocationLabel: whereInput || startingInput || 'Current location',
      });
      setPlanTimes({});
      setArrivalTimes({});
      setPendingInsertIndex(null);
      setSelectedStopKey(null);
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
    } catch (err) {
      addLog(`Plan setup failed: ${compactError(err)}`);
      Alert.alert('Plan setup failed', compactError(err));
    } finally {
      setPlanSetupSubmitting(false);
    }
  };

  const openSavedPlansHomeAction = () => {
    closeTransientSurfaces();
    setPlanSetupOpen(false);
    setHomeOpen(false);
    setSavedPlansLandingOpen(true);
    setSavedPlansOpen(true);
    setPreferencesOpen(false);
    setAdvancedPreferencesOpen(false);
    setPlanSettingsOpen(false);
    scrollToSavedPlans();
    addLog('Home action: saved plans');
  };

  const markStopSelected = (key?: string) => {
    if (key) setSelectedStopKey(key);
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
    ])
      .then(([rawUser, rawUsage, rawSavedPlans, rawPlanningSessions, rawActivePlanningSession]) => {
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
          savedPlansRef.current = parsedSavedPlans;
          setSavedPlans(parsedSavedPlans);
        }
        if (rawPlanningSessions) setPlanningSessions(JSON.parse(rawPlanningSessions) as PlanningSession[]);
        if (rawActivePlanningSession) setActivePlanningSessionId(JSON.parse(rawActivePlanningSession) as string);
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
            'X-Goog-FieldMask': FIELD_MASK,
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
      const results = await withTimeout(Location.geocodeAsync(query), 12000, `Location ${value}`);
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
    const permission = await Location.requestForegroundPermissionsAsync();
    addLog(`GPS permission: ${permission.status}`);
    if (permission.status !== 'granted') throw new Error('Location permission was not granted.');

    try {
      addLog('Getting current GPS location');
      const current = await withTimeout(
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        15000,
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
      const lastKnown = await withTimeout(Location.getLastKnownPositionAsync(), 5000, 'Last known location');
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

  const getSearchLocation = async () => {
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

  const searchNearbyType = async (type: string, center: LatLon, radiusMeters: number): Promise<PlaceCard[]> => {
    if (!GOOGLE_API_KEY) throw new Error('Google Places API key is not loaded.');

    addLog(`Google Places search: ${type}`);
    await recordPlacesUsage('nearby');
    const response = await withTimeout(
      fetch('https://places.googleapis.com/v1/places:searchNearby', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': GOOGLE_API_KEY,
          'X-Goog-FieldMask': FIELD_MASK,
        },
        body: JSON.stringify({
          includedTypes: [type],
          maxResultCount: 20,
          rankPreference: 'DISTANCE',
          locationRestriction: {
            circle: {
              center: { latitude: center.latitude, longitude: center.longitude },
              radius: radiusMeters,
            },
          },
        }),
      }),
      12000,
      `Google Places ${type}`,
    );

    addLog(`Google Places ${type} status: ${response.status}`);
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`Google Places ${type} failed: ${response.status} ${text.slice(0, 140)}`);
    }

    const json = JSON.parse(text);
    const places = Array.isArray(json?.places) ? json.places : [];
    addLog(`Google Places ${type} returned ${places.length}`);
    return places.map(toCard);
  };

  const searchPlaceByText = async (
    query: string,
    slot: PlanSlot,
    center?: LatLon | null,
    options?: { rawFoodQuery?: boolean; maxResults?: number; radiusMeters?: number },
  ): Promise<PlaceCard[]> => {
    if (!GOOGLE_API_KEY) throw new Error('Google Places API key is not loaded.');

    const cacheKey = textSearchCacheKey(`${options?.rawFoodQuery ? 'raw' : 'default'}:${query}`, slot, center);
    const cachedCards = await readCachedSearch(STORAGE_TEXT_SEARCH_CACHE, cacheKey, TEXT_SEARCH_CACHE_TTL_MS, 'Text search');
    if (cachedCards) return cachedCards;

    addLog(`Google Places text search: ${query}`);
    await recordPlacesUsage('text');
    const response = await withTimeout(
      fetch('https://places.googleapis.com/v1/places:searchText', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': GOOGLE_API_KEY,
          'X-Goog-FieldMask': FIELD_MASK,
        },
        body: JSON.stringify({
          textQuery: slot === 'food' && !options?.rawFoodQuery ? `${query} restaurant` : query,
          maxResultCount: options?.maxResults || 10,
          locationBias: center
            ? {
                circle: {
                  center: { latitude: center.latitude, longitude: center.longitude },
                  radius: options?.radiusMeters || (slot === 'food' ? 50000 : DEFAULT_ACTIVITY_RADIUS_METERS),
                },
              }
            : undefined,
        }),
      }),
      12000,
      `Google Places text search ${query}`,
    );

    addLog(`Google Places text status: ${response.status}`);
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`Google Places text search failed: ${response.status} ${text.slice(0, 140)}`);
    }

    const json = JSON.parse(text);
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
    const cards: PlaceCard[] = places.map(toCard).sort((a: PlaceCard, b: PlaceCard) => scoreTextMatch(b) - scoreTextMatch(a));
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

  const searchOpenFoodByText = async (center: LatLon): Promise<PlaceCard[]> => {
    if (!GOOGLE_API_KEY) throw new Error('Google Places API key is not loaded.');

    const cacheKey = [
      'open-food-text',
      center.latitude.toFixed(4),
      center.longitude.toFixed(4),
      center.label ? normalizePlaceName(center.label) : 'unlabeled',
    ].join('|');
    const cachedCards = await readCachedSearch(STORAGE_TEXT_SEARCH_CACHE, cacheKey, TEXT_SEARCH_CACHE_TTL_MS, 'Open food text search');
    if (cachedCards) return cachedCards;

    addLog('Google Places open food text search');
    await recordPlacesUsage('text');
    const response = await withTimeout(
      fetch('https://places.googleapis.com/v1/places:searchText', {
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
          maxResultCount: 20,
          locationBias: {
            circle: {
              center: { latitude: center.latitude, longitude: center.longitude },
              radius: EXPANDED_FOOD_RADIUS_METERS,
            },
          },
        }),
      }),
      12000,
      'Google Places open food text search',
    );

    addLog(`Google Places open food text status: ${response.status}`);
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`Google Places open food text search failed: ${response.status} ${text.slice(0, 140)}`);
    }

    const json = JSON.parse(text);
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
  ): Promise<PlaceCard[]> => {
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

    for (const query of unique(queries).slice(0, 8)) {
      try {
        const results = await searchPlaceByText(query, 'food', center, {
          rawFoodQuery: true,
          maxResults: 20,
          radiusMeters: EXPANDED_FOOD_RADIUS_METERS,
        });
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
          found.set(card.id, {
            ...dietaryTaggedCard,
          });
        });
      } catch (err) {
        addLog(`Food text discovery failed: ${query} ${compactError(err)}`);
      }
    }

    const cards = Array.from(found.values())
      .filter((card) => hasKnownHours(card))
      .sort((a, b) =>
        foodCardScore(b, center, memory, selectedMoods, foodSelections, selectedDietaryPreferences) -
        foodCardScore(a, center, memory, selectedMoods, foodSelections, selectedDietaryPreferences)
      );
    addLog(`Food text discovery returned ${cards.length}`);
    return cards;
  };

  const searchLocalEventPlaces = async (center: LatLon): Promise<PlaceCard[]> => {
    if (!GOOGLE_API_KEY) return [];
    const activeDateWindow = selectedDateWindowRef.current;
    const datePhrase = dateWindowSearchPhrase(activeDateWindow, customDateRangeRef.current);
    const queries = [
      `fair rodeo festival ${datePhrase}`,
      `local events ${datePhrase}`,
      `farmers market live music festival ${datePhrase}`,
    ];
    const found = new Map<string, PlaceCard>();

    for (const query of queries) {
      try {
        const results = await searchPlaceByText(query, 'activity', center);
        results.slice(0, 4).forEach((card) => {
          if (memory.neverRecommend.includes(card.id)) return;
          found.set(`local-event-${card.id}`, {
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
        addLog(`Local event fallback failed: ${query} ${compactError(err)}`);
      }
    }

    return Array.from(found.values());
  };

  const ticketmasterDateParam = (date: Date) => date.toISOString().replace(/\.\d{3}Z$/, 'Z');

  const searchTicketmasterEvents = async (center: LatLon, radiusMiles = TICKETMASTER_EVENT_RADIUS_MILES): Promise<PlaceCard[]> => {
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
    const cached = await readCachedSearch(STORAGE_TEXT_SEARCH_CACHE, cacheKey, EVENT_SEARCH_CACHE_TTL_MS, 'Ticketmaster event search');
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
      size: '30',
    });

    addLog(`Ticketmaster event search: ${center.latitude.toFixed(4)},${center.longitude.toFixed(4)} ${radiusMiles}mi`);
    const response = await withTimeout(
      fetch(`https://app.ticketmaster.com/discovery/v2/events.json?${params.toString()}`),
      12000,
      'Ticketmaster event search',
    );
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`Ticketmaster event search failed: ${response.status} ${text.slice(0, 140)}`);
    }

    let json: any;
    try {
      json = JSON.parse(text);
    } catch {
      throw new Error('Ticketmaster event search returned malformed JSON');
    }

    const events = Array.isArray(json?._embedded?.events) ? json._embedded.events : [];
    const now = Date.now();
    const cards = events
      .map(ticketmasterEventToCard)
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
    await writeCachedSearch(STORAGE_TEXT_SEARCH_CACHE, cacheKey, cards, 20, 'Ticketmaster event search');
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
  ) => {
    const wantsEvents = slot === 'activity';
    const eventsFocused = slot === 'activity' && activitySelections.includes('Events');
    const chargerFocused = slot === 'activity' && wantsChargerActivity(activitySelections);
    const preferenceKey = slot === 'food'
      ? `${wantsNoFastFood(foodSelections) ? '|no-fast-food' : ''}${wantsCloseBy(foodSelections) ? '|close-by' : ''}${wantsOpenNow(foodSelections) ? '|open-now' : ''}${cuisineSelections(foodSelections).join(',')}|dietary:${dietarySelections(selectedDietaryPreferences).join(',')}`
      : `${nonEventActivitySelections(activitySelections).join(',')}|${wantsEvents ? `events|${EVENT_PROVIDER_CACHE_VERSION}|${selectedDateWindowRef.current}|${customDateRangeRef.current ? `${customDateRangeRef.current.start}-${customDateRangeRef.current.end}` : 'preset'}${eventsFocused ? '|focused' : ''}` : ''}`;
    const cacheKey = `${searchCacheKey(slot, center, types, radiusMeters)}${preferenceKey}`;
    const applyResultFilters = (nextCards: PlaceCard[]) => nextCards.filter((card) => {
      const isFavorite = memory.favorites.includes(card.id);
      if (!hasKnownHours(card) && !(chargerFocused && isEvCharger(card))) return false;
      if (slot === 'food' && wantsNoFastFood(foodSelections) && isLikelyFastFood(card)) return false;
      if (slot === 'food' && !isLikelyFoodPreferenceMatch(card, foodSelections)) return false;
      if (slot === 'food' && card.isOpen === false && !isFavorite) return false;
      if (slot === 'activity' && isBadActivityResult(card)) return false;
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
      !wantsCloseBy(foodSelections) &&
      radiusMeters < EXPANDED_FOOD_RADIUS_METERS &&
      count < MIN_FOOD_RESULTS_BEFORE_EXPAND;
    const searchAndFilter = async (searchRadius: number) => {
      const merged = new Map<string, PlaceCard>();
      for (const type of types) {
        try {
          const results = await searchNearbyType(type, center, searchRadius);
          results.forEach((card) => {
            if (!memory.neverRecommend.includes(card.id)) merged.set(card.id, card);
          });
        } catch (err) {
          addLog(`Google Places ${type} error: ${compactError(err)}`);
        }
      }

      return applyResultFilters(Array.from(merged.values()));
    };

    let unblockedCards = forceRefresh
      ? undefined
      : await readCachedSearch(STORAGE_SEARCH_CACHE, cacheKey, SEARCH_CACHE_TTL_MS, 'Nearby search');
    if (unblockedCards) {
      unblockedCards = applyResultFilters(unblockedCards);
      addLog(`Nearby cache after filters: ${unblockedCards.length} cards`);
    } else {
      unblockedCards = await searchAndFilter(radiusMeters);
    }

    if (slot === 'food') {
      try {
        const textFoodCards = await searchFoodByTextPreferences(center, foodSelections, selectedDietaryPreferences);
        unblockedCards = mergeCards(unblockedCards, textFoodCards);
        addLog(`Food text discovery merged: ${unblockedCards.length} cards`);
      } catch (err) {
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
            radiusMeters: DEFAULT_ACTIVITY_RADIUS_METERS,
          });
          unblockedCards = mergeCards(unblockedCards, chargerTextCards);
          addLog(`${query} text discovery merged: ${unblockedCards.length} activity cards`);
        } catch (err) {
          addLog(`${query} text discovery error: ${compactError(err)}`);
        }
      }
    }

    if (shouldExpand(unblockedCards.length)) {
      addLog(`Food results sparse (${unblockedCards.length}); expanding radius to ${Math.round(EXPANDED_FOOD_RADIUS_METERS / 1609)} miles`);
      const expandedCacheKey = `${searchCacheKey(slot, center, types, EXPANDED_FOOD_RADIUS_METERS)}${preferenceKey}|expanded`;
      const expandedCachedCards = forceRefresh
        ? undefined
        : await readCachedSearch(STORAGE_SEARCH_CACHE, expandedCacheKey, SEARCH_CACHE_TTL_MS, 'Expanded food search');
      if (expandedCachedCards) {
        unblockedCards = mergeCards(unblockedCards, expandedCachedCards);
        addLog(`Expanded cache after filters: ${unblockedCards.length} cards`);
      } else {
        const expandedCards = await searchAndFilter(EXPANDED_FOOD_RADIUS_METERS);
        unblockedCards = mergeCards(unblockedCards, expandedCards);
        await writeCachedSearch(STORAGE_SEARCH_CACHE, expandedCacheKey, expandedCards, 32, 'Expanded food search');
      }
      if (unblockedCards.length < MIN_FOOD_RESULTS_BEFORE_EXPAND) {
        try {
          const openFoodTextCards = await searchOpenFoodByText(center);
          unblockedCards = mergeCards(unblockedCards, openFoodTextCards);
          addLog(`Open food text fallback merged: ${unblockedCards.length} cards`);
        } catch (err) {
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
        const ticketmasterCards = await searchTicketmasterEvents(center);
        ticketmasterEventCount = ticketmasterCards.length;
        unblockedCards = mergeCards(unblockedCards, ticketmasterCards);
        addLog(`Ticketmaster event results merged: ${unblockedCards.length} activity cards`);
      } catch (err) {
        addLog(`Ticketmaster event search failed: ${compactError(err)}`);
      }

      if (eventsFocused && ticketmasterEventCount < 4) {
        try {
          const ticketmasterNames = new Set(
            unblockedCards
              .filter((card) => card.kind === 'event' && card.source === 'Ticketmaster')
              .map((card) => normalizePlaceName(card.title)),
          );
          const localEventCards = (await searchLocalEventPlaces(center))
            .filter((card) => !ticketmasterNames.has(normalizePlaceName(card.title)));
          unblockedCards = mergeCards(unblockedCards, localEventCards);
          addLog(`Local event fallback merged: ${unblockedCards.length} activity cards`);
        } catch (err) {
          addLog(`Local event fallback failed: ${compactError(err)}`);
        }
      }
    }

    const sortedCards = unblockedCards.sort((a, b) => {
      if (wantsEvents) {
        if (eventsFocused) {
          const sourceA = a.source === 'Ticketmaster' ? 0 : a.kind === 'event' ? 1 : 2;
          const sourceB = b.source === 'Ticketmaster' ? 0 : b.kind === 'event' ? 1 : 2;
          if (sourceA !== sourceB) return sourceA - sourceB;
          const timeA = a.eventStartMs || Number.POSITIVE_INFINITY;
          const timeB = b.eventStartMs || Number.POSITIVE_INFINITY;
          if (timeA !== timeB) return timeA - timeB;
          return distanceMeters(center, a) - distanceMeters(center, b);
        }

        return activityCardScore(b, center, memory, selectedMoods, activitySelections, eventsFocused) -
          activityCardScore(a, center, memory, selectedMoods, activitySelections, eventsFocused);
      }

      if (slot === 'food') {
        return foodCardScore(b, center, memory, selectedMoods, foodSelections, selectedDietaryPreferences) -
          foodCardScore(a, center, memory, selectedMoods, foodSelections, selectedDietaryPreferences);
      }

      return scoreCard(b, memory, selectedMoods) - scoreCard(a, memory, selectedMoods);
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
    setVisibleCount(PAGE_SIZE);
    await rememberFavoriteCardsFromResults(slot, finalCards);
    await writeCachedSearch(STORAGE_SEARCH_CACHE, cacheKey, finalCards, 32, 'Nearby search');
  };

  const searchForSlot = async (
    slot: PlanSlot,
    shouldScroll = false,
    forceRefresh = false,
    centerOverride?: LatLon,
    preferenceOverride?: SearchPreferenceOverride,
  ) => {
    const requestId = searchRequestIdRef.current + 1;
    searchRequestIdRef.current = requestId;
    const foodSelections = preferenceOverride?.foodSelections || selectedFoods;
    const activitySelections = preferenceOverride?.activitySelections || selectedActivities;
    const dietaryPreferences = preferenceOverride?.dietarySelections || selectedDietary;
    if (resultFilter === 'favorites' && !cards.length && memory.favorites.length > 0) {
      addLog('Favorites filter needs a search before saved places can be shown');
    }
    addLog(`Find button tapped: ${slot}`);
    if (!keyLoaded) {
      setResultMode(slot);
      setResultFilter('all');
      setHasInitiatedSearch(true);
      setCards([]);
      setVisibleCount(PAGE_SIZE);
      setSearchNotice('Search needs EXPO_PUBLIC_GOOGLE_PLACES_API_KEY. Import a route, or use Find a specific place to add stops manually.');
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
        const anchor = centerOverride
          ? null
          : foodItems.find((item): item is PlaceCard => typeof item !== 'string' && Boolean(item.lat && item.lng));
        if (anchor) {
          const activityRadius = activitySelections.includes('Movies') ? DEFAULT_ACTIVITY_RADIUS_METERS : PAIRING_RADIUS_METERS;
          await runPlacesSearch('activity', { latitude: anchor.lat!, longitude: anchor.lng!, label: anchor.title }, types, activityRadius, forceRefresh, foodSelections, requestId, dietaryPreferences, activitySelections);
        } else {
          await runPlacesSearch('activity', center, types, DEFAULT_ACTIVITY_RADIUS_METERS, forceRefresh, foodSelections, requestId, dietaryPreferences, activitySelections);
        }
      } else {
        const types = typesForSelection(foodSelections, FOOD_TYPE_MAP, DEFAULT_FOOD_TYPES);
        addLog(`Selected food types: ${types.join(', ')}`);
        await runPlacesSearch('food', center, types, wantsCloseBy(foodSelections) ? CLOSE_BY_RADIUS_METERS : DEFAULT_RADIUS_METERS, forceRefresh, foodSelections, requestId, dietaryPreferences, activitySelections);
      }
      if (shouldScroll) scrollToResults();
    } catch (err) {
      addLog(`Find failed: ${compactError(err)}`);
      Alert.alert('Could not search nearby', compactError(err));
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
    setPlan((prev) => prev.status !== 'locked' ? {
      ...prev,
      dateWindow: next,
      customDateRange: null,
      planDateStart: nextDateRange.start,
      planDateEnd: nextDateRange.end,
      lockedArrivalTimes: undefined,
      savedPlanId: undefined,
    } : prev);
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
    setTimeout(() => {
      void searchForSlot(resultMode, true, false);
    }, 25);
  };

  const applyCustomDateWindow = () => {
    const start = parseDateInput(customDateStartInput);
    const end = parseDateInput(customDateEndInput);
    if (!start || !end) {
      Alert.alert('Check dates', 'Use dates like 2026-06-12.');
      return;
    }
    if (end < start) {
      Alert.alert('Check dates', 'End date must be the same as or after the start date.');
      return;
    }

    const nextRange = {
      start: formatDateInput(start),
      end: formatDateInput(end),
    };
    customDateRangeRef.current = nextRange;
    setCustomDateRange(nextRange);
    setCustomDateOpen(false);
    selectedDateWindowRef.current = 'custom';
    setSelectedDateWindow('custom');
    setPlan((prev) => prev.status !== 'locked' ? {
      ...prev,
      dateWindow: 'custom',
      customDateRange: nextRange,
      planDateStart: nextRange.start,
      planDateEnd: nextRange.end,
      lockedArrivalTimes: undefined,
      savedPlanId: undefined,
    } : prev);
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
    setTimeout(() => {
      void searchForSlot(resultMode, true, false);
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
    setTimeout(() => {
      void searchForSlot(resultMode, true, false, centerOverride);
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

  const searchFromPlan = async (slot: PlanSlot) => {
    const selectedIndex = selectedStopKey ? plan.stops.findIndex((stop) => stop.key === selectedStopKey) : -1;
    const anchorIndex = selectedIndex >= 0 ? selectedIndex : plan.stops.length - 1;
    setPendingInsertIndex(anchorIndex >= 0 ? anchorIndex : null);
    setResultMode(slot);
    const preferenceOverride: SearchPreferenceOverride = slot === 'food'
      ? { foodSelections: [...DEFAULT_FOOD_SELECTIONS] }
      : { activitySelections: [...DEFAULT_ACTIVITY_SELECTIONS] };
    if (slot === 'food') {
      setSelectedFoods(preferenceOverride.foodSelections || [...DEFAULT_FOOD_SELECTIONS]);
    } else {
      setSelectedActivities(preferenceOverride.activitySelections || [...DEFAULT_ACTIVITY_SELECTIONS]);
    }
    setPreferencesOpen(false);
    scrollToResults();
    await searchForSlot(slot, true, false, anchorIndex >= 0 ? stopSearchCenter(plan.stops[anchorIndex]) : undefined, preferenceOverride);
  };

  const addStopAfter = async (slot: PlanSlot, index: number) => {
    if (isPlanLocked) return;
    markStopSelected(plan.stops[index]?.key);
    setPendingInsertIndex(index);
    setResultMode(slot);
    const preferenceOverride: SearchPreferenceOverride = slot === 'food'
      ? { foodSelections: [...DEFAULT_FOOD_SELECTIONS] }
      : { activitySelections: [...DEFAULT_ACTIVITY_SELECTIONS] };
    if (slot === 'food') {
      setSelectedFoods(preferenceOverride.foodSelections || [...DEFAULT_FOOD_SELECTIONS]);
    } else {
      setSelectedActivities(preferenceOverride.activitySelections || [...DEFAULT_ACTIVITY_SELECTIONS]);
    }
    setPreferencesOpen(false);
    scrollToResults();
    await searchForSlot(slot, true, false, stopSearchCenter(plan.stops[index]), preferenceOverride);
  };

  const openTimeEditor = (key: string, index: number) => {
    if (isPlanLocked) return;
    const stop = plan.stops.find((item) => item.key === key);
    const existingArrival = stop ? arrivalTimes[stop.key] : arrivalTimes[key];
    setTimeEditorKey(key);
    setDraftArrivalTime(existingArrival || clockTimeFromOffsetMinutes(itineraryArrivalMinutes(index), activePlanTimelineBaseMs));
    setDraftTime(planTimes[key] || stopTimeFromMinutes(stop ? defaultStopDurationMinutes(stop) : 60));
    setArrivalDraftDirty(false);
    setDurationDraftDirty(false);
  };

  const adjustDraftTime = (field: keyof StopTime, delta: number) => {
    setDurationDraftDirty(true);
    setDraftTime((prev) => {
      const total = prev.hours * 60 + prev.minutes + (field === 'hours' ? delta * 60 : delta);
      return stopTimeFromMinutes(total);
    });
  };

  const adjustDraftArrivalTime = (field: keyof StopTime, delta: number) => {
    setArrivalDraftDirty(true);
    setDraftArrivalTime((prev) => {
      const snappedCurrent = Math.round((prev.hours * 60 + prev.minutes) / 15) * 15;
      const total = snappedCurrent + (field === 'hours' ? delta * 60 : delta);
      const normalized = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
      return {
        hours: Math.floor(normalized / 60),
        minutes: normalized % 60,
      };
    });
  };

  const saveDraftTime = () => {
    if (isPlanLocked) return;
    if (!timeEditorKey) return;
    if (!arrivalDraftDirty && !durationDraftDirty) {
      setTimeEditorKey(null);
      return;
    }
    if (arrivalDraftDirty) {
      setArrivalTimes((prev) => ({ ...prev, [timeEditorKey]: draftArrivalTime }));
    }
    if (durationDraftDirty) {
      setPlanTimes((prev) => ({ ...prev, [timeEditorKey]: draftTime }));
    }
    if (arrivalDraftDirty || durationDraftDirty) {
      setPlan((prev) => ({ ...prev, savedPlanId: undefined }));
    }
    addLog(`Itinerary time set: ${arrivalDraftDirty ? `arrival ${formatClockTime(draftArrivalTime)}` : 'arrival unchanged'}, ${durationDraftDirty ? `duration ${formatStopTime(draftTime)}` : 'duration unchanged'}`);
    setTimeEditorKey(null);
  };

  const refreshFromPreferences = async () => {
    setPreferencesOpen(false);
    scrollToResults();
    await searchForSlot(resultMode, true, true);
  };

  const searchFromLocationOverride = async () => {
    const value = routeOriginOverride.trim();
    if (!value) {
      Alert.alert('Location needed', 'Enter a ZIP, address, or place first.');
      return;
    }

    addLog(`Location override tapped: ${value}`);
    beginSettingsLocationSearch();
    try {
      const next = await resolveLocationInput(value);
      if (!next) {
        setLoading(false);
        Alert.alert('Location not found', `Could not find a location for ${value}.`);
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
      const refreshCenter = activePlanningSession?.searchLocation || searchLocation || (searchLocationOverride.trim() ? undefined : next);
      searchAfterSettingsLocationChange(refreshCenter);
      addLog('Starting location saved; refreshing active results');
    } catch (err) {
      setLoading(false);
      addLog(`Location override failed: ${compactError(err)}`);
      Alert.alert('Location search failed', compactError(err));
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
      Alert.alert('Search location needed', 'Enter a ZIP, address, or place first.');
      return;
    }

    addLog(`Search location tapped: ${value}`);
    beginSettingsLocationSearch();
    try {
      const next = await resolveLocationInput(value);
      if (!next) {
        setLoading(false);
        Alert.alert('Location not found', `Could not find a location for ${value}.`);
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
      searchAfterSettingsLocationChange(next);
      addLog('Search location saved; refreshing active results');
    } catch (err) {
      setLoading(false);
      addLog(`Search location failed: ${compactError(err)}`);
      Alert.alert('Search location failed', compactError(err));
    }
  };

  const clearSearchLocationOverride = async () => {
    if (activePlanningSession) {
      Alert.alert('Shared location required', 'A planning session needs a shared search location. Edit it instead of clearing it.');
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

  const patchPlanningSession = async (id: string, updater: (session: PlanningSession) => PlanningSession) => {
    const existing = planningSessions.find((session) => session.id === id);
    if (!existing) return;
    const updated = { ...updater(existing), updatedAt: Date.now() };
    await savePlanningSessions(planningSessions.map((session) => session.id === id ? updated : session));
  };

  const createPlanningSession = async () => {
    if (!sessionInvitees.length) {
      Alert.alert('Invite testers', 'Choose at least one local tester user for this planning session.');
      return;
    }

    const locationInput = sessionLocationInput.trim();
    try {
      const resolvedLocation = locationInput
        ? await resolveLocationInput(locationInput)
        : searchLocation || location || await getLocation();
      if (!resolvedLocation) {
        Alert.alert('Shared location needed', 'Enter a ZIP, address, or place for the shared session search.');
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
      Alert.alert('Could not create session', compactError(err));
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
    showToast('Suggestion added');
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
      Alert.alert('Add suggestions first', 'Food or activity suggestions are needed before building a final plan.');
      return;
    }
    const recommendation = buildPlanningRecommendation(activePlanningSession);
    if (!recommendation.suggestionIds.length) {
      Alert.alert('No matching suggestions', 'Add suggestions that match the session intent first.');
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
      ...currentPlanContext(),
      stops: finalStops,
      status: 'draft',
    });
    setPlanTimes({});
    setArrivalTimes({});
    setPendingInsertIndex(null);
    setSelectedStopKey(finalStops[finalStops.length - 1]?.key || null);
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
    showToast('Final plan added to itinerary');
  };

  const loadFinalSessionPlan = () => {
    if (!activePlanningSession?.finalPlan.length) return;
    const loadSuffix = `-session-load-${Date.now()}`;
    const loadedStops = activePlanningSession.finalPlan.map((stop) => cloneStopForSavedPlan(stop, loadSuffix));
    setPlan({
      ...currentPlanContext(),
      stops: loadedStops,
      status: 'draft',
    });
    setPlanTimes({});
    setArrivalTimes({});
    setSelectedStopKey(loadedStops[loadedStops.length - 1]?.key || null);
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
      await Linking.openURL(mapsSearchUrl(suggestion.item, activePlanningSession?.searchLocation || searchLocation || location));
      return;
    }
    await Linking.openURL(suggestion.item.mapsUri || mapsSearchUrl(suggestion.item.title, suggestion.item));
  };

  const openPlanningSuggestionEvent = async (suggestion: PlanningSuggestion) => {
    if (typeof suggestion.item === 'string' || !suggestion.item.eventUrl) return;
    await Linking.openURL(suggestion.item.eventUrl);
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
        ...currentPlanContext(),
        stops: nextStops,
        status: 'draft',
      });
      nextStops.forEach((stop) => {
        void refreshStopFeatures(stop.key, stop.slot, stop.item);
      });
      setPlanTimes({});
      setArrivalTimes({});
      setPendingInsertIndex(null);
      setSelectedStopKey(nextStops[nextStops.length - 1]?.key || null);
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

    if (!keyLoaded) return;
    setHasInitiatedSearch(true);
    setCards([]);
    setVisibleCount(PAGE_SIZE);
    setLoading(true);
    scrollToResults();
    try {
      const center = await getSearchLocation();
      const anchor = foodItems.find((item): item is PlaceCard => typeof item !== 'string' && Boolean(item.lat && item.lng));
      const activityAnchor = activityItems.find((item): item is PlaceCard => typeof item !== 'string' && Boolean(item.lat && item.lng));
      const searchCenter =
        suggestion.slot === 'activity' && anchor
          ? { latitude: anchor.lat!, longitude: anchor.lng!, label: anchor.title }
          : suggestion.slot === 'food' && activityAnchor
            ? { latitude: activityAnchor.lat!, longitude: activityAnchor.lng!, label: activityAnchor.title }
            : center;
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
        searchRequestIdRef.current,
        selectedDietary,
        suggestion.slot === 'activity' ? suggestion.selections : selectedActivities,
      );
      scrollToResults();
    } catch (err) {
      addLog(`Suggested pairing search failed: ${compactError(err)}`);
    } finally {
      setLoading(false);
    }
  };

  const searchActivitiesNearFood = async (food: PlaceCard) => {
    if (!food.lat || !food.lng) {
      addLog('Selected food has no coordinates; activity search needs manual Maps fallback');
      return;
    }

    setLoading(true);
    try {
      const types = typesForSelection(selectedActivities, ACTIVITY_TYPE_MAP, DEFAULT_ACTIVITY_TYPES);
      addLog(`Activity pairing types: ${types.join(', ')}`);
      await runPlacesSearch(
        'activity',
        { latitude: food.lat, longitude: food.lng, label: food.title },
        types,
        selectedActivities.includes('Movies') ? DEFAULT_ACTIVITY_RADIUS_METERS : PAIRING_RADIUS_METERS,
        false,
        selectedFoods,
        searchRequestIdRef.current,
        selectedDietary,
        selectedActivities,
      );
    } catch (err) {
      addLog(`Activity pairing failed: ${compactError(err)}`);
      Alert.alert('Could not search activities nearby', compactError(err));
    } finally {
      setLoading(false);
    }
  };

  const insertStopIntoPlan = (slot: PlanSlot, item: PlaceCard | string) => {
    if (isPlanLocked) {
      showToast('Unlock the plan to edit it');
      return undefined;
    }
    const context = currentPlanContext();
    const existingStop = plan.stops.find((stop) => stop.slot === slot && cardToId(stop.item) === cardToId(item));
    if (existingStop) {
      setPlan((prev) => ({
        ...prev,
        ...context,
        stops: prev.stops.filter((stop) => stop.key !== existingStop.key),
        lockedArrivalTimes: undefined,
        savedPlanId: undefined,
      }));
      setPlanTimes((times) => ({ ...times, [existingStop.key]: undefined }));
      setArrivalTimes((times) => ({ ...times, [existingStop.key]: undefined }));
      setSelectedStopKey((current) => current === existingStop.key ? null : current);
      setPendingInsertIndex(null);
      return undefined;
    }

    const nextStop: ItineraryStop = {
      key: makeStopKey(slot, item),
      slot,
      item,
      featureOptions: [],
      selectedFeatures: [],
      featuresExpanded: false,
    };
    setPlan((prev) => {
      const selectedIndex = selectedStopKey ? prev.stops.findIndex((stop) => stop.key === selectedStopKey) : -1;
      const insertAfterIndex = pendingInsertIndex !== null ? pendingInsertIndex : selectedIndex;
      const insertAt = insertAfterIndex < 0 ? prev.stops.length : Math.min(insertAfterIndex + 1, prev.stops.length);
      return {
        ...prev,
        ...context,
        stops: [
          ...prev.stops.slice(0, insertAt),
          nextStop,
          ...prev.stops.slice(insertAt),
        ],
        lockedArrivalTimes: undefined,
        savedPlanId: undefined,
      };
    });
    setPendingInsertIndex(null);
    setSelectedStopKey(nextStop.key);
    void refreshStopFeatures(nextStop.key, slot, item);
    return nextStop;
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

    const alreadySelected = plan.stops.some((stop) => stop.slot === resultMode && cardToId(stop.item) === card.id);
    const insertedStop = insertStopIntoPlan(resultMode, card);
    addLog(alreadySelected ? `Removed ${resultMode} choice: ${card.title}` : `Added ${resultMode} choice: ${card.title}`);
    if (insertedStop) scrollToPlanStop(insertedStop.key);
    setManualSearch('');
    setManualSearchSubmitted(false);

    if (resultMode === 'food') {
      if (!alreadySelected && pendingInsertIndex === null) {
        setResultMode('activity');
        await searchActivitiesNearFood(card);
      }
      return;
    }
  };

  const openCardMaps = async (card: PlaceCard) => {
    addLog(`Card Open Maps action: ${card.title}`);
    await Linking.openURL(card.mapsUri || mapsSearchUrl(card.title));
  };

  const openCardEvent = async (card: PlaceCard) => {
    if (!card.eventUrl) return;
    addLog(`Card Open Event action: ${card.title}`);
    await Linking.openURL(card.eventUrl);
  };

  const openStopMaps = async (stop: ItineraryStop) => {
    const name = cardToName(stop.item);
    addLog(`Plan Map action: ${name || stop.slot}`);
    if (typeof stop.item !== 'string') {
      await Linking.openURL(stop.item.mapsUri || mapsSearchUrl(stop.item.title, stop.item));
      return;
    }
    await Linking.openURL(mapsSearchUrl(stop.item, activeSearchLocation || location));
  };

  const quickShareTitle = (target: QuickShareTarget) => {
    if (target.kind === 'card') return target.card.title;
    return cardToName(target.stop.item) || `${target.stop.slot === 'food' ? 'Food' : 'Activity'} stop`;
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

  const currentPlanContext = () => ({
    dateWindow: activePlanDateWindow,
    customDateRange: activePlanCustomDateRange,
    planDateStart: activePlanDateRange.start,
    planDateEnd: activePlanDateRange.end,
    timeWindow: activePlanTimeWindow || timeWindowFromStartClock(clockTimeFromDate(new Date(activePlanTimelineBaseMs))),
    routeOriginLabel: startingLocationLabel,
    routeStartLocation,
    searchLocation: activeSearchLocation || routeStartLocation,
    searchLocationLabel,
  });

  const planTitle = plan.title || titleForPlanStops(plan.stops);
  const isPlanLocked = plan.status === 'locked';
  const isImportedGoogleMapsPlan = plan.routeProvider === 'google_maps';
  const isImportedGoogleMapsDraft = isImportedGoogleMapsPlan && plan.status === 'draft';
  const planInvitees = plan.invitees || [];
  const timeSignature = (time?: StopTime) => time ? `${time.hours}:${time.minutes}` : '';
  const stopSaveSignature = (stop: ItineraryStop, duration?: StopTime, arrival?: StopTime) => ({
    slot: stop.slot,
    itemId: cardToId(stop.item),
    name: cardToName(stop.item) || '',
    travelMode: stop.travelMode || '',
    duration: timeSignature(duration),
    arrival: timeSignature(arrival),
    features: [...(stop.selectedFeatures || [])].sort(),
  });
  const savedPlanSignature = (saved: SavedPlan) => JSON.stringify({
    title: saved.title,
    sourceUrl: saved.sourceUrl || '',
    routeProvider: saved.routeProvider || '',
    status: saved.status || '',
    invitees: [...(saved.invitees || [])].sort(),
    dateWindow: saved.dateWindow || '',
    customDateRange: saved.customDateRange || null,
    planDateStart: dateRangeForSavedPlan(saved).start,
    planDateEnd: dateRangeForSavedPlan(saved).end,
    timeWindow: saved.timeWindow || '',
    routeOriginLabel: saved.routeOriginLabel || '',
    routeStartLocation: saved.routeStartLocation ? `${saved.routeStartLocation.latitude.toFixed(4)},${saved.routeStartLocation.longitude.toFixed(4)}` : '',
    searchLocationLabel: saved.searchLocationLabel || '',
    searchLocation: saved.searchLocation ? `${saved.searchLocation.latitude.toFixed(4)},${saved.searchLocation.longitude.toFixed(4)}` : '',
    stops: saved.stops.map((stop) => stopSaveSignature(
      stop,
      saved.planTimes?.[stop.key],
      savedArrivalClockTime(saved, stop),
    )),
  });
  const currentContextSignature = currentPlanContext();
  const currentPlanSignature = JSON.stringify({
    title: planTitle,
    sourceUrl: plan.sourceUrl || '',
    routeProvider: plan.routeProvider || '',
    status: plan.status || '',
    invitees: [...planInvitees].sort(),
    dateWindow: currentContextSignature.dateWindow || '',
    customDateRange: currentContextSignature.customDateRange || null,
    planDateStart: currentContextSignature.planDateStart,
    planDateEnd: currentContextSignature.planDateEnd,
    timeWindow: currentContextSignature.timeWindow || '',
    routeOriginLabel: currentContextSignature.routeOriginLabel || '',
    routeStartLocation: currentContextSignature.routeStartLocation ? `${currentContextSignature.routeStartLocation.latitude.toFixed(4)},${currentContextSignature.routeStartLocation.longitude.toFixed(4)}` : '',
    searchLocationLabel: currentContextSignature.searchLocationLabel || '',
    searchLocation: currentContextSignature.searchLocation ? `${currentContextSignature.searchLocation.latitude.toFixed(4)},${currentContextSignature.searchLocation.longitude.toFixed(4)}` : '',
    stops: plan.stops.map((stop, index) => stopSaveSignature(
      stop,
      planTimes[stop.key],
      displayedArrivalTimeForStop(stop, index),
    )),
  });
  const isCurrentPlanSaved = Boolean(plan.savedPlanId && visibleSavedPlans.some((saved) => saved.id === plan.savedPlanId && saved.source === 'saved')) ||
    visibleSavedPlans.some((saved) =>
    saved.source === 'saved' && savedPlanSignature(saved) === currentPlanSignature,
  );

  const cloneStopForSavedPlan = (stop: ItineraryStop, suffix = ''): ItineraryStop => ({
    ...stop,
    key: `${stop.key}${suffix}`,
    featureOptions: [...(stop.featureOptions || [])],
    selectedFeatures: [...(stop.selectedFeatures || [])],
    featuresExpanded: false,
  });

  const renamePlan = (title: string) => {
    if (isPlanLocked) return;
    setPlan((prev) => ({ ...prev, title, savedPlanId: undefined }));
  };

  const togglePlanInvitee = (user: string) => {
    setPlan((prev) => {
      const invitees = prev.invitees || [];
      return {
        ...prev,
        invitees: invitees.includes(user)
          ? invitees.filter((item) => item !== user)
          : unique([...invitees, user]),
        savedPlanId: undefined,
      };
    });
  };

  const moveStop = (key: string, direction: -1 | 1) => {
    if (isPlanLocked) return;
    setPlan((prev) => {
      const index = prev.stops.findIndex((stop) => stop.key === key);
      const targetIndex = index + direction;
      if (index < 0 || targetIndex < 0 || targetIndex >= prev.stops.length) return prev;

      const stops = [...prev.stops];
      [stops[index], stops[targetIndex]] = [stops[targetIndex], stops[index]];
      return { ...prev, stops, savedPlanId: undefined };
    });
    addLog(`Plan stop moved ${direction < 0 ? 'up' : 'down'}`);
  };

  const lockPlan = () => {
    if (!plan.stops.length) return;
    const lockedArrivalTimes = currentDisplayedArrivalTimes();
    const context = currentPlanContext();
    setPlan((prev) => ({
      ...prev,
      ...context,
      title: prev.title || titleForPlanStops(prev.stops),
      status: 'locked',
      lockedArrivalTimes,
      savedPlanId: undefined,
    }));
    setTimeEditorKey(null);
    setLocationOverrideOpen(false);
    setSearchLocationOverrideOpen(false);
    setCustomDateOpen(false);
    setPreferencesOpen(false);
    setRouteImportOpen(false);
    addLog('Plan locked');
    showToast('Plan locked');
  };

  const unlockPlan = () => {
    setPlan((prev) => ({ ...prev, status: 'draft', lockedArrivalTimes: undefined, savedPlanId: undefined }));
    addLog('Plan unlocked');
    showToast('Plan ready to edit');
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
        timeWindow: selectedPreferenceTimeWindow,
        routeOriginLabel: startingLocationLabel,
        routeStartLocation,
        searchLocation: activeSearchLocation || routeStartLocation,
        searchLocationLabel,
      });
      setPlanTimes({});
      setArrivalTimes({});
      setPendingInsertIndex(null);
      setSelectedStopKey(importedStops[importedStops.length - 1]?.key || null);
      setTimeEditorKey(null);
      setHasInitiatedSearch(false);
      setCards([]);
      setRouteImportOpen(false);
      setRouteImportUrl('');
      addLog(`Google Maps route imported: ${routeImport.stops.length} stops`);
      showToast('Route imported as draft');
      setTimeout(() => scrollRef.current?.scrollTo({ y: 0, animated: true }), 100);
    } catch (err) {
      const message = err instanceof Error && err.message === GOOGLE_MAPS_ROUTE_IMPORT_ERROR
        ? err.message
        : GOOGLE_MAPS_ROUTE_IMPORT_ERROR;
      setRouteImportError(message);
      addLog(`Google Maps route import failed: ${compactError(err)}`);
      Alert.alert('Could not import route', message);
    } finally {
      setRouteImporting(false);
    }
  };

  const openImportedGoogleRoute = async () => {
    if (!plan.sourceUrl) return;
    addLog('Imported Google Maps route opened');
    await Linking.openURL(plan.sourceUrl);
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
      Alert.alert('No plan yet', 'Select food or activity first.');
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
      Alert.alert('No destination yet', 'Select food or activity first.');
      return;
    }

    setRouteOptionsOpen(false);
    try {
      await Share.share({ message: payload });
      addLog('Tesla route handoff opened');
    } catch (err) {
      addLog(`Tesla route handoff failed: ${compactError(err)}`);
      Alert.alert('Could not open Tesla handoff', compactError(err));
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
    const context = currentPlanContext();
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
      timeWindow: context.timeWindow,
      routeOriginLabel: context.routeOriginLabel,
      routeStartLocation: context.routeStartLocation,
      searchLocation: context.searchLocation,
      searchLocationLabel: context.searchLocationLabel,
      owner: source === 'saved' ? currentTesterName : options.sharedTo,
      sharedBy: options.sharedBy,
      sharedTo: options.sharedTo,
    };
  };

  const saveCurrentPlan = async () => {
    if (!plan.stops.length) return;
    const saved = makeSavedPlan(plan.stops, 'saved');
    await saveSavedPlans((current) => [saved, ...current.filter((item) => item.id !== saved.id)]);
    setPlan((prev) => ({
      ...prev,
      ...currentPlanContext(),
      savedPlanId: saved.id,
    }));
    addLog(`Plan saved: ${saved.title}`);
    showToast('Plan saved');
  };

  const loadSavedPlan = (saved: SavedPlan) => {
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
      timeWindow: loadedTimeWindow,
      routeOriginLabel: saved.routeOriginLabel,
      routeStartLocation: saved.routeStartLocation,
      searchLocation: saved.searchLocation,
      searchLocationLabel: saved.searchLocationLabel,
      lockedArrivalTimes: saved.status === 'locked' ? loadedLockedArrivalTimes : undefined,
    });
    setPlanTimes(loadedPlanTimes);
    setArrivalTimes(loadedArrivalOverrides);
    setPendingInsertIndex(null);
    setSelectedStopKey(loadedStops[loadedStops.length - 1]?.key || null);
    setTimeEditorKey(null);
    setHasInitiatedSearch(false);
    setCards([]);
    setHomeOpen(false);
    setSavedPlansLandingOpen(false);
    setPlanSetupOpen(false);
    setTimeout(() => scrollRef.current?.scrollTo({ y: 0, animated: true }), 100);
    addLog(`Saved plan loaded: ${saved.title}`);
  };

  const deleteSavedPlan = async (id: string) => {
    await saveSavedPlans((current) => current.filter((item) => item.id !== id));
    addLog('Saved plan removed');
  };

  const quickShareMapsUrl = (target: QuickShareTarget) => {
    const item = target.kind === 'card' ? target.card : target.stop.item;
    if (typeof item !== 'string') return item.mapsUri || mapsSearchUrl(item.title, item);
    return mapsSearchUrl(item, activeSearchLocation || location);
  };

  const quickShareMessage = (target: QuickShareTarget) => {
    const title = quickShareTitle(target);
    const url = quickShareMapsUrl(target);
    return [title, url, 'Shared from NomNomGo'].join('\n');
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

  const dismissCard = async (card: PlaceCard) => {
    const dismissedSession = unique([card.id, ...memory.dismissedSession]);
    const nextMemory = { ...memory, dismissedSession };
    setMemory(nextMemory);
    setCards((prev) => prev.filter((item) => item.id !== card.id));
    addLog(`Dismissed for session: ${card.title}`);
  };

  const neverRecommendCard = async (card: PlaceCard) => {
    const neverRecommend = unique([card.id, ...memory.neverRecommend]);
    await saveMemory({ ...memory, neverRecommend });
    setCards((prev) => prev.filter((item) => item.id !== card.id));
    addLog(`Never recommend again: ${card.title}`);
  };

  const addManualCardToPlan = async (slot: PlanSlot, card: PlaceCard) => {
    if (isPlanLocked && !planningSuggestionMode) {
      showToast('Unlock the plan to edit it');
      return;
    }
    const nextMemory = {
      ...memory,
      selectedHistory: unique([card.id, ...memory.selectedHistory]).slice(0, 80),
    };
    await saveMemory(nextMemory);

    if (planningSuggestionMode) {
      await addPlanningSuggestion(slot, card, 'manual');
      setResultMode(slot);
      setCards((prev) => {
        const existing = prev.some((item) => item.id === card.id);
        return existing ? prev : [card, ...prev];
      });
      setVisibleCount(PAGE_SIZE);
      return;
    }

    const alreadySelected = plan.stops.some((stop) => stop.slot === slot && cardToId(stop.item) === card.id);
    const insertedStop = !alreadySelected ? insertStopIntoPlan(slot, card) : undefined;
    setResultMode(slot);
    setCards((prev) => {
      const existing = prev.some((item) => item.id === card.id);
      return existing ? prev : [card, ...prev];
    });
    setVisibleCount(PAGE_SIZE);
    if (insertedStop) scrollToPlanStop(insertedStop.key);

    if (slot === 'food' && !alreadySelected && pendingInsertIndex === null) {
      setResultMode('activity');
      await searchActivitiesNearFood(card);
    }
  };

  const clearManualSearch = () => {
    setManualSearch('');
    setManualSearchSubmitted(false);
    setCards([]);
    setVisibleCount(PAGE_SIZE);
    setHasInitiatedSearch(false);
    setTimeout(() => manualSearchRef.current?.focus(), 50);
  };

  const useManual = async (slot: PlanSlot) => {
    if (isPlanLocked && !planningSuggestionMode) {
      showToast('Unlock the plan to edit it');
      return;
    }
    const value = manualSearch.trim();
    if (!value) return;
    setManualSearchSubmitted(true);
    if (!keyLoaded) {
      if (planningSuggestionMode) {
        await addPlanningSuggestion(slot, value, 'manual');
        setManualSearch('');
        addLog(`Manual ${slot} suggested without Places lookup: ${value}`);
        return;
      }
      const insertedStop = insertStopIntoPlan(slot, value);
      if (insertedStop) scrollToPlanStop(insertedStop.key);
      setManualSearch('');
      setManualSearchSubmitted(false);
      addLog(`Manual ${slot} used without Places lookup: ${value}`);
      notifyGooglePlacesMissing('Manual lookup skipped: Google Places key missing', 'Added manually. Places details need a Google key.');
      return;
    }

    setLoading(true);
    try {
      const center = await getSearchLocation().catch((err) => {
        addLog(`Manual lookup location unavailable: ${compactError(err)}`);
        return null;
      });
      const matches = await searchPlaceByText(value, slot, center);
      const resolved = matches[0];
      if (!resolved) {
        if (planningSuggestionMode) {
          await addPlanningSuggestion(slot, value, 'manual');
          setManualSearch('');
          addLog(`Manual ${slot} suggestion added without match: ${value}`);
          return;
        }
        const insertedStop = insertStopIntoPlan(slot, value);
        if (insertedStop) scrollToPlanStop(insertedStop.key);
        setManualSearch('');
        setManualSearchSubmitted(false);
        addLog(`Manual ${slot} lookup found no match: ${value}`);
        Alert.alert('Place not found', `I added "${value}" manually, but Google Places did not return a match.`);
        return;
      }

      if (matches.length > 1) {
        setResultMode(slot);
        setHasInitiatedSearch(true);
        setCards(matches);
        setVisibleCount(PAGE_SIZE);
        setPreferencesOpen(false);
        setLoading(false);
        scrollToResults();
        addLog(`Manual ${slot} needs choice: ${matches.slice(0, 3).map((card) => card.title).join(' | ')}`);
        return;
      }

      await addManualCardToPlan(slot, resolved);
      setManualSearch('');
      addLog(`Manual ${slot} resolved: ${resolved.title}`);
    } catch (err) {
      if (planningSuggestionMode) {
        await addPlanningSuggestion(slot, value, 'manual');
        setManualSearch('');
        addLog(`Manual ${slot} suggestion added after lookup failure: ${compactError(err)}`);
        return;
      }
      const insertedStop = insertStopIntoPlan(slot, value);
      if (insertedStop) scrollToPlanStop(insertedStop.key);
      setManualSearch('');
      setManualSearchSubmitted(false);
      addLog(`Manual ${slot} lookup failed: ${compactError(err)}`);
      Alert.alert('Manual lookup failed', `I added "${value}" manually, but could not load details from Google Places.`);
    } finally {
      setLoading(false);
    }
  };

  const removeStop = (stop: ItineraryStop) => {
    if (isPlanLocked) return;
    setPlan((prev) => ({
      ...prev,
      stops: prev.stops.filter((item) => item.key !== stop.key),
      savedPlanId: undefined,
    }));
    setPlanTimes((prev) => ({ ...prev, [stop.key]: undefined }));
    setArrivalTimes((prev) => ({ ...prev, [stop.key]: undefined }));
    setSelectedStopKey((current) => current === stop.key ? null : current);
    if (timeEditorKey === stop.key) setTimeEditorKey(null);
    addLog(`Removed ${stop.slot}: ${cardToName(stop.item)}`);
  };

  const toggleStopFeaturesOpen = (key: string) => {
    if (isPlanLocked) return;
    setPlan((prev) => ({
      ...prev,
      stops: prev.stops.map((stop) =>
        stop.key === key ? { ...stop, featuresExpanded: !stop.featuresExpanded } : stop,
      ),
    }));
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
      Alert.alert('No plan yet', 'Select food or activity first.');
      return;
    }
    addLog('Directions to plan opened');
    await Linking.openURL(url);
  };

  const sharePlan = async () => {
    try {
      await Share.share({ message: sharePlanText() });
      addLog('Plan shared as text');
    } catch (err) {
      addLog(`Plan share failed: ${compactError(err)}`);
      Alert.alert('Could not share plan', compactError(err));
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

  const suggestedPairings = useMemo<PairingSuggestion[]>(() => {
    const suggestions: PairingSuggestion[] = [];
    const favoriteSuggestionCenter = activeSearchLocation || lastSearchLocationCenter || location;
    const isOpenSuggestion = (card: PlaceCard) => hasKnownHours(card) && card.isOpen === true;
    const distanceFromSearchLocation = (card: PlaceCard) =>
      favoriteSuggestionCenter ? distanceMeters(favoriteSuggestionCenter, card) : Number.POSITIVE_INFINITY;
    const savedFavorites = Object.values(memory.favoriteCards || {}).filter((entry) =>
      memory.favorites.includes(entry.card.id) &&
      isOpenSuggestion(entry.card) &&
      favoriteMatchesSearchLocation(entry, favoriteSuggestionCenter) &&
      !(entry.slot === 'activity' && isBadActivityResult(entry.card)),
    );
    const favoriteFoods = savedFavorites
      .filter((entry) => entry.slot === 'food')
      .map((entry) => entry.card)
      .sort((a, b) => distanceFromSearchLocation(a) - distanceFromSearchLocation(b));
    const favoriteActivities = savedFavorites
      .filter((entry) => entry.slot === 'activity')
      .map((entry) => entry.card)
      .sort((a, b) => distanceFromSearchLocation(a) - distanceFromSearchLocation(b));

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
      })),
    )
      .filter((combo) => Number.isFinite(combo.distance) && combo.distance <= PAIRING_RADIUS_METERS)
      .sort((a, b) => a.distance - b.distance);

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
  }, [plan.stops, foodItems, activityItems, memory.favoriteCards, memory.favorites, selectedMoods, selectedWeather, searchLocation, lastSearchLocationCenter, location]);

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
    selectedTime,
    resultMode === 'food'
      ? summarizeSelection('Food', selectedFoods)
      : summarizeSelection('Activity', selectedActivities),
    resultMode === 'food' ? summarizeSelection('Dietary', selectedDietary) : '',
  ].filter(Boolean);

  const quickShareUsers = unique(TEST_USERS.filter((user) => user !== currentTesterName));

  if (!authLoaded) {
    return (
      <SafeAreaView style={[styles.safeArea, isLightMode && styles.lightScreen, isDarkMode && styles.darkScreen]} edges={['top', 'left', 'right']}>
        <View style={styles.authCentered}>
          <ActivityIndicator color="#f23b35" />
          <Text style={styles.authHint}>Loading NomNomGo</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!testerAuthenticated) {
    return (
      <SafeAreaView style={[styles.safeArea, isLightMode && styles.lightScreen, isDarkMode && styles.darkScreen]} edges={['top', 'left', 'right']}>
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
    <ScrollView
      ref={scrollRef}
      style={[styles.screen, isLightMode && styles.lightScreen, isDarkMode && styles.darkScreen]}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
    >
      <View style={[styles.appBanner, isDarkMode && styles.darkPanel]}>
        <TouchableOpacity
          style={styles.bannerBrand}
          onPress={openHome}
          accessibilityRole="button"
          accessibilityLabel="Go to NomNomGo home"
        >
          <Image
            source={require('./assets/nom-nom-go-mark-transparent-v19.png')}
            style={styles.bannerLogoMark}
            resizeMode="contain"
          />
          <View style={styles.bannerBrandText}>
            <View style={styles.bannerNameRow}>
              <Text
                style={[styles.bannerName, styles.bannerNameMain, isDarkMode && styles.bannerNameMainDark]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.72}
                maxFontSizeMultiplier={1}
              >
                NomNom
              </Text>
              <Text style={[styles.bannerName, styles.bannerNameGo]} numberOfLines={1} maxFontSizeMultiplier={1}>
                Go
              </Text>
            </View>
            <Text style={[styles.bannerTagline, isDarkMode && styles.darkMutedText]} numberOfLines={1}>
              Come together
            </Text>
          </View>
        </TouchableOpacity>
        <View style={styles.bannerActions}>
          <TouchableOpacity
            style={[styles.accountIconButton, isDarkMode && styles.darkChip]}
            onPress={() => setAccountMenuOpen((prev) => !prev)}
            accessibilityRole="button"
            accessibilityLabel="Open user menu"
          >
            <Ionicons name="person-circle-outline" size={28} color={isDarkMode ? '#fffaf3' : '#071827'} />
          </TouchableOpacity>
        </View>
      </View>

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
                <Ionicons name="person-circle-outline" size={36} color="#071827" />
              </View>
              <View style={styles.accountTextBlock}>
                <Text style={[styles.accountName, isDarkMode && styles.darkText]}>{testerUser?.name || 'Tester'}</Text>
                <Text style={[styles.accountUsage, isDarkMode && styles.darkMutedText]}>
                  Places calls: {usageMeter.nearbySearchesToday + usageMeter.textSearchesToday} today - {usageMeter.nearbySearchesMonth + usageMeter.textSearchesMonth} month
                </Text>
              </View>
            </View>
            <View style={styles.accountActions}>
              <Button
                label="User settings"
                onPress={() => {
                  setAccountMenuOpen(false);
                  setAccountSettingsOpen(true);
                }}
                compact
              />
              <Button
                label="Switch user"
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
                label="Switch user"
                onPress={() => {
                  setAccountSettingsOpen(false);
                  void signOutTester();
                }}
                compact
              />
              <Button label="Close" onPress={() => setAccountSettingsOpen(false)} compact />
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {homeOpen ? (
        <View style={[styles.homeBox, isLightMode && styles.lightPanel, isDarkMode && styles.darkPanel]}>
          {!planSetupOpen ? (
            <>
              <View style={styles.homeTitleBlock}>
                <Text style={[styles.homeTitle, isDarkMode && styles.darkText]}>NomNomGo</Text>
                <Text style={[styles.homeSubtitle, isDarkMode && styles.darkMutedText]}>Come together</Text>
              </View>
              <View style={styles.homeActionGrid}>
                <TouchableOpacity
                  style={[styles.homeMainButton, styles.homeNowButton]}
                  onPress={() => openPlanSetup('now')}
                  accessibilityRole="button"
                  accessibilityLabel="Now"
                >
                  <Ionicons name="time-outline" size={24} color="#fffaf3" />
                  <Text style={styles.homeMainButtonText}>Now</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.homeMainButton, styles.homeLaterButton]}
                  onPress={() => openPlanSetup('later')}
                  accessibilityRole="button"
                  accessibilityLabel="Later"
                >
                  <Ionicons name="calendar-outline" size={24} color="#fffaf3" />
                  <Text style={styles.homeMainButtonText}>Later</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.homeMainButton, styles.homeSavedButton]}
                  onPress={openSavedPlansHomeAction}
                  accessibilityRole="button"
                  accessibilityLabel="Saved or shared plans"
                >
                  <Ionicons name="albums-outline" size={24} color="#fffaf3" />
                  <Text style={styles.homeMainButtonText}>Saved/Shared</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <>
              <View style={styles.setupHeaderRow}>
                <View>
                  <Text style={[styles.homeTitle, isDarkMode && styles.darkText]}>
                    {planSetupTiming === 'now' ? 'Now' : 'Later'}
                  </Text>
                  <Text style={[styles.homeSubtitle, isDarkMode && styles.darkMutedText]}>New plan</Text>
                </View>
                <Button label="Back" onPress={() => setPlanSetupOpen(false)} compact />
              </View>

              <View style={styles.setupField}>
                <Text style={[styles.setupLabel, isDarkMode && styles.darkMutedText]}>Name</Text>
                <TextInput
                  style={[styles.input, isDarkMode && styles.darkPanelInput, Platform.OS === 'web' && styles.webInput]}
                  value={planSetupName}
                  onChangeText={setPlanSetupName}
                  placeholder="Plan name"
                  placeholderTextColor={isLightMode ? '#64748b' : '#94a3b8'}
                  returnKeyType="next"
                />
              </View>

              <View style={styles.setupField}>
                <Text style={[styles.setupLabel, isDarkMode && styles.darkMutedText]}>When</Text>
                <View style={styles.dateChipWrap}>
                  {setupDateWindowOptions.map((option) => {
                    const active = planSetupDateWindow === option.id;
                    return (
                      <TouchableOpacity
                        key={`setup-date-${option.id}`}
                        style={[styles.dateChip, active && styles.dateChipActive]}
                        onPress={() => setPlanSetupDateWindow(option.id)}
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
                        placeholder="Start YYYY-MM-DD"
                        placeholderTextColor="#64748b"
                        keyboardType="numbers-and-punctuation"
                      />
                      <TextInput
                        style={[styles.input, styles.customDateInput]}
                        value={planSetupCustomDateEndInput}
                        onChangeText={setPlanSetupCustomDateEndInput}
                        placeholder="End YYYY-MM-DD"
                        placeholderTextColor="#64748b"
                        keyboardType="numbers-and-punctuation"
                      />
                    </View>
                  </View>
                ) : null}
                <View style={styles.chipWrap}>
                  {TIMES.map((time) => {
                    const active = planSetupTime === time;
                    return (
                      <TouchableOpacity
                        key={`setup-time-${time}`}
                        style={[styles.chip, isDarkMode && styles.darkChip, active && styles.chipActive]}
                        onPress={() => setPlanSetupTime(time)}
                      >
                        <Text style={[styles.chipText, isDarkMode && styles.darkMutedText, active && styles.chipTextActive]}>{time}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <View style={styles.setupField}>
                <Text style={[styles.setupLabel, isDarkMode && styles.darkMutedText]}>Where</Text>
                <TextInput
                  style={[styles.input, isDarkMode && styles.darkPanelInput, Platform.OS === 'web' && styles.webInput]}
                  value={planSetupWhere}
                  onChangeText={setPlanSetupWhere}
                  placeholder="City, ZIP, or place"
                  placeholderTextColor={isLightMode ? '#64748b' : '#94a3b8'}
                  returnKeyType="next"
                />
              </View>

              <View style={styles.setupField}>
                <Text style={[styles.setupLabel, isDarkMode && styles.darkMutedText]}>Starting location</Text>
                <TextInput
                  style={[styles.input, isDarkMode && styles.darkPanelInput, Platform.OS === 'web' && styles.webInput]}
                  value={planSetupStartingLocation}
                  onChangeText={setPlanSetupStartingLocation}
                  placeholder="Current location"
                  placeholderTextColor={isLightMode ? '#64748b' : '#94a3b8'}
                  returnKeyType="done"
                  onSubmitEditing={submitPlanSetup}
                />
              </View>

              <View style={styles.setupActions}>
                <Button
                  label={planSetupSubmitting ? 'Creating' : 'Create plan'}
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
              placeholder={searchLocationLabel}
              placeholderTextColor="#64748b"
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
              placeholder="6:00 PM - 9:00 PM"
              placeholderTextColor="#64748b"
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
                    placeholder="Place or idea"
                    placeholderTextColor="#64748b"
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
                {activePlanningSession.finalPlan.map((stop, index) => (
                  <Text key={stop.key} style={[styles.sessionRecommendationLine, isDarkMode && styles.darkText]}>
                    {index + 1}. {stop.slot === 'food' ? 'Food' : 'Activity'}: {cardToName(stop.item) || 'Stop'}
                  </Text>
                ))}
                <View style={styles.buttonRow}>
                  <Button label="Load final plan" onPress={loadFinalSessionPlan} compact />
                </View>
              </View>
            ) : null}
          </View>
        </View>
      ) : null}

      <View
        style={[styles.planBox, isDarkMode && styles.darkPanel]}
        onLayout={(event) => { planBoxYRef.current = event.nativeEvent.layout.y; }}
      >
        {hasAnyActiveStop && !isPlanLocked ? (
          <View style={styles.planHeader}>
            <View style={styles.planTitleBlock}>
              <TextInput
                style={[styles.planTitleInput, isDarkMode && styles.darkPanelInput]}
                value={plan.title ?? planTitle}
                onChangeText={renamePlan}
                placeholder="Plan title"
                placeholderTextColor="#64748b"
              />
              {isImportedGoogleMapsPlan ? (
                <Text style={[styles.planMetaText, isDarkMode && styles.darkMutedText]} numberOfLines={2}>
                  Google Maps draft route | {activePlanDateTimeLabel} | {plan.stops.length} stops
                </Text>
              ) : null}
            </View>
            <View style={styles.planHeaderActions}>
              <Button label="Lock In" onPress={lockPlan} primary compact />
              <Button label="Save" onPress={saveCurrentPlan} compact />
              <Button label="Invite" onPress={() => setSharePreviewOpen(true)} compact />
              <Button label={isImportedGoogleMapsPlan && plan.sourceUrl ? 'Open route' : 'Route'} onPress={openRouteOptions} compact />
            </View>
          </View>
        ) : null}

        {!hasAnyActiveStop ? (
          <View>
            <Text style={[styles.startWithLabel, isDarkMode && styles.darkMutedText]}>Start with</Text>
            <View style={styles.startChooser}>
              <TouchableOpacity
                style={[styles.startChoice, styles.startChoiceFood]}
                onPress={() => searchFromPlan('food')}
              >
                <Text style={[styles.startChoiceLabel, styles.startChoiceFoodLabel]}>Food</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.startChoice, styles.startChoiceActivity]}
                onPress={() => searchFromPlan('activity')}
              >
                <Text style={[styles.startChoiceLabel, styles.startChoiceActivityLabel]}>Activity</Text>
              </TouchableOpacity>
            </View>
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
                  {activePlanDateTimeLabel}
                </Text>
              </View>
              <View style={styles.lockedPlanCardTools}>
                <TouchableOpacity
                  style={[styles.lockedPlanIconButton, isDarkMode && styles.darkChip]}
                  onPress={() => setPlanPreviewOpen(true)}
                  accessibilityRole="button"
                  accessibilityLabel="View larger plan"
                >
                  <Ionicons name="expand-outline" size={18} color={isDarkMode ? '#fffaf3' : '#071827'} />
                </TouchableOpacity>
                <Text style={[styles.lockedPlanMeta, isDarkMode && styles.darkMutedText]}>{plan.stops.length} stops</Text>
              </View>
            </View>
            {leaveForFirstStopText ? (
              <Text style={[styles.lockedPlanLeave, isDarkMode && styles.darkMutedText]} numberOfLines={1}>
                {leaveForFirstStopText}
              </Text>
            ) : null}
            {planInvitees.length ? (
              <Text style={[styles.lockedPlanInvitees, isDarkMode && styles.darkMutedText]} numberOfLines={1}>
                With {unique([currentTesterName, ...planInvitees]).join(', ')}
              </Text>
            ) : null}
            <View style={styles.lockedStopList}>
              {plan.stops.map((stop, index) => {
                const stopCityState = cityStateLabel(cityStateForPlace(stop.item));
                const travelMeta = travelMetaForStop(stop, index);
                const walkableAfterTesla = travelMeta.mode === 'walk' && isWalkableAfterTeslaStop(plan.stops[index - 1], stop);
                return (
                  <TouchableOpacity key={`locked-${stop.key}`} style={styles.lockedStopRow} onPress={() => openStopMaps(stop)}>
                    <Text style={styles.lockedStopIndex}>{index + 1}</Text>
                    <View style={styles.lockedStopTravelBlock}>
                      <Ionicons name={travelMeta.icon} size={16} color="#178f79" />
                      <Text style={styles.lockedStopTravelText} numberOfLines={1}>{travelMeta.duration}</Text>
                    </View>
                    <Text style={styles.lockedStopTime}>{formatClockTime(displayedArrivalTimeForStop(stop, index))}</Text>
                    {walkableAfterTesla ? (
                      <Ionicons name="walk-outline" size={14} color="#178f79" />
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
            <Button label="Unlock/Edit" onPress={unlockPlan} compact />
            {!isCurrentPlanSaved ? <Button label="Save" onPress={saveCurrentPlan} compact /> : null}
            <Button label="Invite" onPress={() => setSharePreviewOpen(true)} compact />
            <Button label={isImportedGoogleMapsPlan && plan.sourceUrl ? 'Open route' : 'Route'} onPress={openRouteOptions} primary compact />
          </View>
          </>
        ) : null}

        {hasAnyActiveStop && !isPlanLocked ? (
        <View
          style={styles.timeline}
          onLayout={(event) => { timelineYRef.current = event.nativeEvent.layout.y; }}
        >
          {plan.stops.map((stop, index) => (
            <View
              key={stop.key}
              style={styles.timelineStopGroup}
              onLayout={(event) => { stopLayoutYRef.current[stop.key] = event.nativeEvent.layout.y; }}
            >
              <PlanStep
                number={`${index + 1}`}
                title={isImportedGoogleMapsDraft ? 'Stop' : stop.slot === 'food' ? 'Food' : 'Activity'}
                value={cardToName(stop.item) || (stop.slot === 'food' ? 'Food stop' : 'Activity stop')}
                detail={stepDetail(stop, index)}
                cityState={cityStateLabel(cityStateForPlace(stop.item))}
                travelMeta={travelMetaForStop(stop, index)}
                walkable={travelMetaForStop(stop, index).mode === 'walk' && isWalkableAfterTeslaStop(plan.stops[index - 1], stop)}
                travelModeOptions={TRAVEL_MODE_OPTIONS}
                onTravelModePress={(travelMode) => setStopTravelMode(stop.key, travelMode)}
                featureOptions={stop.featureOptions || []}
                selectedFeatures={stop.selectedFeatures || []}
                featuresExpanded={Boolean(stop.featuresExpanded)}
                onToggleFeaturesOpen={() => toggleStopFeaturesOpen(stop.key)}
                onToggleFeature={(feature) => toggleStopFeature(stop.key, feature)}
                active
                onPress={() => {
                  markStopSelected(stop.key);
                  void addStopAfter(stop.slot, index);
                }}
                actionLabel="Adjust time"
                onActionPress={() => {
                  markStopSelected(stop.key);
                  openTimeEditor(stop.key, index);
                }}
                mapLabel="Map"
                onMapPress={() => openStopMaps(stop)}
                shareLabel="Share"
                onSharePress={() => openQuickShare({ kind: 'stop', stop, index })}
                moveUpLabel={index > 0 ? 'Up' : undefined}
                onMoveUpPress={index > 0 ? () => moveStop(stop.key, -1) : undefined}
                moveDownLabel={index < plan.stops.length - 1 ? 'Down' : undefined}
                onMoveDownPress={index < plan.stops.length - 1 ? () => moveStop(stop.key, 1) : undefined}
                removeLabel="Remove"
                onRemovePress={() => removeStop(stop)}
              />
              {timeEditorKey === stop.key ? (
                <View style={styles.timeEditor}>
                  <Text style={styles.timeEditorTitle}>{stop.slot === 'food' ? 'Food time' : 'Activity time'}</Text>
                  <Text style={styles.timeStepperGroupLabel}>Arrival time</Text>
                  <ArrivalTimeControl
                    value={formatClockTime(draftArrivalTime)}
                    onHourMinus={() => adjustDraftArrivalTime('hours', -1)}
                    onHourPlus={() => adjustDraftArrivalTime('hours', 1)}
                    onMinuteMinus={() => adjustDraftArrivalTime('minutes', -15)}
                    onMinutePlus={() => adjustDraftArrivalTime('minutes', 15)}
                  />
                  <Text style={styles.timeStepperGroupLabel}>Stop duration</Text>
                  <View style={styles.timeControls}>
                    <TimeStepper label="Hours" value={draftTime.hours} onMinus={() => adjustDraftTime('hours', -1)} onPlus={() => adjustDraftTime('hours', 1)} />
                    <TimeStepper label="Minutes" value={draftTime.minutes} onMinus={() => adjustDraftTime('minutes', -5)} onPlus={() => adjustDraftTime('minutes', 5)} />
                  </View>
                  <View style={styles.timeEditorActions}>
                    <Button label="Clear" onPress={() => {
                      setPlanTimes((prev) => ({ ...prev, [stop.key]: undefined }));
                      setArrivalTimes((prev) => ({ ...prev, [stop.key]: undefined }));
                      setPlan((prev) => ({ ...prev, savedPlanId: undefined }));
                      setArrivalDraftDirty(false);
                      setDurationDraftDirty(false);
                      setTimeEditorKey(null);
                    }} compact />
                    <Button label="Save time" onPress={saveDraftTime} primary compact />
                  </View>
                </View>
              ) : null}
              <View style={styles.itineraryAddRow}>
                <Button label="Add food" onPress={() => addStopAfter('food', index)} compact />
                <Button label="Add activity" onPress={() => addStopAfter('activity', index)} compact />
              </View>
            </View>
          ))}
        </View>
        ) : null}

        {(hasFood || hasActivity) && !isPlanLocked ? (
          <View style={styles.planActions}>
            <Button
              label="Clear plan"
              onPress={() => {
                setPlan(EMPTY_PLAN);
                setPlanTimes({});
                setArrivalTimes({});
                setSelectedStopKey(null);
                setHasInitiatedSearch(false);
                setCards([]);
                addLog('Plan cleared');
              }}
              compact
            />
          </View>
        ) : null}

        {!isPlanLocked ? (
        <View style={styles.routeOriginBox}>
          <TouchableOpacity style={styles.planSettingsHeader} onPress={() => setPlanSettingsOpen((prev) => !prev)}>
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
                  placeholder="ZIP, address, or place"
                  placeholderTextColor="#64748b"
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
                  placeholder="ZIP, address, or place"
                  placeholderTextColor="#64748b"
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
                placeholder="Paste Google Maps route URL"
                placeholderTextColor="#64748b"
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
                    placeholder="Start YYYY-MM-DD"
                    placeholderTextColor="#64748b"
                    keyboardType="numbers-and-punctuation"
                  />
                  <TextInput
                    style={[styles.input, styles.customDateInput]}
                    value={customDateEndInput}
                    onChangeText={setCustomDateEndInput}
                    placeholder="End YYYY-MM-DD"
                    placeholderTextColor="#64748b"
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

      </>
      ) : null}

      <View
        style={[styles.savedPlansBox, isLightMode && styles.lightPanel, isDarkMode && styles.darkPanel]}
        onLayout={(event) => { savedPlansYRef.current = event.nativeEvent.layout.y; }}
      >
        <TouchableOpacity style={styles.savedPlansHeader} onPress={() => setSavedPlansOpen((prev) => !prev)}>
          <View style={styles.sectionHeaderTextBlock}>
            <Text style={[styles.sectionTitle, isLightMode && styles.lightSectionTitle, isDarkMode && styles.darkText]}>
              {savedPlansLandingOpen ? 'Saved/Shared Plans' : 'Saved Plans'}
            </Text>
            <Text style={[styles.savedPlansHint, isLightMode && styles.lightMutedText, isDarkMode && styles.darkMutedText]}>
              {visibleSavedPlans.length ? `${visibleSavedPlans.length} saved or shared for ${currentTesterName}` : 'Saved and shared plans will show here.'}
            </Text>
          </View>
          <HeaderAction label={savedPlansOpen ? 'Hide' : 'Show'} />
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
                      : 'Saved plan'} · {savedPlanDateLabel(saved)}
                  </Text>
                  <Text style={styles.savedPlanStops} numberOfLines={2}>
                    {savedPlanStopsLabel(saved)}
                  </Text>
                </View>
                <View style={styles.savedPlanActions}>
                  <Button label="Load" onPress={() => loadSavedPlan(saved)} primary compact />
                  <Button label="Delete" onPress={() => deleteSavedPlan(saved.id)} compact />
                </View>
              </View>
            )) : (
              <Text style={[styles.empty, isLightMode && styles.lightMutedText]}>No saved plans yet.</Text>
            )}
          </View>
        ) : null}
      </View>

      {!savedPlansLandingOpen && !isPlanLocked ? (
      <>
      <View style={[styles.pairingBox, isLightMode && styles.lightPairingBox, isDarkMode && styles.darkAccentPanel]}>
          <TouchableOpacity style={styles.pairingHeader} onPress={toggleSuggestedPairingsOpen}>
            <View style={styles.pairingHeaderText}>
              <Text style={[styles.sectionTitle, styles.pairingTitle, isLightMode && styles.lightSectionTitle, isDarkMode && styles.darkText]}>
                Suggested pairings
              </Text>
              <Text
                style={[styles.pairingHint, isLightMode && styles.lightMutedText, isDarkMode && styles.darkMutedText]}
                numberOfLines={suggestedPairingsOpen ? 2 : 1}
              >
                {suggestedPairingsOpen
                  ? 'Starred combos fill your plan. Other suggestions update filters.'
                  : `${suggestedPairings.length} suggestions available`}
              </Text>
            </View>
            <HeaderAction label={suggestedPairingsOpen ? 'Hide' : 'Show'} />
          </TouchableOpacity>
          {suggestedPairingsOpen ? (
            <View style={styles.pairingBody}>
              <View style={styles.chipWrap}>
                {visibleSuggestedPairings.map((suggestion, index) => (
                  <TouchableOpacity key={`${suggestion.slot}-${suggestion.label}-${index}`} style={styles.mapChip} onPress={() => runSuggestion(suggestion)}>
                    <Text style={styles.mapChipText}>{suggestion.label}</Text>
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
        <TouchableOpacity style={styles.preferencesHeader} onPress={() => setPreferencesOpen((prev) => !prev)}>
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
              items={TIMES}
              selected={[selectedTime]}
              onPress={(value) => {
                addLog(`Time chip tapped: ${value}`);
                setSelectedTime(value);
                setPlan((prev) => prev.status !== 'locked' ? {
                  ...prev,
                  timeWindow: value === 'Now' ? undefined : defaultTimeWindowForPreference(value),
                  lockedArrivalTimes: undefined,
                  savedPlanId: undefined,
                } : prev);
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
            <TouchableOpacity style={styles.advancedPreferenceHeader} onPress={() => setAdvancedPreferencesOpen((prev) => !prev)}>
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
            <TouchableOpacity style={styles.bottomHideButton} onPress={refreshFromPreferences}>
              <Text style={styles.bottomHideText}>Refresh Results</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>

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
            placeholder="restaurant, activity, or place"
            placeholderTextColor={isLightMode ? '#64748b' : '#94a3b8'}
            returnKeyType="search"
            onSubmitEditing={() => useManual(resultMode)}
          />
          {manualSearchSubmitted ? (
            <Button label="Clear" onPress={clearManualSearch} compact />
          ) : (
            <Button label="Search" onPress={() => useManual(resultMode)} compact />
          )}
        </View>
      </View>

      {!hasInitiatedSearch ? (
        <View onLayout={(event) => { resultsYRef.current = event.nativeEvent.layout.y; }}>
          <View style={[styles.emptyState, styles.preSearchEmptyState, isDarkMode && styles.darkPanel]}>
            <Text style={[styles.emptyTitle, isDarkMode && styles.darkText]}>Waiting for food or activity</Text>
            <Text style={[styles.empty, isDarkMode && styles.darkMutedText]}>
              Search results and suggested stops will appear here.
            </Text>
          </View>
        </View>
      ) : (
        <View onLayout={(event) => { resultsYRef.current = event.nativeEvent.layout.y; }}>
        <Section title={titleForResults}>
          <View style={styles.filterTabs}>
            <FilterTab label="All" active={resultFilter === 'all'} onPress={() => setResultFilter('all')} />
            <FilterTab label="Favorites" active={resultFilter === 'favorites'} onPress={() => setResultFilter('favorites')} />
          </View>
          {loading ? (
            <View style={[styles.loadingResults, isDarkMode && styles.darkPanel]}>
              <ActivityIndicator color="#f23b35" />
              <Text style={styles.loadingResultsText}>
                Searching {resultMode === 'food' ? 'food places' : 'activities'}...
              </Text>
            </View>
          ) : null}
          {!loading && shownCards.length === 0 && resultFilter === 'favorites' ? (
            <View style={[styles.emptyState, isDarkMode && styles.darkPanel]}>
              <Text style={styles.emptyTitle}>No favorites in this search</Text>
              <Text style={styles.empty}>Star places from the results, then use Favorites to narrow this list.</Text>
            </View>
          ) : !loading && shownCards.length === 0 ? (
            <View style={[styles.emptyState, isDarkMode && styles.darkPanel]}>
              <Text style={styles.emptyTitle}>{searchNotice ? 'Google Places key missing' : 'Ready when you are'}</Text>
              <Text style={styles.empty}>{searchNotice || 'Adjust preferences or search for places nearby.'}</Text>
            </View>
          ) : null}
          {!loading && shownCards.map((card, index) => {
            const isSelected = selectedCards.some((item) => cardToId(item) === card.id);
            const isSuggested = planningSuggestionMode && Boolean(activePlanningSession?.suggestions.some((suggestion) => samePlanningSuggestion(suggestion, resultMode, card)));
            const isFavorite = memory.favorites.includes(card.id);
            const distanceText = resultDistanceAnchor && resultDistanceContext
              ? formatDistanceFromMeters(distanceMeters(resultDistanceAnchor, card))
              : undefined;
            const distanceLabel = distanceText ? `${distanceText} ${resultDistanceContext}` : undefined;
            const resultActionLabel = planningSuggestionMode
              ? isSuggested
                ? 'Suggested'
                : resultMode === 'food'
                  ? 'Suggest food'
                  : 'Suggest activity'
              : isSelected
                ? 'Deselect'
                : resultMode === 'food'
                  ? 'Add food'
                  : 'Add activity';
            return (
            <View key={`${card.id}-${index}`} style={[styles.card, isDarkMode && styles.darkCard, (isSelected || isSuggested) && styles.cardSelected]}>
              <View style={styles.cardTopRow}>
                <Text style={[styles.cardRank, isSelected && styles.cardRankSelected]}>
                  {resultBadgeForCard(card, isSelected, index)}
                </Text>
                <Text style={[styles.cardHours, isDarkMode && styles.darkMutedText, card.isOpen ? styles.open : card.isOpen === false ? styles.closed : undefined]}>
                  {card.kind === 'event' ? card.eventDateText || 'Date TBA' : card.hoursText || 'Hours unknown'}
                </Text>
              </View>
              <View style={styles.cardTitleRow}>
                <Text style={[styles.cardTitle, isDarkMode && styles.darkText]}>{card.title}</Text>
                <TouchableOpacity
                  style={[styles.cardFavoriteButton, isFavorite && styles.cardFavoriteButtonActive]}
                  onPress={() => toggleFavorite(card)}
                  accessibilityRole="button"
                  accessibilityLabel={isFavorite ? `Unstar ${card.title}` : `Star ${card.title}`}
                >
                  <Ionicons name={isFavorite ? 'star' : 'star-outline'} size={20} color={isFavorite ? '#ffc84a' : '#94a3b8'} />
                </TouchableOpacity>
              </View>
              <Text style={styles.cardSubtitle}>{card.subtitle}</Text>
              {distanceLabel ? (
                <Text style={[styles.cardDistance, isDarkMode && styles.darkMutedText]}>{distanceLabel}</Text>
              ) : null}
              {card.kind === 'event' && card.source ? (
                <Text style={[styles.hoursDetail, isDarkMode && styles.darkMutedText]}>Source: {card.source}</Text>
              ) : null}
              {card.address ? <Text style={[styles.address, isDarkMode && styles.darkMutedText]}>{card.address}</Text> : null}
              {card.todayHours ? <Text style={[styles.hoursDetail, isDarkMode && styles.darkMutedText]}>{card.todayHours}</Text> : null}
              <View style={styles.buttonRow}>
                <Button label={resultActionLabel} onPress={() => selectCard(card)} primary={!isSelected && !isSuggested} compact />
                {card.kind === 'event' && card.eventUrl ? (
                  <Button label="Open event" onPress={() => openCardEvent(card)} compact />
                ) : null}
                {card.kind !== 'event' || card.mapsUri || (typeof card.lat === 'number' && typeof card.lng === 'number') ? (
                  <Button label={card.kind === 'event' ? 'Map' : 'Open Maps'} onPress={() => openCardMaps(card)} compact />
                ) : null}
                <Button label="Share" onPress={() => openQuickShare({ kind: 'card', slot: resultMode, card })} compact />
              </View>
              <View style={styles.buttonRow}>
                <Button label="Dismiss" onPress={() => dismissCard(card)} compact />
                <Button label="Don't rec again" onPress={() => neverRecommendCard(card)} compact />
              </View>
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
              Tesla handoff opens your device share sheet. Choose Tesla if available.
            </Text>
            <View style={styles.routeOptionList}>
              <TouchableOpacity style={styles.routeOptionButton} onPress={openGoogleRouteFromOptions}>
                <Ionicons name="map-outline" size={18} color="#071827" />
                <Text style={styles.routeOptionButtonText}>
                  {isImportedGoogleMapsPlan && plan.sourceUrl ? 'Open Google route' : 'Google Maps'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.routeOptionButton} onPress={sendPlanToTesla}>
                <Ionicons name="car-sport-outline" size={18} color="#071827" />
                <Text style={styles.routeOptionButtonText}>Send to Tesla</Text>
              </TouchableOpacity>
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
        <View style={styles.shareOverlay}>
          <View style={styles.planPreviewShell}>
            <View style={[styles.planPreviewCard, isDarkMode && styles.darkModalCard]}>
              <Text style={[styles.planPreviewTitle, isDarkMode && styles.darkText]} numberOfLines={2}>
                {planTitle}
              </Text>
              <View style={styles.planPreviewMetaRow}>
                <Text style={[styles.planPreviewMeta, isDarkMode && styles.darkMutedText]} numberOfLines={1}>
                  {activePlanDateTimeLabel}
                </Text>
                <Text style={[styles.planPreviewMeta, isDarkMode && styles.darkMutedText]}>{plan.stops.length} stops</Text>
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
                {plan.stops.map((stop, index) => (
                  <View key={`preview-${stop.key}`} style={styles.planPreviewStopRow}>
                    <Text style={styles.planPreviewStopIndex}>{index + 1}</Text>
                    <View style={styles.planPreviewTravelBlock}>
                      <Ionicons name={travelMetaForStop(stop, index).icon} size={15} color="#178f79" />
                      <Text style={styles.planPreviewTravelText} numberOfLines={1}>{travelMetaForStop(stop, index).duration}</Text>
                    </View>
                    <Text style={styles.planPreviewStopTime}>{formatClockTime(displayedArrivalTimeForStop(stop, index))}</Text>
                    <Text style={styles.planPreviewStopName} numberOfLines={1}>{cardToName(stop.item) || 'Stop'}</Text>
                  </View>
                ))}
              </View>
            </View>
            <View style={[styles.shareControlPanel, isDarkMode && styles.darkModalCard]}>
              <View style={styles.shareActions}>
                <Button label="Close" onPress={() => setPlanPreviewOpen(false)} primary />
              </View>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={sharePreviewOpen}
        animationType="fade"
        transparent
        onRequestClose={() => setSharePreviewOpen(false)}
      >
        <View style={styles.shareOverlay}>
          <View style={styles.shareModalShell}>
          <View style={[styles.shareCard, isDarkMode && styles.darkModalCard]}>
            <View style={styles.shareHeader}>
              <Text style={styles.shareBrand}>NomNomGo</Text>
              <Text style={styles.shareTagline}>Come together</Text>
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
                {plan.stops.map((stop, index) => (
                  <View key={`share-locked-${stop.key}`} style={styles.shareLockedStopRow}>
                    <Text style={styles.shareLockedStopIndex}>{index + 1}</Text>
                    <View style={styles.shareLockedTravelBlock}>
                      <Ionicons name={travelMetaForStop(stop, index).icon} size={15} color="#178f79" />
                      <Text style={styles.shareLockedTravelText} numberOfLines={1}>{travelMetaForStop(stop, index).duration}</Text>
                    </View>
                    <Text style={styles.shareLockedStopTime}>{formatClockTime(displayedArrivalTimeForStop(stop, index))}</Text>
                    <Text style={styles.shareLockedStopName} numberOfLines={1}>{cardToName(stop.item) || 'Stop'}</Text>
                  </View>
                ))}
              </View>
            ) : (
              plan.stops.map((stop, index) => (
                <View key={`share-${stop.key}`} style={styles.shareStop}>
                  <View style={styles.shareStopNumber}>
                    <Text style={styles.shareStopNumberText}>{index + 1}</Text>
                  </View>
                  <View style={styles.shareStopBody}>
                    <Text style={styles.shareStopType}>{stop.slot === 'food' ? 'Food' : 'Activity'}</Text>
                    <Text style={styles.shareStopName}>{cardToName(stop.item) || 'Stop'}</Text>
                    <Text style={styles.shareStopTime}>{stepDetail(stop, index)}</Text>
                    {stop.selectedFeatures?.length ? (
                      <Text style={styles.shareStopTime}>Includes: {stop.selectedFeatures.join(', ')}</Text>
                    ) : null}
                  </View>
                </View>
              ))
            )}
            {planInvitees.length ? (
              <Text style={[styles.shareMetaLine, isDarkMode && styles.darkMutedText]} numberOfLines={1}>
                With {unique([currentTesterName, ...planInvitees]).join(', ')}
              </Text>
            ) : null}
          </View>
          <View style={[styles.shareControlPanel, isDarkMode && styles.darkModalCard]}>
            <Text style={styles.quickShareHint}>Invite NNG users</Text>
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
              <Button label="Text contacts" onPress={sharePlan} primary />
              <Button label="Close" onPress={() => setSharePreviewOpen(false)} />
            </View>
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
              <Button label="Text contacts" onPress={textQuickTarget} primary />
              <Button label="Close" onPress={() => setQuickShareTarget(null)} />
            </View>
          </View>
        </View>
      </Modal>

    </ScrollView>
    </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export default function App() {
  const colorScheme = useColorScheme();
  useWebDocumentSurface(colorScheme === 'dark' ? DARK_WEB_BACKGROUND : LIGHT_WEB_BACKGROUND);

  return (
    <SafeAreaProvider>
      <AlphaAccessGate>
        <NomNomGoApp />
      </AlphaAccessGate>
    </SafeAreaProvider>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const isDarkMode = useColorScheme() === 'dark';
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
  const isDarkMode = useColorScheme() === 'dark';
  return (
    <View style={styles.chipWrap}>
      {items.map((item) => {
        const active = selected.includes(item);
        return (
          <TouchableOpacity key={item} style={[styles.chip, isDarkMode && styles.darkChip, active && styles.chipActive]} onPress={() => onPress(item)}>
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
  const isDarkMode = useColorScheme() === 'dark';
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
            <TouchableOpacity key={item} style={[styles.chip, isDarkMode && styles.darkChip, active && styles.chipActive]} onPress={() => onPress(item)}>
              <Text style={[styles.chipText, isDarkMode && styles.darkMutedText, active && styles.chipTextActive]}>{item}</Text>
            </TouchableOpacity>
          );
        })}
        {canExpand ? (
          <TouchableOpacity style={[styles.chip, isDarkMode && styles.darkChip, styles.preferenceMoreChip]} onPress={() => onToggleExpanded?.()}>
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
  const isDarkMode = useColorScheme() === 'dark';
  const useActiveStepText = active;
  return (
    <TouchableOpacity style={[styles.filterTab, isDarkMode && styles.darkChip, active && styles.filterTabActive]} onPress={onPress}>
      <Text style={[styles.filterTabText, isDarkMode && styles.darkMutedText, active && styles.filterTabTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function PlanLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.planLine}>
      <Text style={styles.planLabel}>{label}:</Text>
      <Text style={styles.planValue}>{value}</Text>
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
}: {
  suggestion: PlanningSuggestion;
  currentUser: string;
  canRemove: boolean;
  onVote: () => void;
  onRemove: () => void;
  onOpenMap?: () => void;
  onOpenEvent?: () => void;
}) {
  const isDarkMode = useColorScheme() === 'dark';
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
        <Button label={voted ? 'Unvote' : 'Vote'} onPress={onVote} primary={!voted} compact />
        {onOpenEvent ? <Button label="Open event" onPress={onOpenEvent} compact /> : null}
        {onOpenMap ? <Button label="Map" onPress={onOpenMap} compact /> : null}
        {canRemove ? <Button label="Remove" onPress={onRemove} compact /> : null}
      </View>
    </View>
  );
}

function PlanStep({
  number,
  title,
  value,
  detail,
  cityState,
  travelMeta,
  walkable,
  travelModeOptions,
  onTravelModePress,
  featureOptions,
  selectedFeatures,
  featuresExpanded,
  onToggleFeaturesOpen,
  onToggleFeature,
  active,
  last,
  onPress,
  actionLabel,
  onActionPress,
  mapLabel,
  onMapPress,
  shareLabel,
  onSharePress,
  moveUpLabel,
  onMoveUpPress,
  moveDownLabel,
  onMoveDownPress,
  removeLabel,
  onRemovePress,
}: {
  number: string;
  title: string;
  value: string;
  detail: string;
  cityState?: string;
  travelMeta?: { mode: StopTravelMode; icon: React.ComponentProps<typeof Ionicons>['name']; label: string; duration: string };
  walkable?: boolean;
  travelModeOptions?: Array<{ id: StopTravelMode; label: string; icon: React.ComponentProps<typeof Ionicons>['name'] }>;
  onTravelModePress?: (mode: StopTravelMode) => void;
  featureOptions?: string[];
  selectedFeatures?: string[];
  featuresExpanded?: boolean;
  onToggleFeaturesOpen?: () => void;
  onToggleFeature?: (feature: string) => void;
  active: boolean;
  last?: boolean;
  onPress?: () => void;
  actionLabel?: string;
  onActionPress?: () => void;
  mapLabel?: string;
  onMapPress?: () => void;
  shareLabel?: string;
  onSharePress?: () => void;
  moveUpLabel?: string;
  onMoveUpPress?: () => void;
  moveDownLabel?: string;
  onMoveDownPress?: () => void;
  removeLabel?: string;
  onRemovePress?: () => void;
}) {
  const isDarkMode = useColorScheme() === 'dark';
  return (
    <View style={styles.stepRow}>
      <View style={styles.stepRail}>
        <View style={[styles.stepDot, active && styles.stepDotActive]}>
          <Text style={[styles.stepNumber, active && styles.stepNumberActive]}>{number}</Text>
        </View>
        {!last ? <View style={styles.stepLine} /> : null}
      </View>
      <TouchableOpacity style={[styles.stepCard, isDarkMode && styles.darkCard, active && styles.stepCardActive]} onPress={onPress}>
        <View style={styles.stepTopLine}>
          <View style={styles.stepTextBlock}>
            <Text style={styles.stepTitle}>{title}</Text>
            <Text style={[styles.stepValue, isDarkMode && !active && styles.darkText, active && styles.stepValueActive]}>{value}</Text>
            {cityState ? (
              <Text style={[styles.stepCityState, isDarkMode && !active && styles.darkMutedText]} numberOfLines={1}>{cityState}</Text>
            ) : null}
          </View>
          {travelMeta ? (
            <View style={styles.stepTravelBadge}>
              <Ionicons name={travelMeta.icon} size={18} color="#178f79" />
              <Text style={styles.stepTravelDuration} numberOfLines={1}>{travelMeta.duration}</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.stepDetailRow}>
          {walkable ? (
            <Ionicons name="walk-outline" size={13} color={isDarkMode && !active ? '#fffaf3' : '#178f79'} />
          ) : null}
          <Text style={[styles.stepDetail, isDarkMode && !active && styles.darkMutedText, active && styles.stepDetailActive]}>{detail}</Text>
        </View>
        {travelModeOptions && onTravelModePress && travelMeta ? (
          <View style={styles.travelModeRow}>
            {travelModeOptions.map((option) => {
              const selected = option.id === travelMeta.mode;
              return (
                <TouchableOpacity
                  key={option.id}
                  style={[styles.travelModeButton, selected && styles.travelModeButtonSelected]}
                  onPress={(event: GestureResponderEvent) => {
                    event.stopPropagation();
                    onTravelModePress(option.id);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`Use ${option.label.toLowerCase()} to this stop`}
                >
                  <Ionicons name={option.icon} size={15} color={selected ? '#fffaf3' : '#178f79'} />
                  <Text style={[styles.travelModeButtonText, selected && styles.travelModeButtonTextSelected]}>{option.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : null}
        {featureOptions && featureOptions.length > 1 && onToggleFeaturesOpen ? (
          <View style={styles.stepFeatureBox}>
            <TouchableOpacity
              style={styles.stepFeatureHeader}
              onPress={(event: GestureResponderEvent) => {
                event.stopPropagation();
                onToggleFeaturesOpen();
              }}
            >
              <Text style={styles.stepFeatureHeaderText}>
                {featuresExpanded && selectedFeatures?.length ? 'Select things here' : featuresExpanded ? 'Hide things here' : `${featureOptions.length} things here`}
              </Text>
            </TouchableOpacity>
            {!featuresExpanded && selectedFeatures?.length ? (
              <View style={styles.stepSelectedFeatureList}>
                {selectedFeatures.map((feature) => (
                  <View key={`selected-${feature}`} style={styles.stepSelectedFeaturePill}>
                    <Text style={styles.stepSelectedFeatureText}>✓ {feature}</Text>
                  </View>
                ))}
              </View>
            ) : null}
            {featuresExpanded ? (
              <View style={styles.stepFeatureList}>
                {featureOptions.map((feature) => {
                  const selected = selectedFeatures?.includes(feature);
                  return (
                    <TouchableOpacity
                      key={feature}
                      style={[styles.stepFeatureItem, selected && styles.stepFeatureItemSelected]}
                      onPress={(event: GestureResponderEvent) => {
                        event.stopPropagation();
                        onToggleFeature?.(feature);
                      }}
                    >
                      <Text style={[styles.stepFeatureCheck, selected && styles.stepFeatureCheckSelected]}>{selected ? '✓' : '+'}</Text>
                      <Text style={[styles.stepFeatureText, selected && styles.stepFeatureTextSelected]}>{feature}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : null}
          </View>
        ) : null}
        {actionLabel && onActionPress || mapLabel && onMapPress || shareLabel && onSharePress || moveUpLabel && onMoveUpPress || moveDownLabel && onMoveDownPress || removeLabel && onRemovePress ? (
          <View style={styles.stepActionRow}>
            {actionLabel && onActionPress ? (
              <TouchableOpacity
                style={[styles.stepActionButton, active && styles.stepActionButtonActive]}
                onPress={(event: GestureResponderEvent) => {
                  event.stopPropagation();
                  Keyboard.dismiss();
                  onActionPress();
                }}
              >
                <Text style={[styles.stepActionText, active && styles.stepActionTextActive]}>{actionLabel}</Text>
              </TouchableOpacity>
            ) : null}
            {mapLabel && onMapPress ? (
              <TouchableOpacity
                style={styles.stepActionButton}
                onPress={(event: GestureResponderEvent) => {
                  event.stopPropagation();
                  Keyboard.dismiss();
                  onMapPress();
                }}
              >
                <Text style={styles.stepActionText}>{mapLabel}</Text>
              </TouchableOpacity>
            ) : null}
            {shareLabel && onSharePress ? (
              <TouchableOpacity
                style={styles.stepActionButton}
                onPress={(event: GestureResponderEvent) => {
                  event.stopPropagation();
                  Keyboard.dismiss();
                  onSharePress();
                }}
              >
                <Text style={styles.stepActionText}>{shareLabel}</Text>
              </TouchableOpacity>
            ) : null}
            {moveUpLabel && onMoveUpPress ? (
              <TouchableOpacity
                style={styles.stepActionButton}
                onPress={(event: GestureResponderEvent) => {
                  event.stopPropagation();
                  Keyboard.dismiss();
                  onMoveUpPress();
                }}
              >
                <Text style={styles.stepActionText}>{moveUpLabel}</Text>
              </TouchableOpacity>
            ) : null}
            {moveDownLabel && onMoveDownPress ? (
              <TouchableOpacity
                style={styles.stepActionButton}
                onPress={(event: GestureResponderEvent) => {
                  event.stopPropagation();
                  Keyboard.dismiss();
                  onMoveDownPress();
                }}
              >
                <Text style={styles.stepActionText}>{moveDownLabel}</Text>
              </TouchableOpacity>
            ) : null}
            {removeLabel && onRemovePress ? (
              <TouchableOpacity
                style={styles.stepActionButton}
                onPress={(event: GestureResponderEvent) => {
                  event.stopPropagation();
                  Keyboard.dismiss();
                  onRemovePress();
                }}
              >
                <Text style={styles.stepActionText}>{removeLabel}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}
      </TouchableOpacity>
    </View>
  );
}

function ArrivalTimeControl({
  value,
  onHourMinus,
  onHourPlus,
  onMinuteMinus,
  onMinutePlus,
}: {
  value: string;
  onHourMinus: () => void;
  onHourPlus: () => void;
  onMinuteMinus: () => void;
  onMinutePlus: () => void;
}) {
  return (
    <View style={styles.arrivalControl}>
      <View style={styles.arrivalTimeRow}>
        <TouchableOpacity style={styles.arrivalButton} onPress={onHourMinus}>
          <Text style={styles.arrivalButtonText}>-1 hr</Text>
        </TouchableOpacity>
        <Text style={styles.arrivalTimeValue}>{value}</Text>
        <TouchableOpacity style={styles.arrivalButton} onPress={onHourPlus}>
          <Text style={styles.arrivalButtonText}>+1 hr</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.arrivalMinuteRow}>
        <TouchableOpacity style={styles.arrivalSmallButton} onPress={onMinuteMinus}>
          <Text style={styles.arrivalSmallButtonText}>-15 min</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.arrivalSmallButton} onPress={onMinutePlus}>
          <Text style={styles.arrivalSmallButtonText}>+15 min</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function TimeStepper({
  label,
  value,
  onMinus,
  onPlus,
}: {
  label: string;
  value: number | string;
  onMinus: () => void;
  onPlus: () => void;
}) {
  return (
    <View style={styles.timeStepper}>
      <Text style={styles.timeStepperLabel}>{label}</Text>
      <View style={styles.timeStepperControls}>
        <TouchableOpacity style={styles.timeStepperButton} onPress={onMinus}>
          <Text style={styles.timeStepperButtonText}>-</Text>
        </TouchableOpacity>
        <Text style={styles.timeStepperValue}>{value}</Text>
        <TouchableOpacity style={styles.timeStepperButton} onPress={onPlus}>
          <Text style={styles.timeStepperButtonText}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function Button({
  label,
  onPress,
  primary,
  disabled,
  compact,
}: {
  label: string;
  onPress: () => void;
  primary?: boolean;
  disabled?: boolean;
  compact?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[
        styles.button,
        primary && styles.primaryButton,
        compact && styles.compactButton,
        disabled && styles.disabledButton,
      ]}
      onPress={() => {
        Keyboard.dismiss();
        void onPress();
      }}
      disabled={disabled}
    >
      <Text style={[styles.buttonText, primary && styles.primaryButtonText]}>{label}</Text>
    </TouchableOpacity>
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
    backgroundColor: '#fff7ed',
  },
  keyboardAvoider: {
    flex: 1,
  },
  screen: {
    flex: 1,
    backgroundColor: '#fff7ed',
  },
  lightScreen: {
    backgroundColor: '#fff7ed',
  },
  darkScreen: {
    backgroundColor: '#071827',
  },
  content: {
    flexGrow: 1,
    padding: 16,
    paddingTop: 12,
    paddingBottom: 42,
  },
  appBanner: {
    minHeight: 72,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#eadccb',
    backgroundColor: '#fffaf3',
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 6,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  bannerBrand: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bannerLogoMark: {
    width: 52,
    height: 50,
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
    color: '#071827',
    fontSize: 23,
    lineHeight: 27,
    fontWeight: '900',
    flexShrink: 1,
  },
  bannerNameMain: {
    color: '#071827',
    fontWeight: '900',
  },
  bannerNameMainDark: {
    color: '#fffaf3',
  },
  bannerNameGo: {
    color: '#66c5a8',
    fontWeight: '900',
    flexShrink: 0,
  },
  bannerTagline: {
    color: '#526170',
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '900',
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
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#eadccb',
    backgroundColor: '#fffdf8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  homeBox: {
    backgroundColor: '#fffaf3',
    borderWidth: 1,
    borderColor: '#eadccb',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    gap: 16,
  },
  homeTitleBlock: {
    gap: 2,
  },
  homeTitle: {
    color: '#071827',
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '900',
  },
  homeSubtitle: {
    color: '#526170',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '900',
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
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  homeNowButton: {
    backgroundColor: '#071827',
  },
  homeLaterButton: {
    backgroundColor: '#178f79',
  },
  homeSavedButton: {
    backgroundColor: '#f23b35',
  },
  homeMainButtonText: {
    color: '#fffaf3',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '900',
    textAlign: 'center',
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
  setupLabel: {
    color: '#526170',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  setupActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  hero: {
    backgroundColor: '#fffaf3',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingTop: 12,
    paddingBottom: 12,
    marginTop: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#eadccb',
  },
  lightHero: {
    backgroundColor: '#fffaf3',
    borderColor: '#eadccb',
  },
  darkHero: {
    backgroundColor: '#fffaf3',
    borderColor: '#2a3f52',
  },
  webHero: {
    backgroundColor: '#f8fffc',
    borderColor: '#b7e5d6',
  },
  darkPanel: {
    backgroundColor: '#102338',
    borderColor: '#2a3f52',
  },
  darkAccentPanel: {
    backgroundColor: '#123a35',
    borderColor: '#66c5a8',
  },
  darkCard: {
    backgroundColor: '#102338',
    borderColor: '#2a3f52',
  },
  darkModalCard: {
    backgroundColor: '#102338',
    borderColor: '#2a3f52',
  },
  darkText: {
    color: '#fffaf3',
  },
  darkMutedText: {
    color: '#d8c8b7',
  },
  darkChip: {
    backgroundColor: '#071827',
    borderColor: '#2a3f52',
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
    backgroundColor: '#fffaf3',
    borderWidth: 1,
    borderColor: '#eadccb',
    borderRadius: 8,
    padding: 16,
  },
  webAuthCard: {
    backgroundColor: '#eefaf5',
    borderColor: '#66c5a8',
  },
  authTitle: {
    color: '#071827',
    fontSize: 24,
    fontWeight: '900',
    marginBottom: 8,
  },
  authCopy: {
    color: '#526170',
    fontSize: 15,
    lineHeight: 21,
    marginBottom: 14,
  },
  authHint: {
    color: '#526170',
    fontWeight: '800',
  },
  alphaGateShell: {
    flex: 1,
    justifyContent: 'center',
    padding: 18,
  },
  testerDropdown: {
    borderWidth: 1,
    borderColor: '#eadccb',
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#fffdf8',
  },
  webTesterDropdown: {
    borderColor: '#b7e5d6',
    backgroundColor: '#f8fffc',
  },
  testerOption: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f0e3d4',
  },
  webTesterOption: {
    borderBottomColor: '#d6f2e9',
  },
  testerOptionText: {
    color: '#071827',
    fontSize: 16,
    fontWeight: '900',
  },
  authFinePrint: {
    color: '#6b7280',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 12,
  },
  usageBox: {
    backgroundColor: '#071827',
    borderWidth: 1,
    borderColor: '#f23b35',
    borderRadius: 8,
    padding: 12,
    marginBottom: 14,
    alignItems: 'stretch',
    gap: 10,
  },
  usageTextBlock: {
    gap: 3,
  },
  usageName: {
    color: '#fffaf3',
    fontWeight: '900',
    fontSize: 15,
  },
  usageText: {
    color: '#f5d7c2',
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
    backgroundColor: 'rgba(7, 24, 39, 0.18)',
    alignItems: 'flex-end',
    paddingTop: 76,
    paddingHorizontal: 16,
  },
  accountCard: {
    width: '100%',
    maxWidth: 320,
    zIndex: 1,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#eadccb',
    backgroundColor: '#fffaf3',
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
    borderRadius: 21,
    backgroundColor: '#fffdf8',
    borderWidth: 1,
    borderColor: '#eadccb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountTextBlock: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  accountName: {
    color: '#071827',
    fontSize: 18,
    fontWeight: '900',
  },
  accountUsage: {
    color: '#526170',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '800',
  },
  accountSettingList: {
    gap: 10,
  },
  accountSettingLabel: {
    color: '#526170',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  accountSettingValue: {
    color: '#071827',
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
    backgroundColor: '#ffd9cf',
    borderWidth: 1,
    borderColor: '#f23b35',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 14,
  },
  toastText: {
    color: '#071827',
    fontSize: 14,
    fontWeight: '900',
  },
  eyebrow: {
    color: '#f23b35',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  lightEyebrow: {
    color: '#f23b35',
  },
  eyebrowDark: {
    color: '#f23b35',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0,
    textTransform: 'uppercase',
    marginBottom: 3,
  },
  title: {
    color: '#071827',
    fontSize: 31,
    fontWeight: '900',
  },
  brandTitle: {
    fontSize: 44,
    fontWeight: '900',
  },
  brandTitleMain: {
    color: '#071827',
    fontWeight: '900',
  },
  brandTitleGo: {
    color: '#ff3b30',
    fontWeight: '900',
  },
  lightTitle: {
    color: '#111827',
  },
  taglineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 10,
  },
  taglineText: {
    color: '#071827',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 4,
  },
  taglinePin: {
    width: 16,
    height: 21,
    borderRadius: 10,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '45deg' }],
  },
  taglinePinDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#fffaf3',
  },
  heroCopy: {
    color: '#d1fae5',
    marginTop: 10,
    marginBottom: 14,
    fontSize: 15,
    lineHeight: 21,
  },
  lightHeroCopy: {
    color: '#526170',
  },
  filterTabs: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 2,
    marginBottom: 14,
  },
  filterTab: {
    minHeight: 36,
    borderRadius: 8,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fffdf8',
    borderWidth: 1,
    borderColor: '#eadccb',
  },
  filterTabActive: {
    backgroundColor: '#ffd9cf',
    borderColor: '#ff5a4f',
  },
  filterTabText: {
    color: '#526170',
    fontWeight: '900',
  },
  filterTabTextActive: {
    color: '#071827',
  },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  statusGood: {
    backgroundColor: '#dcfce7',
  },
  statusBad: {
    backgroundColor: '#fee2e2',
  },
  statusText: {
    color: '#052e16',
    fontSize: 12,
    fontWeight: '900',
  },
  provider: {
    color: '#64748b',
    marginTop: 5,
    fontSize: 14,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    color: '#071827',
    fontSize: 17,
    fontWeight: '900',
    marginBottom: 10,
  },
  lightSectionTitle: {
    color: '#111827',
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderWidth: 1,
    borderColor: '#eadccb',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: '#fffdf8',
  },
  chipActive: {
    backgroundColor: '#dff7ef',
    borderColor: '#66c5a8',
  },
  chipText: {
    color: '#526170',
    fontWeight: '700',
  },
  chipTextActive: {
    color: '#071827',
  },
  sessionBox: {
    backgroundColor: '#fffdf8',
    borderWidth: 1,
    borderColor: '#66c5a8',
    borderRadius: 8,
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
    color: '#526170',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  sessionSubhead: {
    color: '#071827',
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
    borderColor: '#c7eadf',
    borderRadius: 8,
    backgroundColor: '#f3fbf7',
    padding: 10,
  },
  sessionResumeTitle: {
    color: '#071827',
    fontSize: 14,
    fontWeight: '900',
  },
  sessionResumeMeta: {
    color: '#526170',
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
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#c7eadf',
    backgroundColor: '#f3fbf7',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  sessionOwnerPill: {
    backgroundColor: '#ffd9cf',
    borderColor: '#ff5a4f',
  },
  sessionParticipantText: {
    color: '#071827',
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
    borderColor: '#eadccb',
    borderRadius: 8,
    backgroundColor: '#fff7ed',
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
    color: '#071827',
    fontSize: 15,
    fontWeight: '900',
    flex: 1,
  },
  sessionVoteCount: {
    minWidth: 32,
    minHeight: 28,
    borderRadius: 8,
    backgroundColor: '#071827',
    color: '#fffaf3',
    textAlign: 'center',
    textAlignVertical: 'center',
    paddingTop: Platform.OS === 'ios' ? 5 : 4,
    fontSize: 13,
    fontWeight: '900',
  },
  sessionSuggestionMeta: {
    color: '#526170',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
  },
  sessionFinalBox: {
    borderTopWidth: 1,
    borderTopColor: '#c7eadf',
    paddingTop: 12,
    gap: 10,
  },
  sessionRecommendationBox: {
    borderWidth: 1,
    borderColor: '#c7eadf',
    borderRadius: 8,
    backgroundColor: '#f3fbf7',
    padding: 12,
    gap: 7,
  },
  sessionRecommendationLine: {
    color: '#071827',
    fontSize: 14,
    fontWeight: '900',
  },
  planBox: {
    backgroundColor: '#fffdf8',
    borderWidth: 1,
    borderColor: '#ffc84a',
    borderRadius: 8,
    padding: 14,
    marginBottom: 16,
  },
  lightPanel: {
    backgroundColor: '#fffdf8',
    borderColor: '#eadccb',
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
  planTitleBlock: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  planTitle: {
    color: '#071827',
    fontSize: 20,
    fontWeight: '900',
    maxWidth: 210,
  },
  lockedPlanTitle: {
    color: '#071827',
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '900',
  },
  planTitleInput: {
    width: '100%',
    minHeight: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#eadccb',
    backgroundColor: '#fffdf8',
    color: '#071827',
    paddingHorizontal: 10,
    fontSize: 18,
    fontWeight: '900',
  },
  planMetaText: {
    color: '#526170',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '800',
  },
  savedPlansBox: {
    borderWidth: 1,
    borderColor: '#66c5a8',
    borderRadius: 8,
    padding: 14,
    marginBottom: 16,
    backgroundColor: '#fffdf8',
  },
  savedPlansHeader: {
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
    color: '#526170',
    fontSize: 13,
    lineHeight: 18,
  },
  savedPlansList: {
    gap: 10,
    marginTop: 12,
  },
  savedPlanItem: {
    borderWidth: 1,
    borderColor: '#eadccb',
    borderRadius: 8,
    backgroundColor: '#fff7ed',
    padding: 12,
    gap: 10,
  },
  savedPlanTextBlock: {
    gap: 4,
  },
  savedPlanTitle: {
    color: '#071827',
    fontSize: 16,
    fontWeight: '900',
  },
  savedPlanMeta: {
    color: '#f23b35',
    fontSize: 12,
    fontWeight: '800',
  },
  savedPlanStops: {
    color: '#526170',
    fontSize: 13,
    lineHeight: 18,
  },
  savedPlanActions: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  startWithLabel: {
    color: '#526170',
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
    minHeight: 58,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startChoiceFood: {
    backgroundColor: '#071827',
    borderColor: '#071827',
  },
  startChoiceActivity: {
    backgroundColor: '#071827',
    borderColor: '#071827',
  },
  startChoiceLabel: {
    fontSize: 16,
    fontWeight: '900',
    textAlign: 'center',
  },
  startChoiceFoodLabel: {
    color: '#fffaf3',
  },
  startChoiceActivityLabel: {
    color: '#fffaf3',
  },
  routeImportBox: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#eadccb',
    borderRadius: 8,
    backgroundColor: '#fff7ed',
    padding: 12,
    gap: 8,
  },
  routeImportError: {
    color: '#b91c1c',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '800',
  },
  lockedPlanCard: {
    borderWidth: 1,
    borderColor: '#66c5a8',
    borderRadius: 8,
    backgroundColor: '#eefaf5',
    padding: 10,
    gap: 8,
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
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d8efe7',
    backgroundColor: '#fffdf8',
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
    color: '#526170',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '900',
  },
  lockedPlanLeave: {
    color: '#526170',
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '800',
  },
  lockedPlanInvitees: {
    color: '#526170',
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '800',
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
    minHeight: 34,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d8efe7',
    backgroundColor: '#fffdf8',
    paddingHorizontal: 8,
    paddingVertical: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  lockedStopIndex: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#f23b35',
    color: '#fffaf3',
    textAlign: 'center',
    lineHeight: 24,
    fontSize: 12,
    fontWeight: '900',
  },
  lockedStopTime: {
    width: 68,
    color: '#178f79',
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
    color: '#526170',
    fontSize: 9,
    lineHeight: 11,
    fontWeight: '900',
    textAlign: 'center',
  },
  lockedStopTextBlock: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  lockedStopName: {
    color: '#071827',
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '900',
  },
  lockedStopCityPill: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
    borderRadius: 999,
    backgroundColor: '#e9f8f2',
    borderWidth: 1,
    borderColor: '#c9eadf',
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  lockedStopCityText: {
    color: '#178f79',
    fontSize: 9,
    lineHeight: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  timeline: {
    gap: 0,
  },
  timelineStopGroup: {
    gap: 0,
  },
  stepRow: {
    flexDirection: 'row',
    gap: 10,
  },
  stepRail: {
    width: 30,
    alignItems: 'center',
  },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#f3e5d6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotActive: {
    backgroundColor: '#f23b35',
  },
  stepNumber: {
    color: '#526170',
    fontSize: 12,
    fontWeight: '900',
  },
  stepNumberActive: {
    color: '#fffaf3',
  },
  stepLine: {
    width: 3,
    flex: 1,
    minHeight: 42,
    backgroundColor: '#eadccb',
  },
  stepCard: {
    flex: 1,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#eadccb',
    backgroundColor: '#fffdf8',
    padding: 11,
    marginBottom: 10,
  },
  stepCardActive: {
    borderColor: '#66c5a8',
    backgroundColor: '#eefaf5',
  },
  stepTopLine: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  stepTextBlock: {
    flex: 1,
    minWidth: 0,
  },
  stepTitle: {
    color: '#f23b35',
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  stepValue: {
    color: '#071827',
    fontSize: 15,
    fontWeight: '900',
    marginTop: 3,
  },
  stepValueActive: {
    color: '#071827',
  },
  stepCityState: {
    color: '#526170',
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '800',
    marginTop: 2,
  },
  stepTravelBadge: {
    minWidth: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#c9eadf',
    backgroundColor: '#f8fffc',
    paddingHorizontal: 6,
    paddingVertical: 5,
    gap: 2,
  },
  stepTravelDuration: {
    color: '#178f79',
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '900',
    textAlign: 'center',
  },
  stepDetail: {
    color: '#526170',
    fontSize: 12,
    marginTop: 0,
  },
  stepDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },
  stepDetailActive: {
    color: '#526170',
  },
  travelModeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  travelModeButton: {
    minHeight: 30,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#c9eadf',
    backgroundColor: '#f8fffc',
    paddingHorizontal: 8,
    paddingVertical: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  travelModeButtonSelected: {
    backgroundColor: '#178f79',
    borderColor: '#178f79',
  },
  travelModeButtonText: {
    color: '#178f79',
    fontSize: 11,
    lineHeight: 13,
    fontWeight: '900',
  },
  travelModeButtonTextSelected: {
    color: '#fffaf3',
  },
  stepFeatureSummary: {
    color: '#178f79',
    fontSize: 12,
    fontWeight: '800',
    marginTop: 6,
  },
  stepFeatureBox: {
    marginTop: 8,
  },
  stepFeatureHeader: {
    alignSelf: 'flex-start',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#66c5a8',
    backgroundColor: '#e9f8f2',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  stepFeatureHeaderText: {
    color: '#071827',
    fontSize: 12,
    fontWeight: '900',
  },
  stepSelectedFeatureList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  stepSelectedFeaturePill: {
    borderRadius: 8,
    backgroundColor: '#fff3d8',
    borderWidth: 1,
    borderColor: '#ffc84a',
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  stepSelectedFeatureText: {
    color: '#071827',
    fontSize: 12,
    fontWeight: '900',
  },
  stepFeatureList: {
    marginTop: 8,
    gap: 7,
  },
  stepFeatureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#eadccb',
    backgroundColor: '#fffdf8',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  stepFeatureItemSelected: {
    borderColor: '#66c5a8',
    backgroundColor: '#dff7ef',
  },
  stepFeatureCheck: {
    width: 20,
    color: '#526170',
    fontSize: 14,
    fontWeight: '900',
    textAlign: 'center',
  },
  stepFeatureCheckSelected: {
    color: '#178f79',
  },
  stepFeatureText: {
    flex: 1,
    color: '#526170',
    fontSize: 13,
    fontWeight: '800',
  },
  stepFeatureTextSelected: {
    color: '#071827',
  },
  stepActionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 9,
  },
  stepActionButton: {
    alignSelf: 'flex-start',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#eadccb',
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: '#fffdf8',
  },
  stepActionButtonActive: {
    borderColor: '#66c5a8',
    backgroundColor: '#dff7ef',
  },
  stepActionText: {
    color: '#526170',
    fontSize: 12,
    fontWeight: '900',
  },
  stepActionTextActive: {
    color: '#071827',
  },
  itineraryAddRow: {
    flexDirection: 'row',
    gap: 8,
    marginLeft: 40,
    marginBottom: 10,
  },
  timeEditor: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#eadccb',
    backgroundColor: '#fffdf8',
    padding: 10,
    marginLeft: 40,
    marginBottom: 10,
  },
  timeEditorTitle: {
    color: '#111827',
    fontSize: 13,
    fontWeight: '900',
    marginBottom: 8,
  },
  timeStepperGroupLabel: {
    color: '#526170',
    fontSize: 12,
    fontWeight: '900',
    marginTop: 6,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  timeClockValue: {
    color: '#111827',
    fontSize: 20,
    fontWeight: '900',
    marginBottom: 8,
  },
  arrivalControl: {
    gap: 8,
    marginBottom: 6,
  },
  arrivalTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  arrivalTimeValue: {
    flex: 1,
    color: '#111827',
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'center',
  },
  arrivalButton: {
    borderRadius: 8,
    backgroundColor: '#fff3d8',
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  arrivalButtonText: {
    color: '#111827',
    fontSize: 13,
    fontWeight: '900',
  },
  arrivalMinuteRow: {
    flexDirection: 'row',
    gap: 8,
  },
  arrivalSmallButton: {
    flex: 1,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#eadccb',
    backgroundColor: '#fffdf8',
    paddingVertical: 10,
    alignItems: 'center',
  },
  arrivalSmallButtonText: {
    color: '#526170',
    fontSize: 13,
    fontWeight: '900',
  },
  timeControls: {
    flexDirection: 'row',
    gap: 8,
  },
  timeEditorActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 10,
  },
  timeStepper: {
    flex: 1,
  },
  timeStepperLabel: {
    color: '#526170',
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 5,
  },
  timeStepperControls: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#eadccb',
    backgroundColor: '#fffdf8',
    overflow: 'hidden',
  },
  timeStepperButton: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff3d8',
  },
  timeStepperButtonText: {
    color: '#111827',
    fontSize: 18,
    fontWeight: '900',
  },
  timeStepperValue: {
    flex: 1,
    color: '#111827',
    fontSize: 16,
    fontWeight: '900',
    textAlign: 'center',
  },
  planActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  bridgeBox: {
    borderWidth: 1,
    borderColor: '#ffb6a9',
    borderRadius: 8,
    backgroundColor: '#fffdf8',
    marginBottom: 16,
    padding: 14,
    gap: 8,
  },
  webBridgeBox: {
    borderColor: '#66c5a8',
    backgroundColor: '#eefaf5',
  },
  routeOriginBox: {
    borderTopWidth: 1,
    borderTopColor: '#eadccb',
    marginTop: 10,
    paddingTop: 12,
    gap: 8,
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
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#eadccb',
    backgroundColor: '#fffdf8',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  dateChipActive: {
    borderColor: '#66c5a8',
    backgroundColor: '#dff7ef',
  },
  dateChipText: {
    color: '#071827',
    fontSize: 12,
    fontWeight: '900',
  },
  dateChipTextActive: {
    color: '#178f79',
  },
  customDateBox: {
    borderWidth: 1,
    borderColor: '#eadccb',
    borderRadius: 8,
    backgroundColor: '#fffdf8',
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
    color: '#526170',
    fontSize: 12,
    lineHeight: 17,
  },
  bridgeTitle: {
    color: '#071827',
    fontWeight: '900',
  },
  bridgeTitleDarkPanel: {
    color: '#071827',
  },
  planLine: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 5,
  },
  planLabel: {
    width: 72,
    color: '#178f79',
    fontWeight: '800',
  },
  planValue: {
    flex: 1,
    color: '#071827',
  },
  inputLabel: {
    color: '#071827',
    fontWeight: '700',
    marginTop: 12,
    marginBottom: 6,
  },
  inputRow: {
    flexDirection: 'row',
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
    minHeight: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#eadccb',
    paddingHorizontal: 12,
    color: '#071827',
    backgroundColor: '#fffdf8',
  },
  webInput: {
    borderColor: '#b7e5d6',
    backgroundColor: '#f8fffc',
  },
  darkPanelInput: {
    borderColor: '#eadccb',
    color: '#071827',
    backgroundColor: '#fffdf8',
  },
  buttonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: 10,
    rowGap: 10,
    marginTop: 12,
  },
  button: {
    minHeight: 42,
    borderRadius: 8,
    paddingHorizontal: 13,
    paddingVertical: 10,
    backgroundColor: '#071827',
    justifyContent: 'center',
    alignItems: 'center',
  },
  compactButton: {
    minWidth: 76,
    minHeight: 38,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  primaryButton: {
    backgroundColor: '#f23b35',
  },
  disabledButton: {
    opacity: 0.55,
  },
  buttonText: {
    color: '#fffaf3',
    fontWeight: '800',
  },
  primaryButtonText: {
    color: '#fffaf3',
  },
  spinner: {
    marginTop: 10,
  },
  pairingBox: {
    borderWidth: 1,
    borderColor: '#66c5a8',
    borderRadius: 8,
    padding: 14,
    marginBottom: 16,
    backgroundColor: '#e9f8f2',
  },
  lightPairingBox: {
    backgroundColor: '#e9f8f2',
    borderColor: '#66c5a8',
  },
  pairingHeader: {
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
    color: '#526170',
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
    borderRadius: 8,
    backgroundColor: '#178f79',
    paddingHorizontal: 11,
    paddingVertical: 9,
  },
  mapChipText: {
    color: '#ecfeff',
    fontWeight: '800',
  },
  preferencesBox: {
    borderWidth: 1,
    borderColor: '#ffc84a',
    borderRadius: 8,
    backgroundColor: '#fffdf8',
    marginBottom: 16,
    overflow: 'hidden',
  },
  preferencesHeader: {
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  preferenceSummary: {
    color: '#526170',
    fontSize: 13,
    marginTop: -3,
  },
  lightMutedText: {
    color: '#526170',
  },
  headerActionButton: {
    minWidth: 76,
    minHeight: 38,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#071827',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  headerActionText: {
    color: '#fffaf3',
    fontWeight: '900',
  },
  preferencesContent: {
    borderTopWidth: 1,
    borderTopColor: '#eadccb',
    padding: 14,
    paddingTop: 12,
    gap: 12,
  },
  preferenceGroup: {
    gap: 8,
  },
  bottomHideButton: {
    minHeight: 42,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#eadccb',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    backgroundColor: '#071827',
  },
  bottomHideText: {
    color: '#fffaf3',
    fontWeight: '900',
  },
  filterLabel: {
    color: '#f23b35',
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    marginTop: 4,
  },
  preferenceMoreChip: {
    borderColor: '#66c5a8',
  },
  preferenceMoreText: {
    fontWeight: '900',
  },
  advancedPreferenceHeader: {
    borderTopWidth: 1,
    borderTopColor: '#eadccb',
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
    color: '#526170',
    fontSize: 15,
    lineHeight: 21,
  },
  emptyState: {
    borderWidth: 1,
    borderColor: '#eadccb',
    borderRadius: 8,
    padding: 14,
    backgroundColor: '#fffdf8',
  },
  preSearchEmptyState: {
    marginBottom: 16,
  },
  emptyTitle: {
    color: '#071827',
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 5,
  },
  loadingResults: {
    borderWidth: 1,
    borderColor: '#eadccb',
    borderRadius: 8,
    padding: 14,
    backgroundColor: '#fffdf8',
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  loadingResultsText: {
    color: '#071827',
    fontWeight: '900',
  },
  card: {
    borderWidth: 1,
    borderColor: '#ffc84a',
    backgroundColor: '#fffdf8',
    borderRadius: 8,
    padding: 14,
    marginBottom: 12,
  },
  cardSelected: {
    borderColor: '#66c5a8',
    backgroundColor: '#eefaf5',
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  cardRank: {
    color: '#f23b35',
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  cardRankSelected: {
    color: '#178f79',
  },
  cardHours: {
    color: '#526170',
    fontSize: 12,
    fontWeight: '900',
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  cardFavoriteButton: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#071827',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  cardFavoriteButtonActive: {
    borderWidth: 1,
    borderColor: '#ffc84a',
  },
  shareOverlay: {
    flex: 1,
    backgroundColor: 'rgba(7, 24, 39, 0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
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
    borderRadius: 8,
    backgroundColor: '#fffaf3',
    borderWidth: 1,
    borderColor: '#eadccb',
    padding: 18,
    gap: 10,
  },
  planPreviewTitle: {
    color: '#071827',
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
    color: '#526170',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '900',
  },
  planPreviewStopList: {
    gap: 8,
  },
  planPreviewStopRow: {
    minHeight: 42,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#eadccb',
    backgroundColor: '#fffdf8',
    paddingHorizontal: 10,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  planPreviewStopIndex: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#f23b35',
    color: '#fffaf3',
    textAlign: 'center',
    lineHeight: 28,
    fontSize: 13,
    fontWeight: '900',
  },
  planPreviewStopTime: {
    width: 76,
    color: '#178f79',
    fontSize: 13,
    fontWeight: '900',
  },
  planPreviewTravelBlock: {
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
  },
  planPreviewTravelText: {
    color: '#526170',
    fontSize: 9,
    lineHeight: 11,
    fontWeight: '900',
    textAlign: 'center',
  },
  planPreviewStopName: {
    flex: 1,
    color: '#071827',
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '900',
  },
  shareCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 8,
    backgroundColor: '#fffaf3',
    padding: 18,
  },
  shareControlPanel: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 8,
    backgroundColor: '#fffaf3',
    borderWidth: 1,
    borderColor: '#eadccb',
    padding: 12,
  },
  quickShareCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 8,
    backgroundColor: '#fffaf3',
    padding: 18,
    borderWidth: 1,
    borderColor: '#eadccb',
  },
  quickShareTitle: {
    color: '#071827',
    fontSize: 22,
    fontWeight: '900',
  },
  quickSharePlace: {
    color: '#f23b35',
    fontSize: 16,
    fontWeight: '900',
    marginTop: 6,
    marginBottom: 14,
  },
  quickShareHint: {
    color: '#526170',
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
    borderRadius: 8,
    backgroundColor: '#dff7ef',
    borderWidth: 1,
    borderColor: '#66c5a8',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  quickShareUserButtonSelected: {
    backgroundColor: '#ffd9cf',
    borderColor: '#ff5a4f',
  },
  quickShareUserText: {
    color: '#071827',
    fontWeight: '900',
  },
  routeOptionHint: {
    color: '#526170',
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
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#66c5a8',
    backgroundColor: '#dff7ef',
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  routeOptionButtonText: {
    color: '#071827',
    fontSize: 15,
    fontWeight: '900',
    flexShrink: 1,
  },
  shareHeader: {
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#eadccb',
    paddingBottom: 12,
    marginBottom: 14,
  },
  shareBrand: {
    color: '#071827',
    fontSize: 31,
    fontWeight: '900',
  },
  shareTagline: {
    color: '#526170',
    fontSize: 11,
    fontWeight: '900',
    marginTop: 3,
  },
  shareTitle: {
    color: '#071827',
    fontSize: 20,
    fontWeight: '900',
    marginBottom: 10,
  },
  shareMetaLine: {
    color: '#526170',
    fontSize: 12,
    fontWeight: '900',
    marginTop: -4,
    marginBottom: 10,
  },
  shareLeaveTime: {
    color: '#071827',
    fontSize: 14,
    fontWeight: '900',
    backgroundColor: '#fff3d8',
    borderWidth: 1,
    borderColor: '#ffc84a',
    borderRadius: 8,
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
    borderRadius: 14,
    backgroundColor: '#f23b35',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareStopNumberText: {
    color: '#fffaf3',
    fontWeight: '900',
  },
  shareStopBody: {
    flex: 1,
  },
  shareStopType: {
    color: '#178f79',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  shareStopName: {
    color: '#071827',
    fontSize: 16,
    fontWeight: '900',
    marginTop: 2,
  },
  shareStopTime: {
    color: '#526170',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  shareLockedStopList: {
    gap: 6,
    marginBottom: 14,
  },
  shareLockedStopRow: {
    minHeight: 34,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#eadccb',
    backgroundColor: '#fffdf8',
    paddingHorizontal: 8,
    paddingVertical: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  shareLockedStopIndex: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#f23b35',
    color: '#fffaf3',
    textAlign: 'center',
    lineHeight: 24,
    fontSize: 12,
    fontWeight: '900',
  },
  shareLockedStopTime: {
    width: 68,
    color: '#178f79',
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
    color: '#526170',
    fontSize: 9,
    lineHeight: 11,
    fontWeight: '900',
    textAlign: 'center',
  },
  shareLockedStopName: {
    flex: 1,
    color: '#071827',
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '900',
  },
  shareFooter: {
    color: '#526170',
    fontSize: 12,
    fontWeight: '800',
    marginTop: 4,
    marginBottom: 14,
  },
  shareActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 4,
  },
  cardTitle: {
    flex: 1,
    color: '#071827',
    fontSize: 19,
    fontWeight: '900',
  },
  cardSubtitle: {
    color: '#178f79',
    fontWeight: '700',
    marginTop: 5,
  },
  cardDistance: {
    color: '#526170',
    marginTop: 6,
    fontSize: 12,
    fontWeight: '900',
  },
  address: {
    color: '#526170',
    marginTop: 7,
  },
  hoursDetail: {
    color: '#526170',
    marginTop: 8,
    fontWeight: '700',
    lineHeight: 18,
  },
  hours: {
    color: '#526170',
    marginTop: 7,
    fontWeight: '800',
  },
  open: {
    color: '#178f79',
  },
  closed: {
    color: '#f23b35',
  },
  utilityBox: {
    marginTop: 4,
    marginBottom: 18,
  },
  muted: {
    color: '#526170',
    marginBottom: 8,
  },
  filterSpacer: {
    height: 8,
  },
});
