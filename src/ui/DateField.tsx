import React from 'react';
import { Platform, TextInput } from 'react-native';

export function DateField({ label, value, onChange, disabled = false }: { label: string; value: string; onChange: (value: string) => void; disabled?: boolean }) {
  if (Platform.OS === 'web') return React.createElement('input', {
    type: 'date', 'aria-label': label, value, disabled,
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => onChange(event.target.value),
    style: { boxSizing: 'border-box', width: '100%', minWidth: 0, minHeight: 48, padding: 12, borderRadius: 10, border: '1px solid #667785', background: '#0d1721', color: '#fff', colorScheme: 'dark', font: 'inherit' },
  });
  return <TextInput accessibilityLabel={label} value={value} onChangeText={onChange} placeholder="YYYY-MM-DD" placeholderTextColor="#a8b2bf" editable={!disabled} style={{ minHeight: 48, padding: 12, borderRadius: 10, borderColor: '#667785', borderWidth: 1, backgroundColor: '#0d1721', color: '#fff' }} />;
}
