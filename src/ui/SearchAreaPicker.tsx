import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AREA_CHOICES, AREA_RADIUS_OPTIONS, locationForArea, METERS_PER_MILE, type AreaCenter, type AreaKind, type AreaLocation, type AreaMatch } from '../domain/searchArea';
import { isSearchCancelled, SearchExecution } from '../domain/searchExecution';
import { colors } from './theme';

type Props = {
  location: AreaLocation | null;
  contextKey: string;
  pendingKind?: AreaKind | 'whole';
  onLoad: (kind: AreaKind, execution: SearchExecution) => Promise<{ base: AreaCenter; matches: AreaMatch[] }>;
  onSelect: (location: AreaLocation | null) => Promise<void>;
};

/** The inline chooser contains filter values; only selecting one updates main results. */
export function SearchAreaPicker({ location, contextKey, pendingKind, onLoad, onSelect }: Props) {
  const [openKind, setOpenKind] = useState<AreaKind | null>(null);
  const [options, setOptions] = useState<{ base: AreaCenter; matches: AreaMatch[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const request = useRef<SearchExecution | null>(null);
  const cache = useRef(new Map<string, { expires: number; value: { base: AreaCenter; matches: AreaMatch[] } }>());
  useEffect(() => {
    request.current?.cancel();
    setOpenKind(null);
    setOptions(null);
    setBusy(false);
    setError('');
    return () => request.current?.cancel();
  }, [contextKey]);

  const close = () => {
    request.current?.cancel();
    setOpenKind(null);
    setBusy(false);
  };
  const load = async (kind: AreaKind) => {
    request.current?.cancel();
    const execution = new SearchExecution((request.current?.id || 0) + 1);
    request.current = execution;
    setOpenKind(kind);
    setOptions(null);
    setError('');
    const key = `${contextKey}:${kind}`;
    const saved = cache.current.get(key);
    if (saved && saved.expires > Date.now()) {
      setOptions(saved.value);
      setBusy(false);
      return;
    }
    setBusy(true);
    try {
      const value = await onLoad(kind, execution);
      execution.check();
      if (cache.current.size >= 12) cache.current.delete(cache.current.keys().next().value!);
      cache.current.set(key, { expires: Date.now() + 10 * 60 * 1000, value });
      setOptions(value);
    } catch (cause) {
      if (!isSearchCancelled(cause) && !execution.controller.signal.aborted) setError('Could not load local choices. Try again.');
    } finally {
      if (!execution.controller.signal.aborted) setBusy(false);
    }
  };
  const focus = location?.areaFocus;
  const selectedKind = openKind || pendingKind || focus?.kind || 'whole';
  return (
    <View style={styles.panel}>
      <View style={styles.heading}>
        <Ionicons name="locate-outline" color={colors.teal} size={18} />
        <Text style={styles.title}>Area preference</Text>
      </View>
      <View style={styles.chips}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Search whole area"
          accessibilityState={{ selected: selectedKind === 'whole' }}
          onPress={() => { close(); void onSelect(null); }}
          style={[styles.chip, selectedKind === 'whole' && styles.selected]}>
          <Text style={styles.chipText}>Whole area</Text>
        </TouchableOpacity>
        {AREA_CHOICES.filter((choice) => choice.kind !== 'custom').map((choice) => (
          <TouchableOpacity key={choice.kind} accessibilityRole="button" accessibilityLabel={choice.label}
            accessibilityState={{ selected: selectedKind === choice.kind, expanded: openKind === choice.kind }}
            onPress={() => { if (openKind === choice.kind) close(); else void load(choice.kind); }}
            style={[styles.chip, selectedKind === choice.kind && styles.selected]}>
            <Text style={styles.chipText}>{choice.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {openKind ? (
        <View style={styles.chooser}>
          <View style={styles.heading}>
            <Text style={[styles.title, styles.grow]}>Choose {openKind === 'freeway' ? 'a freeway' : openKind === 'neighborhood' ? 'a neighborhood' : openKind === 'supercharger' ? 'a Supercharger' : 'a location'}</Text>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Close area choices" onPress={close} style={styles.close}>
              <Ionicons name="close" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
          {busy ? <View style={styles.heading}><ActivityIndicator size="small" color={colors.teal} /><Text style={styles.hint}>Finding local choices…</Text></View> : null}
          {error ? <View style={styles.heading}><Text style={[styles.hint, styles.grow]} accessibilityLiveRegion="polite">{error}</Text><TouchableOpacity accessibilityRole="button" onPress={() => { void load(openKind); }} style={styles.chip}><Text style={styles.chipText}>Retry</Text></TouchableOpacity></View> : null}
          {options ? <>
            <Text style={styles.hint}>Near {options.base.label || 'your search location'}. Select one to refresh the main results.</Text>
            {!options.matches.length ? <Text style={styles.hint} accessibilityLiveRegion="polite">No nearby choices found. Try another filter or change your search city.</Text> : null}
            <ScrollView style={styles.options} nestedScrollEnabled keyboardShouldPersistTaps="handled">
              {options.matches.map((match) => (
                <TouchableOpacity key={match.id} accessibilityRole="button"
                  accessibilityLabel={`${match.label}, ${match.address}`}
                  accessibilityState={{ selected: focus?.placeId === match.id }}
                  style={[styles.option, focus?.placeId === match.id && styles.selected]}
                  onPress={() => { close(); void onSelect(locationForArea(openKind, options.base, match, focus?.radiusMeters)); }}>
                  <View style={styles.grow}><Text style={styles.chipText}>{match.label}</Text><Text style={styles.hint}>{match.address || match.description}</Text></View>
                  <Ionicons name={focus?.placeId === match.id ? 'checkmark-circle' : 'chevron-forward'} size={18} color={colors.teal} />
                </TouchableOpacity>
              ))}
            </ScrollView>
            {options.matches.some((match) => match.source === 'osm') ? <Text accessibilityRole="link" onPress={() => { void Linking.openURL('https://www.openstreetmap.org/copyright'); }} style={styles.attribution}>© OpenStreetMap contributors</Text> : <Text style={styles.attribution}>Powered by Google</Text>}
          </> : null}
        </View>
      ) : null}
      <Text style={styles.hint}>
        {pendingKind ? 'Updating main results…' : focus ? `Showing results ${focus.corridor ? 'along' : 'near'} ${location.label}.` : 'Choose a filter, then a location to update the main results.'}
      </Text>
      {focus?.kind === 'supercharger' ? <Text style={styles.hint}>Adding a place also adds this Supercharger to your plan.</Text> : null}
      {focus ? (
        <View style={styles.chips}>
          <Text style={styles.radiusLabel}>{focus.corridor ? 'From freeway' : 'Within'}</Text>
          {AREA_RADIUS_OPTIONS.map((miles) => (
            <TouchableOpacity key={miles} accessibilityRole="button"
              accessibilityLabel={`Search within ${miles} ${miles === 1 ? 'mile' : 'miles'}`}
              accessibilityState={{ selected: Math.round(focus.radiusMeters / METERS_PER_MILE) === miles }}
              style={[styles.chip, Math.round(focus.radiusMeters / METERS_PER_MILE) === miles && styles.selected]}
              onPress={() => { close(); void onSelect({ ...location, areaFocus: { ...focus, radiusMeters: miles * METERS_PER_MILE } }); }}>
              <Text style={styles.chipText}>{miles} mi</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { gap: 10, paddingTop: 12 },
  chooser: { gap: 10, padding: 12, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: 12, backgroundColor: colors.surface },
  options: { maxHeight: 260 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderBottomWidth: 1, borderColor: colors.border },
  grow: { flex: 1 },
  close: { padding: 8 },
  attribution: { color: colors.textTertiary, fontSize: 11 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { color: colors.textPrimary, fontSize: 14, fontWeight: '700' },
  hint: { color: colors.textSecondary, fontSize: 12, lineHeight: 18 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  chip: { minHeight: 40, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 20, backgroundColor: colors.surfaceRaised, borderWidth: 1, borderColor: colors.borderStrong, justifyContent: 'center' },
  selected: { backgroundColor: colors.tealSoft, borderColor: colors.teal },
  chipText: { color: colors.textPrimary, fontSize: 12, fontWeight: '600' },
  radiusLabel: { color: colors.textSecondary, fontSize: 12, marginRight: 2 },
});
