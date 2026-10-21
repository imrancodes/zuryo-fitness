import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";
import { paise } from "@/models/fields";

const timeOfDay = { type: String, required: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ };

const peakSlotSchema = new Schema(
  {
    daysOfWeek: { type: [Number], required: true, validate: (days: number[]) => days.every((day) => day >= 0 && day <= 6) },
    startTime: timeOfDay,
    endTime: timeOfDay,
  },
  { _id: false }
);

const pricingRuleSchema = new Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    normalPrice: paise,
    peakPrice: paise,
    commissionPercent: { type: Number, required: true, min: 0, max: 100 },
    peakSlots: { type: [peakSlotSchema], default: [] },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

pricingRuleSchema.index({ isActive: 1 });

export type PricingRuleDocument = InferSchemaType<typeof pricingRuleSchema>;

export const PricingRule: Model<PricingRuleDocument> =
  models.PricingRule ?? model("PricingRule", pricingRuleSchema);
