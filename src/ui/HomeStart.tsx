import { useTheme, useThemedStyles } from './ThemeProvider';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { radii, spacing, typography, type NomNomGoTheme } from './theme';

export function HomeStart({ onFood, onActivity, onPeople, onLater }: {
  onFood: () => void; onActivity: () => void; onPeople: () => void; onLater: () => void;
}) {
  const { theme: { colors, semanticTones } } = useTheme();
  const styles = useThemedStyles(createStyles);
  return <View style={styles.container}>
    <View style={styles.intro}>
      <Text accessibilityRole="header" style={styles.title}>What sounds good?</Text>
      <Text style={styles.subtitle}>A bite to eat. Something fun. A little of both.</Text>
    </View>
    <View style={styles.choices}>
      <TouchableOpacity style={[styles.choice, styles.food]} onPress={onFood} accessibilityRole="button" accessibilityLabel="Find food now">
        <View style={[styles.choiceIcon, { backgroundColor: semanticTones.food.soft }]}><Ionicons name="restaurant-outline" size={24} color={semanticTones.food.accent} /></View>
        <Text style={styles.choiceTitle}>Food</Text>
        <View style={styles.choiceFooter}><Text style={styles.choiceHint}>Find a bite</Text><Ionicons name="arrow-forward" size={18} color={semanticTones.food.accent} /></View>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.choice, styles.activity]} onPress={onActivity} accessibilityRole="button" accessibilityLabel="Find an activity now">
        <View style={[styles.choiceIcon, { backgroundColor: semanticTones.activity.soft }]}><Ionicons name="sparkles-outline" size={24} color={semanticTones.activity.accent} /></View>
        <Text style={styles.choiceTitle}>Activity</Text>
        <View style={styles.choiceFooter}><Text style={styles.choiceHint}>Go explore</Text><Ionicons name="arrow-forward" size={18} color={semanticTones.activity.accent} /></View>
      </TouchableOpacity>
    </View>
    <TouchableOpacity style={styles.later} onPress={onLater} accessibilityRole="button" accessibilityLabel="Plan for later">
      <View style={styles.icon}><Ionicons name="calendar-outline" size={22} color={colors.teal} /></View>
      <View style={styles.rowText}><Text style={styles.rowTitle}>Plan for later</Text><Text style={styles.rowHint}>Give your next outing a date.</Text></View>
      <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
    </TouchableOpacity>
    <TouchableOpacity style={styles.people} onPress={onPeople} accessibilityRole="button" accessibilityLabel="Include someone">
      <Ionicons name="people-outline" size={20} color={colors.teal} />
      <Text style={styles.peopleLabel}>Bring someone along</Text>
      <Ionicons name="arrow-forward" size={16} color={colors.textSecondary} />
    </TouchableOpacity>
  </View>;
}

const createStyles = ({ colors, semanticTones }: NomNomGoTheme) => StyleSheet.create({
  container: { gap: spacing.sm },
  intro: { gap: spacing.xs, paddingTop: spacing.xs, paddingBottom: spacing.xs },
  title: { ...typography.title, color: colors.textPrimary, fontSize: 28, lineHeight: 34, fontWeight: '700' },
  subtitle: { ...typography.body, color: colors.textSecondary },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  choice: { flex: 1, minWidth: 130, borderRadius: radii.lg, borderWidth: 1, padding: spacing.sm, gap: spacing.sm },
  food: { backgroundColor: semanticTones.food.surface, borderColor: colors.border },
  activity: { backgroundColor: semanticTones.activity.surface, borderColor: colors.border },
  choiceIcon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: radii.sm },
  choiceTitle: { ...typography.subheading, color: colors.textPrimary },
  choiceFooter: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: spacing.micro },
  choiceHint: { ...typography.caption, color: colors.textSecondary },
  later: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, padding: spacing.sm, borderRadius: radii.md, backgroundColor: colors.surfaceRaised, borderWidth: 1, borderColor: colors.border },
  icon: { width: 40, height: 40, backgroundColor: colors.tealSoft, borderRadius: radii.sm, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1, minWidth: 0, gap: spacing.micro },
  rowTitle: { ...typography.bodyStrong, color: colors.textPrimary },
  rowHint: { ...typography.caption, color: colors.textSecondary },
  people: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', minHeight: 44, gap: spacing.xs },
  peopleLabel: { ...typography.label, color: colors.textSecondary },
});
