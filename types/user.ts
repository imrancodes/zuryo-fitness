import type { Role } from "@/lib/roles";

export type PublicUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatarUrl: string | null;
};
