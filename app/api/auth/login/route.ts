import { NextResponse, type NextRequest } from "next/server";
import { jsonError, readJson, validationError } from "@/lib/api";
import { safeRedirect } from "@/lib/redirect";
import { setSessionCookie } from "@/lib/session";
import { authenticate } from "@/services/auth.service";
import { loginSchema } from "@/validators/auth";

export async function POST(request: NextRequest) {
  const result = loginSchema.safeParse(await readJson(request));

  if (!result.success) {
    return validationError(result.error);
  }

  const user = await authenticate(result.data.email, result.data.password);

  if (!user) {
    return jsonError("Invalid email or password", 401);
  }

  const response = NextResponse.json({ user, redirectTo: safeRedirect(result.data.next, user.role) });
  await setSessionCookie(response, user);
  return response;
}
