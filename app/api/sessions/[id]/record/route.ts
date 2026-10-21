import type { NextRequest } from "next/server";
import { handleError, readJson, validationError } from "@/lib/api";
import { getApiUser } from "@/lib/auth";
import { saveWorkoutRecord } from "@/services/session.service";
import { workoutRecordSchema } from "@/validators/session";

export async function PATCH(request: NextRequest, context: RouteContext<"/api/sessions/[id]/record">) {
  const { user, error } = await getApiUser(request, ["trainer"]);
  if (error) {
    return error;
  }

  const input = workoutRecordSchema.safeParse(await readJson(request));
  if (!input.success) {
    return validationError(input.error);
  }

  try {
    const { id } = await context.params;
    return Response.json({ session: await saveWorkoutRecord(id, user.id, input.data) });
  } catch (caught) {
    return handleError(caught);
  }
}
