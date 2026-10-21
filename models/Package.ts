import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";
import { count } from "@/models/fields";

export const PACKAGE_STATUSES = ["active", "exhausted", "expired", "cancelled"] as const;

const packageSchema = new Schema(
  {
    customerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    totalSessions: { ...count, min: 1 },
    usedSessions: { ...count, default: 0 },
    remainingSessions: count,
    status: { type: String, enum: PACKAGE_STATUSES, default: "active" },
  },
  { timestamps: true }
);

packageSchema.pre("validate", function () {
  if (this.isNew && this.remainingSessions == null) {
    this.remainingSessions = this.totalSessions - this.usedSessions;
  }
});

packageSchema.index({ customerId: 1, status: 1 });

export type PackageDocument = InferSchemaType<typeof packageSchema>;

export const Package: Model<PackageDocument> = models.Package ?? model("Package", packageSchema);
