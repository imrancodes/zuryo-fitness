import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";
import { paise } from "@/models/fields";

export const BOOKING_TYPES = ["instant", "scheduled"] as const;
export const BOOKING_STATUSES = ["pending", "confirmed", "cancelled", "completed"] as const;
export const PAYMENT_STATUSES = ["unpaid", "paid", "refunded", "failed"] as const;

const bookingSchema = new Schema(
  {
    customerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    trainerId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true },
    bookingType: { type: String, enum: BOOKING_TYPES, required: true },
    status: { type: String, enum: BOOKING_STATUSES, default: "pending" },
    serviceZone: { type: String, required: true, trim: true },
    sessionPrice: paise,
    commissionAmount: paise,
    totalAmount: paise,
    paymentStatus: { type: String, enum: PAYMENT_STATUSES, default: "unpaid" },
  },
  { timestamps: true }
);

bookingSchema.index({ trainerId: 1, startTime: 1, endTime: 1 });
bookingSchema.index({ customerId: 1, startTime: -1 });
bookingSchema.index({ status: 1, startTime: 1 });

export type BookingDocument = InferSchemaType<typeof bookingSchema>;

export const Booking: Model<BookingDocument> = models.Booking ?? model("Booking", bookingSchema);
