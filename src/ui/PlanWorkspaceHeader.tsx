import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ActionButton } from './primitives';

export function PlanWorkspaceHeader({ section, count, disabled, onBack, onPlan, onFriends }: {
  section: 'plan' | 'friends'; count?: number; disabled?: boolean;
  onBack: () => void; onPlan: () => void; onFriends: () => void;
}) {
  return <View style={styles.header}>
    <View style={styles.titleRow}>
      <ActionButton label="Back" accessibilityLabel="Back to plans" size="compact" onPress={onBack} disabled={disabled} />
      <Text style={styles.title}>Plans</Text>
    </View>
    <View style={styles.tabs} accessibilityRole="tablist">
      {(['plan', 'friends'] as const).map((tab) => <TouchableOpacity key={tab}
        accessibilityRole="tab" accessibilityLabel={tab === 'plan' ? 'Plan' : 'Friends'}
        accessibilityState={{ selected: section === tab, disabled }} disabled={disabled}
        onPress={tab === 'plan' ? onPlan : onFriends}
        style={[styles.tab, section === tab && styles.selected]}>
        <Text style={styles.tabText}>{tab === 'plan' ? 'Plan' : `Friends${count ? ` (${count})` : ''}`}</Text>
      </TouchableOpacity>)}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  header: { backgroundColor: '#0c1117', padding: 16, gap: 12, borderBottomWidth: 1, borderColor: '#293440', width: '100%' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, width: '100%', maxWidth: 748, alignSelf: 'center' },
  title: { fontSize: 24, fontWeight: '700', color: '#f5f7fa' },
  tabs: { flexDirection: 'row', gap: 8, width: '100%', maxWidth: 748, alignSelf: 'center' },
  tab: { flex: 1, minHeight: 46, padding: 12, borderRadius: 10, backgroundColor: '#25323d', justifyContent: 'center' },
  selected: { backgroundColor: '#276558' },
  tabText: { color: '#fff', textAlign: 'center', fontWeight: '700', fontSize: 15 },
});
