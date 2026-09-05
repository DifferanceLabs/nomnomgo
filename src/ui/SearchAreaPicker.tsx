import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AREA_CHOICES, AREA_RADIUS_OPTIONS, METERS_PER_MILE, type AreaKind, type AreaLocation } from '../domain/searchArea';
import { colors } from './theme';

type Props = {
  location: AreaLocation | null;
  pendingKind?: AreaKind | 'whole';
  onSelect: (kind: AreaKind | null, radiusMeters?: number) => Promise<void>;
};

/** Area chips filter the main result list; there is no separate area search surface. */
export function SearchAreaPicker({ location, pendingKind, onSelect }: Props) {
  const focus = location?.areaFocus;
  const selectedKind = pendingKind || focus?.kind || 'whole';
  return (
    <View style={styles.panel}>
      <View style={styles.heading}>
        <Ionicons name="locate-outline" color={colors.teal} size={18} />
        <Text style={styles.title}>Area preference</Text>
      </View>
      <View style={styles.chips}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Search whole area"
          accessibilityState={{ selected: selectedKind === 'whole' }}
          onPress={() => { void onSelect(null); }}
          style={[styles.chip, selectedKind === 'whole' && styles.selected]}>
          <Text style={styles.chipText}>Whole area</Text>
        </TouchableOpacity>
        {AREA_CHOICES.filter((choice) => choice.kind !== 'custom').map((choice) => (
          <TouchableOpacity key={choice.kind} accessibilityRole="button" accessibilityLabel={choice.label}
            accessibilityState={{ selected: selectedKind === choice.kind }}
            onPress={() => { void onSelect(choice.kind); }}
            style={[styles.chip, selectedKind === choice.kind && styles.selected]}>
            <Text style={styles.chipText}>{choice.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <Text style={styles.hint}>
        {pendingKind ? 'Updating main results…' : focus ? `Showing results near ${location.label}.` : 'Choose an area to update the main results.'}
      </Text>
      {focus ? (
        <View style={styles.chips}>
          <Text style={styles.radiusLabel}>Within</Text>
          {AREA_RADIUS_OPTIONS.map((miles) => (
            <TouchableOpacity key={miles} accessibilityRole="button"
              accessibilityLabel={`Search within ${miles} ${miles === 1 ? 'mile' : 'miles'}`}
              accessibilityState={{ selected: Math.round(focus.radiusMeters / METERS_PER_MILE) === miles }}
              style={[styles.chip, Math.round(focus.radiusMeters / METERS_PER_MILE) === miles && styles.selected]}
              onPress={() => { void onSelect(focus.kind, miles * METERS_PER_MILE); }}>
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
  heading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { color: colors.textPrimary, fontSize: 14, fontWeight: '700' },
  hint: { color: colors.textSecondary, fontSize: 12, lineHeight: 18 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  chip: { minHeight: 40, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 20, backgroundColor: colors.surfaceRaised, borderWidth: 1, borderColor: colors.borderStrong, justifyContent: 'center' },
  selected: { backgroundColor: colors.tealSoft, borderColor: colors.teal },
  chipText: { color: colors.textPrimary, fontSize: 12, fontWeight: '600' },
  radiusLabel: { color: colors.textSecondary, fontSize: 12, marginRight: 2 },
});
