import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { semanticTones } from './theme';
import { sharedRsvpLabel, sharedRsvpSummary } from '../data/sharedPlans';

export const rsvpPalette = (value?: string | null) => value === 'going' ? semanticTones.going
  : value === 'maybe' ? semanticTones.maybe : value === 'cant_make_it' ? semanticTones.danger : semanticTones.neutral;

export function RsvpBadge({ value, pendingLabel = 'Awaiting reply' }: { value?: string | null; pendingLabel?: string }) {
  const palette = rsvpPalette(value);
  return <Text style={[styles.badge, { color: palette.accent, backgroundColor: palette.soft }]}>
    {value ? sharedRsvpLabel(value) : pendingLabel}
  </Text>;
}

export function RsvpSummary({ participants }: { participants?: { rsvp?: string | null }[] }) {
  if (!participants?.length) return null;
  return <View style={styles.row} accessibilityLabel={sharedRsvpSummary(participants)} accessibilityLiveRegion="polite">
    {(['going', 'maybe', 'cant_make_it', ''] as const).map((value) => {
      const count = participants.filter((person) => (person.rsvp || '') === value).length;
      if (!count) return null;
      const palette = rsvpPalette(value);
      return <Text key={value} style={[styles.badge, { color: palette.accent, backgroundColor: palette.soft }]}>
        {count} {value ? sharedRsvpLabel(value) : 'Awaiting reply'}
      </Text>;
    })}
  </View>;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  badge: { fontSize: 13, lineHeight: 20, fontWeight: '600', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, alignSelf: 'flex-start' },
});
