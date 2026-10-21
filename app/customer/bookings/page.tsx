import { CalendarCheck, CalendarPlus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { BookingList } from "@/features/booking/booking-list";
import { requireRole } from "@/lib/auth";
import { listCustomerBookings } from "@/services/booking.service";

export const metadata: Metadata = { title: "My bookings" };

export default async function MyBookingsPage() {
  const user = await requireRole("customer");
  const bookings = await listCustomerBookings(user.id);

  return (
    <>
      <PageHeader
        title="My bookings"
        description="All your sessions, newest first."
        breadcrumbs={[{ label: "Customer", href: "/customer" }, { label: "My bookings" }]}
      />
      {bookings.length > 0 ? (
        <BookingList bookings={bookings} perspective="customer" hrefFor={(id) => `/customer/bookings/${id}`} />
      ) : (
        <EmptyState icon={CalendarCheck} title="No bookings yet" description="Your booked sessions will appear here.">
          <Button nativeButton={false} render={<Link href="/customer/book" />}>
            <CalendarPlus aria-hidden />
            Book a session
          </Button>
        </EmptyState>
      )}
    </>
  );
}
