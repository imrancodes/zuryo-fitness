import { Search } from "lucide-react";
import Link from "next/link";
import type { ComponentProps } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { hasFilters } from "@/features/admin-bookings/bookings-href";
import { PAYMENT_STATUS_LABEL } from "@/features/booking/payment-status-badge";
import { BOOKING_STATUSES, PAYMENT_STATUSES } from "@/lib/booking";
import { TIME_ZONE_LABEL } from "@/lib/time";
import { cn } from "@/lib/utils";
import type { AdminBookingListQuery } from "@/validators/booking";

const controlClass = "h-10 bg-card";

function Select({ className, ...props }: ComponentProps<"select">) {
  return (
    <select
      className={cn(
        "w-full rounded-lg border border-input px-2.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
        controlClass,
        className
      )}
      {...props}
    />
  );
}

export function BookingFilters({ query }: { query: AdminBookingListQuery }) {
  return (
    <form method="get" action="/admin/bookings" role="search" className="grid gap-4 rounded-xl border bg-card p-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))]">
      <div className="grid gap-2 sm:col-span-2 lg:col-span-1">
        <Label htmlFor="q">Search</Label>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input id="q" name="q" type="search" defaultValue={query.q} placeholder="Booking ID, customer or trainer" maxLength={80} className={cn(controlClass, "pl-9")} />
        </div>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="status">Booking status</Label>
        <Select id="status" name="status" defaultValue={query.status ?? ""}>
          <option value="">All statuses</option>
          {BOOKING_STATUSES.map((status) => (
            <option key={status} value={status}>
              {status[0].toUpperCase() + status.slice(1)}
            </option>
          ))}
        </Select>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="payment">Payment</Label>
        <Select id="payment" name="payment" defaultValue={query.payment ?? ""}>
          <option value="">All payments</option>
          {PAYMENT_STATUSES.map((status) => (
            <option key={status} value={status}>
              {PAYMENT_STATUS_LABEL[status]}
            </option>
          ))}
        </Select>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="date">Session date ({TIME_ZONE_LABEL})</Label>
        <Input id="date" name="date" type="date" defaultValue={query.date} className={controlClass} />
      </div>
      <div className="flex flex-wrap items-center gap-2 sm:col-span-2 lg:col-span-4">
        <Button type="submit">Apply filters</Button>
        {hasFilters(query) && (
          <Button variant="ghost" nativeButton={false} render={<Link href="/admin/bookings" />}>
            Clear
          </Button>
        )}
      </div>
    </form>
  );
}
