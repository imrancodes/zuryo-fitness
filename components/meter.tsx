export function Meter({ label, value, max }: { label: string; value: number; max: number }) {
  const percent = max > 0 ? Math.min(100, (value / max) * 100) : 0;

  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      className="h-2 overflow-hidden rounded-full bg-chart-1/15"
    >
      <div className="h-full rounded-full bg-chart-1" style={{ width: `${percent}%` }} />
    </div>
  );
}
