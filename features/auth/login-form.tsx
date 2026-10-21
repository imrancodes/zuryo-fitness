"use client";

import { FormField } from "@/components/form-field";
import { FormStatus } from "@/features/auth/form-status";
import { PasswordInput } from "@/features/auth/password-input";
import { SubmitButton } from "@/features/auth/submit-button";
import { useAuthForm } from "@/features/auth/use-auth-form";
import { loginSchema } from "@/validators/auth";

const nextParam = () => ({ next: new URLSearchParams(window.location.search).get("next") ?? undefined });

export function LoginForm() {
  const { status, error, fieldErrors, onSubmit, onChange } = useAuthForm("/api/auth/login", loginSchema, nextParam);

  return (
    <form noValidate onSubmit={onSubmit} onChange={onChange} className="grid gap-5">
      <FormStatus error={error} success={status === "success" ? "Signed in. Taking you to your workspace…" : null} />
      <FormField
        id="email"
        label="Email"
        type="email"
        autoComplete="email"
        placeholder="you@example.com"
        error={fieldErrors.email?.[0]}
      />
      <FormField
        id="password"
        label="Password"
        as={PasswordInput}
        autoComplete="current-password"
        error={fieldErrors.password?.[0]}
      />
      <SubmitButton pending={status !== "idle"} pendingLabel="Signing in…">
        Sign in
      </SubmitButton>
    </form>
  );
}
