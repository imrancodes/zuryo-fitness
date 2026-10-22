import type { NextRequest } from "next/server";
import { handleError, searchParamsOf, validationError } from "@/lib/api";
import { getApiUser } from "@/lib/auth";
import { listAdminBookings } from "@/services/booking.service";
import { adminBookingListQuerySchema } from "@/validators/booking";

export async function GET(request: NextRequest) {
  const { error } = await getApiUser(request, ["admin"]);
  if (error) {
    return error;
  }

  const query = adminBookingListQuerySchema.safeParse(searchParamsOf(request));
  if (!query.success) {
    return validationError(query.error);
  }

  try {
    return Response.json(await listAdminBookings(query.data));
  } catch (caught) {
    return handleError(caught);
  }
}
