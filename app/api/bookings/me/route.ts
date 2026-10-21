import type { NextRequest } from "next/server";
import { handleError, searchParamsOf, validationError } from "@/lib/api";
import { getApiUser } from "@/lib/auth";
import { listCustomerBookings } from "@/services/booking.service";
import { bookingListQuerySchema } from "@/validators/booking";

export async function GET(request: NextRequest) {
  const { user, error } = await getApiUser(request, ["customer"]);
  if (error) {
    return error;
  }

  const query = bookingListQuerySchema.safeParse(searchParamsOf(request));
  if (!query.success) {
    return validationError(query.error);
  }

  try {
    return Response.json({ bookings: await listCustomerBookings(user.id, query.data.status) });
  } catch (caught) {
    return handleError(caught);
  }
}
