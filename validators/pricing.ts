import { z } from "zod";
import { hasOverlappingPeakSlots } from "@/lib/pricing";

const timeOfDay = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use the HH:mm format");

const pricePaise = z
  .number({ error: "Enter a price" })
  .int("Prices must be whole paise")
  .min(100, "Price must be at least ₹1.00")
  .max(10_000_000, "Price must be at most ₹1,00,000");

const peakSlotSchema = z
  .object({
    daysOfWeek: z
      .array(z.number().int().min(0).max(6))
      .min(1, "Pick at least one day")
      .refine((days) => new Set(days).size === days.length, "Days must not repeat"),
    startTime: timeOfDay,
    endTime: timeOfDay,
  })
  .refine((slot) => slot.startTime < slot.endTime, { path: ["endTime"], message: "End time must be after the start time" });

export const pricingRuleSchema = z
  .object({
    normalPrice: pricePaise,
    peakPrice: pricePaise,
    commissionPercent: z
      .number({ error: "Enter a commission percentage" })
      .min(0, "Commission can't be negative")
      .max(100, "Commission can't be more than 100%")
      .refine((value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-6, "Use at most 2 decimal places"),
    peakSlots: z.array(peakSlotSchema).max(14, "Use at most 14 peak windows"),
    isActive: z.boolean(),
  })
  .refine((rule) => !hasOverlappingPeakSlots(rule.peakSlots), {
    path: ["peakSlots"],
    message: "Peak windows on the same day must not overlap",
  });

export type PricingRuleInput = z.infer<typeof pricingRuleSchema>;
