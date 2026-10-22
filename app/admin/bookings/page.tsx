import { CalendarSearch, ReceiptText, TriangleAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { AdminBookingTable } from "@/features/admin-bookings/admin-booking-table";
import { BookingFilters } from "@/features/admin-bookings/booking-filters";
import { bookingsHref, hasFilters } from "@/features/admin-bookings/bookings-href";
import { Pagination } from "@/features/admin-bookings/pagination";
import { requireRole } from "@/lib/auth";
import { listAdminBookings } from "@/services/booking.service";
import { adminBookingListQuerySchema } from "@/validators/booking";

export const metadata: Metadata = { title: "Bookings" };

export default async function AdminBookingsPage({ searchParams }: PageProps<"/admin/bookings">) {
  await requireRole("admin");
  const parsed = adminBookingListQuerySchema.safeParse(await searchParams);
  const query = parsed.success ? parsed.data : adminBookingListQuerySchema.parse({});
  const result = await listAdminBookings(query);
  const filtered = hasFilters(query);
  const first = (result.page - 1) * result.pageSize + 1;
  const last = first + result.bookings.length - 1;

  return (
    <>
      <PageHeader
        title="Bookings"
        description="Every booking on the platform with its trainer assignment, session and payment status."
        breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Bookings" }]}
      />
      <BookingFilters query={query} />
      {!parsed.success && (
        <p role="status" className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <TriangleAlert className="size-4 text-destructive" aria-hidden />
          Some filters in the link weren&apos;t valid, so all bookings are shown.
        </p>
      )}
      {result.bookings.length > 0 ? (
        <section aria-labelledby="results" className="space-y-4">
          <h2 id="results" className="text-sm text-muted-foreground tabular-nums">
            Showing {first}–{last} of {result.total} {result.total === 1 ? "booking" : "bookings"}
          </h2>
          <AdminBookingTable bookings={result.bookings} />
          <Pagination query={query} page={result.page} totalPages={result.totalPages} />
        </section>
      ) : result.total > 0 ? (
        <EmptyState icon={CalendarSearch} title="This page is empty" description={`There are only ${result.totalPages} pages of results.`}>
          <Button variant="outline" nativeButton={false} render={<Link href={bookingsHref({ ...query, page: 1 })} />}>
            Go to the first page
          </Button>
        </EmptyState>
      ) : filtered ? (
        <EmptyState icon={CalendarSearch} title="No bookings match these filters" description="Try a different status, date or search term.">
          <Button variant="outline" nativeButton={false} render={<Link href="/admin/bookings" />}>
            Clear filters
          </Button>
        </EmptyState>
      ) : (
        <EmptyState icon={ReceiptText} title="No bookings yet" description="Bookings appear here as soon as customers book a session." />
      )}
    </>
  );
}
