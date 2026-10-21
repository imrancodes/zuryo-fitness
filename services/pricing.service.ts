import "server-only";
import { isValidObjectId, type ClientSession, type Types } from "mongoose";
import { ServiceError } from "@/lib/errors";
import { connectToDatabase } from "@/lib/mongodb";
import { calculateQuote, DEFAULT_PRICING, type PricingConfig } from "@/lib/pricing";
import { Booking, type BookingRecord } from "@/models/Booking";
import { PricingRule, type PricingRuleDocument } from "@/models/PricingRule";
import type { PricingRuleView } from "@/types/payment";
import type { PricingRuleInput } from "@/validators/pricing";

export const STANDARD_RULE_NAME = "Standard";

type PricingRuleRecord = PricingRuleDocument & { _id: Types.ObjectId; updatedAt?: Date };
type PayableBooking = Pick<BookingRecord, "status" | "paymentStatus" | "endTime">;

function toConfig(rule: PricingRuleRecord): PricingConfig {
  return {
    normalPrice: rule.normalPrice,
    peakPrice: rule.peakPrice,
    commissionPercent: rule.commissionPercent,
    peakSlots: rule.peakSlots.map(({ daysOfWeek, startTime, endTime }) => ({ daysOfWeek: [...daysOfWeek], startTime, endTime })),
  };
}

function toRuleView(rule: PricingRuleRecord): PricingRuleView {
  return {
    id: rule._id.toString(),
    name: rule.name,
    isActive: rule.isActive ?? false,
    updatedAt: (rule.updatedAt ?? new Date()).toISOString(),
    ...toConfig(rule),
  };
}

export async function getActivePricingRule(session: ClientSession | null = null) {
  await connectToDatabase();
  const rule = await PricingRule.findOne({ isActive: true }).session(session).lean<PricingRuleRecord>();

  if (!rule) {
    throw new ServiceError(503, "Checkout is paused while pricing is being updated. Please try again later.");
  }

  return rule;
}

export function assertPayable(booking: PayableBooking, now: Date) {
  if (booking.status !== "confirmed") {
    throw new ServiceError(409, "Only confirmed bookings can be paid.");
  }
  if (booking.paymentStatus === "paid") {
    throw new ServiceError(409, "This booking is already paid.");
  }
  if (booking.endTime <= now) {
    throw new ServiceError(409, "This session has already ended and can't be paid.");
  }
}

export async function findCustomerBooking(bookingId: string, customerId: string, session: ClientSession | null = null) {
  await connectToDatabase();
  const booking = isValidObjectId(bookingId)
    ? await Booking.findOne({ _id: bookingId, customerId }).session(session).lean<BookingRecord>()
    : null;

  if (!booking) {
    throw new ServiceError(404, "Booking not found");
  }

  return booking;
}

export async function quoteBooking(bookingId: string, customerId: string, now = new Date()) {
  const booking = await findCustomerBooking(bookingId, customerId);
  assertPayable(booking, now);
  const rule = await getActivePricingRule();

  return { quote: calculateQuote(toConfig(rule), booking.startTime), ruleId: rule._id };
}

export async function getPricingRule() {
  await connectToDatabase();
  const rule = await PricingRule.findOne({ name: STANDARD_RULE_NAME }).lean<PricingRuleRecord>();
  return rule ? toRuleView(rule) : { id: "", name: STANDARD_RULE_NAME, isActive: false, updatedAt: "", ...DEFAULT_PRICING };
}

export async function updatePricingRule(input: PricingRuleInput) {
  await connectToDatabase();
  await PricingRule.init();

  const rule = (await PricingRule.findOne({ name: STANDARD_RULE_NAME })) ?? new PricingRule({ name: STANDARD_RULE_NAME });
  rule.set(input);
  await rule.save();

  return toRuleView(rule.toObject() as PricingRuleRecord);
}
