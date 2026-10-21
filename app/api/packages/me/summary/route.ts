import type { NextRequest } from "next/server";
import { handleError } from "@/lib/api";
import { getApiUser } from "@/lib/auth";
import { getPackageSummary } from "@/services/package.service";

export async function GET(request: NextRequest) {
  const { user, error } = await getApiUser(request, ["customer"]);
  if (error) {
    return error;
  }

  try {
    return Response.json({ summary: await getPackageSummary(user.id) });
  } catch (caught) {
    return handleError(caught);
  }
}
