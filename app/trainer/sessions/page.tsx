import { CalendarClock } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { FilterTabs } from "@/components/filter-tabs";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { SessionList } from "@/features/sessions/session-list";
import { requireRole } from "@/lib/auth";
import { listTrainerSessions } from "@/services/session.service";
import { sessionListQuerySchema, type SessionFilter } from "@/validators/session";

export const metadata: Metadata = { title: "Sessions" };

const TABS: { filter: SessionFilter; label: string; empty: string }[] = [
  { filter: "upcoming", label: "Upcoming", empty: "No upcoming sessions. New bookings in your zones will appear here." },
  { filter: "in_progress", label: "In progress", empty: "No session is running right now." },
  { filter: "completed", label: "Completed", empty: "Completed sessions and their workout logs will appear here." },
  { filter: "all", label: "All", empty: "You don't have any sessions yet." },
];

export default async function TrainerSessionsPage({ searchParams }: PageProps<"/trainer/sessions">) {
  const user = await requireRole("trainer");
  const query = sessionListQuerySchema.safeParse(await searchParams);
  const filter = query.success ? query.data.status : "upcoming";
  const sessions = await listTrainerSessions(user.id, filter);
  const active = TABS.find((tab) => tab.filter === filter) ?? TABS[0];

  return (
    <>
      <PageHeader
        title="Sessions"
        description="Your assigned sessions. Open one to start it, follow the timer and log the workout."
        breadcrumbs={[{ label: "Trainer", href: "/trainer" }, { label: "Sessions" }]}
      />
      <FilterTabs
        label="Filter sessions"
        tabs={TABS.map((tab) => ({ label: tab.label, href: `/trainer/sessions?status=${tab.filter}`, active: tab.filter === filter }))}
      />
      {sessions.length > 0 ? (
        <SessionList sessions={sessions} />
      ) : (
        <EmptyState icon={CalendarClock} title={`No ${active.label.toLowerCase()} sessions`} description={active.empty}>
          <Button variant="outline" nativeButton={false} render={<Link href="/trainer/availability" />}>
            Manage availability
          </Button>
        </EmptyState>
      )}
    </>
  );
}
