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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

type PlanSlot = 'food' | 'activity';
type PairingSuggestion = {
  label: string;
  slot: PlanSlot;
  selections: string[];
  searchText: string;
  combo?: Array<{ slot: PlanSlot; item: PlaceCard | string }>;
};
type ResultFilter = 'all' | 'favorites';
type DateWindowId = 'today' | 'tomorrow' | 'next3' | 'weekend' | 'nextWeekend' | 'custom';
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
  featureOptions?: string[];
  selectedFeatures?: string[];
  featuresExpanded?: boolean;
};

type ConfirmedPlan = {
  stops: ItineraryStop[];
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
  createdAt: number;
  source: 'saved' | 'shared';
  owner?: string;
  sharedBy?: string;
  sharedTo?: string;
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
const PAGE_SIZE = 8;
const FACTORY_EXPERIENCE_URL = 'https://factoryatfranklin.com/experience/';
const DEV_SHARE_USERS = ['Alex', 'Jordan', 'Taylor', 'Morgan'];
const TEST_USERS = ['BDM', ...DEV_SHARE_USERS];

const MOODS = ['Easy', 'Fun', 'Hungry', 'Tired', 'Bored', 'Date', 'Social', 'New', 'Cheap', 'Kid-friendly', 'Cozy', 'Active'];
const TIMES = ['Now', 'Morning', 'Lunch', 'Afternoon', 'Dinner', 'Late night'];
const WEATHER = ['Mild', 'Nice', 'Hot', 'Cold', 'Rainy', 'Unknown'];
const DATE_WINDOW_IDS: DateWindowId[] = ['today', 'tomorrow', 'next3', 'weekend', 'nextWeekend', 'custom'];
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
const ACTIVITIES = ['Any', 'Events', 'Movies', 'Bowling', 'Arcade', 'Park', 'Shopping', 'Museum', 'Dessert', 'Coffee'];

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

function cardToRouteParam(card: PlaceCard | string) {
  if (typeof card !== 'string' && typeof card.lat === 'number' && typeof card.lng === 'number') {
    return `${card.lat},${card.lng}`;
  }
  return cardToName(card);
}

function cardListRouteParams(cards: Array<PlaceCard | string>) {
  return cards.map(cardToRouteParam).filter(Boolean) as string[];
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
  const stops = cardListRouteParams(plan.stops.map((stop) => stop.item));

  const destination = stops[stops.length - 1];
  if (!destination) return undefined;
  const waypoints = stops.slice(0, -1);
  const waypointQuery = waypoints.length ? `&waypoints=${encodeURIComponent(waypoints.join('|'))}` : '';
  return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(
    destination,
  )}${waypointQuery}&travelmode=driving`;
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
) {
  const cuisineStrength = foodCuisineMatchStrength(card, selectedFoods);
  const hasCuisineFilter = cuisineSelections(selectedFoods).length > 0;
  let score = scoreCard(card, memory, selectedMoods) + distanceScore(center, card);

  if (hasCuisineFilter) {
    score += cuisineStrength * 26;
    if (isLikelyFastFood(card) && cuisineStrength <= 1) score -= 50;
    else if (isLikelyFastFood(card) && cuisineStrength < 5) score -= 18;
  }

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

function clockTimeFromOffsetMinutes(totalMinutes: number): StopTime {
  const date = new Date(Date.now() + Math.max(0, Math.round(totalMinutes)) * 60 * 1000);
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

function minutesUntilClockTime(time: StopTime) {
  const now = new Date();
  const target = new Date(now);
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

function estimateDriveMinutes(from: LatLon | undefined, to: PlaceCard | string) {
  const toCoords = stopCoords(to);
  if (!from || !toCoords) return 15;
  const miles = distanceMeters(from, { lat: toCoords.latitude, lng: toCoords.longitude }) / 1609.344;
  return Math.max(5, Math.round(miles <= 1 ? miles * 8 + 3 : miles * 2.4 + 6));
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

function shortDate(date: Date) {
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
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

function formatClockAfterMinutes(totalMinutes: number) {
  const date = new Date(Date.now() + Math.max(0, Math.round(totalMinutes)) * 60 * 1000);
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

const DIFFERANCE_LOGIN_URL = 'https://differancelabs.com/login';
const LAUNCH_TOKEN_PARAM = 'dl_launch_token';

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
        <View style={[styles.authCard, isDarkMode && styles.darkPanel]}>
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
  const [selectedFoods, setSelectedFoods] = useState<string[]>(['Any']);
  const [selectedActivities, setSelectedActivities] = useState<string[]>(['Any']);
  const [plan, setPlan] = useState<ConfirmedPlan>(EMPTY_PLAN);
  const [cards, setCards] = useState<PlaceCard[]>([]);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [logs, setLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [location, setLocation] = useState<LatLon | null>(null);
  const [searchLocation, setSearchLocation] = useState<LatLon | null>(null);
  const [lastSearchLocationCenter, setLastSearchLocationCenter] = useState<LatLon | null>(null);
  const [manualSearch, setManualSearch] = useState('');
  const [manualSearchSubmitted, setManualSearchSubmitted] = useState(false);
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
  const [resultMode, setResultMode] = useState<PlanSlot>('food');
  const [resultFilter, setResultFilter] = useState<ResultFilter>('all');
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [hasInitiatedSearch, setHasInitiatedSearch] = useState(false);
  const [sharePreviewOpen, setSharePreviewOpen] = useState(false);
  const [quickShareTarget, setQuickShareTarget] = useState<QuickShareTarget | null>(null);
  const [savedPlans, setSavedPlans] = useState<SavedPlan[]>([]);
  const [savedPlansOpen, setSavedPlansOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [authLoaded, setAuthLoaded] = useState(false);
  const [testerUser, setTesterUser] = useState<TesterUser | null>(null);
  const [testerAuthenticated, setTesterAuthenticated] = useState(false);
  const [usageMeter, setUsageMeter] = useState<UsageMeter>(emptyUsageMeter());
  selectedDateWindowRef.current = selectedDateWindow;
  customDateRangeRef.current = customDateRange;

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
  const startingLocationLabel = routeOriginOverride.trim() || location?.label || 'Current location';
  const searchLocationLabel = searchLocationOverride.trim() || searchLocation?.label || startingLocationLabel;
  const dateWindowOptions = useMemo(() => DATE_WINDOW_IDS.map((id) => ({ id, label: dateWindowLabel(id, new Date(), customDateRange) })), [customDateRange]);
  const selectedDateWindowText = dateWindowLabel(selectedDateWindow, new Date(), customDateRange);
  const currentTesterName = testerUser?.name || 'Tester';
  const visibleSavedPlans = savedPlans.filter((saved) => {
    if (saved.source === 'shared') return saved.sharedTo === currentTesterName;
    return (saved.owner || saved.sharedBy || 'BDM') === currentTesterName;
  });

  const durationForStop = (stop: ItineraryStop) =>
    (planTimes[stop.key]?.hours || 0) * 60 + (planTimes[stop.key]?.minutes || 0) || defaultStopDurationMinutes(stop);

  const arrivalOverrideForStop = (stop: ItineraryStop) => {
    const override = arrivalTimes[stop.key];
    return override ? override.hours * 60 + override.minutes : undefined;
  };

  const itineraryArrivalMinutes = (targetIndex: number) => {
    let elapsed = 0;
    let from = location || undefined;

    for (let index = 0; index <= targetIndex; index += 1) {
      const stop = plan.stops[index];
      const estimatedArrival = elapsed + estimateDriveMinutes(from, stop.item);
      const arrival = arrivalOverrideForStop(stop) ?? estimatedArrival;
      if (index === targetIndex) return arrival;
      elapsed = arrival + durationForStop(stop);
      from = stopCoords(stop.item);
    }

    return elapsed;
  };

  const stepDetail = (stop: ItineraryStop, index: number) => {
    const arrival = formatClockAfterMinutes(itineraryArrivalMinutes(index));
    const stay = formatStopTime(stopTimeFromMinutes(durationForStop(stop)));
    return `Est. ${arrival} - ${stay} stop`;
  };
  const firstStop = plan.stops[0];
  const firstStopArrivalMinutes = firstStop ? itineraryArrivalMinutes(0) : undefined;
  const firstStopTravelMinutes = firstStop ? estimateDriveMinutes(location || undefined, firstStop.item) : 0;
  const leaveForFirstStopText = firstStop && typeof firstStopArrivalMinutes === 'number'
    ? `Leave around ${formatClockAfterMinutes(Math.max(0, firstStopArrivalMinutes - firstStopTravelMinutes))} from ${startingLocationLabel}`
    : undefined;
  const sharePlanText = () => {
    const lines = ['NomNomGo plan'];
    plan.stops.forEach((stop) => {
      const name = cardToName(stop.item) || 'Stop';
      const url = typeof stop.item !== 'string'
        ? stop.item.mapsUri || mapsSearchUrl(stop.item.title, stop.item)
        : mapsSearchUrl(stop.item, searchLocation || location);
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

  const resetResultsUntilSearch = () => {
    searchRequestIdRef.current += 1;
    setHasInitiatedSearch(false);
    setCards([]);
    setVisibleCount(PAGE_SIZE);
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

  const saveSavedPlans = async (next: SavedPlan[]) => {
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
    ])
      .then(([rawUser, rawUsage, rawSavedPlans]) => {
        if (rawUser) {
          const user = JSON.parse(rawUser) as TesterUser;
          if (user.name) {
            setTesterUser({ name: user.name });
            setTesterAuthenticated(true);
          }
        }
        if (rawUsage) setUsageMeter(normalizeUsageMeter(JSON.parse(rawUsage) as UsageMeter));
        if (rawSavedPlans) setSavedPlans(JSON.parse(rawSavedPlans) as SavedPlan[]);
      })
      .catch((err) => addLog(`Tester profile load failed: ${compactError(err)}`))
      .finally(() => setAuthLoaded(true));
  }, []);

  const saveMemory = async (next: LocalMemory) => {
    setMemory(next);
    await AsyncStorage.setItem(STORAGE_MEMORY, JSON.stringify(next));
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

  const resolveLocationInput = async (value: string) => {
    const isZip = /^\d{5}$/.test(value);
    let next = isZip ? await readCachedZip(value) : undefined;
    if (next) return next;

    const query = isZip ? `${value}, USA` : value;
    const results = await withTimeout(Location.geocodeAsync(query), 12000, `Location ${value}`);
    const match = results[0];
    if (!match) return undefined;

    next = {
      latitude: match.latitude,
      longitude: match.longitude,
      label: value,
    };
    if (isZip) await writeCachedZip(value, next);
    return next;
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

  const getSearchLocation = async () => searchLocation || getLocation();

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

  const searchFoodByTextPreferences = async (center: LatLon, foodSelections: string[]): Promise<PlaceCard[]> => {
    const cuisines = cuisineSelections(foodSelections);
    const baseQueries = cuisines.length
      ? cuisines.flatMap((cuisine) => FOOD_TEXT_QUERY_MAP[cuisine] || [`${cuisine} restaurants`])
      : ['restaurants', 'places to eat', 'best food nearby'];
    const locationLabel = center.label && !/current location|last known location/i.test(center.label) ? center.label : '';
    const locationQueries = locationLabel && cuisines.length
      ? baseQueries.slice(0, 3).map((query) => `${query} near ${locationLabel}`)
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
          found.set(card.id, {
            ...taggedCard,
          });
        });
      } catch (err) {
        addLog(`Food text discovery failed: ${query} ${compactError(err)}`);
      }
    }

    const cards = Array.from(found.values())
      .filter((card) => hasKnownHours(card))
      .sort((a, b) => foodCardScore(b, center, memory, selectedMoods, foodSelections) - foodCardScore(a, center, memory, selectedMoods, foodSelections));
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
  ) => {
    const wantsEvents = slot === 'activity';
    const eventsFocused = slot === 'activity' && selectedActivities.includes('Events');
    const preferenceKey = slot === 'food'
      ? `${wantsNoFastFood(foodSelections) ? '|no-fast-food' : ''}${wantsCloseBy(foodSelections) ? '|close-by' : ''}${wantsOpenNow(foodSelections) ? '|open-now' : ''}${cuisineSelections(foodSelections).join(',')}`
      : `${wantsEvents ? `|events|${EVENT_PROVIDER_CACHE_VERSION}|${selectedDateWindowRef.current}|${customDateRangeRef.current ? `${customDateRangeRef.current.start}-${customDateRangeRef.current.end}` : 'preset'}${eventsFocused ? '|focused' : ''}` : ''}`;
    const cacheKey = `${searchCacheKey(slot, center, types, radiusMeters)}${preferenceKey}`;
    const applyResultFilters = (nextCards: PlaceCard[]) => nextCards.filter((card) => {
      const isFavorite = memory.favorites.includes(card.id);
      if (!hasKnownHours(card)) return false;
      if (slot === 'food' && wantsNoFastFood(foodSelections) && isLikelyFastFood(card)) return false;
      if (slot === 'food' && !isLikelyFoodPreferenceMatch(card, foodSelections)) return false;
      if (slot === 'food' && card.isOpen === false && !isFavorite) return false;
      if (slot === 'activity' && isBadActivityResult(card)) return false;
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
      !wantsCloseBy(selectedFoods) &&
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
        const textFoodCards = await searchFoodByTextPreferences(center, foodSelections);
        unblockedCards = mergeCards(unblockedCards, textFoodCards);
        addLog(`Food text discovery merged: ${unblockedCards.length} cards`);
      } catch (err) {
        addLog(`Food text discovery error: ${compactError(err)}`);
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
    } else if (slot === 'food' && wantsCloseBy(selectedFoods)) {
      addLog('Food radius expansion skipped: Close by selected');
    } else if (slot === 'food') {
      addLog(`Food radius expansion not needed: ${unblockedCards.length} results`);
    }

    if (wantsEvents) {
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

        return activityCardScore(b, center, memory, selectedMoods, selectedActivities, eventsFocused) -
          activityCardScore(a, center, memory, selectedMoods, selectedActivities, eventsFocused);
      }

      if (slot === 'food') {
        return foodCardScore(b, center, memory, selectedMoods, foodSelections) -
          foodCardScore(a, center, memory, selectedMoods, foodSelections);
      }

      return scoreCard(b, memory, selectedMoods) - scoreCard(a, memory, selectedMoods);
    });
    const finalCards = wantsEvents && !eventsFocused
      ? promoteActivityEvents(capActivityEventBlend(sortedCards, selectedActivities), selectedActivities)
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

  const searchForSlot = async (slot: PlanSlot, shouldScroll = false, forceRefresh = false, centerOverride?: LatLon) => {
    const requestId = searchRequestIdRef.current + 1;
    searchRequestIdRef.current = requestId;
    if (resultFilter === 'favorites' && !cards.length && memory.favorites.length > 0) {
      addLog('Favorites filter needs a search before saved places can be shown');
    }
    addLog(`Find button tapped: ${slot}`);
    if (!keyLoaded) {
      Alert.alert('Google Places key missing', 'Add EXPO_PUBLIC_GOOGLE_PLACES_API_KEY to things-app/.env, then restart Expo with --clear.');
      addLog('Search stopped: API key missing');
      return;
    }

    setResultMode(slot);
    setResultFilter('all');
    setHasInitiatedSearch(true);
    setCards([]);
    setVisibleCount(PAGE_SIZE);
    setLoading(true);
    if (shouldScroll) scrollToResults();
    try {
      const center = centerOverride || await getSearchLocation();
      if (requestId !== searchRequestIdRef.current) return;
      setLastSearchLocationCenter(center);
      if (slot === 'activity') {
        const types = typesForSelection(selectedActivities, ACTIVITY_TYPE_MAP, DEFAULT_ACTIVITY_TYPES);
        addLog(`Selected activity types: ${types.join(', ')}`);
        const anchor = centerOverride
          ? null
          : foodItems.find((item): item is PlaceCard => typeof item !== 'string' && Boolean(item.lat && item.lng));
        if (anchor) {
          const activityRadius = selectedActivities.includes('Movies') ? DEFAULT_ACTIVITY_RADIUS_METERS : PAIRING_RADIUS_METERS;
          await runPlacesSearch('activity', { latitude: anchor.lat!, longitude: anchor.lng!, label: anchor.title }, types, activityRadius, forceRefresh, selectedFoods, requestId);
        } else {
          await runPlacesSearch('activity', center, types, DEFAULT_ACTIVITY_RADIUS_METERS, forceRefresh, selectedFoods, requestId);
        }
      } else {
        const types = typesForSelection(selectedFoods, FOOD_TYPE_MAP, DEFAULT_FOOD_TYPES);
        addLog(`Selected food types: ${types.join(', ')}`);
        await runPlacesSearch('food', center, types, wantsCloseBy(selectedFoods) ? CLOSE_BY_RADIUS_METERS : DEFAULT_RADIUS_METERS, forceRefresh, selectedFoods, requestId);
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
    setCustomDateOpen(false);
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
    setPendingInsertIndex(null);
    setResultMode(slot);
    setPreferencesOpen(false);
    scrollToResults();
    await searchForSlot(slot, true);
  };

  const addStopAfter = async (slot: PlanSlot, index: number) => {
    setPendingInsertIndex(index);
    setResultMode(slot);
    setPreferencesOpen(false);
    scrollToResults();
    await searchForSlot(slot, true, false, stopSearchCenter(plan.stops[index]));
  };

  const openTimeEditor = (key: string, index: number) => {
    const stop = plan.stops.find((item) => item.key === key);
    setTimeEditorKey(key);
    setDraftArrivalTime(clockTimeFromOffsetMinutes(arrivalOverrideForStop(stop || plan.stops[index]) ?? itineraryArrivalMinutes(index)));
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
    if (!timeEditorKey) return;
    if (!arrivalDraftDirty && !durationDraftDirty) {
      setTimeEditorKey(null);
      return;
    }
    if (arrivalDraftDirty) {
      const arrivalOffsetMinutes = minutesUntilClockTime(draftArrivalTime);
      const arrivalOffset = {
        hours: Math.floor(arrivalOffsetMinutes / 60),
        minutes: arrivalOffsetMinutes % 60,
      };
      setArrivalTimes((prev) => ({ ...prev, [timeEditorKey]: arrivalOffset }));
    }
    if (durationDraftDirty) {
      setPlanTimes((prev) => ({ ...prev, [timeEditorKey]: draftTime }));
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
    try {
      const next = await resolveLocationInput(value);
      if (!next) {
        Alert.alert('Location not found', `Could not find a location for ${value}.`);
        addLog(`Location geocode returned no results: ${value}`);
        return;
      }

      await saveLocation(next);
      addLog(`Location override saved: ${value} ${next.latitude.toFixed(4)}, ${next.longitude.toFixed(4)}`);
      setLocationOverrideOpen(false);
      setPreferencesOpen(false);
      refreshAfterSearchContextChange(searchLocation || next);
      addLog('Starting location saved; refreshing active results');
    } catch (err) {
      addLog(`Location override failed: ${compactError(err)}`);
      Alert.alert('Location search failed', compactError(err));
    }
  };

  const clearLocationOverride = async () => {
    setRouteOriginOverride('');
    setLocation(null);
    setLocationOverrideOpen(false);
    await AsyncStorage.removeItem(STORAGE_LOCATION);
    refreshAfterSearchContextChange(searchLocation || undefined);
    addLog('Starting location override cleared');
  };

  const searchFromSearchLocationOverride = async () => {
    const value = searchLocationOverride.trim();
    if (!value) {
      Alert.alert('Search location needed', 'Enter a ZIP, address, or place first.');
      return;
    }

    addLog(`Search location tapped: ${value}`);
    try {
      const next = await resolveLocationInput(value);
      if (!next) {
        Alert.alert('Location not found', `Could not find a location for ${value}.`);
        addLog(`Search location geocode returned no results: ${value}`);
        return;
      }

      await saveSearchLocation(next);
      addLog(`Search location saved: ${value} ${next.latitude.toFixed(4)}, ${next.longitude.toFixed(4)}`);
      setSearchLocationOverrideOpen(false);
      setPreferencesOpen(false);
      refreshAfterSearchContextChange(next);
      addLog('Search location saved; refreshing active results');
    } catch (err) {
      addLog(`Search location failed: ${compactError(err)}`);
      Alert.alert('Search location failed', compactError(err));
    }
  };

  const clearSearchLocationOverride = async () => {
    setSearchLocationOverride('');
    setSearchLocation(null);
    setLastSearchLocationCenter(null);
    setSearchLocationOverrideOpen(false);
    await AsyncStorage.removeItem(STORAGE_SEARCH_LOCATION);
    refreshAfterSearchContextChange(location || undefined);
    addLog('Search location override cleared');
  };

  const runSuggestion = async (suggestion: PairingSuggestion) => {
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
        stops: nextStops,
      });
      nextStops.forEach((stop) => {
        void refreshStopFeatures(stop.key, stop.slot, stop.item);
      });
      setPlanTimes({});
      setArrivalTimes({});
      setPendingInsertIndex(null);
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
      );
    } catch (err) {
      addLog(`Activity pairing failed: ${compactError(err)}`);
      Alert.alert('Could not search activities nearby', compactError(err));
    } finally {
      setLoading(false);
    }
  };

  const insertStopIntoPlan = (slot: PlanSlot, item: PlaceCard | string) => {
    const nextStop: ItineraryStop = {
      key: makeStopKey(slot, item),
      slot,
      item,
      featureOptions: [],
      selectedFeatures: [],
      featuresExpanded: false,
    };
    setPlan((prev) => {
      const existingIndex = prev.stops.findIndex((stop) => stop.slot === slot && cardToId(stop.item) === cardToId(item));
      if (existingIndex >= 0) {
        setPlanTimes((times) => ({ ...times, [prev.stops[existingIndex].key]: undefined }));
        return { ...prev, stops: prev.stops.filter((_, index) => index !== existingIndex) };
      }

      const insertAt = pendingInsertIndex === null ? prev.stops.length : Math.min(pendingInsertIndex + 1, prev.stops.length);
      return {
        ...prev,
        stops: [
          ...prev.stops.slice(0, insertAt),
          nextStop,
          ...prev.stops.slice(insertAt),
        ],
      };
    });
    setPendingInsertIndex(null);
    void refreshStopFeatures(nextStop.key, slot, item);
    return nextStop;
  };

  const selectCard = async (card: PlaceCard) => {
    addLog(`Card Select action: ${card.title}`);
    const nextMemory = {
      ...memory,
      selectedHistory: unique([card.id, ...memory.selectedHistory]).slice(0, 80),
    };
    await saveMemory(nextMemory);

    const alreadySelected = plan.stops.some((stop) => stop.slot === resultMode && cardToId(stop.item) === card.id);
    insertStopIntoPlan(resultMode, card);
    addLog(alreadySelected ? `Removed ${resultMode} choice: ${card.title}` : `Added ${resultMode} choice: ${card.title}`);
    setTimeout(() => scrollRef.current?.scrollTo({ y: 0, animated: true }), 100);

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
    await Linking.openURL(mapsSearchUrl(stop.item, searchLocation || location));
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

  const cloneStopForSavedPlan = (stop: ItineraryStop, suffix = ''): ItineraryStop => ({
    ...stop,
    key: `${stop.key}${suffix}`,
    featureOptions: [...(stop.featureOptions || [])],
    selectedFeatures: [...(stop.selectedFeatures || [])],
    featuresExpanded: false,
  });

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
    stops.forEach((stop, index) => {
      const savedKey = savedStops[index].key;
      if (planTimes[stop.key]) savedPlanTimes[savedKey] = planTimes[stop.key];
      if (arrivalTimes[stop.key]) savedArrivalTimes[savedKey] = arrivalTimes[stop.key];
    });
    return {
      id: `plan-${stamp}`,
      title: options.title || titleForPlanStops(stops),
      stops: savedStops,
      planTimes: savedPlanTimes,
      arrivalTimes: savedArrivalTimes,
      createdAt: stamp,
      source,
      owner: source === 'saved' ? currentTesterName : options.sharedTo,
      sharedBy: options.sharedBy,
      sharedTo: options.sharedTo,
    };
  };

  const saveCurrentPlan = async () => {
    if (!plan.stops.length) return;
    const saved = makeSavedPlan(plan.stops, 'saved');
    await saveSavedPlans([saved, ...savedPlans]);
    addLog(`Plan saved: ${saved.title}`);
    showToast('Plan saved');
  };

  const loadSavedPlan = (saved: SavedPlan) => {
    const loadSuffix = `-load-${Date.now()}`;
    const loadedStops = saved.stops.map((stop) => cloneStopForSavedPlan(stop, loadSuffix));
    const loadedPlanTimes: Record<string, StopTime | undefined> = {};
    const loadedArrivalTimes: Record<string, StopTime | undefined> = {};
    saved.stops.forEach((stop, index) => {
      const loadedKey = loadedStops[index].key;
      if (saved.planTimes?.[stop.key]) loadedPlanTimes[loadedKey] = saved.planTimes[stop.key];
      if (saved.arrivalTimes?.[stop.key]) loadedArrivalTimes[loadedKey] = saved.arrivalTimes[stop.key];
    });
    setPlan({ stops: loadedStops });
    setPlanTimes(loadedPlanTimes);
    setArrivalTimes(loadedArrivalTimes);
    setPendingInsertIndex(null);
    setTimeEditorKey(null);
    setHasInitiatedSearch(false);
    setCards([]);
    setTimeout(() => scrollRef.current?.scrollTo({ y: 0, animated: true }), 100);
    addLog(`Saved plan loaded: ${saved.title}`);
  };

  const deleteSavedPlan = async (id: string) => {
    await saveSavedPlans(savedPlans.filter((item) => item.id !== id));
    addLog('Saved plan removed');
  };

  const quickShareMapsUrl = (target: QuickShareTarget) => {
    const item = target.kind === 'card' ? target.card : target.stop.item;
    if (typeof item !== 'string') return item.mapsUri || mapsSearchUrl(item.title, item);
    return mapsSearchUrl(item, searchLocation || location);
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
    await saveSavedPlans([shared, ...savedPlans]);
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
    const nextMemory = {
      ...memory,
      selectedHistory: unique([card.id, ...memory.selectedHistory]).slice(0, 80),
    };
    await saveMemory(nextMemory);

    const alreadySelected = plan.stops.some((stop) => stop.slot === slot && cardToId(stop.item) === card.id);
    if (!alreadySelected) insertStopIntoPlan(slot, card);
    setResultMode(slot);
    setCards((prev) => {
      const existing = prev.some((item) => item.id === card.id);
      return existing ? prev : [card, ...prev];
    });
    setVisibleCount(PAGE_SIZE);
    setTimeout(() => scrollRef.current?.scrollTo({ y: 0, animated: true }), 100);

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
    const value = manualSearch.trim();
    if (!value) return;
    setManualSearchSubmitted(true);
    if (!keyLoaded) {
      insertStopIntoPlan(slot, value);
      addLog(`Manual ${slot} used without Places lookup: ${value}`);
      Alert.alert('Google Places key missing', 'Manual lookup needs the Places API key. Added the typed name without details.');
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
        insertStopIntoPlan(slot, value);
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
      insertStopIntoPlan(slot, value);
      addLog(`Manual ${slot} lookup failed: ${compactError(err)}`);
      Alert.alert('Manual lookup failed', `I added "${value}" manually, but could not load details from Google Places.`);
    } finally {
      setLoading(false);
    }
  };

  const removeStop = (stop: ItineraryStop) => {
    setPlan((prev) => ({
      ...prev,
      stops: prev.stops.filter((item) => item.key !== stop.key),
    }));
    setPlanTimes((prev) => ({ ...prev, [stop.key]: undefined }));
    setArrivalTimes((prev) => ({ ...prev, [stop.key]: undefined }));
    if (timeEditorKey === stop.key) setTimeEditorKey(null);
    addLog(`Removed ${stop.slot}: ${cardToName(stop.item)}`);
  };

  const toggleStopFeaturesOpen = (key: string) => {
    setPlan((prev) => ({
      ...prev,
      stops: prev.stops.map((stop) =>
        stop.key === key ? { ...stop, featuresExpanded: !stop.featuresExpanded } : stop,
      ),
    }));
  };

  const toggleStopFeature = (key: string, feature: string) => {
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
    }));
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
      title: titleForPlanStops(plan.stops),
    });
    await saveSavedPlans([shared, ...savedPlans]);
    setSharePreviewOpen(false);
    addLog(`Plan shared in-app to ${user}: ${shared.title}`);
    showToast(`Shared to ${user}`);
  };

  const suggestedPairings = useMemo<PairingSuggestion[]>(() => {
    const suggestions: PairingSuggestion[] = [];
    const favoriteSuggestionCenter = searchLocation || lastSearchLocationCenter || location;
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
            <View style={[styles.hero, isLightMode && styles.lightHero, isDarkMode && styles.darkHero]}>
              <Image source={require('./assets/nom-nom-go-wordmark-v19.png')} style={styles.wordmarkImage} resizeMode="contain" />
            </View>
            <View style={[styles.authCard, isDarkMode && styles.darkPanel]}>
              <Text style={[styles.authTitle, isDarkMode && styles.darkText]}>Choose tester</Text>
              <Text style={[styles.authCopy, isDarkMode && styles.darkMutedText]}>
                Select a local test user. This keeps development sharing simple until backend accounts are added.
              </Text>
              <View style={styles.testerDropdown}>
                {TEST_USERS.map((name) => (
                  <TouchableOpacity key={name} style={styles.testerOption} onPress={() => selectTester(name)}>
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
      <View style={[styles.hero, isLightMode && styles.lightHero, isDarkMode && styles.darkHero]}>
        <Image source={require('./assets/nom-nom-go-wordmark-v19.png')} style={styles.wordmarkImage} resizeMode="contain" />
      </View>

      <View style={styles.usageBox}>
        <View>
          <Text style={styles.usageName}>{testerUser?.name || 'Tester'}</Text>
          <Text style={styles.usageText}>
            Places calls today: {usageMeter.nearbySearchesToday + usageMeter.textSearchesToday} · month: {usageMeter.nearbySearchesMonth + usageMeter.textSearchesMonth}
          </Text>
        </View>
        <Button label="Sign out" onPress={signOutTester} compact />
      </View>

      {toastMessage ? (
        <View style={styles.toastBox}>
          <Text style={styles.toastText}>{toastMessage}</Text>
        </View>
      ) : null}

      <View style={[styles.planBox, isDarkMode && styles.darkPanel]}>
        {hasAnyActiveStop ? (
          <View style={styles.planHeader}>
            <View>
              <Text style={[styles.planTitle, isDarkMode && styles.darkText]} numberOfLines={1} adjustsFontSizeToFit>
                Plan
              </Text>
            </View>
            <View style={styles.planHeaderActions}>
              <Button label="Save" onPress={saveCurrentPlan} compact />
              <Button label="Share" onPress={() => setSharePreviewOpen(true)} compact />
              <Button label="Route" onPress={openDirections} primary compact />
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

        {hasAnyActiveStop ? (
        <View style={styles.timeline}>
          {plan.stops.map((stop, index) => (
            <React.Fragment key={stop.key}>
              <PlanStep
                number={`${index + 1}`}
                title={stop.slot === 'food' ? 'Food' : 'Activity'}
                value={cardToName(stop.item) || (stop.slot === 'food' ? 'Food stop' : 'Activity stop')}
                detail={stepDetail(stop, index)}
                featureOptions={stop.featureOptions || []}
                selectedFeatures={stop.selectedFeatures || []}
                featuresExpanded={Boolean(stop.featuresExpanded)}
                onToggleFeaturesOpen={() => toggleStopFeaturesOpen(stop.key)}
                onToggleFeature={(feature) => toggleStopFeature(stop.key, feature)}
                active
                onPress={() => addStopAfter(stop.slot, index)}
                actionLabel="Adjust time"
                onActionPress={() => openTimeEditor(stop.key, index)}
                mapLabel="Map"
                onMapPress={() => openStopMaps(stop)}
                shareLabel="Share"
                onSharePress={() => openQuickShare({ kind: 'stop', stop, index })}
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
            </React.Fragment>
          ))}
        </View>
        ) : null}

        {hasFood || hasActivity ? (
          <View style={styles.planActions}>
            <Button
              label="Clear plan"
              onPress={() => {
                setPlan(EMPTY_PLAN);
                setPlanTimes({});
                setArrivalTimes({});
                setHasInitiatedSearch(false);
                setCards([]);
                addLog('Plan cleared');
              }}
              compact
            />
          </View>
        ) : null}

        <View style={styles.routeOriginBox}>
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
              <View style={styles.inputRow}>
                <TextInput
                  style={styles.input}
                  value={routeOriginOverride}
                  onChangeText={setRouteOriginOverride}
                  placeholder="ZIP, address, or place"
                  placeholderTextColor="#64748b"
                  returnKeyType="search"
                  onSubmitEditing={searchFromLocationOverride}
                />
                {routeOriginOverride.trim() || location ? (
                  <Button label="Clear" onPress={clearLocationOverride} compact />
                ) : null}
                <Button label="Use" onPress={searchFromLocationOverride} compact />
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
              <View style={styles.inputRow}>
                <TextInput
                  style={styles.input}
                  value={searchLocationOverride}
                  onChangeText={setSearchLocationOverride}
                  placeholder="ZIP, address, or place"
                  placeholderTextColor="#64748b"
                  returnKeyType="search"
                  onSubmitEditing={searchFromSearchLocationOverride}
                />
                {searchLocationOverride.trim() || searchLocation ? (
                  <Button label="Clear" onPress={clearSearchLocationOverride} compact />
                ) : null}
                <Button label="Use" onPress={searchFromSearchLocationOverride} compact />
              </View>
            </>
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
        </View>

      </View>

      <View style={[styles.savedPlansBox, isLightMode && styles.lightPanel, isDarkMode && styles.darkPanel]}>
        <TouchableOpacity style={styles.savedPlansHeader} onPress={() => setSavedPlansOpen((prev) => !prev)}>
          <View>
            <Text style={[styles.sectionTitle, isLightMode && styles.lightSectionTitle, isDarkMode && styles.darkText]}>Saved Plans</Text>
            <Text style={[styles.savedPlansHint, isLightMode && styles.lightMutedText, isDarkMode && styles.darkMutedText]}>
              {visibleSavedPlans.length ? `${visibleSavedPlans.length} saved or shared for ${currentTesterName}` : 'Saved and shared plans will show here.'}
            </Text>
          </View>
          <Button label={savedPlansOpen ? 'Hide' : 'Show'} onPress={() => setSavedPlansOpen((prev) => !prev)} compact />
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
                      : 'Saved plan'} · {new Date(saved.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                  </Text>
                  <Text style={styles.savedPlanStops} numberOfLines={2}>
                    {saved.stops.map((stop) => cardToName(stop.item)).filter(Boolean).join(' → ') || 'No stops'}
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

      <View style={[styles.pairingBox, isLightMode && styles.lightPairingBox, isDarkMode && styles.darkAccentPanel]}>
          <Text style={[styles.sectionTitle, isLightMode && styles.lightSectionTitle, isDarkMode && styles.darkText]}>Suggested pairings</Text>
          <Text style={[styles.pairingHint, isLightMode && styles.lightMutedText, isDarkMode && styles.darkMutedText]}>
            Starred combos fill your plan. Other suggestions update filters.
          </Text>
          <View style={styles.chipWrap}>
            {suggestedPairings.map((suggestion, index) => (
              <TouchableOpacity key={`${suggestion.slot}-${suggestion.label}-${index}`} style={styles.mapChip} onPress={() => runSuggestion(suggestion)}>
                <Text style={styles.mapChipText}>{suggestion.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
      </View>

      <View style={[styles.preferencesBox, isLightMode && styles.lightPanel, isDarkMode && styles.darkPanel]}>
        <TouchableOpacity style={styles.preferencesHeader} onPress={() => setPreferencesOpen((prev) => !prev)}>
          <View>
            <Text style={[styles.sectionTitle, isLightMode && styles.lightSectionTitle, isDarkMode && styles.darkText]}>Preferences</Text>
            <Text style={[styles.preferenceSummary, isLightMode && styles.lightMutedText, isDarkMode && styles.darkMutedText]}>
              {[
                selectedMoods.slice(0, 2).join(', '),
                selectedTime,
                resultMode === 'food'
                  ? `Food: ${selectedFoods.join(', ')}`
                  : `Activity: ${selectedActivities.join(', ')}`,
              ]
                .filter(Boolean)
                .join(' - ')}
            </Text>
          </View>
          <Text style={styles.chevron}>{preferencesOpen ? 'Hide' : 'Edit'}</Text>
        </TouchableOpacity>

        {preferencesOpen ? (
          <View style={styles.preferencesContent}>
            <Text style={styles.filterLabel}>Mood</Text>
            <ChipRow
              items={MOODS}
              selected={selectedMoods}
              onPress={(value) =>
                setSelectedMoods((prev) => {
                  addLog(`Mood chip tapped: ${value}`);
                  return prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value];
                })
              }
            />
            <Text style={styles.filterLabel}>Time</Text>
            <ChipRow
              items={TIMES}
              selected={[selectedTime]}
              onPress={(value) => {
                addLog(`Time chip tapped: ${value}`);
                setSelectedTime(value);
              }}
            />
            {resultMode === 'food' ? (
              <>
                <Text style={styles.filterLabel}>Food filters</Text>
                <ChipRow
                  items={FOOD_QUICK_FILTERS}
                  selected={selectedFoods}
                  onPress={(value) => toggleMulti(value, selectedFoods, setSelectedFoods, 'Food')}
                />
                <Text style={styles.filterLabel}>Cuisine</Text>
                <ChipRow
                  items={CUISINES}
                  selected={selectedFoods}
                  onPress={(value) => toggleMulti(value, selectedFoods, setSelectedFoods, 'Food')}
                />
              </>
            ) : (
              <>
                <Text style={styles.filterLabel}>Activity type</Text>
                <ChipRow
                  items={ACTIVITIES}
                  selected={selectedActivities}
                  onPress={(value) => toggleMulti(value, selectedActivities, setSelectedActivities, 'Activity')}
                />
                {selectedActivities.includes('Events') ? (
                  <Text style={[styles.preferenceSummary, isDarkMode && styles.darkMutedText]}>
                    Events search uses Ticketmaster first, then lower-confidence local search if needed.
                  </Text>
                ) : null}
              </>
            )}
            <Text style={styles.filterLabel}>Weather</Text>
            <ChipRow
              items={WEATHER}
              selected={[selectedWeather]}
              onPress={(value) => {
                addLog(`Weather chip tapped: ${value}`);
                setSelectedWeather(value);
              }}
            />
            <TouchableOpacity style={styles.bottomHideButton} onPress={refreshFromPreferences}>
              <Text style={styles.bottomHideText}>Refresh Results</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>

      <View style={[styles.bridgeBox, isLightMode && styles.lightPanel, isDarkMode && styles.darkPanel]}>
        <Text style={[styles.bridgeTitle, styles.bridgeTitleDarkPanel, isLightMode && styles.lightSectionTitle, isDarkMode && styles.darkText]}>Find a specific place</Text>
        <View style={styles.inputRow}>
          <TextInput
            ref={manualSearchRef}
            style={[styles.input, styles.darkPanelInput, isLightMode && styles.input]}
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

      {hasInitiatedSearch ? (
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
              <Text style={styles.emptyTitle}>Ready when you are</Text>
              <Text style={styles.empty}>Adjust preferences or search for places nearby.</Text>
            </View>
          ) : null}
          {!loading && shownCards.map((card, index) => {
            const isSelected = selectedCards.some((item) => cardToId(item) === card.id);
            return (
            <View key={`${card.id}-${index}`} style={[styles.card, isDarkMode && styles.darkCard, isSelected && styles.cardSelected]}>
              <View style={styles.cardTopRow}>
                <Text style={[styles.cardRank, isSelected && styles.cardRankSelected]}>
                  {resultBadgeForCard(card, isSelected, index)}
                </Text>
                <Text style={[styles.cardHours, isDarkMode && styles.darkMutedText, card.isOpen ? styles.open : card.isOpen === false ? styles.closed : undefined]}>
                  {card.kind === 'event' ? card.eventDateText || 'Date TBA' : card.hoursText || 'Hours unknown'}
                </Text>
              </View>
              <Text style={[styles.cardTitle, isDarkMode && styles.darkText]}>{card.title}</Text>
              <Text style={styles.cardSubtitle}>{card.subtitle}</Text>
              {card.kind === 'event' && card.source ? (
                <Text style={[styles.hoursDetail, isDarkMode && styles.darkMutedText]}>Source: {card.source}</Text>
              ) : null}
              {card.address ? <Text style={[styles.address, isDarkMode && styles.darkMutedText]}>{card.address}</Text> : null}
              {card.todayHours ? <Text style={[styles.hoursDetail, isDarkMode && styles.darkMutedText]}>{card.todayHours}</Text> : null}
              <View style={styles.buttonRow}>
                <Button label={isSelected ? 'Deselect' : resultMode === 'food' ? 'Add food' : 'Add activity'} onPress={() => selectCard(card)} primary={!isSelected} compact />
                {card.kind === 'event' && card.eventUrl ? (
                  <Button label="Open event" onPress={() => openCardEvent(card)} compact />
                ) : null}
                {card.kind !== 'event' || card.mapsUri || (typeof card.lat === 'number' && typeof card.lng === 'number') ? (
                  <Button label={card.kind === 'event' ? 'Map' : 'Open Maps'} onPress={() => openCardMaps(card)} compact />
                ) : null}
                <Button label="Share" onPress={() => openQuickShare({ kind: 'card', slot: resultMode, card })} compact />
                <Button
                  label={memory.favorites.includes(card.id) ? '★' : '☆'}
                  onPress={() => toggleFavorite(card)}
                  compact
                />
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
      ) : null}

      <Modal
        visible={sharePreviewOpen}
        animationType="fade"
        transparent
        onRequestClose={() => setSharePreviewOpen(false)}
      >
        <View style={styles.shareOverlay}>
          <View style={[styles.shareCard, isDarkMode && styles.darkModalCard]}>
            <View style={styles.shareHeader}>
              <Text style={styles.shareBrand}>NomNomGo</Text>
              <Text style={styles.shareTagline}>GOOD FOOD. GREAT PLANS.</Text>
            </View>
            {leaveForFirstStopText ? (
              <Text style={styles.shareLeaveTime}>{leaveForFirstStopText}</Text>
            ) : null}
            {plan.stops.map((stop, index) => (
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
            ))}
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

function PlanStep({
  number,
  title,
  value,
  detail,
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
  removeLabel,
  onRemovePress,
}: {
  number: string;
  title: string;
  value: string;
  detail: string;
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
        <Text style={styles.stepTitle}>{title}</Text>
        <Text style={[styles.stepValue, isDarkMode && !active && styles.darkText, active && styles.stepValueActive]}>{value}</Text>
        <Text style={[styles.stepDetail, isDarkMode && !active && styles.darkMutedText, active && styles.stepDetailActive]}>{detail}</Text>
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
        {actionLabel && onActionPress || mapLabel && onMapPress || shareLabel && onSharePress || removeLabel && onRemovePress ? (
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
    padding: 16,
    paddingTop: 22,
    paddingBottom: 42,
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
  testerOption: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f0e3d4',
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  usageName: {
    color: '#fffaf3',
    fontWeight: '900',
    fontSize: 15,
  },
  usageText: {
    color: '#f5d7c2',
    marginTop: 3,
    fontSize: 12,
    fontWeight: '700',
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
  planBox: {
    backgroundColor: '#fffdf8',
    borderWidth: 1,
    borderColor: '#ffc84a',
    borderRadius: 8,
    padding: 14,
    marginBottom: 18,
  },
  lightPanel: {
    backgroundColor: '#fffdf8',
    borderColor: '#eadccb',
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 14,
  },
  planHeaderActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: 8,
    flexShrink: 1,
  },
  planTitle: {
    color: '#071827',
    fontSize: 20,
    fontWeight: '900',
    maxWidth: 210,
  },
  savedPlansBox: {
    borderWidth: 1,
    borderColor: '#66c5a8',
    borderRadius: 8,
    padding: 14,
    marginBottom: 18,
    backgroundColor: '#fffdf8',
  },
  savedPlansHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
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
    gap: 10,
  },
  startChoice: {
    flex: 1,
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
    fontSize: 17,
    fontWeight: '900',
  },
  startChoiceFoodLabel: {
    color: '#fffaf3',
  },
  startChoiceActivityLabel: {
    color: '#fffaf3',
  },
  timeline: {
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
  stepDetail: {
    color: '#526170',
    fontSize: 12,
    marginTop: 3,
  },
  stepDetailActive: {
    color: '#526170',
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
  routeOriginBox: {
    borderTopWidth: 1,
    borderTopColor: '#eadccb',
    marginTop: 10,
    paddingTop: 12,
    gap: 8,
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
  input: {
    flex: 1,
    minHeight: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#eadccb',
    paddingHorizontal: 12,
    color: '#071827',
    backgroundColor: '#fffdf8',
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
    marginTop: 10,
    marginBottom: 18,
    backgroundColor: '#e9f8f2',
  },
  lightPairingBox: {
    backgroundColor: '#e9f8f2',
    borderColor: '#66c5a8',
  },
  pairingHint: {
    color: '#526170',
    fontSize: 13,
    lineHeight: 18,
    marginTop: -4,
    marginBottom: 10,
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
  chevron: {
    color: '#f23b35',
    fontWeight: '900',
  },
  preferencesContent: {
    borderTopWidth: 1,
    borderTopColor: '#eadccb',
    padding: 14,
    paddingTop: 12,
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
  shareOverlay: {
    flex: 1,
    backgroundColor: 'rgba(7, 24, 39, 0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  shareCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 8,
    backgroundColor: '#fffaf3',
    padding: 18,
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
  quickShareUserText: {
    color: '#071827',
    fontWeight: '900',
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
    color: '#071827',
    fontSize: 19,
    fontWeight: '900',
  },
  cardSubtitle: {
    color: '#178f79',
    fontWeight: '700',
    marginTop: 5,
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
