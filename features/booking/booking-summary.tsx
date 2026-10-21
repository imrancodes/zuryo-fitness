import type { ReactNode } from "react";
import { BOOKING_MODE_LABEL, SESSION_MINUTES, type BookingMode } from "@/lib/booking";
import { addMinutes, formatDate, formatTime, TIME_ZONE_LABEL } from "@/lib/time";

type BookingSummaryProps = {
  mode: BookingMode;
  startTime: string;
  serviceZone: string;
  trainer?: ReactNode;
  extra?: { label: string; value: ReactNode }[];
};

export function BookingSummary({ mode, startTime, serviceZone, trainer, extra = [] }: BookingSummaryProps) {
  const endTime = addMinutes(new Date(startTime), SESSION_MINUTES);
  const rows = [
    ...extra,
    { label: "Booking type", value: BOOKING_MODE_LABEL[mode] },
    { label: "Date", value: formatDate(startTime) },
    { label: "Time", value: `${formatTime(startTime)} – ${formatTime(endTime)} ${TIME_ZONE_LABEL}` },
    { label: "Duration", value: `${SESSION_MINUTES} minutes` },
    { label: "Service zone", value: serviceZone },
    ...(trainer === undefined ? [] : [{ label: "Trainer", value: trainer }]),
  ];

  return (
    <dl className="divide-y rounded-xl border bg-card">
      {rows.map(({ label, value }) => (
        <div key={label} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="text-right font-medium">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
