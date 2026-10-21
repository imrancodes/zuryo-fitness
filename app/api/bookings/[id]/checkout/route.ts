import type { NextRequest } from "next/server";
import { handleError } from "@/lib/api";
import { getApiUser } from "@/lib/auth";
import { startCheckout } from "@/services/payment.service";

export async function POST(request: NextRequest, context: RouteContext<"/api/bookings/[id]/checkout">) {
  const { user, error } = await getApiUser(request, ["customer"]);
  if (error) {
    return error;
  }

  try {
    const { id } = await context.params;
    const { payment, created } = await startCheckout(id, user.id);
    return Response.json({ payment }, { status: created ? 201 : 200 });
  } catch (caught) {
    return handleError(caught);
  }
}
