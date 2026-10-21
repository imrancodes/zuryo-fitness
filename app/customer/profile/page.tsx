import { ClipboardList } from "lucide-react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { FitnessProfileForm } from "@/features/fitness/fitness-profile-form";
import { requireRole } from "@/lib/auth";
import { formatDateTime, TIME_ZONE_LABEL } from "@/lib/time";
import { getProfile } from "@/services/fitness-profile.service";

export const metadata: Metadata = { title: "Fitness profile" };

export default async function FitnessProfilePage() {
  const user = await requireRole("customer");
  const profile = await getProfile(user.id);

  return (
    <>
      <PageHeader
        title="Fitness profile"
        description={
          profile
            ? `Last updated ${formatDateTime(profile.updatedAt)} ${TIME_ZONE_LABEL}. Each save is kept as an assessment so you can track progress.`
            : "Tell us about your goals so trainers and suggestions fit you."
        }
        breadcrumbs={[{ label: "Customer", href: "/customer" }, { label: "Fitness profile" }]}
      />
      {!profile && (
        <Alert className="border-brand/30 bg-brand/5">
          <ClipboardList className="text-brand" />
          <AlertTitle>Complete your fitness assessment</AlertTitle>
          <AlertDescription>It takes a minute. We only ask for what helps plan your sessions; weight is used for your own progress view.</AlertDescription>
        </Alert>
      )}
      <Card>
        <CardContent className="pt-2">
          <FitnessProfileForm profile={profile} />
        </CardContent>
      </Card>
    </>
  );
}
