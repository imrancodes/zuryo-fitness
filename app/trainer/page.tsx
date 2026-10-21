import { BicepsFlexed, CalendarClock, ClipboardList, TrendingUp, Wallet } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ComingSoonGrid, type ComingSoonItem } from "@/components/coming-soon-grid";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { BookingList } from "@/features/booking/booking-list";
import { requireRole } from "@/lib/auth";
import { listUpcomingBookings } from "@/services/booking.service";

export const metadata: Metadata = { title: "Trainer" };

const UPCOMING: ComingSoonItem[] = [
  { icon: ClipboardList, title: "Session logs", description: "Record exercises, notes and next-workout suggestions." },
  { icon: Wallet, title: "Earnings", description: "See completed sessions and your payouts." },
  { icon: TrendingUp, title: "Client progress", description: "Follow how your regular clients are improving." },
];

const availabilityButton = (
  <Button variant="outline" nativeButton={false} render={<Link href="/trainer/availability" />}>
    <CalendarClock aria-hidden />
    Manage availability
  </Button>
);

export default async function TrainerHomePage() {
  const user = await requireRole("trainer");
  const bookings = await listUpcomingBookings({ trainerId: user.id });

  return (
    <>
      <PageHeader
        title="Trainer workspace"
        description="Your upcoming sessions and schedule at a glance."
        breadcrumbs={[{ label: "Trainer", href: "/trainer" }, { label: "Overview" }]}
        actions={availabilityButton}
      />
      <section aria-labelledby="upcoming" className="space-y-3">
        <h2 id="upcoming" className="text-sm font-medium text-muted-foreground">
          Upcoming sessions
        </h2>
        {bookings.length > 0 ? (
          <BookingList bookings={bookings} perspective="trainer" />
        ) : (
          <EmptyState
            icon={BicepsFlexed}
            title="No upcoming sessions"
            description="Add availability in your service zones so customers can book you."
          >
            {availabilityButton}
          </EmptyState>
        )}
      </section>
      <ComingSoonGrid items={UPCOMING} />
    </>
  );
}
