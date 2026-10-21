import type { NextRequest } from "next/server";
import { handleError, readJson, validationError } from "@/lib/api";
import { getApiUser } from "@/lib/auth";
import { saveFeedback } from "@/services/session.service";
import { feedbackSchema } from "@/validators/session";

export async function PUT(request: NextRequest, context: RouteContext<"/api/sessions/[id]/feedback">) {
  const { user, error } = await getApiUser(request, ["customer"]);
  if (error) {
    return error;
  }

  const input = feedbackSchema.safeParse(await readJson(request));
  if (!input.success) {
    return validationError(input.error);
  }

  try {
    const { id } = await context.params;
    return Response.json({ feedback: await saveFeedback(id, user.id, input.data) });
  } catch (caught) {
    return handleError(caught);
  }
}
