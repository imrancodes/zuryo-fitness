import type { PricingConfig, PriceQuote } from "@/lib/pricing";

export type PaymentStatusValue = "pending" | "paid" | "failed" | "expired";

export type PaymentView = {
  id: string;
  bookingId: string;
  status: PaymentStatusValue;
  currency: string;
  quote: PriceQuote;
  expiresAt: string;
  providerReference: string | null;
  failureReason: string | null;
  paidAt: string | null;
  createdAt: string;
};

export type PricingRuleView = PricingConfig & {
  id: string;
  name: string;
  isActive: boolean;
  updatedAt: string;
};
