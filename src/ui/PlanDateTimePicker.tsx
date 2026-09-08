import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Modal, Platform, Text, TouchableOpacity, View } from 'react-native';
import type { PlanDateTimePickerProps } from './PlanDateTimePicker.types';
import { colors } from './theme';

export function PlanDateTimePicker({ mode, value, label, displayValue, disabled, onChange }: PlanDateTimePickerProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  return <>
    <TouchableOpacity
      accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled}
      style={{ minHeight: 44, justifyContent: 'center', alignItems: 'center', width: '100%' }}
      onPress={() => {
        if (Platform.OS === 'android') {
          DateTimePickerAndroid.open({ value, mode, onChange: (event, selected) => {
            if (event.type === 'set' && selected) onChange(selected);
          } });
        } else { setDraft(value); setOpen(true); }
      }}
    >
      <Text style={{ color: disabled ? colors.textSecondary : colors.cyan, textDecorationLine: disabled ? 'none' : 'underline', fontWeight: '700', textAlign: 'center' }}>{displayValue}</Text>
    </TouchableOpacity>
    {open && !disabled ? <Modal visible transparent animationType="slide" onRequestClose={() => setOpen(false)}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay }}>
        <View style={{ backgroundColor: colors.surfaceRaised, padding: 24, paddingBottom: 40 }}>
          <Text style={{ color: colors.textPrimary, fontWeight: '700' }}>{label}</Text>
          <DateTimePicker value={draft} mode={mode} display="spinner" themeVariant="dark" onChange={(_, selected) => { if (selected) setDraft(selected); }} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <TouchableOpacity accessibilityRole="button" onPress={() => setOpen(false)} style={{ padding: 12 }}><Text style={{ color: colors.textPrimary }}>Cancel</Text></TouchableOpacity>
            <TouchableOpacity accessibilityRole="button" onPress={() => { if (!disabled) onChange(draft); setOpen(false); }} style={{ padding: 12 }}><Text style={{ color: colors.cyan }}>Done</Text></TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal> : null}
  </>;
}
