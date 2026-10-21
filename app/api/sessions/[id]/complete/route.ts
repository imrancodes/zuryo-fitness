import type { NextRequest } from "next/server";
import { handleError } from "@/lib/api";
import { getApiUser } from "@/lib/auth";
import { completeSession } from "@/services/session.service";

export async function POST(request: NextRequest, context: RouteContext<"/api/sessions/[id]/complete">) {
  const { user, error } = await getApiUser(request, ["trainer"]);
  if (error) {
    return error;
  }

  try {
    const { id } = await context.params;
    const { session } = await completeSession(id, user.id);
    return Response.json({ session });
  } catch (caught) {
    return handleError(caught);
  }
}
