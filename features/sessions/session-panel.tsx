"use client";

import { CalendarX, CircleCheck, Loader2, Play, TimerReset } from "lucide-react";
import type { ReactNode } from "react";
import { FormStatus } from "@/components/form-status";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SessionTimer } from "@/features/sessions/session-timer";
import { useApiMutation } from "@/hooks/use-api-mutation";
import { formatDateTime, formatTime, TIME_ZONE_LABEL } from "@/lib/time";
import type { SessionView } from "@/types/session";

type SessionPanelProps = {
  session: SessionView;
  viewer: "trainer" | "customer";
};

function PanelCard({ icon, title, description, children }: { icon: ReactNode; title: string; description: string; children?: ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      {children && <CardContent className="space-y-4">{children}</CardContent>}
    </Card>
  );
}

export function SessionPanel({ session, viewer }: SessionPanelProps) {
  const { pending, error, run } = useApiMutation();
  const windowLabel = `${formatTime(session.startWindow.opensAt)} – ${formatTime(session.startWindow.closesAt)} ${TIME_ZONE_LABEL}`;

  if (session.status === "in_progress" && session.startedAt && session.endsAt) {
    return (
      <PanelCard
        icon={<TimerReset className="size-4 text-brand" aria-hidden />}
        title="Session in progress"
        description={`Started at ${formatTime(session.startedAt)} ${TIME_ZONE_LABEL}. The timer runs on the server and completes automatically at 60 minutes.`}
      >
        <SessionTimer
          sessionId={session.id}
          startedAt={session.startedAt}
          endsAt={session.endsAt}
          serverNow={session.serverNow}
          completeOnExpiry={viewer === "trainer"}
        />
      </PanelCard>
    );
  }

  if (session.status === "completed") {
    return (
      <PanelCard
        icon={<CircleCheck className="size-4 text-brand" aria-hidden />}
        title="Session completed"
        description={`${session.durationMinutes}-minute session`}
      >
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Started</dt>
            <dd className="font-medium">{session.startedAt ? `${formatDateTime(session.startedAt)} ${TIME_ZONE_LABEL}` : "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Completed</dt>
            <dd className="font-medium">{session.completedAt ? `${formatDateTime(session.completedAt)} ${TIME_ZONE_LABEL}` : "—"}</dd>
          </div>
        </dl>
      </PanelCard>
    );
  }

  if (session.status === "missed" || session.status === "cancelled") {
    return (
      <PanelCard
        icon={<CalendarX className="size-4 text-destructive" aria-hidden />}
        title={session.status === "missed" ? "Session missed" : "Booking cancelled"}
        description={
          session.status === "missed"
            ? `The start window (${windowLabel}) closed without the session being started.`
            : "This booking was cancelled, so the session won't take place."
        }
      />
    );
  }

  if (viewer === "customer") {
    return (
      <PanelCard
        icon={<Play className="size-4 text-brand" aria-hidden />}
        title="Upcoming session"
        description={`Your trainer starts the session when they arrive. It can begin between ${windowLabel}.`}
      />
    );
  }

  return (
    <PanelCard
      icon={<Play className="size-4 text-brand" aria-hidden />}
      title="Ready to start"
      description={`You can start this session between ${windowLabel}.`}
    >
      <FormStatus error={error ?? session.startBlockedReason} />
      <Button size="lg" className="h-10 w-full sm:w-auto" disabled={!session.canStart || pending} onClick={() => run(`/api/sessions/${session.id}/start`, "POST")}>
        {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Play aria-hidden />}
        {pending ? "Starting…" : "Start session"}
      </Button>
    </PanelCard>
  );
}
