import { CalendarClock, ClipboardList, Dumbbell, Wallet } from "lucide-react";
import type { Metadata } from "next";
import { ComingSoonGrid, type ComingSoonItem } from "@/components/coming-soon-grid";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Trainer" };

const UPCOMING: ComingSoonItem[] = [
  { icon: CalendarClock, title: "Availability", description: "Publish time slots and the zones you serve." },
  { icon: ClipboardList, title: "Session logs", description: "Record exercises, notes and next-workout suggestions." },
  { icon: Wallet, title: "Earnings", description: "See completed sessions and your payouts." },
];

export default function TrainerHomePage() {
  return (
    <>
      <PageHeader
        title="Trainer workspace"
        description="Your schedule, clients and session records will live here."
        breadcrumbs={[{ label: "Trainer", href: "/trainer" }, { label: "Overview" }]}
      />
      <EmptyState
        icon={Dumbbell}
        title="No sessions assigned yet"
        description="Once booking goes live, sessions assigned to you will appear here with client details and timings."
      >
        <Button disabled>Set availability</Button>
      </EmptyState>
      <ComingSoonGrid items={UPCOMING} />
    </>
  );
}
