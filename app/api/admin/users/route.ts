import type { NextRequest } from "next/server";
import { getApiUser } from "@/lib/auth";
import { listUsers } from "@/services/auth.service";

export async function GET(request: NextRequest) {
  const { error } = await getApiUser(request, ["admin"]);
  return error ?? Response.json({ users: await listUsers() });
}
