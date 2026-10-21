import { ChevronRight, MapPin } from "lucide-react";
import Link from "next/link";
import { InitialsAvatar } from "@/components/initials-avatar";
import { BookingStatusBadge } from "@/features/booking/booking-status-badge";
import { PaymentStatusBadge } from "@/features/booking/payment-status-badge";
import { formatDate, formatTime, TIME_ZONE_LABEL } from "@/lib/time";
import type { BookingView } from "@/types/booking";

type BookingListProps = {
  bookings: BookingView[];
  perspective: "customer" | "trainer";
  hrefFor?: (id: string) => string;
};

export function BookingList({ bookings, perspective, hrefFor }: BookingListProps) {
  return (
    <ul className="divide-y overflow-hidden rounded-xl border bg-card">
      {bookings.map((booking) => {
        const person = perspective === "customer" ? booking.trainer?.name ?? "Assigning trainer" : booking.customer.name;
        const content = (
          <>
            <InitialsAvatar name={person} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{person}</p>
              <p className="flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
                <span>
                  {formatDate(booking.startTime)} · {formatTime(booking.startTime)} {TIME_ZONE_LABEL}
                </span>
                <span className="inline-flex items-center gap-1">
                  <MapPin className="size-3.5" aria-hidden />
                  {booking.serviceZone}
                </span>
              </p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <BookingStatusBadge status={booking.status} />
              {perspective === "customer" && <PaymentStatusBadge status={booking.paymentStatus} />}
            </div>
          </>
        );

        return (
          <li key={booking.id}>
            {hrefFor ? (
              <Link
                href={hrefFor(booking.id)}
                className="flex items-center gap-3 px-4 py-3 outline-none transition-colors hover:bg-secondary focus-visible:bg-secondary"
              >
                {content}
                <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
              </Link>
            ) : (
              <div className="flex items-center gap-3 px-4 py-3">{content}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
