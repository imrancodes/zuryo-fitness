import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import type { NextRequest } from "next/server";
import { jsonError } from "@/lib/api";
import { ROLE_HOME, type Role } from "@/lib/roles";
import { SESSION_COOKIE, verifySession } from "@/lib/session";
import { getActiveUserById } from "@/services/auth.service";
import type { PublicUser } from "@/types/user";

async function resolveUser(token: string | undefined) {
  const session = await verifySession(token);
  return session ? getActiveUserById(session.userId) : null;
}

type ApiAuthResult = { user: PublicUser; error?: never } | { user?: never; error: Response };

export async function getApiUser(request: NextRequest, roles?: Role[]): Promise<ApiAuthResult> {
  const user = await resolveUser(request.cookies.get(SESSION_COOKIE)?.value);

  if (!user) {
    return { error: jsonError("Unauthorized", 401) };
  }

  if (roles && !roles.includes(user.role)) {
    return { error: jsonError("Forbidden", 403) };
  }

  return { user };
}

const getCurrentUser = cache(async () => resolveUser((await cookies()).get(SESSION_COOKIE)?.value));

export async function requireRole(role: Role) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (user.role !== role) {
    redirect(ROLE_HOME[user.role]);
  }

  return user;
}
