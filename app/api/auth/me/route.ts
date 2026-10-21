import type { NextRequest } from "next/server";
import { getApiUser } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const { user, error } = await getApiUser(request);
  return error ?? Response.json({ user });
}
