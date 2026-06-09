import React, { useMemo, useState, useEffect } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';

type Intent = 'Food' | 'Activity' | 'Food + Activity';
type CardKind = 'food' | 'activity' | 'static' | 'pairing';

type LatLon = { latitude: number; longitude: number; label?: string; zip?: string; ts?: number };
type PlaceCard = {
  id: string;
  kind: CardKind;
  title: string;
  subtitle: string;
  description: string;
  distanceMiles?: number;
  latitude?: number;
  longitude?: number;
  tags?: Record<string, string>;
  confidence?: 'strict' | 'broad' | 'static';
  selectedFoodTitle?: string;
  selectedFoodLocation?: LatLon;
};

type Memory = { favorites: string[]; never: string[]; selected: string[] };

const STORAGE_MEMORY = 'thingsNearbyMemoryV29';
const STORAGE_LOCATION = 'thingsNearbyLocationV30';
const STORAGE_FOOD_CACHE = 'thingsNearbyFoodCacheV30';
const LOCATION_TTL_MS = 10 * 60 * 1000;

const intents: Intent[] = ['Food', 'Activity', 'Food + Activity'];
const moods = ['Easy', 'Fun', 'Hungry', 'Tired', 'Bored', 'Date', 'Social', 'New', 'Cheap', 'Kid-friendly', 'Cozy', 'Active'];
const times = ['Now', 'Morning', 'Lunch', 'Afternoon', 'Dinner', 'Late night'];
const foods = ['Any', 'Steak', 'Sushi', 'Pizza', 'Burgers', 'Mexican', 'BBQ', 'Coffee', 'Dessert', 'Breakfast'];
const activities = ['Any', 'Arcade', 'Shopping', 'Museums', 'Trails', 'Parks', 'Movies', 'Music', 'Kid activities'];
const weather = ['Nice', 'Mild', 'Hot', 'Cold', 'Rainy', 'Unknown'];

const FOOD_TERMS: Record<string, string[]> = {
  Steak: ['steak', 'steakhouse', 'chophouse', 'prime', 'ribeye', 'filet', 'filet mignon', 'cork & cow', 'perrys', "perry's", 'ruth', 'fleming', 'longhorn'],
  Sushi: ['sushi', 'hibachi', 'japanese', 'ramen', 'poke', 'thai', 'koi', 'ichiban', 'osaka'],
  Pizza: ['pizza', 'pizzeria', 'pie'],
  Burgers: ['burger', 'hamburger', 'shake shack', 'five guys', 'burger up', 'hopdoddy'],
  Mexican: ['mexican', 'taco', 'burrito', 'cantina', 'taqueria', 'fajita'],
  BBQ: ['bbq', 'barbecue', 'barbeque', 'smokehouse', 'smoked'],
  Coffee: ['coffee', 'cafe', 'espresso', 'roaster', 'starbucks'],
  Dessert: ['dessert', 'ice cream', 'bakery', 'donut', 'chocolate', 'cookie', 'creamery'],
  Breakfast: ['breakfast', 'brunch', 'biscuit', 'pancake', 'waffle', 'eggs'],
};

const NEGATIVE_FOOD_TERMS = ['food lion', 'kroger', 'publix', 'walmart', 'target', 'walgreens', 'cvs', 'gas', 'market', 'grocery'];

const STATIC_FOOD: PlaceCard[] = [
  { id: 'static-food-1', kind: 'static', title: 'Pick a close restaurant', subtitle: 'Fast fallback', description: 'Use Maps for the closest good-looking option and keep the decision low-effort.', confidence: 'static' },
  { id: 'static-food-2', kind: 'static', title: 'Coffee + snack', subtitle: 'Easy outing', description: 'Good when you want to leave the house without committing to a full meal.', confidence: 'static' },
  { id: 'static-food-3', kind: 'static', title: 'Comfort food nearby', subtitle: 'Low friction', description: 'Look for something close, casual, and easy to park at.', confidence: 'static' },
];

const BASE_ACTIVITY_PAIRINGS: PlaceCard[] = [
  { id: 'pair-walk', kind: 'pairing', title: 'Walk nearby', subtitle: 'Low-effort pairing', description: 'Open Maps for parks, town squares, shopping areas, or walkable places near the selected restaurant.', confidence: 'static' },
  { id: 'pair-dessert', kind: 'pairing', title: 'Dessert or coffee afterward', subtitle: 'Easy add-on', description: 'Open Maps for dessert, ice cream, bakeries, or coffee near the selected restaurant.', confidence: 'static' },
  { id: 'pair-movie', kind: 'pairing', title: 'Movie nearby', subtitle: 'Simple activity', description: 'Open Maps for movie theaters near the selected restaurant.', confidence: 'static' },
  { id: 'pair-shopping', kind: 'pairing', title: 'Browse shops nearby', subtitle: 'Flexible', description: 'Open Maps for shopping, downtown areas, or malls near the selected restaurant.', confidence: 'static' },
  { id: 'pair-arcade', kind: 'pairing', title: 'Arcade or games nearby', subtitle: 'Kid-friendly / fun', description: 'Open Maps for arcades, bowling, games, or kid-friendly activities near the selected restaurant.', confidence: 'static' },
  { id: 'pair-park', kind: 'pairing', title: 'Park or trail nearby', subtitle: 'Nice-weather option', description: 'Open Maps for parks, trails, playgrounds, or outdoor areas near the selected restaurant.', confidence: 'static' },
];

function deg2rad(deg: number) { return deg * (Math.PI / 180); }
function distanceMiles(aLat: number, aLon: number, bLat: number, bLon: number) {
  const R = 3958.8;
  const dLat = deg2rad(bLat - aLat);
  const dLon = deg2rad(bLon - aLon);
  const aa = Math.sin(dLat / 2) ** 2 + Math.cos(deg2rad(aLat)) * Math.cos(deg2rad(bLat)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa));
}
function normalize(s?: string) { return (s || '').toLowerCase(); }
function unique<T>(arr: T[]) { return Array.from(new Set(arr)); }
function selectedFoodTerms(selectedFoods: string[]) {
  if (selectedFoods.includes('Any')) return [];
  return unique(selectedFoods.flatMap((f) => FOOD_TERMS[f] || [f.toLowerCase()]));
}
function textBlob(card: PlaceCard) {
  const t = card.tags || {};
  return normalize([card.title, card.subtitle, card.description, t.amenity, t.cuisine, t.shop, t.leisure, t.tourism].join(' '));
}
function foodMatches(card: PlaceCard, selectedFoods: string[], strict: boolean) {
  if (selectedFoods.includes('Any')) return true;
  const blob = textBlob(card);
  if (NEGATIVE_FOOD_TERMS.some((term) => blob.includes(term))) return false;
  const terms = selectedFoodTerms(selectedFoods);
  const matched = terms.some((term) => blob.includes(term));
  if (matched) return true;

  // Broad fallback: keep proper restaurants, but only after strict results are too few.
  if (!strict) {
    const amenity = normalize(card.tags?.amenity);
    const cuisine = normalize(card.tags?.cuisine);
    const isRestaurant = ['restaurant', 'cafe', 'fast_food', 'bar', 'pub'].includes(amenity);
    const hasCuisine = cuisine.length > 0;
    return isRestaurant && hasCuisine;
  }
  return false;
}
function scoreCard(card: PlaceCard, selectedFoods: string[], broad: boolean) {
  let score = 100;
  const d = card.distanceMiles ?? 99;
  score -= d * 10;
  const blob = textBlob(card);
  selectedFoodTerms(selectedFoods).forEach((term) => { if (blob.includes(term)) score += 40; });
  if (card.confidence === 'strict') score += 30;
  if (card.confidence === 'broad') score -= 15;
  if (broad) score -= 5;
  return score;
}

function overpassFoodQuery(lat: number, lon: number, radiusMeters: number) {
  return `[out:json][timeout:25];(
node["amenity"~"restaurant|cafe|fast_food|bar|pub|ice_cream"](around:${radiusMeters},${lat},${lon});
way["amenity"~"restaurant|cafe|fast_food|bar|pub|ice_cream"](around:${radiusMeters},${lat},${lon});
relation["amenity"~"restaurant|cafe|fast_food|bar|pub|ice_cream"](around:${radiusMeters},${lat},${lon});
node["shop"~"bakery|coffee|ice_cream"](around:${radiusMeters},${lat},${lon});
way["shop"~"bakery|coffee|ice_cream"](around:${radiusMeters},${lat},${lon});
);out center tags;`;
}

function timeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const id = setTimeout(() => reject(new Error(message)), ms);
    promise.then((value) => { clearTimeout(id); resolve(value); }).catch((err) => { clearTimeout(id); reject(err); });
  });
}

export default function App() {
  const [intent, setIntent] = useState<Intent>('Food');
  const [selectedMoods, setSelectedMoods] = useState<string[]>(['Easy']);
  const [selectedTime, setSelectedTime] = useState('Now');
  const [selectedFoods, setSelectedFoods] = useState<string[]>(['Any']);
  const [selectedActivities, setSelectedActivities] = useState<string[]>(['Any']);
  const [selectedWeather, setSelectedWeather] = useState('Nice');
  const [zip, setZip] = useState('');
  const [location, setLocation] = useState<LatLon | null>(null);
  const [cards, setCards] = useState<PlaceCard[]>(STATIC_FOOD);
  const [visibleCount, setVisibleCount] = useState(8);
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const [selectedFoodCard, setSelectedFoodCard] = useState<PlaceCard | null>(null);
  const [selectedActivityCard, setSelectedActivityCard] = useState<PlaceCard | null>(null);
  const [manualFoodName, setManualFoodName] = useState('');
  const [manualActivityName, setManualActivityName] = useState('');
  const [memory, setMemory] = useState<Memory>({ favorites: [], never: [], selected: [] });

  const addLog = (line: string) => {
    const stamp = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' });
    const msg = `${stamp} ${line}`;
    console.log(msg);
    setLogs((prev) => [msg, ...prev].slice(0, 160));
  };

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_MEMORY).then((raw) => { if (raw) setMemory(JSON.parse(raw)); }).catch(() => {});
    AsyncStorage.getItem(STORAGE_LOCATION).then((raw) => {
      if (!raw) return;
      const loc = JSON.parse(raw) as LatLon;
      if (loc.ts && Date.now() - loc.ts < LOCATION_TTL_MS) setLocation(loc);
    }).catch(() => {});
  }, []);

  const saveMemory = async (next: Memory) => {
    setMemory(next);
    await AsyncStorage.setItem(STORAGE_MEMORY, JSON.stringify(next));
  };

  const logShownCards = (label: string, list: PlaceCard[]) => {
    addLog(`${label}: showing ${Math.min(visibleCount, list.length)}/${list.length} cards: ${list.slice(0, 6).map((c) => c.title).join(' | ')}`);
  };

  const toggleMood = (v: string) => {
    addLog(`Tapped mood chip: ${v}`);
    setSelectedMoods((p) => p.includes(v) ? p.filter((x) => x !== v) : [...p, v]);
  };
  const toggleFood = (v: string) => {
    addLog(`Tapped food chip: ${v}`);
    setSelectedFoodCard(null);
    setSelectedActivityCard(null);
    setSelectedFoods((p) => {
    if (v === 'Any') return ['Any'];
    const base = p.filter((x) => x !== 'Any');
    const next = base.includes(v) ? base.filter((x) => x !== v) : [...base, v];
    return next.length ? next : ['Any'];
  });
  };
  const toggleActivity = (v: string) => {
    addLog(`Tapped activity chip: ${v}`);
    setSelectedActivityCard(null);
    setSelectedActivities((p) => {
    if (v === 'Any') return ['Any'];
    const base = p.filter((x) => x !== 'Any');
    const next = base.includes(v) ? base.filter((x) => x !== v) : [...base, v];
    return next.length ? next : ['Any'];
  });
  };

  const saveLocation = (next: LatLon) => {
    setLocation(next);
    AsyncStorage.setItem(STORAGE_LOCATION, JSON.stringify(next)).catch(() => {});
  };

  const labelLocationInBackground = (next: LatLon) => {
    Location.reverseGeocodeAsync({ latitude: next.latitude, longitude: next.longitude }).then((r) => {
      const first = r[0];
      if (!first) return;
      const label = `${first.city || first.subregion || 'Current location'}${first.postalCode ? ` ${first.postalCode}` : ''}`;
      const updated = { ...next, label, zip: first.postalCode || undefined };
      addLog(`Reverse geocode label: ${label}`);
      saveLocation(updated);
    }).catch((e) => addLog(`Reverse geocode failed: ${e.message}`));
  };

  const getLocation = async (): Promise<LatLon | null> => {
    if (location?.ts && Date.now() - location.ts < LOCATION_TTL_MS) {
      addLog(`Using cached GPS: ${location.label || 'current location'}`);
      return location;
    }

    // Even if the cached location is older than the TTL, use it as a fast fallback
    // if the fresh GPS request stalls. This prevents the app from becoming unusable
    // indoors or while Android is slow to return a new fix.
    const staleFallback = location?.latitude && location?.longitude ? location : null;

    addLog('Requesting GPS permission...');
    const perm = await Location.requestForegroundPermissionsAsync();
    addLog(`GPS permission: ${perm.status}`);
    if (perm.status !== 'granted') {
      if (staleFallback) {
        addLog(`Permission not granted; using last known app location: ${staleFallback.label || 'previous location'}`);
        return staleFallback;
      }
      return null;
    }

    try {
      addLog('Getting current GPS position...');
      const pos = await timeout(
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        15000,
        'GPS timed out after 15000ms'
      );
      const next: LatLon = { latitude: pos.coords.latitude, longitude: pos.coords.longitude, label: 'Current location', ts: Date.now() };
      addLog(`GPS success: ${next.latitude.toFixed(4)}, ${next.longitude.toFixed(4)}`);
      saveLocation(next);
      labelLocationInBackground(next);
      return next;
    } catch (e: any) {
      addLog(`Fresh GPS failed: ${e.message}`);
    }

    try {
      addLog('Trying Android last known location...');
      const last = await timeout(
        Location.getLastKnownPositionAsync({ maxAge: 30 * 60 * 1000, requiredAccuracy: 5000 }),
        3000,
        'Last known GPS timed out after 3000ms'
      );
      if (last) {
        const next: LatLon = { latitude: last.coords.latitude, longitude: last.coords.longitude, label: 'Last known location', ts: Date.now() };
        addLog(`Last known GPS success: ${next.latitude.toFixed(4)}, ${next.longitude.toFixed(4)}`);
        saveLocation(next);
        labelLocationInBackground(next);
        return next;
      }
      addLog('Android last known location unavailable.');
    } catch (e: any) {
      addLog(`Last known GPS failed: ${e.message}`);
    }

    if (staleFallback) {
      addLog(`Using stale app location as fallback: ${staleFallback.label || 'previous location'}`);
      return staleFallback;
    }

    addLog('No GPS location available. Use ZIP fallback.');
    return null;
  };

  const lookupZip = async (): Promise<LatLon | null> => {
    if (!zip.trim()) return null;
    const url = `https://api.zippopotam.us/us/${encodeURIComponent(zip.trim())}`;
    addLog(`ZIP lookup: ${url}`);
    const res = await timeout(fetch(url), 7000, 'ZIP lookup timed out');
    addLog(`ZIP status: ${res.status}`);
    if (!res.ok) return null;
    const data = await res.json();
    const p = data.places?.[0];
    if (!p) return null;
    const next: LatLon = { latitude: Number(p.latitude), longitude: Number(p.longitude), label: `${p['place name']} ${zip.trim()}`, zip: zip.trim(), ts: Date.now() };
    setLocation(next);
    await AsyncStorage.setItem(STORAGE_LOCATION, JSON.stringify(next));
    return next;
  };

  const parseElements = (elements: any[], loc: LatLon): PlaceCard[] => {
    const seen = new Set<string>();
    return elements.map((el) => {
      const tags = el.tags || {};
      const lat = el.lat ?? el.center?.lat;
      const lon = el.lon ?? el.center?.lon;
      const name = tags.name;
      if (!name || !lat || !lon) return null;
      const id = `${name}-${lat}-${lon}`;
      if (seen.has(id)) return null;
      seen.add(id);
      const d = distanceMiles(loc.latitude, loc.longitude, lat, lon);
      return {
        id,
        kind: 'food' as CardKind,
        title: name,
        subtitle: [tags.cuisine, tags.amenity, d ? `${d.toFixed(1)} mi` : ''].filter(Boolean).join(' · '),
        description: tags.opening_hours ? `Hours listed: ${tags.opening_hours}` : 'Nearby food option from OpenStreetMap.',
        distanceMiles: d,
        latitude: lat,
        longitude: lon,
        tags,
        confidence: 'broad' as const,
      };
    }).filter(Boolean) as PlaceCard[];
  };

  const fetchFoodCards = async (loc: LatLon, radiusMiles: number): Promise<PlaceCard[]> => {
    const radiusMeters = Math.round(radiusMiles * 1609.34);
    const query = `[out:json][timeout:18];
(
  nwr["amenity"~"^(restaurant|cafe|fast_food|bar|pub|ice_cream)$"](around:${radiusMeters},${loc.latitude},${loc.longitude});
  nwr["shop"~"^(bakery|coffee|deli|convenience|supermarket)$"](around:${radiusMeters},${loc.latitude},${loc.longitude});
);
out center tags;`;

    const endpoints = [
      { name: 'kumi', url: 'https://overpass.kumi.systems/api/interpreter', timeout: 18000 },
      { name: 'ru', url: 'https://overpass.openstreetmap.ru/api/interpreter', timeout: 8000 },
    ];

    const parseResponse = async (res: Response, name: string) => {
      addLog(`Overpass ${name} status: ${res.status}`);
      const text = await res.text();
      if (!res.ok) {
        addLog(`Overpass body: ${text.slice(0, 220).replace(/\s+/g, ' ')}`);
        return null;
      }
      try {
        return JSON.parse(text);
      } catch (e: any) {
        addLog(`Overpass JSON parse error: ${e.message}`);
        addLog(`Overpass raw body: ${text.slice(0, 220).replace(/\s+/g, ' ')}`);
        return null;
      }
    };

    for (const endpoint of endpoints) {
      try {
        const url = `${endpoint.url}?data=${encodeURIComponent(query)}`;
        addLog(`Overpass ${endpoint.name} GET radius ${radiusMiles.toFixed(1)}mi`);
        const res = await timeout(fetch(url, { method: 'GET', headers: { Accept: 'application/json' } }), endpoint.timeout, `Overpass ${endpoint.name} GET timed out after ${endpoint.timeout}ms`);
        const json = await parseResponse(res, endpoint.name);
        if (json?.elements) {
          addLog(`Overpass raw element count: ${json.elements?.length || 0}`);
          const cards = parseElements(json.elements || [], loc);
          addLog(`Overpass cards: ${cards.length}`);
          if (cards.length) return cards;
        }
      } catch (e: any) {
        addLog(`Overpass ${endpoint.name} GET failed: ${e.message}`);
      }

      try {
        addLog(`Overpass ${endpoint.name} POST radius ${radiusMiles.toFixed(1)}mi`);
        const res = await timeout(fetch(endpoint.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
          body: `data=${encodeURIComponent(query)}`,
        }), endpoint.timeout, `Overpass ${endpoint.name} POST timed out after ${endpoint.timeout}ms`);
        const json = await parseResponse(res, endpoint.name);
        if (json?.elements) {
          addLog(`Overpass raw element count: ${json.elements?.length || 0}`);
          const cards = parseElements(json.elements || [], loc);
          addLog(`Overpass cards: ${cards.length}`);
          if (cards.length) return cards;
        }
      } catch (e: any) {
        addLog(`Overpass ${endpoint.name} POST failed: ${e.message}`);
      }
    }

    return [];
  };

  const foodCacheKey = (loc: LatLon, radiusMiles: number) => {
    const lat = loc.latitude.toFixed(2);
    const lon = loc.longitude.toFixed(2);
    return `${lat},${lon},${radiusMiles.toFixed(1)}`;
  };

  const getCachedFoodCards = async (loc: LatLon, radiusMiles: number): Promise<PlaceCard[]> => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_FOOD_CACHE);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as Record<string, { ts: number; cards: PlaceCard[] }>;
      const entry = parsed[foodCacheKey(loc, radiusMiles)];
      if (!entry) return [];
      // Keep stale place cache for a while. OSM is flaky; stale nearby food is better than empty generic cards.
      if (Date.now() - entry.ts > 24 * 60 * 60 * 1000) return [];
      addLog(`Using cached Overpass food cards: ${entry.cards.length} within ${radiusMiles.toFixed(1)}mi`);
      return entry.cards;
    } catch (e: any) {
      addLog(`Food cache read failed: ${e.message}`);
      return [];
    }
  };

  const saveCachedFoodCards = async (loc: LatLon, radiusMiles: number, freshCards: PlaceCard[]) => {
    if (!freshCards.length) return;
    try {
      const raw = await AsyncStorage.getItem(STORAGE_FOOD_CACHE);
      const parsed = raw ? JSON.parse(raw) as Record<string, { ts: number; cards: PlaceCard[] }> : {};
      parsed[foodCacheKey(loc, radiusMiles)] = { ts: Date.now(), cards: freshCards.slice(0, 250) };
      await AsyncStorage.setItem(STORAGE_FOOD_CACHE, JSON.stringify(parsed));
      addLog(`Cached Overpass food cards: ${freshCards.length} within ${radiusMiles.toFixed(1)}mi`);
    } catch (e: any) {
      addLog(`Food cache write failed: ${e.message}`);
    }
  };

  const fetchFoodCardsCached = async (loc: LatLon, radiusMiles: number): Promise<PlaceCard[]> => {
    const live = await fetchFoodCards(loc, radiusMiles);
    if (live.length) {
      await saveCachedFoodCards(loc, radiusMiles, live);
      return live;
    }
    const cached = await getCachedFoodCards(loc, radiusMiles);
    if (cached.length) return cached;
    return [];
  };

  const applyFilters = (raw: PlaceCard[], strict: boolean): PlaceCard[] => {
    const notBlocked = raw.filter((c) => !memory.never.includes(c.id));
    if (intent === 'Activity') return notBlocked;
    const filtered = notBlocked.filter((c) => foodMatches(c, selectedFoods, strict));
    return filtered.map((c) => ({ ...c, confidence: foodMatches(c, selectedFoods, true) ? 'strict' : 'broad' }))
      .sort((a, b) => scoreCard(b, selectedFoods, !strict) - scoreCard(a, selectedFoods, !strict));
  };

  const generatePairings = (food: PlaceCard): PlaceCard[] => {
    const base = BASE_ACTIVITY_PAIRINGS.map((p, idx) => ({
      ...p,
      id: `${p.id}-${food.id}-${idx}`,
      selectedFoodTitle: food.title,
      selectedFoodLocation: food.latitude && food.longitude ? { latitude: food.latitude, longitude: food.longitude, label: food.title } : undefined,
      description: `${p.description} Selected food: ${food.title}.`,
    }));
    return base;
  };

  const findThings = async () => {
    setLoading(true);
    setSelectedFoodCard(null);
    setVisibleCount(8);
    setCards(STATIC_FOOD);
    addLog(`Find things tapped: intent=${intent}, foods=${selectedFoods.join(',')}, activities=${selectedActivities.join(',')}, moods=${selectedMoods.join(',')}`);
    try {
      const loc = await getLocation();
      if (!loc) {
        addLog('No GPS location. Enter ZIP.');
        Alert.alert('Location needed', 'Could not get location. Enter a ZIP code and search again.');
        return;
      }
      addLog(`Starting search at ${loc.label || 'Current location'} (${loc.latitude.toFixed(4)}, ${loc.longitude.toFixed(4)})`);
      if (intent === 'Activity') {
        setCards(BASE_ACTIVITY_PAIRINGS);
        addLog('Activity mode uses fast curated activity pairings for now.');
        return;
      }
      const raw75 = await fetchFoodCardsCached(loc, 7.5);
      addLog(`Initial live food cards: ${raw75.length}`);
      let filtered = applyFilters(raw75, true);
      addLog(`Strict food filter kept ${filtered.length}/${raw75.length}`);

      // If strict is too few, broaden locally first before doing a slow wider network search.
      if (filtered.length < 8 && raw75.length > 0) {
        const broad = applyFilters(raw75, false);
        addLog(`Broad local food filter kept ${broad.length}/${raw75.length}`);
        filtered = broad.length > filtered.length ? broad : filtered;
      }

      // Only widen if we at least got some raw cards. If the provider returned zero, avoid another long timeout chain.
      if (filtered.length < 3 && raw75.length > 0) {
        addLog(`Only ${filtered.length} matches; trying wider 14.9mi search.`);
        const raw149 = await fetchFoodCardsCached(loc, 14.9);
        const merged = [...raw75, ...raw149].filter((c, idx, arr) => arr.findIndex((x) => x.id === c.id) === idx);
        addLog(`Merged wider raw cards: ${merged.length}`);
        const strictWide = applyFilters(merged, true);
        const broadWide = applyFilters(merged, false);
        filtered = strictWide.length >= 3 ? strictWide : broadWide;
        addLog(`Wider final kept ${filtered.length}/${merged.length}`);
      } else if (raw75.length === 0) {
        addLog('No raw live cards returned; skipping wider network search and showing manual/Maps fallback.');
      }

      const finalCards = filtered.length ? filtered : STATIC_FOOD;
      setCards(finalCards);
      addLog(`Final card count: ${finalCards.length}`);
      addLog(`Top results: ${finalCards.slice(0, 8).map((c) => c.title).join(' | ')}`);
    } catch (e: any) {
      addLog(`Find things failed: ${e.message}`);
      Alert.alert('Search failed', e.message || 'Unknown error');
      setCards(STATIC_FOOD);
    } finally {
      setLoading(false);
    }
  };

  const searchZip = async () => {
    setLoading(true);
    try {
      const loc = await lookupZip();
      if (!loc) Alert.alert('ZIP not found', 'Try another ZIP code.');
      else await findThings();
    } catch (e: any) {
      addLog(`ZIP search failed: ${e.message}`);
      Alert.alert('ZIP failed', e.message);
    } finally {
      setLoading(false);
    }
  };

  const onSelect = async (card: PlaceCard) => {
    addLog(`Tapped Select: ${card.title} (${card.kind})`);
    const next = { ...memory, selected: unique([card.id, ...memory.selected]).slice(0, 100) };
    await saveMemory(next);
    if (intent === 'Food + Activity' && card.kind === 'food') {
      setSelectedFoodCard(card);
      setSelectedActivityCard(null);
      addLog(`Confirmed food choice: ${card.title}`);
      const pairings = generatePairings(card);
      setCards(pairings);
      setVisibleCount(8);
      addLog(`Generated pairing cards: ${pairings.map((c) => c.title).join(' | ')}`);
      return;
    }
    if (intent === 'Food + Activity' && card.kind === 'pairing') {
      setSelectedActivityCard(card);
      addLog(`Confirmed activity pairing: ${card.title}`);
      return;
    }
    if (intent === 'Activity') {
      setSelectedActivityCard(card);
      addLog(`Confirmed activity choice: ${card.title}`);
      return;
    }
    setSelectedFoodCard(card);
    addLog(`Confirmed food choice: ${card.title}`);
  };
  const onFavorite = async (card: PlaceCard) => { addLog(`Tapped Favorite: ${card.title}`); await saveMemory({ ...memory, favorites: unique([card.id, ...memory.favorites]) }); };
  const onDismiss = (card: PlaceCard) => { addLog(`Tapped Dismiss: ${card.title}`); setCards((p) => p.filter((c) => c.id !== card.id)); };
  const onNever = async (card: PlaceCard) => {
    addLog(`Tapped Don't rec: ${card.title}`);
    await saveMemory({ ...memory, never: unique([card.id, ...memory.never]) });
    setCards((p) => p.filter((c) => c.id !== card.id));
  };

  const useManualFoodForPairing = () => {
    const name = manualFoodName.trim();
    if (!name) {
      Alert.alert('Enter the place', 'Type the restaurant you picked from Maps first.');
      return;
    }
    const card: PlaceCard = {
      id: `manual-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`,
      kind: 'food',
      title: name,
      subtitle: location?.label ? `Picked from Maps · ${location.label}` : 'Picked from Maps',
      description: 'Manually selected after opening Maps.',
      latitude: location?.latitude,
      longitude: location?.longitude,
      confidence: 'static',
    };
    setSelectedFoodCard(card);
    setSelectedActivityCard(null);
    setCards(generatePairings(card));
    setVisibleCount(8);
    addLog(`Manual food selected for pairing: ${name}`);
  };

  const useManualActivity = () => {
    const name = manualActivityName.trim();
    if (!name) {
      Alert.alert('Enter the activity', 'Type the activity or place you picked first.');
      return;
    }
    const card: PlaceCard = {
      id: `manual-activity-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`,
      kind: 'pairing',
      title: name,
      subtitle: selectedFoodCard ? `Paired with ${selectedFoodCard.title}` : 'Picked from Maps',
      description: selectedFoodCard ? `Manual activity paired with ${selectedFoodCard.title}.` : 'Manual activity selection.',
      selectedFoodTitle: selectedFoodCard?.title,
      selectedFoodLocation: selectedFoodCard?.latitude && selectedFoodCard?.longitude ? { latitude: selectedFoodCard.latitude, longitude: selectedFoodCard.longitude, label: selectedFoodCard.title } : undefined,
      confidence: 'static',
    };
    setSelectedActivityCard(card);
    addLog(`Manual activity confirmed: ${name}`);
  };

  const pairingSearchQuery = (card: PlaceCard) => {
    const base = card.selectedFoodTitle || selectedFoodCard?.title || location?.label || zip || 'me';
    const title = card.title.toLowerCase();
    if (title.includes('dessert') || title.includes('coffee')) return `dessert coffee ice cream bakery near ${base}`;
    if (title.includes('movie')) return `movie theater near ${base}`;
    if (title.includes('shopping') || title.includes('shops')) return `shopping mall downtown shops near ${base}`;
    if (title.includes('arcade') || title.includes('games')) return `arcade bowling games kid activities near ${base}`;
    if (title.includes('park') || title.includes('trail') || title.includes('walk')) return `parks trails walkable shopping area near ${base}`;
    return `${card.title} near ${base}`;
  };

  const isManualActivity = (card?: PlaceCard | null) => Boolean(card?.id?.startsWith('manual-activity-'));

  const isConcreteRouteStop = (card?: PlaceCard | null) => {
    if (!card) return false;
    if (card.latitude && card.longitude && card.kind !== 'pairing' && card.kind !== 'static') return true;
    if (isManualActivity(card)) return true;
    if (card.kind !== 'pairing' && card.kind !== 'static') return true;
    return false;
  };

  const concreteMapQueryForCard = (card: PlaceCard) => {
    // For directions, Google Maps behaves best when given a real business/place name.
    // Avoid broad category text like "dessert coffee ice cream bakery near..." as a route stop.
    if (isManualActivity(card)) return selectedFoodCard ? `${card.title} near ${selectedFoodCard.title}` : card.title;
    if (location?.label) return `${card.title} ${location.label}`;
    return card.title;
  };

  const openPlanDirections = () => {
    if (!selectedFoodCard && !selectedActivityCard) {
      Alert.alert('No confirmed choice yet', 'Select food or an activity first.');
      return;
    }

    const origin = 'Current Location';
    const hasConcreteFood = isConcreteRouteStop(selectedFoodCard);
    const hasConcreteActivity = isConcreteRouteStop(selectedActivityCard);
    const foodQ = hasConcreteFood && selectedFoodCard ? concreteMapQueryForCard(selectedFoodCard) : '';
    const activityQ = hasConcreteActivity && selectedActivityCard ? concreteMapQueryForCard(selectedActivityCard) : '';

    let destination = activityQ || foodQ;
    let waypoints = '';
    if (foodQ && activityQ) waypoints = `&waypoints=${encodeURIComponent(foodQ)}`;

    if (!destination) {
      Alert.alert('No routable place yet', 'Select a real place, or type the place you picked from Maps, before requesting directions.');
      return;
    }

    const url = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}${waypoints}&travelmode=driving`;
    addLog(`Open plan directions: origin=${origin}; food=${foodQ || 'none'}; activity=${activityQ || 'none'}; destination=${destination}`);
    Linking.openURL(url);
  };

  const openMaps = (card: PlaceCard) => {
    const foodQuery = selectedFoods.includes('Any')
      ? 'restaurants'
      : `${selectedFoods.join(' or ')} restaurant`;
    let q = card.title;
    if (card.kind === 'static' && card.title.toLowerCase().includes('pick a close')) {
      q = `${foodQuery} near ${location?.label || zip || 'me'}`;
    } else if (card.kind === 'pairing') {
      // Pairing cards are search prompts, not confirmed route stops.
      q = pairingSearchQuery(card);
    } else if (location?.label) {
      q = `${card.title} ${location.label}`;
    }
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
    addLog(`Open Maps: ${q}`);
    Linking.openURL(url);
  };

  const visibleCards = cards.slice(0, visibleCount);

  const Chip = ({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) => (
    <TouchableOpacity onPress={onPress} style={[styles.chip, selected && styles.chipSelected]}>
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.kicker}>PERSONAL SUGGESTION ENGINE</Text>
      <Text style={styles.title}>Things Nearby</Text>
      <Text style={styles.subtitle}>Pick what you are looking for. Get a useful food or activity idea.</Text>

      <View style={styles.panel}>
        <Text style={styles.section}>Looking for</Text>
        <View style={styles.row}>{intents.map((x) => <Chip key={x} label={x} selected={intent === x} onPress={() => { addLog(`Tapped intent chip: ${x}`); setIntent(x); setSelectedFoodCard(null); setSelectedActivityCard(null); }} />)}</View>

        <Text style={styles.section}>Mood</Text>
        <View style={styles.row}>{moods.map((x) => <Chip key={x} label={x} selected={selectedMoods.includes(x)} onPress={() => toggleMood(x)} />)}</View>

        <Text style={styles.section}>Time</Text>
        <View style={styles.row}>{times.map((x) => <Chip key={x} label={x} selected={selectedTime === x} onPress={() => { addLog(`Tapped time chip: ${x}`); setSelectedTime(x); }} />)}</View>

        {intent !== 'Activity' && <>
          <Text style={styles.section}>Food</Text>
          <View style={styles.row}>{foods.map((x) => <Chip key={x} label={x} selected={selectedFoods.includes(x)} onPress={() => toggleFood(x)} />)}</View>
        </>}

        {intent !== 'Food' && <>
          <Text style={styles.section}>Activity</Text>
          <View style={styles.row}>{activities.map((x) => <Chip key={x} label={x} selected={selectedActivities.includes(x)} onPress={() => toggleActivity(x)} />)}</View>
        </>}

        <Text style={styles.section}>Weather</Text>
        <View style={styles.row}>{weather.map((x) => <Chip key={x} label={x} selected={selectedWeather === x} onPress={() => { addLog(`Tapped weather chip: ${x}`); setSelectedWeather(x); }} />)}</View>

        <TouchableOpacity style={styles.primary} onPress={findThings} disabled={loading}>
          {loading ? <ActivityIndicator /> : <Text style={styles.primaryText}>Find things to do</Text>}
        </TouchableOpacity>
        <Text style={styles.small}>{location?.label ? `Searching near: ${location.label}` : 'Location will be requested when you search.'}</Text>

        <View style={styles.zipRow}>
          <TextInput placeholder="ZIP fallback" value={zip} onChangeText={setZip} keyboardType="number-pad" style={styles.zipInput} />
          <TouchableOpacity style={styles.zipButton} onPress={searchZip}><Text style={styles.zipButtonText}>Search ZIP</Text></TouchableOpacity>
        </View>
      </View>

      {(selectedFoodCard || selectedActivityCard) && (
        <View style={styles.planBox}>
          <Text style={styles.planTitle}>Confirmed choice</Text>
          {selectedFoodCard && <Text style={styles.planLine}>Food: {selectedFoodCard.title}</Text>}
          {selectedActivityCard && <Text style={styles.planLine}>Activity: {selectedActivityCard.title}</Text>}
          {!selectedActivityCard && intent === 'Food + Activity' && <Text style={styles.planHint}>Next: pick an activity pairing below, or open Maps and type what you chose.</Text>}
          <View style={styles.actions}>
            {(selectedFoodCard || selectedActivityCard) && <TouchableOpacity style={styles.action} onPress={openPlanDirections}><Text>Directions to plan</Text></TouchableOpacity>}
            {selectedFoodCard && <TouchableOpacity style={styles.action} onPress={() => { addLog('Change food tapped'); setSelectedFoodCard(null); setSelectedActivityCard(null); setCards(STATIC_FOOD); setVisibleCount(8); }}><Text>Change food</Text></TouchableOpacity>}
            {selectedActivityCard && <TouchableOpacity style={styles.action} onPress={() => { addLog('Change activity tapped'); setSelectedActivityCard(null); }}><Text>Change activity</Text></TouchableOpacity>}
          </View>
        </View>
      )}

      {intent === 'Food + Activity' && selectedFoodCard && !selectedActivityCard && (
        <View style={styles.manualBox}>
          <Text style={styles.manualTitle}>Picked an activity in Maps?</Text>
          <Text style={styles.manualText}>Come back here, type what you chose, then tap Use it.</Text>
          <View style={styles.zipRow}>
            <TextInput placeholder="Activity or place name" value={manualActivityName} onChangeText={setManualActivityName} style={styles.zipInput} />
            <TouchableOpacity style={styles.zipButton} onPress={useManualActivity}><Text style={styles.zipButtonText}>Use it</Text></TouchableOpacity>
          </View>
        </View>
      )}

      {intent === 'Food + Activity' && !selectedFoodCard && (
        <Text style={styles.flowHint}>Step 1: pick food first. Tap Select on a restaurant, or open Maps and type the place you chose below.</Text>
      )}
      {intent === 'Food + Activity' && !selectedFoodCard && (
        <View style={styles.manualBox}>
          <Text style={styles.manualTitle}>Picked a restaurant in Maps?</Text>
          <Text style={styles.manualText}>Come back here, type the restaurant name, then tap Use it.</Text>
          <View style={styles.zipRow}>
            <TextInput placeholder="Restaurant name" value={manualFoodName} onChangeText={setManualFoodName} style={styles.zipInput} />
            <TouchableOpacity style={styles.zipButton} onPress={useManualFoodForPairing}><Text style={styles.zipButtonText}>Use it</Text></TouchableOpacity>
          </View>
        </View>
      )}

      <View style={styles.debugRow}>
        <TouchableOpacity style={styles.secondary} onPress={() => Share.share({ message: logs.slice().reverse().join('\n') })}><Text>Share logs</Text></TouchableOpacity>
        <TouchableOpacity style={styles.secondary} onPress={() => { AsyncStorage.removeItem(STORAGE_LOCATION); setLocation(null); addLog('Location cache cleared'); }}><Text>Clear location</Text></TouchableOpacity>
        <TouchableOpacity style={styles.secondary} onPress={() => { AsyncStorage.removeItem(STORAGE_FOOD_CACHE); addLog('Place cache cleared'); }}><Text>Clear places</Text></TouchableOpacity>
        <TouchableOpacity style={styles.secondary} onPress={() => setLoading(false)}><Text>Stop spinner</Text></TouchableOpacity>
      </View>
      <TouchableOpacity onPress={() => setShowLogs((s) => !s)}><Text style={styles.logToggle}>{showLogs ? 'Hide debug logs' : 'Show debug logs'}</Text></TouchableOpacity>
      {showLogs && <View style={styles.logBox}>{logs.map((l, i) => <Text key={i} style={styles.logText}>{l}</Text>)}</View>}

      <Text style={styles.suggestions}>Suggestions</Text>
      {visibleCards.map((card) => (
        <View key={card.id} style={styles.card}>
          <Text style={styles.cardTitle}>{card.title}</Text>
          <Text style={styles.cardSub}>{card.subtitle}</Text>
          <Text style={styles.cardDesc}>{card.description}</Text>
          {card.distanceMiles != null && <Text style={styles.meta}>{card.distanceMiles.toFixed(1)} miles away</Text>}
          {card.confidence && <Text style={styles.meta}>Match: {card.confidence}</Text>}
          <View style={styles.actions}>
            <TouchableOpacity style={styles.action} onPress={() => onSelect(card)}><Text>Select</Text></TouchableOpacity>
            <TouchableOpacity style={styles.action} onPress={() => onFavorite(card)}><Text>Favorite</Text></TouchableOpacity>
            <TouchableOpacity style={styles.action} onPress={() => onDismiss(card)}><Text>Dismiss</Text></TouchableOpacity>
            <TouchableOpacity style={styles.action} onPress={() => onNever(card)}><Text>Don’t rec</Text></TouchableOpacity>
          </View>
          <TouchableOpacity onPress={() => openMaps(card)}><Text style={styles.map}>Open Maps</Text></TouchableOpacity>
        </View>
      ))}
      {visibleCount < cards.length && <TouchableOpacity style={styles.loadMore} onPress={() => setVisibleCount((c) => c + 8)}><Text style={styles.loadMoreText}>Load more</Text></TouchableOpacity>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4efe7' },
  content: { padding: 24, paddingTop: 56 },
  kicker: { color: '#b87500', fontWeight: '800', letterSpacing: 2, marginBottom: 18 },
  title: { fontSize: 46, fontWeight: '900', color: '#111827' },
  subtitle: { fontSize: 20, color: '#5b6270', marginTop: 8, marginBottom: 28 },
  panel: { backgroundColor: '#fffaf2', borderRadius: 28, padding: 18, borderColor: '#e2d8c8', borderWidth: 1 },
  section: { fontSize: 22, fontWeight: '900', marginTop: 16, marginBottom: 10, color: '#111827' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: { paddingHorizontal: 18, paddingVertical: 13, borderRadius: 22, backgroundColor: '#fff', borderWidth: 1, borderColor: '#d7d1c6' },
  chipSelected: { backgroundColor: '#172033', borderColor: '#172033' },
  chipText: { fontSize: 18, fontWeight: '700', color: '#202938' },
  chipTextSelected: { color: '#fff' },
  primary: { marginTop: 24, backgroundColor: '#111827', borderRadius: 18, padding: 20, alignItems: 'center' },
  primaryText: { color: '#fff', fontSize: 19, fontWeight: '900' },
  small: { marginTop: 12, color: '#6b6258', fontSize: 16 },
  zipRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  zipInput: { flex: 1, borderWidth: 1, borderColor: '#d7d1c6', borderRadius: 14, padding: 14, fontSize: 18, backgroundColor: '#fff' },
  zipButton: { backgroundColor: '#e9dfd0', borderRadius: 14, paddingHorizontal: 16, justifyContent: 'center' },
  zipButtonText: { fontWeight: '900' },
  flowHint: { marginTop: 18, color: '#7c5200', fontSize: 18, fontWeight: '800', lineHeight: 24 },
  planBox: { marginTop: 18, backgroundColor: '#ecfdf5', borderRadius: 20, padding: 18, borderColor: '#a7f3d0', borderWidth: 1 },
  planTitle: { color: '#047857', fontSize: 20, fontWeight: '900', marginBottom: 8 },
  planLine: { color: '#064e3b', fontSize: 18, fontWeight: '800', marginBottom: 4 },
  planHint: { color: '#047857', fontSize: 15, marginTop: 6 },
  selectedBox: { marginTop: 18, backgroundColor: '#ecfdf5', borderRadius: 18, padding: 16, borderColor: '#a7f3d0', borderWidth: 1 },
  selectedLine: { color: '#047857', fontSize: 18, fontWeight: '800' },
  manualBox: { backgroundColor: '#fffaf2', borderRadius: 18, padding: 14, marginTop: 14, borderColor: '#e2d8c8', borderWidth: 1 },
  manualTitle: { fontSize: 18, fontWeight: '900', color: '#111827', marginBottom: 4 },
  manualText: { color: '#5b6270', marginBottom: 8, fontSize: 15 },
  debugRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 18 },
  secondary: { backgroundColor: '#fff', borderColor: '#d7d1c6', borderWidth: 1, borderRadius: 14, padding: 12 },
  logToggle: { marginTop: 16, fontSize: 18, fontWeight: '800', color: '#6b4d1f' },
  logBox: { backgroundColor: '#111', borderRadius: 18, padding: 14, marginTop: 8 },
  logText: { color: '#ddd', fontSize: 12, marginBottom: 5 },
  suggestions: { fontSize: 28, fontWeight: '900', marginTop: 28, marginBottom: 14 },
  card: { backgroundColor: '#fff', borderRadius: 24, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: '#e2d8c8' },
  cardTitle: { fontSize: 28, fontWeight: '900', color: '#0f172a' },
  cardSub: { fontSize: 16, color: '#6b7280', marginTop: 6 },
  cardDesc: { fontSize: 18, color: '#4b5563', marginTop: 10, lineHeight: 25 },
  meta: { color: '#047857', fontWeight: '800', marginTop: 8 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 },
  action: { backgroundColor: '#f1f5f9', borderRadius: 12, paddingHorizontal: 13, paddingVertical: 10 },
  map: { marginTop: 14, color: '#1d4ed8', fontSize: 17, fontWeight: '900' },
  loadMore: { backgroundColor: '#111827', padding: 18, borderRadius: 18, alignItems: 'center', marginBottom: 40 },
  loadMoreText: { color: '#fff', fontSize: 18, fontWeight: '900' },
});
