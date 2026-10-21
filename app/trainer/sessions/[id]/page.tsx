import { Lock } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BookingSummary } from "@/features/booking/booking-summary";
import { PaymentStatusBadge } from "@/features/booking/payment-status-badge";
import { SessionPanel } from "@/features/sessions/session-panel";
import { SessionStatusBadge } from "@/features/sessions/session-status-badge";
import { WorkoutForm } from "@/features/sessions/workout-form";
import { WorkoutSummary } from "@/features/sessions/workout-summary";
import { ProfileSnapshot } from "@/features/fitness/profile-snapshot";
import { HistoryList } from "@/features/sessions/history-list";
import { requireRole } from "@/lib/auth";
import { getSessionForViewer } from "@/services/session.service";

export const metadata: Metadata = { title: "Session" };

export default async function TrainerSessionPage({ params }: PageProps<"/trainer/sessions/[id]">) {
  const user = await requireRole("trainer");
  const { id } = await params;
  const session = await getSessionForViewer(id, user).catch(() => null);

  if (!session) {
    notFound();
  }

  return (
    <>
      <PageHeader
        title={`Session with ${session.customer.name}`}
        breadcrumbs={[
          { label: "Trainer", href: "/trainer" },
          { label: "Sessions", href: "/trainer/sessions" },
          { label: session.customer.name },
        ]}
        actions={<SessionStatusBadge status={session.status} />}
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <SessionPanel key={`${session.status}-${session.startedAt}`} session={session} viewer="trainer" />
          <BookingSummary
            mode={session.mode}
            startTime={session.scheduledStart}
            serviceZone={session.serviceZone}
            extra={[
              { label: "Customer", value: session.customer.name },
              { label: "Payment", value: <PaymentStatusBadge status={session.paymentStatus} /> },
            ]}
          />
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Workout log</CardTitle>
            <CardDescription>Exercises, notes and a suggestion for next time. The customer sees this after the session.</CardDescription>
          </CardHeader>
          <CardContent>
            {!session.record && <p className="text-sm text-muted-foreground">Start the session to log the workout.</p>}
            {session.record?.editable && <WorkoutForm sessionId={session.id} record={session.record} />}
            {session.record && !session.record.editable && (
              <div className="space-y-4">
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Lock className="size-3.5" aria-hidden />
                  Locked 24 hours after the session ended.
                </p>
                <WorkoutSummary record={session.record} />
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Customer profile</CardTitle>
            <CardDescription>Shared with you to plan this session. Personal details like age and weight stay private.</CardDescription>
          </CardHeader>
          <CardContent>
            {session.customerProfile ? (
              <ProfileSnapshot profile={session.customerProfile} />
            ) : (
              <p className="text-sm text-muted-foreground">This customer hasn&apos;t completed a fitness assessment yet.</p>
            )}
          </CardContent>
        </Card>
        <section aria-labelledby="previous" className="space-y-3">
          <h2 id="previous" className="text-sm font-medium text-muted-foreground">
            Previous sessions with you
          </h2>
          {session.previousSessions?.length ? (
            <HistoryList entries={session.previousSessions} viewer="trainer" />
          ) : (
            <p className="rounded-xl border border-dashed bg-card p-4 text-sm text-muted-foreground">
              This is your first session with {session.customer.name}.
            </p>
          )}
        </section>
      </div>
    </>
  );
}
