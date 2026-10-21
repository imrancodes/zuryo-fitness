import type { NextRequest } from "next/server";
import { handleError } from "@/lib/api";
import { getApiUser } from "@/lib/auth";
import { getPaymentForViewer } from "@/services/payment.service";

export async function GET(request: NextRequest, context: RouteContext<"/api/payments/[id]">) {
  const { user, error } = await getApiUser(request, ["customer", "admin"]);
  if (error) {
    return error;
  }

  try {
    const { id } = await context.params;
    return Response.json({ payment: await getPaymentForViewer(id, user) });
  } catch (caught) {
    return handleError(caught);
  }
}
