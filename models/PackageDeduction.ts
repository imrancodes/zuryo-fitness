import { Schema, model, models, type InferSchemaType, type Model, type Types } from "mongoose";

export const DEDUCTION_OUTCOMES = ["deducted", "no_package"] as const;

const packageDeductionSchema = new Schema(
  {
    bookingId: { type: Schema.Types.ObjectId, ref: "Booking", required: true, unique: true },
    sessionRecordId: { type: Schema.Types.ObjectId, ref: "SessionRecord", required: true },
    customerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    packageId: { type: Schema.Types.ObjectId, ref: "Package", default: null },
    outcome: { type: String, enum: DEDUCTION_OUTCOMES, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

packageDeductionSchema.index({ customerId: 1, createdAt: -1 });

export type PackageDeductionDocument = InferSchemaType<typeof packageDeductionSchema>;
export type PackageDeductionRecord = PackageDeductionDocument & { _id: Types.ObjectId; createdAt?: Date };

export const PackageDeduction: Model<PackageDeductionDocument> =
  models.PackageDeduction ?? model("PackageDeduction", packageDeductionSchema);
