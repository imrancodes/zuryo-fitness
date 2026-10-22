import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { bookingsHref } from "@/features/admin-bookings/bookings-href";
import type { AdminBookingListQuery } from "@/validators/booking";

type PaginationProps = {
  query: AdminBookingListQuery;
  page: number;
  totalPages: number;
};

export function Pagination({ query, page, totalPages }: PaginationProps) {
  if (totalPages <= 1) {
    return null;
  }

  const link = (target: number) => <Link href={bookingsHref({ ...query, page: target })} />;

  return (
    <nav aria-label="Pagination" className="flex items-center justify-between gap-2">
      {page > 1 ? (
        <Button variant="outline" nativeButton={false} render={link(page - 1)}>
          <ChevronLeft aria-hidden />
          Previous
        </Button>
      ) : (
        <Button variant="outline" disabled>
          <ChevronLeft aria-hidden />
          Previous
        </Button>
      )}
      <p className="text-sm text-muted-foreground tabular-nums">
        Page {page} of {totalPages}
      </p>
      {page < totalPages ? (
        <Button variant="outline" nativeButton={false} render={link(page + 1)}>
          Next
          <ChevronRight aria-hidden />
        </Button>
      ) : (
        <Button variant="outline" disabled>
          Next
          <ChevronRight aria-hidden />
        </Button>
      )}
    </nav>
  );
}
