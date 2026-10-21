import type { NextRequest } from "next/server";
import { handleError, readJson, validationError } from "@/lib/api";
import { getApiUser } from "@/lib/auth";
import { simulatePayment } from "@/services/payment.service";
import { simulatePaymentSchema } from "@/validators/payment";

export async function POST(request: NextRequest) {
  const { user, error } = await getApiUser(request, ["customer"]);
  if (error) {
    return error;
  }

  const input = simulatePaymentSchema.safeParse(await readJson(request));
  if (!input.success) {
    return validationError(input.error);
  }

  try {
    return Response.json({ payment: await simulatePayment(user.id, input.data) });
  } catch (caught) {
    return handleError(caught);
  }
}
