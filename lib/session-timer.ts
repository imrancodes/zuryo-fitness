import { SESSION_MINUTES, type BookingStatus } from "@/lib/booking";
import { addMinutes, formatTime, TIME_ZONE_LABEL } from "@/lib/time";

export const SESSION_STATUSES = ["scheduled", "in_progress", "completed", "missed", "cancelled"] as const;
export type SessionStatus = (typeof SESSION_STATUSES)[number];

export const SESSION_STATUS_LABEL: Record<SessionStatus, string> = {
  scheduled: "Scheduled",
  in_progress: "In progress",
  completed: "Completed",
  missed: "Missed",
  cancelled: "Cancelled",
};

export const START_EARLY_MINUTES = 15;
export const START_LATE_MINUTES = 30;
export const WARNING_SECONDS = 5 * 60;
export const RECORD_EDIT_HOURS = 24;

export type TimerPhase = "running" | "warning" | "ended";

type RecordState = { status: string; endsAt: Date; completedAt?: Date | null } | null;

export function startWindow(scheduledStart: Date) {
  return {
    opensAt: addMinutes(scheduledStart, -START_EARLY_MINUTES),
    closesAt: addMinutes(scheduledStart, START_LATE_MINUTES),
  };
}

export function startWindowError(scheduledStart: Date, now: Date) {
  const { opensAt, closesAt } = startWindow(scheduledStart);

  if (now < opensAt) {
    return `This session can be started from ${formatTime(opensAt)} ${TIME_ZONE_LABEL}.`;
  }
  if (now > closesAt) {
    return `The start window closed at ${formatTime(closesAt)} ${TIME_ZONE_LABEL}.`;
  }
  return null;
}

export function sessionEndsAt(startedAt: Date) {
  return addMinutes(startedAt, SESSION_MINUTES);
}

export function remainingSeconds(endsAt: Date, now: Date) {
  return Math.max(0, Math.ceil((endsAt.getTime() - now.getTime()) / 1000));
}

export function timerPhase(remaining: number): TimerPhase {
  if (remaining <= 0) {
    return "ended";
  }
  return remaining <= WARNING_SECONDS ? "warning" : "running";
}

export function clockOffset(serverNow: Date | string, clientNow: number) {
  return new Date(serverNow).getTime() - clientNow;
}

export function correctedNow(offset: number, clientNow: number) {
  return new Date(clientNow + offset);
}

export function recordEditableUntil(record: RecordState) {
  if (!record) {
    return null;
  }
  const completedAt = record.completedAt ?? (record.status === "completed" ? record.endsAt : null);
  return completedAt ? addMinutes(completedAt, RECORD_EDIT_HOURS * 60) : null;
}

export function isRecordEditable(record: RecordState, now: Date) {
  if (!record) {
    return false;
  }
  const until = recordEditableUntil(record);
  return until === null || now <= until;
}

export function deriveSessionStatus(bookingStatus: BookingStatus, record: RecordState, scheduledStart: Date, now: Date): SessionStatus {
  if (bookingStatus === "cancelled") {
    return "cancelled";
  }
  if (record) {
    return record.status === "completed" || record.endsAt <= now ? "completed" : "in_progress";
  }
  if (bookingStatus === "completed") {
    return "completed";
  }
  return now > startWindow(scheduledStart).closesAt ? "missed" : "scheduled";
}
