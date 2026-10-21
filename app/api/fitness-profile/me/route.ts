import type { NextRequest } from "next/server";
import { handleError, readJson, validationError } from "@/lib/api";
import { getApiUser } from "@/lib/auth";
import { getProfile, saveProfile } from "@/services/fitness-profile.service";
import { fitnessProfileSchema } from "@/validators/fitness";

export async function GET(request: NextRequest) {
  const { user, error } = await getApiUser(request, ["customer"]);
  if (error) {
    return error;
  }

  try {
    return Response.json({ profile: await getProfile(user.id) });
  } catch (caught) {
    return handleError(caught);
  }
}

export async function PUT(request: NextRequest) {
  const { user, error } = await getApiUser(request, ["customer"]);
  if (error) {
    return error;
  }

  const input = fitnessProfileSchema.safeParse(await readJson(request));
  if (!input.success) {
    return validationError(input.error);
  }

  try {
    return Response.json({ profile: await saveProfile(user.id, input.data) });
  } catch (caught) {
    return handleError(caught);
  }
}
