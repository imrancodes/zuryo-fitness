import type { NextRequest } from "next/server";
import { handleError, searchParamsOf, validationError } from "@/lib/api";
import { getApiUser } from "@/lib/auth";
import { findOpenSlots } from "@/services/availability.service";
import { availabilityQuerySchema } from "@/validators/booking";

export async function GET(request: NextRequest) {
  const { error } = await getApiUser(request, ["customer"]);
  if (error) {
    return error;
  }

  const query = availabilityQuerySchema.safeParse(searchParamsOf(request));
  if (!query.success) {
    return validationError(query.error);
  }

  try {
    return Response.json(await findOpenSlots(query.data));
  } catch (caught) {
    return handleError(caught);
  }
}
