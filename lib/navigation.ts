import {
  CalendarCheck,
  CalendarClock,
  Dumbbell,
  LayoutDashboard,
  Package,
  ReceiptText,
  Settings2,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "@/lib/roles";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  soon?: boolean;
};

export const NAV_ITEMS: Record<Role, NavItem[]> = {
  customer: [
    { label: "Overview", href: "/customer", icon: LayoutDashboard },
    { label: "Book a session", href: "/customer/book", icon: CalendarCheck, soon: true },
    { label: "My packages", href: "/customer/packages", icon: Package, soon: true },
    { label: "Fitness profile", href: "/customer/profile", icon: UserRound, soon: true },
  ],
  trainer: [
    { label: "Overview", href: "/trainer", icon: LayoutDashboard },
    { label: "Availability", href: "/trainer/availability", icon: CalendarClock, soon: true },
    { label: "Sessions", href: "/trainer/sessions", icon: Dumbbell, soon: true },
  ],
  admin: [
    { label: "Overview", href: "/admin", icon: LayoutDashboard },
    { label: "Users", href: "/admin/users", icon: Users, soon: true },
    { label: "Bookings", href: "/admin/bookings", icon: ReceiptText, soon: true },
    { label: "Pricing", href: "/admin/pricing", icon: Settings2, soon: true },
  ],
};
