type ChoiceChipProps = {
  name: string;
  value: string;
  label: string;
  checked: boolean;
  onSelect: (value: string) => void;
};

export function ChoiceChip({ name, value, label, checked, onSelect }: ChoiceChipProps) {
  return (
    <label className="inline-flex h-9 cursor-pointer items-center justify-center rounded-lg border bg-card px-3 text-sm font-medium tabular-nums transition-colors hover:bg-secondary has-checked:border-brand has-checked:bg-brand has-checked:text-brand-foreground has-focus-visible:ring-3 has-focus-visible:ring-ring/50">
      <input type="radio" name={name} value={value} checked={checked} onChange={() => onSelect(value)} className="sr-only" />
      {label}
    </label>
  );
}
