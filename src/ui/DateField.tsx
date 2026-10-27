import { useTheme } from './ThemeProvider';
import React from 'react';
import { Platform, TextInput } from 'react-native';

export function DateField({ label, value, onChange, disabled = false }: { label: string; value: string; onChange: (value: string) => void; disabled?: boolean }) {
  const { theme: { colors, mode: colorMode } } = useTheme();
  const mode = colorMode;
  if (Platform.OS === 'web') return React.createElement('input', {
    type: 'date', 'aria-label': label, value, disabled,
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => onChange(event.target.value),
    style: { boxSizing: 'border-box', width: '100%', minWidth: 0, minHeight: 48, padding: 12, borderRadius: 10, border: `1px solid ${colors.borderStrong}`, background: colors.surface, color: colors.textPrimary, colorScheme: mode, font: 'inherit' },
  });
  return <TextInput accessibilityLabel={label} value={value} onChangeText={onChange} placeholder="YYYY-MM-DD" placeholderTextColor={colors.textTertiary} editable={!disabled} style={{ minHeight: 48, padding: 12, borderRadius: 10, borderColor: colors.borderStrong, borderWidth: 1, backgroundColor: colors.surface, color: colors.textPrimary }} />;
}
