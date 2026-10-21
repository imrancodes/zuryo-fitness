export type FieldErrors = Partial<Record<string, string[]>>;

export type ApiResult<T> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number; error: string; fieldErrors?: FieldErrors };

export async function requestJson<T>(url: string, options: { method?: string; body?: unknown } = {}): Promise<ApiResult<T>> {
  try {
    const response = await fetch(url, {
      method: options.method ?? "GET",
      headers: options.body === undefined ? undefined : { "content-type": "application/json" },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
    const data = await response.json();

    return response.ok
      ? { ok: true, status: response.status, data }
      : { ok: false, status: response.status, error: data.error, fieldErrors: data.fieldErrors };
  } catch {
    return { ok: false, status: 0, error: "Something went wrong. Check your connection and try again." };
  }
}
