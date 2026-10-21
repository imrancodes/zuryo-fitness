import { CalendarCheck, CalendarPlus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookingList } from "@/features/booking/booking-list";
import { PackageSummary } from "@/features/packages/package-summary";
import { AiRecommendationCard } from "@/features/recommendations/ai-recommendation-card";
import { requireRole } from "@/lib/auth";
import { listUpcomingBookings } from "@/services/booking.service";
import { getPackageSummary } from "@/services/package.service";

export const metadata: Metadata = { title: "Customer" };

const bookButton = (
  <Button nativeButton={false} render={<Link href="/customer/book" />}>
    <CalendarPlus aria-hidden />
    Book a session
  </Button>
);

export default async function CustomerHomePage() {
  const user = await requireRole("customer");
  const [bookings, packages] = await Promise.all([
    listUpcomingBookings({ customerId: user.id }),
    getPackageSummary(user.id),
  ]);

  return (
    <>
      <PageHeader
        title="Your training hub"
        description="Book sessions, track your packages and follow your progress, all in one place."
        breadcrumbs={[{ label: "Customer", href: "/customer" }, { label: "Overview" }]}
        actions={bookButton}
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section aria-labelledby="upcoming" className="space-y-3">
          <h2 id="upcoming" className="text-sm font-medium text-muted-foreground">
            Upcoming sessions
          </h2>
          {bookings.length > 0 ? (
            <BookingList bookings={bookings} />
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
        <Card className="self-start">
          <CardHeader className="flex items-center justify-between">
            <CardTitle>Session credits</CardTitle>
            <Link href="/customer/packages" className="text-sm font-medium text-brand underline-offset-4 hover:underline">
              Details
            </Link>
          </CardHeader>
          <CardContent>
            <PackageSummary summary={packages} />
          </CardContent>
        </Card>
      </div>
      <section aria-labelledby="suggested" className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 id="suggested" className="text-sm font-medium text-muted-foreground">
            Suggested for you
          </h2>
          <Link href="/customer/progress" className="text-sm font-medium text-brand underline-offset-4 hover:underline">
            View progress
          </Link>
        </div>
        <AiRecommendationCard />
      </section>
    </>
  );
}
