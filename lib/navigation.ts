import {
  BicepsFlexed,
  CalendarCheck,
  CalendarClock,
  CalendarPlus,
  History,
  LayoutDashboard,
  Package,
  ReceiptText,
  Settings2,
  TrendingUp,
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
    { label: "Book a session", href: "/customer/book", icon: CalendarPlus },
    { label: "My bookings", href: "/customer/bookings", icon: CalendarCheck },
    { label: "Workout history", href: "/customer/history", icon: History },
    { label: "Progress", href: "/customer/progress", icon: TrendingUp },
    { label: "My packages", href: "/customer/packages", icon: Package },
    { label: "Fitness profile", href: "/customer/profile", icon: UserRound },
  ],
  trainer: [
    { label: "Overview", href: "/trainer", icon: LayoutDashboard },
    { label: "Availability", href: "/trainer/availability", icon: CalendarClock },
    { label: "Sessions", href: "/trainer/sessions", icon: BicepsFlexed },
  ],
  admin: [
    { label: "Overview", href: "/admin", icon: LayoutDashboard },
    { label: "Users", href: "/admin/users", icon: Users, soon: true },
    { label: "Bookings", href: "/admin/bookings", icon: ReceiptText, soon: true },
    { label: "Pricing", href: "/admin/pricing", icon: Settings2 },
    { label: "Packages", href: "/admin/packages", icon: Package },
  ],
};
