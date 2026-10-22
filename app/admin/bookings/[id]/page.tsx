import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { PageHeader } from "@/components/page-header";
import { PriceBreakdown } from "@/components/price-breakdown";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PaymentAttempts } from "@/features/admin-bookings/payment-attempts";
import { BookingStatusBadge } from "@/features/booking/booking-status-badge";
import { BookingSummary } from "@/features/booking/booking-summary";
import { PaymentStatusBadge } from "@/features/booking/payment-status-badge";
import { SessionStatusBadge } from "@/features/sessions/session-status-badge";
import { requireRole } from "@/lib/auth";
import { ServiceError } from "@/lib/errors";
import { formatDateTime, formatTime, TIME_ZONE_LABEL } from "@/lib/time";
import { getAdminBookingDetail } from "@/services/booking.service";
import type { PersonContact } from "@/types/booking";

export const metadata: Metadata = { title: "Booking details" };

function Contact({ person, fallback }: { person: PersonContact | null; fallback: string }) {
  if (!person) {
    return <span className="text-muted-foreground">{fallback}</span>;
  }

  return (
    <span className="block">
      {person.name}
      {person.email && <span className="block text-xs font-normal text-muted-foreground">{person.email}</span>}
    </span>
  );
}

const stamp = (value: string | null) => (value ? `${formatDateTime(value)} ${TIME_ZONE_LABEL}` : "—");

function Rows({ rows }: { rows: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="divide-y text-sm">
      {rows.map(({ label, value }) => (
        <div key={label} className="flex items-center justify-between gap-4 py-2.5 first:pt-0 last:pb-0">
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="text-right font-medium">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export default async function AdminBookingDetailPage({ params }: PageProps<"/admin/bookings/[id]">) {
  const admin = await requireRole("admin");
  const { id } = await params;
  const detail = await getAdminBookingDetail(id, admin).catch((error: unknown) => {
    if (error instanceof ServiceError && error.status === 404) {
      return null;
    }
    throw error;
  });

  if (!detail) {
    notFound();
  }

  const { booking, payments, session } = detail;
  const paid = payments.find((payment) => payment.status === "paid");

  return (
    <>
      <PageHeader
        title="Booking details"
        breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Bookings", href: "/admin/bookings" }, { label: "Details" }]}
        actions={
          <Button variant="ghost" nativeButton={false} render={<Link href="/admin/bookings" />}>
            <ArrowLeft aria-hidden />
            Back to bookings
          </Button>
        }
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="booking-heading" className="space-y-3">
          <h2 id="booking-heading" className="text-sm font-medium text-muted-foreground">
            Booking and assignment
          </h2>
          <BookingSummary
            mode={booking.mode}
            startTime={booking.startTime}
            serviceZone={booking.serviceZone}
            trainer={<Contact person={booking.trainer} fallback="Unassigned" />}
            extra={[
              { label: "Booking ID", value: <span className="font-mono text-xs break-all">{booking.id}</span> },
              { label: "Booking", value: <BookingStatusBadge status={booking.status} /> },
              { label: "Payment", value: <PaymentStatusBadge status={booking.paymentStatus} /> },
              { label: "Customer", value: <Contact person={booking.customer} fallback="Unknown" /> },
              { label: "Booked and assigned", value: stamp(booking.createdAt) },
            ]}
          />
        </section>
        <div className="space-y-6">
          <Card>
            <CardHeader className="flex items-center justify-between gap-2">
              <CardTitle>Session</CardTitle>
              <SessionStatusBadge status={session.status} />
            </CardHeader>
            <CardContent>
              <Rows
                rows={[
                  {
                    label: "Start window",
                    value: `${formatTime(session.startWindow.opensAt)} – ${formatTime(session.startWindow.closesAt)} ${TIME_ZONE_LABEL}`,
                  },
                  { label: "Started", value: session.startedAt ? stamp(session.startedAt) : "Not started" },
                  { label: "Ends", value: stamp(session.endsAt) },
                  { label: "Completed", value: stamp(session.completedAt) },
                  { label: "Duration", value: `${session.durationMinutes} minutes` },
                ]}
              />
            </CardContent>
          </Card>
          <section aria-labelledby="payment-heading" className="space-y-3">
            <h2 id="payment-heading" className="text-sm font-medium text-muted-foreground">
              Price breakdown
            </h2>
            {paid ? (
              <PriceBreakdown quote={paid.quote} />
            ) : (
              <p className="rounded-xl border border-dashed bg-card p-4 text-sm text-muted-foreground">
                Not paid yet. The price is locked when the customer starts checkout.
              </p>
            )}
          </section>
          <section aria-labelledby="attempts-heading" className="space-y-3">
            <h2 id="attempts-heading" className="text-sm font-medium text-muted-foreground">
              Checkout attempts
            </h2>
            <PaymentAttempts payments={payments} />
          </section>
        </div>
      </div>
    </>
  );
}
