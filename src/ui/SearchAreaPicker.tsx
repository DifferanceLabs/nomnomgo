import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AREA_CHOICES, AREA_RADIUS_OPTIONS, METERS_PER_MILE, type AreaCenter, type AreaKind, type AreaLocation, type AreaMatch } from '../domain/searchArea';
import { isSearchCancelled, SearchExecution } from '../domain/searchExecution';
import { colors } from './theme';

type Props = {
  location: AreaLocation | null;
  locationLabel: string;
  getBaseLocation: () => Promise<AreaCenter>;
  findAreas: (kind: AreaKind, input: string, base: AreaCenter, execution: SearchExecution) => Promise<AreaMatch[]>;
  onSelect: (location: AreaLocation) => Promise<void>;
};

export function SearchAreaPicker({ location, locationLabel, getBaseLocation, findAreas, onSelect }: Props) {
  const [kind, setKind] = useState<AreaKind | null>(null);
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState<AreaMatch[]>([]);
  const [base, setBase] = useState<AreaCenter | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const request = useRef<SearchExecution | null>(null);
  useEffect(() => () => request.current?.cancel(), []);

  const lookup = async (nextKind: AreaKind, input: string) => {
    request.current?.cancel();
    const execution = new SearchExecution((request.current?.id || 0) + 1);
    request.current = execution;
    setKind(nextKind);
    setMatches([]);
    setNotice('');
    setBusy(true);
    try {
      const center = await getBaseLocation();
      execution.check();
      setBase(center);
      const results = await findAreas(nextKind, input, center, execution);
      execution.check();
      setMatches(results);
      if (!results.length) setNotice('No nearby matches found. Try a specific neighborhood, exit, or landmark.');
    } catch (error) {
      if (request.current !== execution || execution.controller.signal.aborted || isSearchCancelled(error)) return;
      setNotice('Could not load nearby areas. Check your city or ZIP above, then try again.');
    } finally {
      if (request.current === execution && !execution.controller.signal.aborted) setBusy(false);
    }
  };

  const chooseKind = (nextKind: AreaKind) => {
    request.current?.cancel();
    setKind(nextKind);
    setQuery('');
    setMatches([]);
    setNotice('');
    setBusy(false);
    if (nextKind !== 'custom') void lookup(nextKind, '');
  };

  const apply = async (next: AreaLocation) => {
    setBusy(true);
    setNotice('');
    try {
      await onSelect(next);
      setKind(null);
      setMatches([]);
    } catch {
      setNotice('Could not save this area. Try again.');
    } finally { setBusy(false); }
  };

  const focus = location?.areaFocus;
  return (
    <View style={styles.panel}>
      <View style={styles.heading}>
        <Ionicons name="locate-outline" color={colors.teal} size={18} />
        <Text style={styles.title}>Narrow the area</Text>
      </View>
      <Text style={styles.hint}>
        {focus ? `Near ${location.label}` : `Find an area around ${locationLabel}.`}
      </Text>
      <View style={styles.chips}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Search whole area" accessibilityState={{ selected: !focus && !kind, disabled: busy }} disabled={busy}
          onPress={() => { if (focus) void apply(focus.base); else { setKind(null); setMatches([]); setNotice(''); } }}
          style={[styles.chip, !focus && !kind && styles.selected]}>
          <Text style={styles.chipText}>Whole area</Text>
        </TouchableOpacity>
        {AREA_CHOICES.map((choice) => (
          <TouchableOpacity key={choice.kind} accessibilityRole="button" accessibilityState={{ selected: kind === choice.kind || (!kind && focus?.kind === choice.kind) }}
            onPress={() => chooseKind(choice.kind)} style={[styles.chip, (kind === choice.kind || (!kind && focus?.kind === choice.kind)) && styles.selected]}>
            <Text style={styles.chipText}>{choice.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {focus ? <View style={styles.chips}>
        <Text style={styles.radiusLabel}>Within</Text>
        {AREA_RADIUS_OPTIONS.map((miles) => <TouchableOpacity key={miles} accessibilityRole="button" accessibilityLabel={`Search within ${miles} miles`} disabled={busy}
          accessibilityState={{ selected: Math.round(focus.radiusMeters / METERS_PER_MILE) === miles, disabled: busy }}
          style={[styles.chip, Math.round(focus.radiusMeters / METERS_PER_MILE) === miles && styles.selected]}
          onPress={() => { void apply({ ...location, areaFocus: { ...focus, radiusMeters: miles * METERS_PER_MILE } }); }}>
          <Text style={styles.chipText}>{miles} mi</Text>
        </TouchableOpacity>)}
      </View> : null}
      {kind ? <View style={styles.results}>
        <Text style={styles.hint}>{kind === 'freeway'
          ? 'Choose a rest stop, or enter a freeway exit or nearby landmark. Search centers on the place you choose, not the entire road.'
          : 'Choose a local match to search around, or enter an area by name.'}</Text>
        <View style={styles.inputRow}>
          <TextInput value={query} onChangeText={(value) => { request.current?.cancel(); setBusy(false); setMatches([]); setNotice(''); setQuery(value); }}
            style={styles.input} accessibilityLabel="Neighborhood, exit, or landmark" placeholder={kind === 'freeway' ? 'Freeway, exit, or nearby landmark' : 'Neighborhood or landmark'}
            placeholderTextColor={colors.textTertiary} returnKeyType="search" onSubmitEditing={() => { if (query.trim()) void lookup(kind, query); }} />
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Find nearby areas" disabled={!query.trim() || busy}
            accessibilityState={{ disabled: !query.trim() || busy }} style={[styles.chip, (!query.trim() || busy) && styles.disabled]}
            onPress={() => { void lookup(kind, query); }}><Text style={styles.chipText}>Find</Text></TouchableOpacity>
        </View>
        {busy ? <View style={styles.heading}><ActivityIndicator color={colors.teal} size="small" /><Text style={styles.hint}>Finding nearby areas…</Text></View> : null}
        {matches.map((match) => <TouchableOpacity key={match.id} accessibilityRole="button" accessibilityLabel={`Search near ${match.label}`} disabled={busy}
          style={styles.match} onPress={() => { if (base) void apply({ latitude: match.latitude, longitude: match.longitude, label: match.label,
            areaFocus: { kind, placeId: match.id, base, radiusMeters: 2 * METERS_PER_MILE } }); }}>
          <View style={styles.matchText}><Text style={styles.matchTitle}>{match.label}</Text><Text style={styles.hint}>{match.description} · {match.address}</Text></View>
          <Ionicons name="chevron-forward" color={colors.teal} size={18} />
        </TouchableOpacity>)}
        {matches.length ? <Text style={styles.attribution}>Google Maps</Text> : null}
      </View> : null}
      {notice ? <Text style={styles.hint} accessibilityLiveRegion="polite">{notice}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { gap: 10, paddingTop: 12 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { color: colors.textPrimary, fontSize: 14, fontWeight: '700' },
  hint: { color: colors.textSecondary, fontSize: 12, lineHeight: 18 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  chip: { minHeight: 40, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 20, backgroundColor: colors.surfaceRaised, borderWidth: 1, borderColor: colors.borderStrong, justifyContent: 'center' },
  selected: { backgroundColor: colors.tealSoft, borderColor: colors.teal },
  chipText: { color: colors.textPrimary, fontSize: 12, fontWeight: '600' },
  radiusLabel: { color: colors.textSecondary, fontSize: 12, marginRight: 2 },
  results: { gap: 10 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: { flex: 1, minWidth: 0, minHeight: 44, color: colors.textPrimary, backgroundColor: colors.surfaceRaised, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: 12, paddingHorizontal: 12, fontSize: 13 },
  match: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.surfaceRaised },
  matchText: { flex: 1, gap: 4 },
  matchTitle: { color: colors.textPrimary, fontSize: 14, fontWeight: '600' },
  attribution: { color: colors.textSecondary, fontSize: 14, fontWeight: '500', alignSelf: 'flex-end' },
  disabled: { opacity: 0.5 },
});
