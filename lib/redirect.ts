import { ROLE_HOME, type Role } from "@/lib/roles";

export function safeRedirect(next: string | null | undefined, role: Role) {
  const home = ROLE_HOME[role];

  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) {
    return home;
  }

  if (next === home || next.startsWith(`${home}/`)) {
    return next;
  }

  return home;
}
