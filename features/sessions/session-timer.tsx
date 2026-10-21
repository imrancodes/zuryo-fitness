"use client";

import { Loader2, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { requestJson } from "@/lib/request";
import { clockOffset, correctedNow, remainingSeconds, timerPhase } from "@/lib/session-timer";
import { formatTime, TIME_ZONE_LABEL } from "@/lib/time";
import { cn } from "@/lib/utils";
import type { SessionView } from "@/types/session";

const SYNC_INTERVAL_MS = 30_000;

type SessionTimerProps = {
  sessionId: string;
  startedAt: string;
  endsAt: string;
  serverNow: string;
  completeOnExpiry: boolean;
};

function formatCountdown(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

export function SessionTimer({ sessionId, startedAt, endsAt, serverNow, completeOnExpiry }: SessionTimerProps) {
  const router = useRouter();
  const offset = useRef(0);
  const expired = useRef(false);
  const [now, setNow] = useState(() => new Date(serverNow));

  useEffect(() => {
    offset.current = clockOffset(serverNow, Date.now());
    expired.current = false;

    async function expire() {
      if (completeOnExpiry) {
        await requestJson(`/api/sessions/${sessionId}/complete`, { method: "POST" });
      }
      router.refresh();
    }

    const interval = setInterval(() => {
      const current = correctedNow(offset.current, Date.now());
      setNow(current);

      if (remainingSeconds(new Date(endsAt), current) === 0 && !expired.current) {
        expired.current = true;
        void expire();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [serverNow, endsAt, sessionId, completeOnExpiry, router]);

  useEffect(() => {
    async function sync() {
      const result = await requestJson<{ session: SessionView }>(`/api/sessions/${sessionId}`);
      if (!result.ok) {
        return;
      }
      offset.current = clockOffset(result.data.session.serverNow, Date.now());
      if (result.data.session.status !== "in_progress") {
        router.refresh();
      }
    }

    function onVisibilityChange() {
      if (document.visibilityState === "visible") {
        void sync();
      }
    }

    const interval = setInterval(sync, SYNC_INTERVAL_MS);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [sessionId, router]);

  const remaining = remainingSeconds(new Date(endsAt), now);
  const phase = timerPhase(remaining);
  const totalSeconds = (new Date(endsAt).getTime() - new Date(startedAt).getTime()) / 1000;
  const progress = Math.min(100, ((totalSeconds - remaining) / totalSeconds) * 100);

  return (
    <div className="space-y-4">
      <div>
        <p className="text-5xl font-semibold tracking-tight tabular-nums" role="timer" aria-label={`${formatCountdown(remaining)} remaining`}>
          {formatCountdown(remaining)}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Remaining · ends at {formatTime(endsAt)} {TIME_ZONE_LABEL}
        </p>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-secondary" aria-hidden>
        <div
          className={cn("h-full rounded-full transition-[width] duration-1000", phase === "warning" ? "bg-amber-500" : "bg-brand")}
          style={{ width: `${progress}%` }}
        />
      </div>
      {phase === "warning" && (
        <div role="alert" className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          Five minutes left. Start wrapping up and log the workout.
        </div>
      )}
      {phase === "ended" && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          Time is up. Completing the session…
        </p>
      )}
    </div>
  );
}
