import { NextResponse, type NextRequest } from "next/server";
import { jsonError, readJson, validationError } from "@/lib/api";
import { ROLE_HOME } from "@/lib/roles";
import { setSessionCookie } from "@/lib/session";
import { EmailTakenError, registerUser } from "@/services/auth.service";
import { registerSchema } from "@/validators/auth";

export async function POST(request: NextRequest) {
  const result = registerSchema.safeParse(await readJson(request));

  if (!result.success) {
    return validationError(result.error);
  }

  try {
    const user = await registerUser(result.data);
    const response = NextResponse.json({ user, redirectTo: ROLE_HOME[user.role] }, { status: 201 });
    await setSessionCookie(response, user);
    return response;
  } catch (error) {
    if (error instanceof EmailTakenError) {
      return jsonError(error.message, 409);
    }
    return jsonError("Could not create your account. Please try again.", 500);
  }
}
