import { History } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { HistoryList } from "@/features/sessions/history-list";
import { requireRole } from "@/lib/auth";
import { listCompletedSessions } from "@/services/session.service";

export const metadata: Metadata = { title: "Workout history" };

export default async function WorkoutHistoryPage() {
  const user = await requireRole("customer");
  const sessions = await listCompletedSessions({ customerId: user.id });

  return (
    <>
      <PageHeader
        title="Workout history"
        description="Completed sessions with what you trained, your trainer's notes and their suggestion for next time."
        breadcrumbs={[{ label: "Customer", href: "/customer" }, { label: "Workout history" }]}
      />
      {sessions.length > 0 ? (
        <HistoryList entries={sessions} viewer="customer" />
      ) : (
        <EmptyState
          icon={History}
          title="No completed workouts yet"
          description="Once a trainer completes a session with you, the workout log and notes appear here."
        >
          <Button nativeButton={false} render={<Link href="/customer/book" />}>
            Book a session
          </Button>
        </EmptyState>
      )}
    </>
  );
}
