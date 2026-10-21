import { BarChart3, ReceiptText, Settings2, TrendingUp, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ComingSoonGrid, type ComingSoonItem } from "@/components/coming-soon-grid";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Admin" };

const UPCOMING: ComingSoonItem[] = [
  { icon: Users, title: "User management", description: "Review customers and trainers, and activate or suspend accounts." },
  { icon: ReceiptText, title: "Bookings", description: "Monitor every booking and its payment status." },
  { icon: TrendingUp, title: "Revenue reports", description: "Track session revenue and society commission over time." },
];

const pricingButton = (
  <Button nativeButton={false} render={<Link href="/admin/pricing" />}>
    <Settings2 aria-hidden />
    Manage pricing
  </Button>
);

export default function AdminHomePage() {
  return (
    <>
      <PageHeader
        title="Admin console"
        description="Platform-wide oversight of users, bookings and pricing."
        breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Overview" }]}
        actions={pricingButton}
      />
      <EmptyState
        icon={BarChart3}
        title="No reports yet"
        description="Booking and revenue metrics will appear here in a later phase. Pricing is already configurable."
      >
        {pricingButton}
      </EmptyState>
      <ComingSoonGrid items={UPCOMING} />
    </>
  );
}
