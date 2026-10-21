import { Meter } from "@/components/meter";
import type { PackageSummary as Summary } from "@/types/package";

export function PackageSummary({ summary }: { summary: Summary }) {
  if (summary.purchased === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        You don&apos;t have a session package yet. Packages are added by the Zuryo team; until then you pay per session at checkout.
      </p>
    );
  }

  const items = [
    { label: "Purchased", value: summary.purchased },
    { label: "Used", value: summary.used },
    { label: "Remaining", value: summary.remaining },
  ];

  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-3 gap-3">
        {items.map(({ label, value }) => (
          <div key={label}>
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="text-2xl font-semibold tracking-tight">{value}</dd>
          </div>
        ))}
      </dl>
      <Meter label={`${summary.used} of ${summary.purchased} sessions used`} value={summary.used} max={summary.purchased} />
      <p className="text-xs text-muted-foreground">
        {summary.used} of {summary.purchased} sessions used. One session is deducted only when a session is completed.
      </p>
    </div>
  );
}
