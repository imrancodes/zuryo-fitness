"use client";

import { Dumbbell, UserRound, type LucideIcon } from "lucide-react";
import { FormField } from "@/components/form-field";
import { FormStatus } from "@/features/auth/form-status";
import { PasswordInput } from "@/features/auth/password-input";
import { SubmitButton } from "@/features/auth/submit-button";
import { useAuthForm } from "@/features/auth/use-auth-form";
import { registerSchema } from "@/validators/auth";

const ROLE_OPTIONS: { value: string; label: string; description: string; icon: LucideIcon }[] = [
  { value: "customer", label: "Customer", description: "Book sessions with trainers", icon: UserRound },
  { value: "trainer", label: "Trainer", description: "Offer sessions to clients", icon: Dumbbell },
];

export function RegisterForm() {
  const { status, error, fieldErrors, onSubmit, onChange } = useAuthForm("/api/auth/register", registerSchema);

  return (
    <form noValidate onSubmit={onSubmit} onChange={onChange} className="grid gap-5">
      <FormStatus error={error} success={status === "success" ? "Account created. Setting up your workspace…" : null} />
      <FormField id="name" label="Full name" autoComplete="name" placeholder="Riya Sharma" error={fieldErrors.name?.[0]} />
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
        autoComplete="new-password"
        placeholder="At least 8 characters"
        error={fieldErrors.password?.[0]}
      />
      <fieldset className="grid gap-2">
        <legend className="mb-2 text-sm font-medium">I want to join as</legend>
        <div className="grid grid-cols-2 gap-3">
          {ROLE_OPTIONS.map(({ value, label, description, icon: Icon }) => (
            <label
              key={value}
              className="flex cursor-pointer flex-col gap-1 rounded-xl border bg-card p-3 transition-colors hover:bg-secondary has-checked:border-brand has-checked:bg-brand/5 has-focus-visible:ring-3 has-focus-visible:ring-ring/50"
            >
              <input type="radio" name="role" value={value} defaultChecked={value === "customer"} className="sr-only" />
              <Icon className="size-4 text-brand" aria-hidden />
              <span className="text-sm font-medium">{label}</span>
              <span className="text-xs text-muted-foreground">{description}</span>
            </label>
          ))}
        </div>
        {fieldErrors.role && <p className="text-sm text-destructive">{fieldErrors.role[0]}</p>}
      </fieldset>
      <SubmitButton pending={status !== "idle"} pendingLabel="Creating account…">
        Create account
      </SubmitButton>
    </form>
  );
}
