import { NextResponse, type NextRequest } from "next/server";
import { jsonError, readJson, validationError } from "@/lib/api";
import { DEMO_ACCOUNTS, isDemoEnabled } from "@/lib/demo";
import { ROLE_HOME } from "@/lib/roles";
import { setSessionCookie } from "@/lib/session";
import { getActiveUserByEmail } from "@/services/auth.service";
import { demoLoginSchema } from "@/validators/auth";

export async function POST(request: NextRequest) {
  if (!isDemoEnabled()) {
    return jsonError("Not found", 404);
  }

  const result = demoLoginSchema.safeParse(await readJson(request));

  if (!result.success) {
    return validationError(result.error);
  }

  const user = await getActiveUserByEmail(DEMO_ACCOUNTS[result.data.role].email);

  if (!user) {
    return jsonError("Demo account not found. Run `bun run seed` first.", 404);
  }

  const response = NextResponse.json({ user, redirectTo: ROLE_HOME[user.role] });
  await setSessionCookie(response, user);
  return response;
}
