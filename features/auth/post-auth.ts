import { requestJson, type FieldErrors } from "@/lib/request";

export type AuthResult = { ok: true; redirectTo: string } | { ok: false; error: string; fieldErrors?: FieldErrors };

export async function postAuth(url: string, body: unknown): Promise<AuthResult> {
  const result = await requestJson<{ redirectTo: string }>(url, { method: "POST", body });
  return result.ok ? { ok: true, redirectTo: result.data.redirectTo } : result;
}
