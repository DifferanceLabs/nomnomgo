import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { radii, spacing, themes, typography, type NomNomGoTheme, type ThemeName } from './theme';
import { useTheme, useThemedStyles } from './ThemeProvider';

const options = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'sage', label: 'Sage' },
] as const;

export function AppearancePreferences() {
  const { theme, preference, ready, saving, error, setPreference } = useTheme();
  const styles = useThemedStyles(createStyles);
  const disabled = !ready || saving;
  const select = (name: ThemeName) => { void setPreference(name); };
  return <View style={styles.section}>
    <Text accessibilityRole="header" style={styles.title}>Appearance</Text>
    <View style={styles.deviceRow}>
      <View style={styles.deviceText}>
        <Text style={styles.deviceLabel}>Follow device appearance</Text>
        <Text style={styles.hint}>Switch between light and dark automatically</Text>
      </View>
      <Switch accessibilityLabel="Follow device appearance" value={preference === 'system'} disabled={disabled}
        onValueChange={(enabled) => { void setPreference(enabled ? 'system' : theme.name); }}
        trackColor={{ false: theme.colors.borderStrong, true: theme.colors.teal }}
        thumbColor={theme.colors.surface} />
    </View>
    <View accessibilityRole="radiogroup" accessibilityLabel="Color theme" style={styles.options}>
      {options.map((option) => {
        const preview = themes[option.value];
        const selected = theme.name === option.value;
        return <TouchableOpacity key={option.value} accessibilityRole="radio"
          accessibilityLabel={`${option.label} theme`} accessibilityState={{ checked: selected, disabled }}
          aria-checked={selected} aria-disabled={disabled} disabled={disabled} onPress={() => select(option.value)}
          style={[styles.option, selected && styles.selected]}>
          <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.preview, { backgroundColor: preview.colors.background, borderColor: preview.colors.border }]}>
            <View style={[styles.previewHeading, { backgroundColor: preview.colors.textPrimary }]} />
            <View style={styles.previewCards}>
              <View style={[styles.previewCard, { backgroundColor: preview.colors.surface }]}><View style={[styles.previewDot, { backgroundColor: preview.colors.coral }]} /></View>
              <View style={[styles.previewCard, { backgroundColor: preview.colors.surface }]}><View style={[styles.previewDot, { backgroundColor: preview.colors.amber }]} /></View>
            </View>
            <View style={[styles.previewNavigation, { backgroundColor: preview.navigation.background }]}>
              <View style={[styles.previewPill, { backgroundColor: preview.navigation.activeForeground }]} />
              <View style={[styles.previewPill, { backgroundColor: preview.colors.borderStrong }]} />
              <View style={[styles.previewPill, { backgroundColor: preview.colors.borderStrong }]} />
            </View>
          </View>
          <View style={styles.optionLabel}>
            <Text style={[styles.label, selected && styles.selectedLabel]}>{option.label}</Text>
            {selected ? <Ionicons name="checkmark-circle" size={14} color={theme.navigation.activeForeground} /> : null}
          </View>
        </TouchableOpacity>;
      })}
    </View>
    <Text accessibilityLiveRegion="polite" style={styles.hint}>
      {preference === 'system' ? `Following your device · ${theme.name === 'dark' ? 'Dark' : 'Light'}`
        : theme.name === 'sage' ? 'Sage · muted greens and warm neutrals' : `${theme.name === 'dark' ? 'Soft charcoal' : 'Clean whites'} · saved on this device`}
    </Text>
    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
  </View>;
}

const createStyles = ({ colors, navigation }: NomNomGoTheme) => StyleSheet.create({
  section: { gap: spacing.xs, paddingVertical: spacing.sm },
  title: { ...typography.subheading, color: colors.textPrimary },
  deviceRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingBottom: spacing.xs },
  deviceText: { flex: 1, gap: spacing.micro },
  deviceLabel: { ...typography.label, color: colors.textPrimary },
  options: { flexDirection: 'row', gap: spacing.xs },
  option: { flex: 1, minWidth: 0, gap: spacing.xs, padding: 6, borderWidth: 1, borderColor: colors.border,
    borderRadius: radii.sm, backgroundColor: colors.surface },
  selected: { borderColor: navigation.activeForeground, backgroundColor: navigation.activeBackground },
  preview: { height: 58, borderRadius: 6, borderWidth: 1, overflow: 'hidden', paddingTop: 8 },
  previewHeading: { width: '46%', height: 3, marginLeft: 6, borderRadius: 2, marginBottom: 6 },
  previewCards: { flexDirection: 'row', gap: 4, paddingHorizontal: 5, flex: 1, paddingBottom: 6 },
  previewCard: { flex: 1, borderRadius: 4, padding: 4 },
  previewDot: { width: 5, height: 5, borderRadius: 3 },
  previewNavigation: { height: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  previewPill: { width: 7, height: 3, borderRadius: 2 },
  optionLabel: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3 },
  label: { ...typography.caption, color: colors.textSecondary },
  selectedLabel: { color: navigation.activeForeground },
  hint: { ...typography.caption, color: colors.textSecondary, fontSize: 11, lineHeight: 16 },
  error: { ...typography.caption, color: colors.red },
});
