import type { NextRequest } from "next/server";
import { handleError, searchParamsOf, validationError } from "@/lib/api";
import { getApiUser } from "@/lib/auth";
import { listTrainerSessions } from "@/services/session.service";
import { sessionListQuerySchema } from "@/validators/session";

export async function GET(request: NextRequest) {
  const { user, error } = await getApiUser(request, ["trainer"]);
  if (error) {
    return error;
  }

  const query = sessionListQuerySchema.safeParse(searchParamsOf(request));
  if (!query.success) {
    return validationError(query.error);
  }

  try {
    const now = new Date();
    return Response.json({ sessions: await listTrainerSessions(user.id, query.data.status, now), serverNow: now.toISOString() });
  } catch (caught) {
    return handleError(caught);
  }
}
