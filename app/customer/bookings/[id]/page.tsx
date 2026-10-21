import { CreditCard } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { PriceBreakdown } from "@/components/price-breakdown";
import { Button } from "@/components/ui/button";
import { BookingStatusBadge } from "@/features/booking/booking-status-badge";
import { BookingSummary } from "@/features/booking/booking-summary";
import { PaymentStatusBadge } from "@/features/booking/payment-status-badge";
import { requireRole } from "@/lib/auth";
import { getBookingForViewer } from "@/services/booking.service";
import { getBookingPayment } from "@/services/payment.service";

export const metadata: Metadata = { title: "Booking" };

export default async function BookingDetailPage({ params }: PageProps<"/customer/bookings/[id]">) {
  const user = await requireRole("customer");
  const { id } = await params;
  const booking = await getBookingForViewer(id, user).catch(() => null);

  if (!booking) {
    notFound();
  }

  const payment = booking.paymentStatus === "paid" ? await getBookingPayment(booking.id, user.id) : null;
  const payable = booking.status === "confirmed" && booking.paymentStatus !== "paid" && new Date(booking.endTime) > new Date();

  return (
    <>
      <PageHeader
        title="Booking details"
        breadcrumbs={[
          { label: "Customer", href: "/customer" },
          { label: "My bookings", href: "/customer/bookings" },
          { label: "Details" },
        ]}
        actions={
          payable && (
            <Button nativeButton={false} render={<Link href={`/customer/checkout/${booking.id}`} />}>
              <CreditCard aria-hidden />
              Pay now
            </Button>
          )
        }
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <BookingSummary
          mode={booking.mode}
          startTime={booking.startTime}
          serviceZone={booking.serviceZone}
          trainer={booking.trainer?.name ?? "Assigning trainer"}
          extra={[
            { label: "Booking ID", value: <span className="font-mono text-xs">{booking.id}</span> },
            { label: "Status", value: <BookingStatusBadge status={booking.status} /> },
            { label: "Payment", value: <PaymentStatusBadge status={booking.paymentStatus} /> },
          ]}
        />
        {payment && (
          <div className="space-y-3">
            <h2 className="text-sm font-medium text-muted-foreground">Payment</h2>
            <PriceBreakdown quote={payment.quote} />
            <p className="text-xs text-muted-foreground">
              Reference <span className="font-mono">{payment.providerReference}</span> · simulated payment
            </p>
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" nativeButton={false} render={<Link href="/customer/book" />}>
          Book another session
        </Button>
        <Button variant="ghost" nativeButton={false} render={<Link href="/customer/bookings" />}>
          All bookings
        </Button>
      </div>
    </>
  );
}
