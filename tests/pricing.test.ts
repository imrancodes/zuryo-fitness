import { describe, expect, test } from "bun:test";
import { formatInr, rupeesToPaise } from "@/lib/money";
import { calculateQuote, commissionFor, DEFAULT_PRICING, hasOverlappingPeakSlots, isPeakTime } from "@/lib/pricing";
import { zonedToUtc } from "@/lib/time";
import { pricingRuleSchema } from "@/validators/pricing";

const MONDAY = "2026-10-26";
const SATURDAY = "2026-10-24";
const SUNDAY = "2026-10-25";
const peak = (date: string, time: string) => isPeakTime(zonedToUtc(date, time), DEFAULT_PRICING.peakSlots);

describe("price calculation", () => {
  test("a normal slot costs ₹399 + ₹39.90 commission = ₹438.90", () => {
    const quote = calculateQuote(DEFAULT_PRICING, zonedToUtc(MONDAY, "11:00"));

    expect(quote).toEqual({ isPeak: false, sessionPrice: 39900, commissionPercent: 10, commissionAmount: 3990, totalAmount: 43890 });
    expect(formatInr(quote.totalAmount)).toBe("₹438.90");
  });

  test("a peak slot costs ₹499 + ₹49.90 commission = ₹548.90", () => {
    const quote = calculateQuote(DEFAULT_PRICING, zonedToUtc(MONDAY, "07:00"));

    expect(quote).toEqual({ isPeak: true, sessionPrice: 49900, commissionPercent: 10, commissionAmount: 4990, totalAmount: 54890 });
    expect(formatInr(quote.totalAmount)).toBe("₹548.90");
  });

  test("commission is computed in whole paise and rounds half a paisa up", () => {
    expect(commissionFor(39900, 10)).toBe(3990);
    expect(commissionFor(39900, 12.5)).toBe(4988);
    expect(commissionFor(39999, 0.01)).toBe(4);
    expect(Number.isInteger(commissionFor(12345, 7.77))).toBe(true);
  });
});

describe("peak hours in IST", () => {
  test("weekday morning window starts at 06:00 and ends before 10:00", () => {
    expect(peak(MONDAY, "05:59")).toBe(false);
    expect(peak(MONDAY, "06:00")).toBe(true);
    expect(peak(MONDAY, "09:59")).toBe(true);
    expect(peak(MONDAY, "10:00")).toBe(false);
  });

  test("weekend window is 07:00 to 12:00", () => {
    expect(peak(SATURDAY, "06:45")).toBe(false);
    expect(peak(SATURDAY, "07:00")).toBe(true);
    expect(peak(SUNDAY, "11:45")).toBe(true);
    expect(peak(SUNDAY, "12:00")).toBe(false);
  });

  test("the weekday is taken in IST, not UTC", () => {
    const fridayEveningUtc = new Date("2026-10-23T18:45:00.000Z");
    const saturdayMorningIst = new Date("2026-10-24T01:30:00.000Z");

    expect(fridayEveningUtc.getUTCDay()).toBe(5);
    expect(isPeakTime(fridayEveningUtc, DEFAULT_PRICING.peakSlots)).toBe(false);
    expect(isPeakTime(saturdayMorningIst, DEFAULT_PRICING.peakSlots)).toBe(true);
  });
});

describe("pricing configuration", () => {
  const valid = { ...DEFAULT_PRICING, isActive: true };

  test("the default configuration is valid and has no overlapping windows", () => {
    expect(pricingRuleSchema.safeParse(valid).success).toBe(true);
    expect(hasOverlappingPeakSlots(DEFAULT_PRICING.peakSlots)).toBe(false);
  });

  test.each([
    ["a negative price", { normalPrice: -100 }],
    ["a non-integer paise amount", { peakPrice: 49900.5 }],
    ["commission above 100%", { commissionPercent: 150 }],
    ["negative commission", { commissionPercent: -1 }],
    ["commission with too many decimals", { commissionPercent: 10.125 }],
    ["a window ending before it starts", { peakSlots: [{ daysOfWeek: [1], startTime: "10:00", endTime: "09:00" }] }],
    ["a window with no days", { peakSlots: [{ daysOfWeek: [], startTime: "06:00", endTime: "09:00" }] }],
    [
      "overlapping windows on the same day",
      {
        peakSlots: [
          { daysOfWeek: [1, 2], startTime: "06:00", endTime: "10:00" },
          { daysOfWeek: [2], startTime: "09:00", endTime: "11:00" },
        ],
      },
    ],
  ])("rejects %s", (_label, change) => {
    expect(pricingRuleSchema.safeParse({ ...valid, ...change }).success).toBe(false);
  });

  test("adjacent windows and windows on different days do not overlap", () => {
    expect(
      hasOverlappingPeakSlots([
        { daysOfWeek: [1], startTime: "06:00", endTime: "10:00" },
        { daysOfWeek: [1], startTime: "10:00", endTime: "12:00" },
        { daysOfWeek: [2], startTime: "06:00", endTime: "12:00" },
      ])
    ).toBe(false);
  });

  test("rupee input is parsed without floating point", () => {
    expect(rupeesToPaise("399")).toBe(39900);
    expect(rupeesToPaise("399.5")).toBe(39950);
    expect(rupeesToPaise("0.29")).toBe(29);
    expect(rupeesToPaise("399.555")).toBeNull();
    expect(rupeesToPaise("-1")).toBeNull();
  });
});
