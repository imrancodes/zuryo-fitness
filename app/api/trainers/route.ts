import type { NextRequest } from "next/server";
import { handleError, searchParamsOf, validationError } from "@/lib/api";
import { getApiUser } from "@/lib/auth";
import { findAvailableTrainers } from "@/services/availability.service";
import { trainersQuerySchema } from "@/validators/booking";

export async function GET(request: NextRequest) {
  const { error } = await getApiUser(request, ["customer"]);
  if (error) {
    return error;
  }

  const query = trainersQuerySchema.safeParse(searchParamsOf(request));
  if (!query.success) {
    return validationError(query.error);
  }

  try {
    const trainers = await findAvailableTrainers(query.data.serviceZone, new Date(query.data.startTime));
    return Response.json({ trainers });
  } catch (caught) {
    return handleError(caught);
  }
}
