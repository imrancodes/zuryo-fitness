import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";
import { CURRENCY } from "@/lib/money";
import { paise } from "@/models/fields";

export const PAYMENT_RECORD_STATUSES = ["pending", "paid", "failed", "expired"] as const;

export type PaymentRecordStatus = (typeof PAYMENT_RECORD_STATUSES)[number];

const paymentSchema = new Schema(
  {
    bookingId: { type: Schema.Types.ObjectId, ref: "Booking", required: true },
    customerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    status: { type: String, enum: PAYMENT_RECORD_STATUSES, default: "pending" },
    currency: { type: String, enum: [CURRENCY], default: CURRENCY },
    isPeak: { type: Boolean, required: true },
    sessionPrice: paise,
    commissionPercent: { type: Number, required: true, min: 0, max: 100 },
    commissionAmount: paise,
    totalAmount: paise,
    pricingRuleId: { type: Schema.Types.ObjectId, ref: "PricingRule", required: true },
    expiresAt: { type: Date, required: true },
    providerReference: { type: String, default: null },
    failureReason: { type: String, default: null },
    paidAt: { type: Date, default: null },
  },
  { timestamps: true }
);

paymentSchema.index({ bookingId: 1, createdAt: -1 });
paymentSchema.index({ customerId: 1, createdAt: -1 });
paymentSchema.index({ bookingId: 1 }, { unique: true, partialFilterExpression: { status: "paid" } });
paymentSchema.index({ bookingId: 1, status: 1 }, { unique: true, partialFilterExpression: { status: "pending" } });

export type PaymentDocument = InferSchemaType<typeof paymentSchema>;

export const Payment: Model<PaymentDocument> = models.Payment ?? model("Payment", paymentSchema);
