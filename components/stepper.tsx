import { cn } from "@/lib/utils";

export function Stepper({ steps, current }: { steps: string[]; current: number }) {
  return (
    <nav aria-label="Progress" className="space-y-2">
      <p className="text-sm text-muted-foreground sm:hidden">
        Step {current + 1} of {steps.length} · <span className="font-medium text-foreground">{steps[current]}</span>
      </p>
      <ol className="grid gap-2" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
        {steps.map((label, index) => (
          <li key={label} aria-current={index === current ? "step" : undefined} className="space-y-2">
            <span className={cn("block h-1.5 rounded-full", index <= current ? "bg-brand" : "bg-border")} />
            <span
              className={cn(
                "hidden text-xs font-medium sm:block",
                index <= current ? "text-foreground" : "text-muted-foreground"
              )}
            >
              {index + 1}. {label}
            </span>
          </li>
        ))}
      </ol>
    </nav>
  );
}
