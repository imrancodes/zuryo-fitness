import type { Role } from "@/lib/roles";

export const DEMO_ACCOUNTS: Record<Role, { name: string; email: string }> = {
  customer: { name: "Aarav Mehta", email: "customer@zuryo.dev" },
  trainer: { name: "Priya Nair", email: "trainer@zuryo.dev" },
  admin: { name: "Zuryo Admin", email: "admin@zuryo.dev" },
};
