import { ChevronRight, Clock3, MapPin } from "lucide-react";
import Link from "next/link";
import { InitialsAvatar } from "@/components/initials-avatar";
import { PaymentStatusBadge } from "@/features/booking/payment-status-badge";
import { SessionStatusBadge } from "@/features/sessions/session-status-badge";
import { SESSION_MINUTES } from "@/lib/booking";
import { formatDate, formatTime, TIME_ZONE_LABEL } from "@/lib/time";
import type { BookingView } from "@/types/booking";

export function BookingList({ bookings }: { bookings: BookingView[] }) {
  return (
    <ul className="divide-y overflow-hidden rounded-xl border bg-card">
      {bookings.map((booking) => {
        const trainer = booking.trainer?.name ?? "Assigning trainer";

        return (
          <li key={booking.id}>
            <Link
              href={`/customer/bookings/${booking.id}`}
              className="flex items-center gap-3 px-4 py-3 outline-none transition-colors hover:bg-secondary focus-visible:bg-secondary"
            >
              <InitialsAvatar name={trainer} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{trainer}</p>
                <p className="flex flex-wrap items-center gap-x-3 text-sm text-muted-foreground">
                  <span>
                    {formatDate(booking.startTime)} · {formatTime(booking.startTime)} {TIME_ZONE_LABEL}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="size-3.5" aria-hidden />
                    {booking.serviceZone}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Clock3 className="size-3.5" aria-hidden />
                    {SESSION_MINUTES} min
                  </span>
                  <span className="capitalize">Booking {booking.status}</span>
                </p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <SessionStatusBadge status={booking.sessionStatus} />
                <PaymentStatusBadge status={booking.paymentStatus} />
              </div>
              <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
