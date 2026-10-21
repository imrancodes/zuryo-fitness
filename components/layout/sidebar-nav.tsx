"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { NAV_ITEMS } from "@/lib/navigation";
import type { Role } from "@/lib/roles";
import { cn } from "@/lib/utils";

const itemClass = "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors";

export function SidebarNav({ role, onNavigate }: { role: Role; onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Main">
      <ul className="space-y-1">
        {NAV_ITEMS[role].map(({ label, href, icon: Icon, soon }) => {
          const active = pathname === href;

          return (
            <li key={href}>
              {soon ? (
                <span aria-disabled className={cn(itemClass, "cursor-not-allowed text-muted-foreground/70")}>
                  <Icon className="size-4" aria-hidden />
                  {label}
                  <Badge variant="outline" className="ml-auto">
                    Soon
                  </Badge>
                </span>
              ) : (
                <Link
                  href={href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    itemClass,
                    "outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                    active ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  )}
                >
                  <Icon className={cn("size-4", active && "text-brand")} aria-hidden />
                  {label}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
