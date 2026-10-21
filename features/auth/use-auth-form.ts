"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { z } from "zod";
import { postAuth } from "@/features/auth/post-auth";
import type { FieldErrors } from "@/lib/request";
import { useResetOnHide } from "@/hooks/use-reset-on-hide";

type Status = "idle" | "pending" | "success";

export function useAuthForm(url: string, schema: z.ZodType, extraValues?: () => Record<string, unknown>) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  useResetOnHide(() => {
    formRef.current?.reset();
    setStatus("idle");
    setError(null);
    setFieldErrors({});
  });

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = { ...Object.fromEntries(new FormData(event.currentTarget)), ...extraValues?.() };
    const parsed = schema.safeParse(values);

    if (!parsed.success) {
      setFieldErrors(z.flattenError(parsed.error).fieldErrors);
      return;
    }

    setStatus("pending");
    setError(null);
    setFieldErrors({});

    const result = await postAuth(url, parsed.data);

    if (result.ok) {
      setStatus("success");
      router.replace(result.redirectTo);
      router.refresh();
      return;
    }

    setStatus("idle");
    setError(result.error);
    setFieldErrors(result.fieldErrors ?? {});
  }

  function onChange(event: FormEvent<HTMLFormElement>) {
    const { name } = event.target as HTMLInputElement;
    setFieldErrors((current) => (current[name] ? { ...current, [name]: undefined } : current));
  }

  return { formRef, status, error, fieldErrors, onSubmit, onChange };
}
