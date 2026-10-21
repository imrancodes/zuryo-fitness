import { cn } from "@/lib/utils";

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function InitialsAvatar({ name, className }: { name: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("grid size-9 shrink-0 place-items-center rounded-full bg-secondary text-sm font-semibold text-primary", className)}
    >
      {initials(name)}
    </span>
  );
}
