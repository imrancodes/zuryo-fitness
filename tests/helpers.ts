import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import type { Role } from "@/lib/roles";
import { SESSION_COOKIE } from "@/lib/session";
import { hashPassword } from "@/services/auth.service";
import { User } from "@/models/User";

export const PASSWORD = "Password123!";

export function makeRequest(path: string, options: { method?: string; body?: unknown; session?: string } = {}) {
  const headers = new Headers({ "content-type": "application/json" });

  if (options.session) {
    headers.set("cookie", `${SESSION_COOKIE}=${options.session}`);
  }

  return new NextRequest(new URL(path, "http://localhost:3000"), {
    method: options.method ?? "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
}

export function sessionFrom(response: Response) {
  const match = response.headers.get("set-cookie")?.match(new RegExp(`${SESSION_COOKIE}=([^;]*)`));
  return match?.[1] ?? "";
}

export async function createUser(role: Role, email = `${role}-${crypto.randomUUID()}@test.dev`) {
  await connectToDatabase();
  await User.create({ name: `Test ${role}`, email, passwordHash: await hashPassword(PASSWORD), role });
  return email;
}
