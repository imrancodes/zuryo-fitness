import { CalendarCheck, CalendarPlus, HeartPulse, Package } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ComingSoonGrid, type ComingSoonItem } from "@/components/coming-soon-grid";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { BookingList } from "@/features/booking/booking-list";
import { requireRole } from "@/lib/auth";
import { listUpcomingBookings } from "@/services/booking.service";

export const metadata: Metadata = { title: "Customer" };

const UPCOMING: ComingSoonItem[] = [
  { icon: Package, title: "Session packages", description: "Buy packs of sessions and track what's left." },
  { icon: HeartPulse, title: "Fitness profile", description: "Share your goals so trainers can plan your workouts." },
];

const bookButton = (
  <Button nativeButton={false} render={<Link href="/customer/book" />}>
    <CalendarPlus aria-hidden />
    Book a session
  </Button>
);

export default async function CustomerHomePage() {
  const user = await requireRole("customer");
  const bookings = await listUpcomingBookings({ customerId: user.id });

  return (
    <>
      <PageHeader
        title="Your training hub"
        description="Book sessions, manage packages and follow your progress, all in one place."
        breadcrumbs={[{ label: "Customer", href: "/customer" }, { label: "Overview" }]}
        actions={bookings.length > 0 && bookButton}
      />
      <section aria-labelledby="upcoming" className="space-y-3">
        <h2 id="upcoming" className="text-sm font-medium text-muted-foreground">
          Upcoming sessions
        </h2>
        {bookings.length > 0 ? (
          <BookingList bookings={bookings} perspective="customer" hrefFor={(id) => `/customer/bookings/${id}`} />
        ) : (
          <EmptyState
            icon={CalendarCheck}
            title="No upcoming sessions"
            description="Book an instant session within the hour or schedule one with a certified trainer in your zone."
          >
            {bookButton}
          </EmptyState>
        )}
      </section>
      <ComingSoonGrid items={UPCOMING} />
    </>
  );
}
