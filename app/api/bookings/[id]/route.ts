import type { NextRequest } from "next/server";
import { handleError } from "@/lib/api";
import { getApiUser } from "@/lib/auth";
import { getBookingForViewer } from "@/services/booking.service";

export async function GET(request: NextRequest, context: RouteContext<"/api/bookings/[id]">) {
  const { user, error } = await getApiUser(request);
  if (error) {
    return error;
  }

  try {
    const { id } = await context.params;
    return Response.json({ booking: await getBookingForViewer(id, user) });
  } catch (caught) {
    return handleError(caught);
  }
}
