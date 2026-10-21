import type { NextRequest } from "next/server";
import { getApiUser } from "@/lib/auth";
import { listTrainerAvailability } from "@/services/availability.service";

export async function GET(request: NextRequest) {
  const { user, error } = await getApiUser(request, ["trainer"]);
  return error ?? Response.json({ slots: await listTrainerAvailability(user.id) });
}
