import type { NextRequest } from "next/server";
import { handleError, readJson, searchParamsOf, validationError } from "@/lib/api";
import { getApiUser } from "@/lib/auth";
import { todayInZone } from "@/lib/time";
import { createAvailability, listTrainerAvailability } from "@/services/availability.service";
import { availabilityDateQuerySchema, availabilitySchema } from "@/validators/availability";

export async function GET(request: NextRequest) {
  const { user, error } = await getApiUser(request, ["trainer"]);
  if (error) {
    return error;
  }

  const query = availabilityDateQuerySchema.safeParse(searchParamsOf(request));
  if (!query.success) {
    return validationError(query.error);
  }

  try {
    return Response.json({ windows: await listTrainerAvailability(user.id, query.data.date ?? todayInZone()) });
  } catch (caught) {
    return handleError(caught);
  }
}

export async function POST(request: NextRequest) {
  const { user, error } = await getApiUser(request, ["trainer"]);
  if (error) {
    return error;
  }

  const input = availabilitySchema.safeParse(await readJson(request));
  if (!input.success) {
    return validationError(input.error);
  }

  try {
    return Response.json(await createAvailability(user.id, input.data), { status: 201 });
  } catch (caught) {
    return handleError(caught);
  }
}
