import type { NextRequest } from "next/server";
import { handleError } from "@/lib/api";
import { getApiUser } from "@/lib/auth";
import { getSessionForViewer } from "@/services/session.service";

export async function GET(request: NextRequest, context: RouteContext<"/api/sessions/[id]">) {
  const { user, error } = await getApiUser(request);
  if (error) {
    return error;
  }

  try {
    const { id } = await context.params;
    return Response.json({ session: await getSessionForViewer(id, user) });
  } catch (caught) {
    return handleError(caught);
  }
}
