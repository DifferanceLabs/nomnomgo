export type PlanDateTimePickerProps = {
  mode: 'date' | 'time';
  value: Date;
  label: string;
  displayValue: string;
  disabled?: boolean;
  onChange: (value: Date) => void;
};
