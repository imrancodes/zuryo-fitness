import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { BookingWizard } from "@/features/booking/booking-wizard";

export const metadata: Metadata = { title: "Book a session" };

export default function BookSessionPage() {
  return (
    <>
      <PageHeader
        title="Book a session"
        description="Pick how soon, where and when. We'll match you with an available certified trainer."
        breadcrumbs={[{ label: "Customer", href: "/customer" }, { label: "Book a session" }]}
      />
      <BookingWizard />
    </>
  );
}
