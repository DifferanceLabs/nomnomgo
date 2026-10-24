import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { radii, spacing, typography, type NomNomGoTheme } from './theme';
import { useTheme, useThemedStyles, type AppearancePreference } from './ThemeProvider';

const options = [
  { value: 'system', label: 'System', icon: 'phone-portrait-outline' },
  { value: 'light', label: 'Light', icon: 'sunny-outline' },
  { value: 'dark', label: 'Dark', icon: 'moon-outline' },
] as const;

export function AppearancePreferences() {
  const { theme, preference, ready, saving, error, setPreference } = useTheme();
  const styles = useThemedStyles(createStyles);
  const select = (value: AppearancePreference) => { void setPreference(value); };
  return <View style={styles.section}>
    <Text accessibilityRole="header" style={styles.title}>Appearance</Text>
    <View accessibilityRole="radiogroup" accessibilityLabel="Appearance" style={styles.options}>
      {options.map((option) => {
        const selected = preference === option.value;
        return <TouchableOpacity key={option.value} accessibilityRole="radio"
          accessibilityLabel={`${option.label} appearance`} accessibilityState={{ checked: selected, disabled: !ready || saving }}
          aria-checked={selected} aria-disabled={!ready || saving}
          disabled={!ready || saving} onPress={() => select(option.value)}
          style={[styles.option, selected && styles.selected]}>
          <Ionicons name={option.icon} size={20} color={selected ? theme.colors.teal : theme.colors.textSecondary} />
          <Text style={[styles.label, selected && styles.selectedLabel]}>{option.label}</Text>
        </TouchableOpacity>;
      })}
    </View>
    <Text accessibilityLiveRegion="polite" style={styles.hint}>
      {preference === 'system' ? `Follows your device · ${theme.mode === 'dark' ? 'Dark' : 'Light'} now` : `${preference === 'dark' ? 'Dark' : 'Light'} on this device`}
    </Text>
    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
  </View>;
}

const createStyles = ({ colors }: NomNomGoTheme) => StyleSheet.create({
  section: { gap: spacing.xs, paddingVertical: spacing.sm },
  title: { ...typography.subheading, color: colors.textPrimary },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  option: { flex: 1, minWidth: 72, minHeight: 60, justifyContent: 'center', alignItems: 'center', gap: spacing.micro,
    padding: spacing.xs, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radii.sm, backgroundColor: colors.surface },
  selected: { backgroundColor: colors.tealSoft, borderColor: colors.teal },
  label: { ...typography.caption, color: colors.textSecondary },
  selectedLabel: { color: colors.teal },
  hint: { ...typography.caption, color: colors.textSecondary },
  error: { ...typography.caption, color: colors.red },
});
