import type { NextRequest } from "next/server";
import { handleError, readJson, validationError } from "@/lib/api";
import { getApiUser } from "@/lib/auth";
import { grantPackage, listRecentPackages } from "@/services/package.service";
import { grantPackageSchema } from "@/validators/package";

export async function GET(request: NextRequest) {
  const { error } = await getApiUser(request, ["admin"]);
  if (error) {
    return error;
  }

  try {
    return Response.json({ packages: await listRecentPackages() });
  } catch (caught) {
    return handleError(caught);
  }
}

export async function POST(request: NextRequest) {
  const { user, error } = await getApiUser(request, ["admin"]);
  if (error) {
    return error;
  }

  const input = grantPackageSchema.safeParse(await readJson(request));
  if (!input.success) {
    return validationError(input.error);
  }

  try {
    return Response.json({ package: await grantPackage(input.data, user.id) }, { status: 201 });
  } catch (caught) {
    return handleError(caught);
  }
}
