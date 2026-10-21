import { addMinutes, dayBoundsUtc, MINUTE_MS } from "@/lib/time";

export const BOOKING_MODES = ["instant", "scheduled"] as const;
export const BOOKING_STATUSES = ["pending", "confirmed", "cancelled", "completed"] as const;
export const ACTIVE_BOOKING_STATUSES = ["pending", "confirmed"] as const;
export const PAYMENT_STATUSES = ["unpaid", "paid", "failed", "refunded"] as const;

export type BookingMode = (typeof BOOKING_MODES)[number];
export type BookingStatus = (typeof BOOKING_STATUSES)[number];
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const SESSION_MINUTES = 60;
export const INSTANT_WINDOW_MINUTES = 60;
export const SLOT_ALIGN_MINUTES = 15;
export const SCHEDULED_STEP_MINUTES = 30;
export const MAX_DAYS_AHEAD = 30;

export const BOOKING_MODE_LABEL: Record<BookingMode, string> = {
  instant: "Instant",
  scheduled: "Scheduled",
};

export function startTimeError(mode: BookingMode, start: Date, now: Date) {
  const instantLimit = addMinutes(now, INSTANT_WINDOW_MINUTES);

  if (start.getTime() % (SLOT_ALIGN_MINUTES * MINUTE_MS) !== 0) {
    return "Sessions start on 15-minute marks.";
  }
  if (start <= now) {
    return "This time has already passed. Choose a future time.";
  }
  if (mode === "instant" && start > instantLimit) {
    return "Instant sessions must start within the next 60 minutes. Use scheduled booking for later times.";
  }
  if (mode === "scheduled" && start < instantLimit) {
    return "Scheduled sessions must start at least 60 minutes from now. Use instant booking for sooner sessions.";
  }
  if (start > addMinutes(now, MAX_DAYS_AHEAD * 24 * 60)) {
    return "Sessions can be booked up to 30 days ahead.";
  }
  return null;
}

export function candidateStarts(mode: BookingMode, date: string | undefined, now: Date) {
  const step = (mode === "instant" ? SLOT_ALIGN_MINUTES : SCHEDULED_STEP_MINUTES) * MINUTE_MS;
  const day = mode === "scheduled" && date ? dayBoundsUtc(date) : null;
  const from = day ? day.start.getTime() : now.getTime();
  const to = day ? day.end.getTime() - 1 : addMinutes(now, INSTANT_WINDOW_MINUTES).getTime();
  const starts: Date[] = [];

  for (let time = Math.ceil(from / step) * step; time <= to; time += step) {
    const start = new Date(time);
    if (!startTimeError(mode, start, now)) {
      starts.push(start);
    }
  }

  return starts;
}
