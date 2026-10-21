import type { NextRequest } from "next/server";
import { handleError, readJson, validationError } from "@/lib/api";
import { getApiUser } from "@/lib/auth";
import { createBooking } from "@/services/booking.service";
import { createBookingSchema } from "@/validators/booking";

export async function POST(request: NextRequest) {
  const { user, error } = await getApiUser(request, ["customer"]);
  if (error) {
    return error;
  }

  const input = createBookingSchema.safeParse(await readJson(request));
  if (!input.success) {
    return validationError(input.error);
  }

  try {
    const { booking, created } = await createBooking(user.id, input.data);
    return Response.json({ booking }, { status: created ? 201 : 200 });
  } catch (caught) {
    return handleError(caught);
  }
}
