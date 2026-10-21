export const ROLES = ["customer", "trainer", "admin"] as const;

export type Role = (typeof ROLES)[number];

export const PUBLIC_ROLES = ["customer", "trainer"] as const;

export const ROLE_HOME: Record<Role, string> = {
  customer: "/customer",
  trainer: "/trainer",
  admin: "/admin",
};

export const ROLE_LABEL: Record<Role, string> = {
  customer: "Customer",
  trainer: "Trainer",
  admin: "Admin",
};

export function isRole(value: unknown): value is Role {
  return ROLES.includes(value as Role);
}
