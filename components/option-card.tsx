import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type OptionCardProps = {
  name: string;
  value: string;
  label: string;
  description?: string;
  icon?: LucideIcon;
  checked?: boolean;
  defaultChecked?: boolean;
  onSelect?: (value: string) => void;
  className?: string;
};

export function OptionCard({
  name,
  value,
  label,
  description,
  icon: Icon,
  checked,
  defaultChecked,
  onSelect,
  className,
}: OptionCardProps) {
  return (
    <label
      className={cn(
        "flex cursor-pointer flex-col gap-1 rounded-xl border bg-card p-4 transition-colors hover:bg-secondary has-checked:border-brand has-checked:bg-brand/5 has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
        className
      )}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        defaultChecked={defaultChecked}
        onChange={() => onSelect?.(value)}
        className="sr-only"
      />
      {Icon && <Icon className="mb-1 size-5 text-brand" aria-hidden />}
      <span className="text-sm font-medium">{label}</span>
      {description && <span className="text-xs text-muted-foreground">{description}</span>}
    </label>
  );
}
