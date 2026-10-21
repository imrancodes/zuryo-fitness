import { Dumbbell } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

type BrandProps = {
  href?: string;
  inverted?: boolean;
  className?: string;
};

export function Brand({ href = "/", inverted = false, className }: BrandProps) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-2 rounded-md text-lg font-semibold tracking-tight outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        className
      )}
    >
      <span
        className={cn(
          "grid size-8 place-items-center rounded-lg",
          inverted ? "bg-brand text-brand-foreground" : "bg-primary text-primary-foreground"
        )}
      >
        <Dumbbell className="size-4 -rotate-45" aria-hidden />
      </span>
      Zuryo
    </Link>
  );
}
