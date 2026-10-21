import type { NextRequest } from "next/server";
import { handleError } from "@/lib/api";
import { getApiUser } from "@/lib/auth";
import { quoteBooking } from "@/services/pricing.service";

export async function GET(request: NextRequest, context: RouteContext<"/api/bookings/[id]/quote">) {
  const { user, error } = await getApiUser(request, ["customer"]);
  if (error) {
    return error;
  }

  try {
    const { id } = await context.params;
    const { quote } = await quoteBooking(id, user.id);
    return Response.json({ quote });
  } catch (caught) {
    return handleError(caught);
  }
}
