import { z } from "zod";
import { objectId } from "@/validators/common";

export const PAYMENT_OUTCOMES = ["approve", "decline"] as const;

export const simulatePaymentSchema = z.object({
  paymentId: objectId,
  outcome: z.enum(PAYMENT_OUTCOMES, { error: "Choose a simulated outcome" }),
});

export type SimulatePaymentInput = z.infer<typeof simulatePaymentSchema>;
