import { Schema, model, models, type InferSchemaType, type Model, type Types } from "mongoose";
import { BOOKING_MODES, BOOKING_STATUSES, PAYMENT_STATUSES } from "@/lib/booking";
import { SERVICE_ZONES } from "@/lib/zones";
import { paise } from "@/models/fields";

const optionalPaise = { ...paise, required: false, default: null };

const bookingSchema = new Schema(
  {
    customerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    trainerId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true },
    bookingType: { type: String, enum: BOOKING_MODES, required: true },
    status: { type: String, enum: BOOKING_STATUSES, default: "pending" },
    serviceZone: { type: String, enum: SERVICE_ZONES, required: true },
    sessionPrice: optionalPaise,
    commissionAmount: optionalPaise,
    totalAmount: optionalPaise,
    paymentStatus: { type: String, enum: PAYMENT_STATUSES, default: "unpaid" },
    idempotencyKey: { type: String },
  },
  { timestamps: true }
);

bookingSchema.index({ trainerId: 1, startTime: 1, endTime: 1 });
bookingSchema.index({ customerId: 1, startTime: -1 });
bookingSchema.index({ status: 1, startTime: 1 });
bookingSchema.index(
  { customerId: 1, idempotencyKey: 1 },
  { unique: true, partialFilterExpression: { idempotencyKey: { $type: "string" } } }
);

export type BookingDocument = InferSchemaType<typeof bookingSchema>;
export type BookingRecord = BookingDocument & { _id: Types.ObjectId };

export const Booking: Model<BookingDocument> = models.Booking ?? model("Booking", bookingSchema);
