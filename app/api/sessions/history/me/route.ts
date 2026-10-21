import type { NextRequest } from "next/server";
import { handleError } from "@/lib/api";
import { getApiUser } from "@/lib/auth";
import { listCompletedSessions } from "@/services/session.service";

export async function GET(request: NextRequest) {
  const { user, error } = await getApiUser(request, ["customer"]);
  if (error) {
    return error;
  }

  try {
    return Response.json({ sessions: await listCompletedSessions({ customerId: user.id }) });
  } catch (caught) {
    return handleError(caught);
  }
}
