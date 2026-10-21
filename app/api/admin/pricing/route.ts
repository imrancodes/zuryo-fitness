import type { NextRequest } from "next/server";
import { handleError, readJson, validationError } from "@/lib/api";
import { getApiUser } from "@/lib/auth";
import { getPricingRule, updatePricingRule } from "@/services/pricing.service";
import { pricingRuleSchema } from "@/validators/pricing";

export async function GET(request: NextRequest) {
  const { error } = await getApiUser(request, ["admin"]);
  if (error) {
    return error;
  }

  try {
    return Response.json({ rule: await getPricingRule() });
  } catch (caught) {
    return handleError(caught);
  }
}

export async function PUT(request: NextRequest) {
  const { error } = await getApiUser(request, ["admin"]);
  if (error) {
    return error;
  }

  const input = pricingRuleSchema.safeParse(await readJson(request));
  if (!input.success) {
    return validationError(input.error);
  }

  try {
    return Response.json({ rule: await updatePricingRule(input.data) });
  } catch (caught) {
    return handleError(caught);
  }
}
