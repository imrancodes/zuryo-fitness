import { percentToBps } from "@/lib/money";
import { toZonedParts, weekdayInZone } from "@/lib/time";

export type PeakSlot = {
  daysOfWeek: number[];
  startTime: string;
  endTime: string;
};

export type PricingConfig = {
  normalPrice: number;
  peakPrice: number;
  commissionPercent: number;
  peakSlots: PeakSlot[];
};

export type PriceQuote = {
  isPeak: boolean;
  sessionPrice: number;
  commissionPercent: number;
  commissionAmount: number;
  totalAmount: number;
};

export const QUOTE_TTL_MINUTES = 15;

export const DEFAULT_PRICING: PricingConfig = {
  normalPrice: 39900,
  peakPrice: 49900,
  commissionPercent: 10,
  peakSlots: [
    { daysOfWeek: [1, 2, 3, 4, 5], startTime: "06:00", endTime: "10:00" },
    { daysOfWeek: [1, 2, 3, 4, 5], startTime: "17:00", endTime: "21:00" },
    { daysOfWeek: [0, 6], startTime: "07:00", endTime: "12:00" },
  ],
};

export function isPeakTime(start: Date, peakSlots: PeakSlot[]) {
  const { time } = toZonedParts(start);
  const day = weekdayInZone(start);
  return peakSlots.some((slot) => slot.daysOfWeek.includes(day) && time >= slot.startTime && time < slot.endTime);
}

export function commissionFor(sessionPrice: number, commissionPercent: number) {
  return Math.floor((sessionPrice * percentToBps(commissionPercent) + 5000) / 10000);
}

export function quoteForPrice(sessionPrice: number, commissionPercent: number, isPeak: boolean): PriceQuote {
  const commissionAmount = commissionFor(sessionPrice, commissionPercent);
  return { isPeak, sessionPrice, commissionPercent, commissionAmount, totalAmount: sessionPrice + commissionAmount };
}

export function calculateQuote(config: PricingConfig, start: Date): PriceQuote {
  const isPeak = isPeakTime(start, config.peakSlots);
  return quoteForPrice(isPeak ? config.peakPrice : config.normalPrice, config.commissionPercent, isPeak);
}

export function hasOverlappingPeakSlots(peakSlots: PeakSlot[]) {
  return peakSlots.some((slot, index) =>
    peakSlots
      .slice(index + 1)
      .some(
        (other) =>
          slot.daysOfWeek.some((day) => other.daysOfWeek.includes(day)) &&
          slot.startTime < other.endTime &&
          other.startTime < slot.endTime
      )
  );
}
