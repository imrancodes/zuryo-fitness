import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { AvailabilityManager } from "@/features/availability/availability-manager";
import { requireRole } from "@/lib/auth";
import { todayInZone } from "@/lib/time";
import { listTrainerAvailability } from "@/services/availability.service";
import { dateString } from "@/validators/common";

export const metadata: Metadata = { title: "Availability" };

export default async function AvailabilityPage({ searchParams }: PageProps<"/trainer/availability">) {
  const user = await requireRole("trainer");
  const { date } = await searchParams;
  const today = todayInZone();
  const day = dateString.safeParse(date).success ? (date as string) : today;
  const windows = await listTrainerAvailability(user.id, day);

  return (
    <>
      <PageHeader
        title="Availability"
        description="Set the times and zones you can train. Customers can only book inside these windows."
        breadcrumbs={[{ label: "Trainer", href: "/trainer" }, { label: "Availability" }]}
      />
      <AvailabilityManager date={day} today={today} windows={windows} />
    </>
  );
}
