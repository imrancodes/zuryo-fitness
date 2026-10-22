import { z } from "zod";
import { BOOKING_MODES, BOOKING_STATUSES, PAYMENT_STATUSES } from "@/lib/booking";
import { dateString, objectId, serviceZone } from "@/validators/common";

const mode = z.enum(BOOKING_MODES, { error: "Choose instant or scheduled" });
const startTime = z.iso.datetime({ offset: true, error: "Choose a valid start time" });

export const createBookingSchema = z.object({
  mode,
  startTime,
  serviceZone,
  preferredTrainerId: objectId.optional(),
  idempotencyKey: z.uuid({ error: "A request id is required" }),
});

export const availabilityQuerySchema = z
  .object({
    mode,
    serviceZone,
    date: dateString.optional(),
  })
  .refine((value) => value.mode === "instant" || value.date, { path: ["date"], message: "Choose a date" });

export const trainersQuerySchema = z.object({
  serviceZone,
  startTime,
});

export type CreateBookingInput = z.infer<typeof createBookingSchema>;
export type AvailabilityQuery = z.infer<typeof availabilityQuerySchema>;

export const BOOKING_FILTERS = ["upcoming", "in_progress", "completed", "cancelled", "all"] as const;

export const bookingListQuerySchema = z.object({
  status: z.enum(BOOKING_FILTERS).default("all"),
});

export type BookingFilter = (typeof BOOKING_FILTERS)[number];

export const ADMIN_BOOKINGS_PAGE_SIZE = 20;

const blankAsUnset = (value: unknown) => (value === "" ? undefined : value);

export const adminBookingListQuerySchema = z.object({
  status: z.preprocess(blankAsUnset, z.enum(BOOKING_STATUSES, { error: "Choose a valid booking status" }).optional()),
  payment: z.preprocess(blankAsUnset, z.enum(PAYMENT_STATUSES, { error: "Choose a valid payment status" }).optional()),
  date: z.preprocess(blankAsUnset, dateString.optional()),
  q: z.preprocess(blankAsUnset, z.string().trim().max(80, "Search is limited to 80 characters").optional()),
  page: z.preprocess(blankAsUnset, z.coerce.number().int().min(1).max(1000).default(1)),
});

export type AdminBookingListQuery = z.infer<typeof adminBookingListQuerySchema>;
