"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { requestJson, type FieldErrors } from "@/lib/request";

export function useApiMutation() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  async function run(url: string, method: string, body?: unknown) {
    setPending(true);
    setError(null);
    setFieldErrors({});

    const result = await requestJson(url, { method, body });
    setPending(false);

    if (!result.ok) {
      setError(result.error);
      setFieldErrors(result.fieldErrors ?? {});
      return false;
    }

    router.refresh();
    return true;
  }

  function reset() {
    setPending(false);
    setError(null);
    setFieldErrors({});
  }

  return { pending, error, fieldErrors, setFieldErrors, run, reset };
}
