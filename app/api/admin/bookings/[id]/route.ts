import type { NextRequest } from "next/server";
import { handleError } from "@/lib/api";
import { getApiUser } from "@/lib/auth";
import { getAdminBookingDetail } from "@/services/booking.service";

export async function GET(request: NextRequest, context: RouteContext<"/api/admin/bookings/[id]">) {
  const { user, error } = await getApiUser(request, ["admin"]);
  if (error) {
    return error;
  }

  try {
    const { id } = await context.params;
    return Response.json(await getAdminBookingDetail(id, user));
  } catch (caught) {
    return handleError(caught);
  }
}
