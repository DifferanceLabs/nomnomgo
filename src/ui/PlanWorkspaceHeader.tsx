import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { RsvpSummary } from './RsvpSummary';
import { colors } from './theme';

type HeaderProps = {
  section: 'plan' | 'friends'; count?: number; disabled?: boolean;
  title: string; dateLabel: string; timeLabel?: string; locationLabel: string;
  stopCount: number; locked: boolean; statusLabel?: string;
  participants?: { rsvp?: string | null }[];
  onTitleChange?: (title: string) => void;
  onBack: () => void; onPlan: () => void; onFriends: () => void;
};

// Identity and context belong to the plan; only the content below its tabs changes.
export function PlanWorkspaceHeader({ section, count, disabled, title, dateLabel, timeLabel,
  locationLabel, stopCount, locked, statusLabel, participants, onTitleChange, onBack, onPlan, onFriends }: HeaderProps) {
  const [editingTitle, setEditingTitle] = useState(false);
  return <View style={styles.header} testID="plan-workspace-header">
    <View style={styles.navigation}>
    <TouchableOpacity accessibilityRole="button" accessibilityLabel="Back to plans" disabled={disabled}
      onPress={onBack} style={styles.back}>
      <Ionicons name="chevron-back" size={18} color={colors.textSecondary} />
      <Text style={styles.backText}>All plans</Text>
    </TouchableOpacity>
    {onTitleChange && !locked ? <TouchableOpacity accessibilityRole="button" accessibilityLabel="Edit plan name"
      disabled={disabled} onPress={() => setEditingTitle(true)} style={styles.edit}>
      <Ionicons name="create-outline" size={19} color={colors.textSecondary} />
    </TouchableOpacity> : null}
    </View>
    <View style={styles.titleRow}>
      {editingTitle && onTitleChange && !locked ? <TextInput accessibilityLabel="Plan name" value={title}
        onChangeText={onTitleChange} editable={!disabled} placeholder="Plan title" placeholderTextColor={colors.textTertiary}
        autoFocus selectTextOnFocus maxLength={160} returnKeyType="done" onSubmitEditing={() => setEditingTitle(false)} onBlur={() => setEditingTitle(false)}
        style={[styles.title, styles.titleInput]} />
        : <Text accessibilityRole="header" style={styles.title}>{title || 'Untitled plan'}</Text>}
    </View>
    <View style={styles.details}>
      <View style={styles.timing}>
        <View style={styles.detail}><Ionicons name="calendar-outline" size={16} color={colors.textSecondary} /><Text style={styles.detailText}>{dateLabel}</Text></View>
        {timeLabel ? <View style={styles.detail}><Ionicons name="time-outline" size={16} color={colors.textSecondary} /><Text style={styles.detailText}>{timeLabel}</Text></View> : null}
      </View>
      <View style={styles.detail}><Ionicons name="location-outline" size={16} color={colors.textSecondary} /><Text style={styles.detailText}>{locationLabel}</Text></View>
      <View style={styles.status}>
        <Text style={styles.statusText}>{stopCount} {stopCount === 1 ? 'stop' : 'stops'}</Text>
        <View style={styles.detail}><Ionicons name={locked ? 'lock-closed-outline' : 'create-outline'} size={14} color={colors.textTertiary} /><Text style={styles.statusText}>{locked ? 'Locked' : 'Planning'}</Text></View>
        {statusLabel ? <Text accessibilityLiveRegion="polite" style={styles.statusText}>{statusLabel}</Text> : null}
        <RsvpSummary participants={participants} />
      </View>
    </View>
    <View style={styles.tabs} accessibilityRole="tablist" accessibilityLabel="Plan sections">
      {(['plan', 'friends'] as const).map((tab) => <TouchableOpacity key={tab}
        accessibilityRole="tab" accessibilityLabel={tab === 'plan' ? 'Plan' : 'Friends'}
        accessibilityState={{ selected: section === tab, disabled }} disabled={disabled}
        onPress={tab === 'plan' ? onPlan : onFriends}
        style={[styles.tab, section === tab && styles.selected]}>
        <Text style={styles.tabText}>{tab === 'plan' ? 'Plan' : 'Friends' + (count ? ' (' + count + ')' : '')}</Text>
      </TouchableOpacity>)}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  header: { gap: 10, width: '100%', paddingBottom: 16, borderBottomWidth: 1, borderColor: colors.divider },
  navigation: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  back: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44, alignSelf: 'flex-start', paddingRight: 12 },
  backText: { color: colors.textSecondary, fontSize: 14, fontWeight: '600' },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  title: { flex: 1, minWidth: 0, fontSize: 24, lineHeight: 30, fontWeight: '700', color: colors.textPrimary },
  titleInput: { padding: 0, minHeight: 44, borderBottomWidth: 1, borderBottomColor: colors.cyan },
  edit: { minHeight: 44, width: 44, alignItems: 'center', justifyContent: 'center' },
  details: { gap: 8 },
  timing: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 16, rowGap: 8 },
  detail: { flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 0, maxWidth: '100%' },
  detailText: { color: colors.textSecondary, fontSize: 14, lineHeight: 20, flexShrink: 1 },
  status: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 12, rowGap: 8 },
  statusText: { color: colors.textTertiary, fontSize: 13, lineHeight: 20 },
  tabs: { flexDirection: 'row', gap: 8, width: '100%', paddingTop: 6 },
  tab: { flex: 1, minHeight: 46, padding: 12, borderRadius: 10, backgroundColor: '#25323d', justifyContent: 'center' },
  selected: { backgroundColor: '#276558' },
  tabText: { color: '#fff', textAlign: 'center', fontWeight: '700', fontSize: 15 },
});
