import { z } from "zod";
import { ServiceError } from "@/lib/errors";

export function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

export function validationError(error: z.ZodError) {
  return Response.json(
    { error: "Please check the highlighted fields", fieldErrors: z.flattenError(error).fieldErrors },
    { status: 400 }
  );
}

export function handleError(error: unknown) {
  if (error instanceof ServiceError) {
    return jsonError(error.message, error.status);
  }

  console.error(error instanceof Error ? error.message : error);
  return jsonError("Something went wrong. Please try again.", 500);
}

export async function readJson(request: Request) {
  return request.json().catch(() => null);
}

export function searchParamsOf(request: Request) {
  return Object.fromEntries(new URL(request.url).searchParams);
}
