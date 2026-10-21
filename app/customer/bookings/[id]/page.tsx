import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FormStatus } from "@/components/form-status";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { BookingStatusBadge } from "@/features/booking/booking-status-badge";
import { BookingSummary } from "@/features/booking/booking-summary";
import { requireRole } from "@/lib/auth";
import { getBookingForViewer } from "@/services/booking.service";

export const metadata: Metadata = { title: "Booking" };

export default async function BookingDetailPage({ params, searchParams }: PageProps<"/customer/bookings/[id]">) {
  const user = await requireRole("customer");
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const booking = await getBookingForViewer(id, user).catch(() => null);

  if (!booking) {
    notFound();
  }

  return (
    <>
      <PageHeader
        title="Booking details"
        breadcrumbs={[
          { label: "Customer", href: "/customer" },
          { label: "My bookings", href: "/customer/bookings" },
          { label: "Details" },
        ]}
      />
      {query.new === "1" && booking.status === "confirmed" && (
        <FormStatus success={`Booking confirmed with ${booking.trainer?.name ?? "your trainer"}. Your session is reserved.`} />
      )}
      <BookingSummary
        mode={booking.mode}
        startTime={booking.startTime}
        serviceZone={booking.serviceZone}
        trainer={booking.trainer?.name ?? "Assigning trainer"}
        extra={[
          { label: "Booking ID", value: <span className="font-mono text-xs">{booking.id}</span> },
          { label: "Status", value: <BookingStatusBadge status={booking.status} /> },
          { label: "Payment", value: <span className="capitalize">{booking.paymentStatus}</span> },
        ]}
      />
      <div className="flex flex-wrap gap-2">
        <Button nativeButton={false} render={<Link href="/customer/book" />}>
          Book another session
        </Button>
        <Button variant="outline" nativeButton={false} render={<Link href="/customer/bookings" />}>
          All bookings
        </Button>
      </div>
    </>
  );
}
