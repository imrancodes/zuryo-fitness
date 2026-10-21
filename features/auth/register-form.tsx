"use client";

import { BicepsFlexed, UserRound } from "lucide-react";
import { FormField } from "@/components/form-field";
import { OptionCard } from "@/components/option-card";
import { FormStatus } from "@/components/form-status";
import { PasswordInput } from "@/features/auth/password-input";
import { SubmitButton } from "@/features/auth/submit-button";
import { useAuthForm } from "@/features/auth/use-auth-form";
import { registerSchema } from "@/validators/auth";

const ROLE_OPTIONS = [
  { value: "customer", label: "Customer", description: "Book sessions with trainers", icon: UserRound },
  { value: "trainer", label: "Trainer", description: "Offer sessions to clients", icon: BicepsFlexed },
];

export function RegisterForm() {
  const { formRef, status, error, fieldErrors, onSubmit, onChange } = useAuthForm("/api/auth/register", registerSchema);

  return (
    <form ref={formRef} noValidate onSubmit={onSubmit} onChange={onChange} className="grid gap-5">
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
          {ROLE_OPTIONS.map((option) => (
            <OptionCard key={option.value} name="role" defaultChecked={option.value === "customer"} className="p-3" {...option} />
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
