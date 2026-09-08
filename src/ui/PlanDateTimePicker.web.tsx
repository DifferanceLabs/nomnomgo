import React, { useState } from 'react';
import type { PlanDateTimePickerProps } from './PlanDateTimePicker.types';

export function PlanDateTimePicker({ mode, value, label, displayValue, disabled, onChange }: PlanDateTimePickerProps) {
  const [focused, setFocused] = useState(false);
  const pad = (number: number) => String(number).padStart(2, '0');
  const inputValue = mode === 'date'
    ? `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`
    : `${pad(value.getHours())}:${pad(value.getMinutes())}`;
  return <label style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 44, width: '100%', color: disabled ? '#AEB3B8' : '#3CCFD1', fontWeight: 700, textAlign: 'center', textDecoration: disabled ? 'none' : 'underline', outline: focused ? '2px solid #FFF2DE' : 'none', borderRadius: 6 }}>
    <span aria-hidden="true">{displayValue}</span>
    <input
      type={mode}
      aria-label={label}
      disabled={disabled}
      value={inputValue}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      step={mode === 'time' ? 60 : undefined}
      onClick={(event) => {
        try { event.currentTarget.showPicker?.(); } catch { /* The browser may already have opened its picker. */ }
      }}
      onChange={(event) => {
        if (!event.target.value || !event.target.validity.valid) return;
        const next = new Date(value);
        if (mode === 'date') {
          const [year, month, day] = event.target.value.split('-').map(Number);
          next.setFullYear(year, month - 1, day);
        } else {
          const [hours, minutes] = event.target.value.split(':').map(Number);
          next.setHours(hours, minutes, 0, 0);
        }
        if (Number.isFinite(next.getTime())) onChange(next);
      }}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, cursor: disabled ? 'default' : 'pointer', colorScheme: 'dark' }}
    />
  </label>;
}
