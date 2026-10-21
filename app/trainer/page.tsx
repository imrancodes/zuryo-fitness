import { BicepsFlexed, CalendarClock, TrendingUp, Wallet } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ComingSoonGrid, type ComingSoonItem } from "@/components/coming-soon-grid";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { SessionList } from "@/features/sessions/session-list";
import { requireRole } from "@/lib/auth";
import { listTrainerSessions } from "@/services/session.service";

export const metadata: Metadata = { title: "Trainer" };

const UPCOMING: ComingSoonItem[] = [
  { icon: Wallet, title: "Earnings", description: "See completed sessions and your payouts." },
  { icon: TrendingUp, title: "Client progress", description: "Follow how your regular clients are improving." },
];

const availabilityButton = (
  <Button variant="outline" nativeButton={false} render={<Link href="/trainer/availability" />}>
    <CalendarClock aria-hidden />
    Manage availability
  </Button>
);

export default async function TrainerHomePage() {
  const user = await requireRole("trainer");
  const [active, upcoming] = await Promise.all([
    listTrainerSessions(user.id, "in_progress"),
    listTrainerSessions(user.id, "upcoming"),
  ]);

  return (
    <>
      <PageHeader
        title="Trainer workspace"
        description="Your sessions and schedule at a glance."
        breadcrumbs={[{ label: "Trainer", href: "/trainer" }, { label: "Overview" }]}
        actions={availabilityButton}
      />
      {active.length > 0 && (
        <section aria-labelledby="active" className="space-y-3">
          <h2 id="active" className="text-sm font-medium text-muted-foreground">
            In progress
          </h2>
          <SessionList sessions={active} />
        </section>
      )}
      <section aria-labelledby="upcoming" className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 id="upcoming" className="text-sm font-medium text-muted-foreground">
            Upcoming sessions
          </h2>
          <Link href="/trainer/sessions?status=all" className="text-sm font-medium text-brand underline-offset-4 hover:underline">
            View all sessions
          </Link>
        </div>
        {upcoming.length > 0 ? (
          <SessionList sessions={upcoming.slice(0, 5)} />
        ) : (
          <EmptyState
            icon={BicepsFlexed}
            title="No upcoming sessions"
            description="Add availability in your service zones so customers can book you."
          >
            {availabilityButton}
          </EmptyState>
        )}
      </section>
      <ComingSoonGrid items={UPCOMING} />
    </>
  );
}
