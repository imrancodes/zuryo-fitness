import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { BookingStatusBadge } from "@/features/booking/booking-status-badge";
import { PaymentStatusBadge } from "@/features/booking/payment-status-badge";
import { SessionStatusBadge } from "@/features/sessions/session-status-badge";
import { BOOKING_MODE_LABEL } from "@/lib/booking";
import { formatInr } from "@/lib/money";
import { formatDate, formatTime, TIME_ZONE_LABEL } from "@/lib/time";
import type { AdminBookingView, PersonContact } from "@/types/booking";

const shortId = (id: string) => `…${id.slice(-8)}`;
const detailHref = (id: string) => `/admin/bookings/${id}`;

function Person({ person, fallback }: { person: PersonContact | null; fallback: string }) {
  if (!person) {
    return <span className="text-muted-foreground">{fallback}</span>;
  }

  return (
    <span className="block min-w-0">
      <span className="block truncate font-medium">{person.name}</span>
      {person.email && <span className="block truncate text-xs text-muted-foreground">{person.email}</span>}
    </span>
  );
}

function Amount({ booking }: { booking: AdminBookingView }) {
  if (!booking.amounts) {
    return <span className="text-muted-foreground" aria-label="Not paid yet">—</span>;
  }

  const { sessionPrice, commissionAmount, totalAmount } = booking.amounts;
  return (
    <span className="block text-right">
      <span className="block font-medium tabular-nums">{formatInr(totalAmount)}</span>
      <span className="block text-xs whitespace-nowrap text-muted-foreground tabular-nums">
        {formatInr(sessionPrice)} + {formatInr(commissionAmount)}
      </span>
    </span>
  );
}

function When({ booking }: { booking: AdminBookingView }) {
  return (
    <span className="block whitespace-nowrap">
      <span className="block">{formatDate(booking.startTime)}</span>
      <span className="block text-xs text-muted-foreground">
        {formatTime(booking.startTime)} {TIME_ZONE_LABEL} · {booking.serviceZone}
      </span>
    </span>
  );
}

export function AdminBookingTable({ bookings }: { bookings: AdminBookingView[] }) {
  return (
    <>
      <div className="hidden overflow-x-auto rounded-xl border bg-card lg:block">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-secondary/50 text-xs text-muted-foreground">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">Booking</th>
              <th scope="col" className="px-4 py-3 font-medium">Customer</th>
              <th scope="col" className="px-4 py-3 font-medium">Trainer</th>
              <th scope="col" className="px-4 py-3 font-medium">Session</th>
              <th scope="col" className="px-4 py-3 font-medium">Status</th>
              <th scope="col" className="px-4 py-3 font-medium">Payment</th>
              <th scope="col" className="px-4 py-3 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {bookings.map((booking) => (
              <tr key={booking.id} className="relative align-top transition-colors hover:bg-secondary/60 has-focus-visible:bg-secondary/60">
                <td className="px-4 py-3">
                  <Link
                    href={detailHref(booking.id)}
                    title={booking.id}
                    className="font-mono text-xs font-medium outline-none after:absolute after:inset-0 hover:underline"
                    aria-label={`View booking ${booking.id}`}
                  >
                    {shortId(booking.id)}
                  </Link>
                  <Badge variant="secondary" className="mt-1.5 flex">
                    {BOOKING_MODE_LABEL[booking.mode]}
                  </Badge>
                </td>
                <td className="max-w-44 px-4 py-3">
                  <Person person={booking.customer} fallback="Unknown" />
                </td>
                <td className="max-w-44 px-4 py-3">
                  <Person person={booking.trainer} fallback="Unassigned" />
                </td>
                <td className="px-4 py-3">
                  <When booking={booking} />
                </td>
                <td className="px-4 py-3">
                  <span className="flex flex-col gap-1">
                    <BookingStatusBadge status={booking.status} />
                    <SessionStatusBadge status={booking.sessionStatus} />
                  </span>
                </td>
                <td className="px-4 py-3">
                  <PaymentStatusBadge status={booking.paymentStatus} />
                </td>
                <td className="px-4 py-3">
                  <Amount booking={booking} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="divide-y overflow-hidden rounded-xl border bg-card lg:hidden">
        {bookings.map((booking) => (
          <li key={booking.id}>
            <Link
              href={detailHref(booking.id)}
              className="flex items-start gap-3 px-4 py-3 text-sm outline-none transition-colors hover:bg-secondary focus-visible:bg-secondary"
            >
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-medium">{shortId(booking.id)}</span>
                  <Badge variant="secondary">{BOOKING_MODE_LABEL[booking.mode]}</Badge>
                  <BookingStatusBadge status={booking.status} />
                  <SessionStatusBadge status={booking.sessionStatus} />
                  <PaymentStatusBadge status={booking.paymentStatus} />
                </div>
                <When booking={booking} />
                <dl className="grid grid-cols-2 gap-3">
                  <div className="min-w-0">
                    <dt className="text-xs text-muted-foreground">Customer</dt>
                    <dd>
                      <Person person={booking.customer} fallback="Unknown" />
                    </dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-xs text-muted-foreground">Trainer</dt>
                    <dd>
                      <Person person={booking.trainer} fallback="Unassigned" />
                    </dd>
                  </div>
                </dl>
              </div>
              <div className="flex items-center gap-2">
                <Amount booking={booking} />
                <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
