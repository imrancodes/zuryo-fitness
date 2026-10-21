import { z } from "zod";

export function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

export function validationError(error: z.ZodError) {
  return Response.json(
    { error: "Please check the highlighted fields", fieldErrors: z.flattenError(error).fieldErrors },
    { status: 400 }
  );
}

export async function readJson(request: Request) {
  return request.json().catch(() => null);
}
