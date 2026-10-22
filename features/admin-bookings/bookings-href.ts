import type { AdminBookingListQuery } from "@/validators/booking";

export function bookingsHref(query: Partial<AdminBookingListQuery>) {
  const params = new URLSearchParams();

  for (const key of ["q", "status", "payment", "date"] as const) {
    const value = query[key];
    if (value) {
      params.set(key, value);
    }
  }
  if (query.page && query.page > 1) {
    params.set("page", String(query.page));
  }

  const search = params.toString();
  return search ? `/admin/bookings?${search}` : "/admin/bookings";
}

export function hasFilters(query: AdminBookingListQuery) {
  return Boolean(query.q || query.status || query.payment || query.date);
}
