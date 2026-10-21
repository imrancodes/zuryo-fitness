import { CalendarCheck, HeartPulse, MapPin, Package } from "lucide-react";
import type { Metadata } from "next";
import { ComingSoonGrid, type ComingSoonItem } from "@/components/coming-soon-grid";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Customer" };

const UPCOMING: ComingSoonItem[] = [
  { icon: MapPin, title: "Trainers near you", description: "Match with certified trainers who serve your area." },
  { icon: Package, title: "Session packages", description: "Buy packs of sessions and track what's left." },
  { icon: HeartPulse, title: "Fitness profile", description: "Share your goals so trainers can plan your workouts." },
];

export default function CustomerHomePage() {
  return (
    <>
      <PageHeader
        title="Your training hub"
        description="Book sessions, manage packages and follow your progress, all in one place."
        breadcrumbs={[{ label: "Customer", href: "/customer" }, { label: "Overview" }]}
      />
      <EmptyState
        icon={CalendarCheck}
        title="No sessions booked yet"
        description="Booking opens in the next phase. You'll be able to book instant or scheduled sessions with certified trainers."
      >
        <Button disabled>Book a session</Button>
      </EmptyState>
      <ComingSoonGrid items={UPCOMING} />
    </>
  );
}
