"use client";

import { Loader2, Plus } from "lucide-react";
import { useState, type FormEvent } from "react";
import { z } from "zod";
import { FormField } from "@/components/form-field";
import { FormStatus } from "@/components/form-status";
import { Button } from "@/components/ui/button";
import { useApiMutation } from "@/hooks/use-api-mutation";
import { grantPackageSchema } from "@/validators/package";

export function GrantPackageForm() {
  const [email, setEmail] = useState("");
  const [sessions, setSessions] = useState("10");
  const [granted, setGranted] = useState<string | null>(null);
  const { pending, error, fieldErrors, setFieldErrors, run } = useApiMutation();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setGranted(null);
    const parsed = grantPackageSchema.safeParse({ email, sessions: sessions.trim() ? Number(sessions) : Number.NaN });

    if (!parsed.success) {
      setFieldErrors(z.flattenError(parsed.error).fieldErrors);
      return;
    }

    if (await run("/api/admin/packages", "POST", parsed.data)) {
      setGranted(`Added ${parsed.data.sessions} sessions to ${parsed.data.email}.`);
      setEmail("");
    }
  }

  return (
    <form noValidate onSubmit={onSubmit} className="space-y-4">
      <FormStatus error={error} success={granted} />
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_8rem]">
        <FormField
          id="email"
          label="Customer email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="customer@zuryo.dev"
          error={fieldErrors.email?.[0]}
        />
        <FormField
          id="sessions"
          label="Sessions"
          inputMode="numeric"
          value={sessions}
          onChange={(event) => setSessions(event.target.value)}
          error={fieldErrors.sessions?.[0]}
        />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Plus aria-hidden />}
        Grant package
      </Button>
    </form>
  );
}
