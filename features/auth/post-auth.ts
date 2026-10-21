export type FieldErrors = Partial<Record<string, string[]>>;

export type AuthResult =
  | { ok: true; redirectTo: string }
  | { ok: false; error: string; fieldErrors?: FieldErrors };

export async function postAuth(url: string, body: unknown): Promise<AuthResult> {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await response.json();

    return response.ok
      ? { ok: true, redirectTo: data.redirectTo }
      : { ok: false, error: data.error, fieldErrors: data.fieldErrors };
  } catch {
    return { ok: false, error: "Something went wrong. Check your connection and try again." };
  }
}
