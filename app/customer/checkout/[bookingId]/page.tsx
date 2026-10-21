import { CircleAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EmptyState } from "@/components/empty-state";
import { FormStatus } from "@/components/form-status";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { CheckoutFlow } from "@/features/checkout/checkout-flow";
import { requireRole } from "@/lib/auth";
import { ServiceError } from "@/lib/errors";
import { getBookingForViewer } from "@/services/booking.service";
import { getBookingPayment, getOpenCheckout } from "@/services/payment.service";
import { quoteBooking } from "@/services/pricing.service";

export const metadata: Metadata = { title: "Checkout" };

async function loadQuote(bookingId: string, customerId: string) {
  try {
    return { quote: (await quoteBooking(bookingId, customerId)).quote, problem: null };
  } catch (error) {
    if (error instanceof ServiceError) {
      return { quote: null, problem: error.message };
    }
    throw error;
  }
}

export default async function CheckoutPage({ params, searchParams }: PageProps<"/customer/checkout/[bookingId]">) {
  const user = await requireRole("customer");
  const [{ bookingId }, query] = await Promise.all([params, searchParams]);
  const booking = await getBookingForViewer(bookingId, user).catch(() => null);

  if (!booking) {
    notFound();
  }

  const paid = booking.paymentStatus === "paid" ? await getBookingPayment(booking.id, user.id) : null;
  const { quote, problem } = paid ? { quote: null, problem: null } : await loadQuote(booking.id, user.id);
  const openPayment = quote ? await getOpenCheckout(booking.id, user.id) : null;

  return (
    <>
      <PageHeader
        title="Checkout"
        description="Review your session, see the server-calculated price and complete a simulated payment."
        breadcrumbs={[
          { label: "Customer", href: "/customer" },
          { label: "My bookings", href: "/customer/bookings" },
          { label: "Checkout" },
        ]}
      />
      {query.new === "1" && !paid && (
        <FormStatus success={`Booking confirmed with ${booking.trainer?.name ?? "your trainer"}. Complete payment to finish.`} />
      )}
      {problem ? (
        <EmptyState icon={CircleAlert} title="Checkout isn't available" description={problem}>
          <Button variant="outline" nativeButton={false} render={<Link href={`/customer/bookings/${booking.id}`} />}>
            View booking
          </Button>
        </EmptyState>
      ) : (
        <CheckoutFlow key={booking.paymentStatus} booking={booking} quote={quote} initialPayment={paid ?? openPayment} />
      )}
    </>
  );
}
