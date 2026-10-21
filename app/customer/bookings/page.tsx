import { CalendarCheck, CalendarPlus, Info } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { FilterTabs } from "@/components/filter-tabs";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { BookingList } from "@/features/booking/booking-list";
import { requireRole } from "@/lib/auth";
import { listCustomerBookings } from "@/services/booking.service";
import { bookingListQuerySchema, type BookingFilter } from "@/validators/booking";

export const metadata: Metadata = { title: "My bookings" };

const TABS: { filter: BookingFilter; label: string; empty: string }[] = [
  { filter: "all", label: "All", empty: "Your booked sessions will appear here." },
  { filter: "upcoming", label: "Upcoming", empty: "No upcoming sessions. Book one to get started." },
  { filter: "in_progress", label: "In progress", empty: "No session is running right now." },
  { filter: "completed", label: "Completed", empty: "Completed sessions will appear here." },
  { filter: "cancelled", label: "Cancelled", empty: "You have no cancelled bookings." },
];

export default async function MyBookingsPage({ searchParams }: PageProps<"/customer/bookings">) {
  const user = await requireRole("customer");
  const query = bookingListQuerySchema.safeParse(await searchParams);
  const filter = query.success ? query.data.status : "all";
  const bookings = await listCustomerBookings(user.id, filter);
  const active = TABS.find((tab) => tab.filter === filter) ?? TABS[0];

  return (
    <>
      <PageHeader
        title="My bookings"
        description="Every booking with its session and payment status."
        breadcrumbs={[{ label: "Customer", href: "/customer" }, { label: "My bookings" }]}
      />
      <FilterTabs
        label="Filter bookings"
        tabs={TABS.map((tab) => ({ label: tab.label, href: `/customer/bookings?status=${tab.filter}`, active: tab.filter === filter }))}
      />
      {bookings.length > 0 ? (
        <BookingList bookings={bookings} />
      ) : (
        <EmptyState icon={CalendarCheck} title={`No ${active.label.toLowerCase()} bookings`} description={active.empty}>
          <Button nativeButton={false} render={<Link href="/customer/book" />}>
            <CalendarPlus aria-hidden />
            Book a session
          </Button>
        </EmptyState>
      )}
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Info className="size-3.5" aria-hidden />
        Cancelling and rescheduling aren&apos;t available in the app yet. Contact the Zuryo team for changes.
      </p>
    </>
  );
}
