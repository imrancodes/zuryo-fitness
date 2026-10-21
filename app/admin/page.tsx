import { BarChart3, ReceiptText, Settings2, Users } from "lucide-react";
import type { Metadata } from "next";
import { ComingSoonGrid, type ComingSoonItem } from "@/components/coming-soon-grid";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Admin" };

const UPCOMING: ComingSoonItem[] = [
  { icon: Users, title: "User management", description: "Review customers and trainers, and activate or suspend accounts." },
  { icon: ReceiptText, title: "Bookings", description: "Monitor every booking and its payment status." },
  { icon: Settings2, title: "Pricing rules", description: "Configure normal and peak prices and commission." },
];

export default function AdminHomePage() {
  return (
    <>
      <PageHeader
        title="Admin console"
        description="Platform-wide oversight of users, bookings and pricing."
        breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Overview" }]}
      />
      <EmptyState
        icon={BarChart3}
        title="No platform activity yet"
        description="Booking and revenue metrics will appear here once customers start booking sessions."
      >
        <Button disabled>View reports</Button>
      </EmptyState>
      <ComingSoonGrid items={UPCOMING} />
    </>
  );
}
