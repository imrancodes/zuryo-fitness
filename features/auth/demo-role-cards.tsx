"use client";

import { ArrowRight, BicepsFlexed, Loader2, ShieldCheck, UserRound, type LucideIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { FormStatus } from "@/components/form-status";
import { postAuth } from "@/features/auth/post-auth";
import { useResetOnHide } from "@/hooks/use-reset-on-hide";
import type { Role } from "@/lib/roles";

const DEMO_ROLES: { role: Role; title: string; description: string; icon: LucideIcon }[] = [
  {
    role: "customer",
    title: "Customer",
    description: "Find nearby certified trainers, book instant or scheduled sessions and track your progress.",
    icon: UserRound,
  },
  {
    role: "trainer",
    title: "Trainer",
    description: "Manage your availability and service zones, run sessions and log workouts for clients.",
    icon: BicepsFlexed,
  },
  {
    role: "admin",
    title: "Admin",
    description: "Oversee users, bookings and pricing rules across the Zuryo platform.",
    icon: ShieldCheck,
  },
];

export function DemoRoleCards() {
  const router = useRouter();
  const [pendingRole, setPendingRole] = useState<Role | null>(null);
  const [error, setError] = useState<string | null>(null);

  useResetOnHide(() => {
    setPendingRole(null);
    setError(null);
  });

  async function enter(role: Role) {
    setPendingRole(role);
    setError(null);
    const result = await postAuth("/api/auth/demo", { role });

    if (result.ok) {
      router.replace(result.redirectTo);
      router.refresh();
      return;
    }

    setPendingRole(null);
    setError(result.error);
  }

  return (
    <div className="space-y-4">
      <FormStatus error={error} />
      <div className="grid gap-4 md:grid-cols-3">
        {DEMO_ROLES.map(({ role, title, description, icon: Icon }) => (
          <Card key={role} className="justify-between">
            <CardHeader className="gap-3">
              <span className="grid size-10 place-items-center rounded-xl bg-brand/10 text-brand">
                <Icon className="size-5" aria-hidden />
              </span>
              <CardTitle className="text-base">{title}</CardTitle>
            </CardHeader>
            <CardContent className="flex-1">
              <CardDescription>{description}</CardDescription>
            </CardContent>
            <CardFooter className="border-t pt-4">
              <Button className="w-full" size="lg" onClick={() => enter(role)} disabled={pendingRole !== null}>
                {pendingRole === role ? <Loader2 className="animate-spin" aria-hidden /> : null}
                Enter as {title}
                {pendingRole !== role && <ArrowRight aria-hidden />}
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
