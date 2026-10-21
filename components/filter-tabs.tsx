import Link from "next/link";
import { cn } from "@/lib/utils";

type FilterTab = { label: string; href: string; active: boolean };

export function FilterTabs({ label, tabs }: { label: string; tabs: FilterTab[] }) {
  return (
    <nav aria-label={label} className="overflow-x-auto">
      <ul className="inline-flex gap-1 rounded-xl border bg-card p-1">
        {tabs.map((tab) => (
          <li key={tab.href}>
            <Link
              href={tab.href}
              aria-current={tab.active ? "page" : undefined}
              className={cn(
                "inline-flex h-8 items-center rounded-lg px-3 text-sm font-medium whitespace-nowrap outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50",
                tab.active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
            >
              {tab.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
