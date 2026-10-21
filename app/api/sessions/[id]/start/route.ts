import type { NextRequest } from "next/server";
import { handleError } from "@/lib/api";
import { getApiUser } from "@/lib/auth";
import { startSession } from "@/services/session.service";

export async function POST(request: NextRequest, context: RouteContext<"/api/sessions/[id]/start">) {
  const { user, error } = await getApiUser(request, ["trainer"]);
  if (error) {
    return error;
  }

  try {
    const { id } = await context.params;
    const { session, created } = await startSession(id, user.id);
    return Response.json({ session }, { status: created ? 201 : 200 });
  } catch (caught) {
    return handleError(caught);
  }
}
