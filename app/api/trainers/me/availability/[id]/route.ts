import type { NextRequest } from "next/server";
import { handleError, readJson, validationError } from "@/lib/api";
import { getApiUser } from "@/lib/auth";
import { deleteAvailability, updateAvailability } from "@/services/availability.service";
import { availabilitySchema } from "@/validators/availability";

type Context = RouteContext<"/api/trainers/me/availability/[id]">;

export async function PATCH(request: NextRequest, context: Context) {
  const { user, error } = await getApiUser(request, ["trainer"]);
  if (error) {
    return error;
  }

  const input = availabilitySchema.safeParse(await readJson(request));
  if (!input.success) {
    return validationError(input.error);
  }

  try {
    const { id } = await context.params;
    return Response.json(await updateAvailability(user.id, id, input.data));
  } catch (caught) {
    return handleError(caught);
  }
}

export async function DELETE(request: NextRequest, context: Context) {
  const { user, error } = await getApiUser(request, ["trainer"]);
  if (error) {
    return error;
  }

  try {
    const { id } = await context.params;
    return Response.json(await deleteAvailability(user.id, id));
  } catch (caught) {
    return handleError(caught);
  }
}
