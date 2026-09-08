import Ionicons from '@expo/vector-icons/Ionicons';
import * as Location from 'expo-location';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Storage from '../data/accountStorage';
import { departureForArrival, formatItineraryDuration } from '../domain/itinerary';
import type { TravelMode } from '../domain/plan';
import { colors } from './theme';

type Origin = { latitude: number; longitude: number; label?: string };
type Journey = { source: 'current' | 'home' | 'custom'; mode: TravelMode; origin?: Origin; override?: number };
export type GettingThereSummary = { tripKey: string; minutes: number; originLabel: string; mode: TravelMode };
const HOME_KEY = 'nomNomGoHomeOriginV1';
const MODES = [
  { mode: 'car', label: 'Drive', icon: 'car-outline' },
  { mode: 'walk', label: 'Walk', icon: 'walk-outline' },
  { mode: 'bike', label: 'Bike', icon: 'bicycle-outline' },
  { mode: 'train', label: 'Train', icon: 'train-outline' },
  { mode: 'plane', label: 'Plane', icon: 'airplane-outline' },
] as const;
const validOrigin = (value: Origin | undefined): value is Origin => !!value &&
  Number.isFinite(value.latitude) && Math.abs(value.latitude) <= 90 && Number.isFinite(value.longitude) && Math.abs(value.longitude) <= 180;

async function getCurrentJourneyOrigin(): Promise<Origin> {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (permission.status !== 'granted') throw new Error('Allow location access, choose an address, or set the travel time.');
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('Location is taking too long. Try again or choose an address.')), 12000); }),
    ]);
    return { latitude: result.coords.latitude, longitude: result.coords.longitude, label: 'Current location' };
  } finally { clearTimeout(timer); }
}

// Each person's approach journey is account-scoped local data, separate from
// shared stops. It remains editable when the organizer locks the itinerary.
export function GettingThereRow({ tripKey, arrivalMs, initialOrigin, initialMode = 'car', editing = false, destinationLocated, estimateMinutes, resolveOrigin, onChange }: {
  tripKey: string; arrivalMs: number; initialOrigin?: Origin; initialMode?: TravelMode;
  editing?: boolean;
  destinationLocated: boolean;
  estimateMinutes: (origin: Origin | undefined, mode: TravelMode) => number;
  resolveOrigin: (query: string) => Promise<Origin | undefined>;
  onChange: (summary: GettingThereSummary) => void;
}) {
  const [journey, setJourney] = useState<Journey>({
    source: initialOrigin?.label && initialOrigin.label !== 'Current location' ? 'custom' : 'current',
    mode: initialMode, origin: initialOrigin,
  });
  const [home, setHome] = useState<Origin>();
  const [ready, setReady] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [addressKind, setAddressKind] = useState<'home' | 'custom' | null>(null);
  const [address, setAddress] = useState('');
  const [minutesDraft, setMinutesDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const alive = useRef(true);
  const writeQueue = useRef(Promise.resolve());
  const storageKey = `nomNomGoJourneyV1:${tripKey}`;
  useEffect(() => {
    alive.current = true;
    void Promise.all([Storage.getItem(HOME_KEY), Storage.getItem(storageKey)]).then(([homeRaw, raw]) => {
      if (!alive.current) return;
      const storedHome = homeRaw ? JSON.parse(homeRaw) : undefined;
      if (validOrigin(storedHome)) setHome(storedHome);
      const stored = raw ? JSON.parse(raw) as Journey : undefined;
      if (stored && ['current', 'home', 'custom'].includes(stored.source) && MODES.some((mode) => mode.mode === stored.mode)) {
        setJourney({ ...stored, origin: validOrigin(stored.origin) ? stored.origin : undefined,
          override: Number.isInteger(stored.override) && stored.override! >= 0 && stored.override! <= 1440 ? stored.override : undefined });
      }
    }).catch(() => { if (alive.current) setError('Saved travel settings could not be loaded. Choose your starting point again.'); })
      .finally(() => { if (alive.current) setReady(true); });
    return () => { alive.current = false; };
  }, [storageKey]);

  const origin = journey.source === 'home' ? home : journey.origin;
  const originLabel = journey.source === 'home' ? 'Home' : journey.source === 'current' ? 'Current location' : origin?.label || 'Another address';
  const minutes = journey.override ?? estimateMinutes(origin, journey.mode);
  useEffect(() => { setMinutesDraft(String(minutes)); }, [minutes]);
  const mode = MODES.find((item) => item.mode === journey.mode)!;
  const departure = new Date(departureForArrival(arrivalMs, minutes));
  const previousDay = departure.toDateString() !== new Date(arrivalMs).toDateString();
  const leaveLabel = `${departure.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}${previousDay ? ` · ${departure.toLocaleDateString([], { month: 'short', day: 'numeric' })}` : ''}`;
  useEffect(() => {
    if (ready) onChange({ tripKey, minutes, originLabel, mode: journey.mode });
  }, [ready, tripKey, minutes, originLabel, journey.mode, onChange]);

  const save = (next: Journey) => {
    setJourney(next);
    setError('');
    writeQueue.current = writeQueue.current.catch(() => {}).then(() => Storage.setItem(storageKey, JSON.stringify(next)));
    void writeQueue.current.catch(() => { if (alive.current) setError('Travel settings could not be saved on this device. Try again.'); });
  };
  const current = async () => {
    setBusy(true); setError(''); setAddressKind(null);
    try {
      const origin = await getCurrentJourneyOrigin();
      if (alive.current) save({ ...journey, source: 'current', origin });
    } catch (cause) { if (alive.current) setError(cause instanceof Error ? cause.message : 'Location is unavailable. Choose an address or set the travel time.'); }
    finally { if (alive.current) setBusy(false); }
  };
  const saveAddress = async () => {
    if (!address.trim() || !addressKind) return;
    setBusy(true); setError('');
    try {
      const resolved = await resolveOrigin(address.trim());
      if (!alive.current) return;
      if (!resolved) throw new Error('Address not found. Try a full address or a nearby place.');
      const nextOrigin = { latitude: resolved.latitude, longitude: resolved.longitude, label: address.trim() };
      if (addressKind === 'home') {
        await Storage.setItem(HOME_KEY, JSON.stringify(nextOrigin));
        if (!alive.current) return;
        setHome(nextOrigin);
      }
      save({ ...journey, source: addressKind, origin: addressKind === 'custom' ? nextOrigin : undefined });
      setAddressKind(null);
    } catch (cause) { if (alive.current) setError(cause instanceof Error ? cause.message : 'The address could not be saved. Try again.'); }
    finally { if (alive.current) setBusy(false); }
  };
  const applyMinutes = () => {
    if (!/^\d{1,4}$/.test(minutesDraft.trim()) || Number(minutesDraft) > 1440) {
      setError('Enter a whole number from 0 to 1,440 minutes.'); return;
    }
    save({ ...journey, override: Number(minutesDraft) });
  };
  const chooseAddress = (kind: 'home' | 'custom') => {
    setAddressKind(kind); setAddress(kind === 'home' ? home?.label || '' : journey.source === 'custom' ? origin?.label || '' : ''); setError('');
  };

  return <View style={[styles.container, editing && styles.editingContainer]}>
    <TouchableOpacity accessibilityRole="button" accessibilityLabel="Edit travel to first stop" accessibilityState={{ expanded, disabled: !ready }}
      disabled={!ready} onPress={() => { setExpanded(!expanded); setMinutesDraft(String(minutes)); }} style={styles.summary}>
      <Ionicons name={mode.icon} size={20} color={colors.cyan} />
      <View style={styles.summaryText}>
        <Text style={styles.title}>Travel · {journey.override === undefined ? '~' : ''}{formatItineraryDuration(minutes)} {mode.label.toLowerCase()}</Text>
        <View style={styles.travelDetails}><Text style={styles.copy}>{originLabel}</Text><Text style={styles.copy}>Leave {leaveLabel}</Text></View>
      </View>
      <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textSecondary} />
    </TouchableOpacity>
    {expanded ? <View style={styles.editor}>
      <Text style={styles.hint}>Your journey to the first stop. The plan starts when you arrive.</Text>
      <View style={styles.choices}>
        <Choice label="Current location" selected={journey.source === 'current'} disabled={busy} onPress={() => { void current(); }} />
        <Choice label="Home" selected={journey.source === 'home'} disabled={busy} onPress={() => { if (home) { save({ ...journey, source: 'home', origin: undefined }); setAddressKind(null); } else chooseAddress('home'); }} />
        <Choice label="Another address" selected={journey.source === 'custom'} disabled={busy} onPress={() => chooseAddress('custom')} />
      </View>
      {journey.source === 'home' && home ? <View style={styles.choices}><Text style={[styles.hint, { flex: 1 }]}>{home.label}</Text><Choice label="Edit home" disabled={busy} onPress={() => chooseAddress('home')} /></View> : null}
      {addressKind ? <View style={styles.field}>
        <Text style={styles.title}>{addressKind === 'home' ? 'Home address' : 'Starting address'}</Text>
        <TextInput accessibilityLabel={addressKind === 'home' ? 'Home address' : 'Starting address'} style={styles.input} value={address}
          editable={!busy} onChangeText={setAddress} placeholder="Address, ZIP, or place" placeholderTextColor={colors.textTertiary} returnKeyType="done" onSubmitEditing={() => { void saveAddress(); }} />
        <Choice label={addressKind === 'home' ? 'Save home' : 'Use address'} disabled={busy || !address.trim()} onPress={() => { void saveAddress(); }} />
      </View> : null}
      <View accessibilityRole="radiogroup" accessibilityLabel="Travel mode to first stop" style={styles.choices}>
        {MODES.map((option) => <Choice key={option.mode} label={option.label} selected={journey.mode === option.mode} disabled={busy} onPress={() => save({ ...journey, mode: option.mode })} />)}
      </View>
      <Text style={styles.hint}>{journey.override !== undefined ? 'Custom travel time' : !destinationLocated ? 'Rough estimate · set travel time for this place' : origin ? 'Estimated travel time · traffic not included' : 'Rough estimate · choose a starting point for a better estimate'}</Text>
      <View style={styles.choices}>
        <TextInput accessibilityLabel="Travel minutes to first stop" value={minutesDraft} onChangeText={setMinutesDraft} editable={!busy}
          keyboardType="number-pad" inputMode="numeric" maxLength={4} style={[styles.input, styles.minutes]} onSubmitEditing={applyMinutes} />
        <Text style={styles.copy}>min</Text>
        <Choice label="Set time" disabled={busy} onPress={applyMinutes} />
        {journey.override !== undefined ? <Choice label="Use estimate" disabled={busy} onPress={() => { save({ ...journey, override: undefined }); setMinutesDraft(String(estimateMinutes(origin, journey.mode))); }} /> : null}
      </View>
      <Text style={styles.hint}>Saved for you on this device. Your starting address is not shared with the plan.</Text>
      {busy ? <ActivityIndicator color={colors.cyan} /> : null}
    </View> : null}
    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
  </View>;
}

function Choice({ label, selected, disabled, onPress }: { label: string; selected?: boolean; disabled?: boolean; onPress: () => void }) {
  return <TouchableOpacity accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected, disabled }} disabled={disabled} onPress={onPress}
    style={[styles.choice, selected && styles.selected, disabled && { opacity: 0.5 }]}><Text style={styles.copy}>{label}</Text></TouchableOpacity>;
}
const styles = StyleSheet.create({
  container: { borderLeftWidth: 2, borderColor: colors.cyan, backgroundColor: colors.surface, borderRadius: 10 },
  editingContainer: { marginLeft: 28 },
  summary: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, minHeight: 58 },
  summaryText: { flex: 1, gap: 4 }, title: { color: colors.cyan, fontSize: 13, lineHeight: 18, fontWeight: '700' },
  travelDetails: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 8, rowGap: 2 },
  copy: { color: colors.textSecondary, fontSize: 13, lineHeight: 18 }, hint: { color: colors.textTertiary, fontSize: 12, lineHeight: 18 },
  editor: { padding: 12, paddingTop: 0, gap: 12 }, field: { gap: 8 }, choices: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  choice: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 10, borderWidth: 1, borderColor: colors.divider, borderRadius: 8 },
  selected: { backgroundColor: '#123b38', borderColor: colors.cyan },
  input: { minHeight: 44, padding: 10, borderWidth: 1, borderColor: colors.divider, borderRadius: 8, color: colors.textPrimary, fontSize: 15, backgroundColor: colors.background },
  minutes: { width: 65 }, error: { padding: 12, color: colors.red, fontSize: 13, lineHeight: 18 },
});
