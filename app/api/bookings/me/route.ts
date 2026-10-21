import type { NextRequest } from "next/server";
import { handleError } from "@/lib/api";
import { getApiUser } from "@/lib/auth";
import { listCustomerBookings } from "@/services/booking.service";

export async function GET(request: NextRequest) {
  const { user, error } = await getApiUser(request, ["customer"]);
  if (error) {
    return error;
  }

  try {
    return Response.json({ bookings: await listCustomerBookings(user.id) });
  } catch (caught) {
    return handleError(caught);
  }
}
