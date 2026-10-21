import "server-only";
import { randomUUID } from "node:crypto";
import { isValidObjectId, type Types } from "mongoose";
import { isDuplicateKeyError, ServiceError } from "@/lib/errors";
import { connectToDatabase } from "@/lib/mongodb";
import { QUOTE_TTL_MINUTES } from "@/lib/pricing";
import { addMinutes } from "@/lib/time";
import { runTransaction } from "@/lib/transaction";
import { Booking } from "@/models/Booking";
import { Payment, type PaymentDocument } from "@/models/Payment";
import { assertPayable, findCustomerBooking, quoteBooking } from "@/services/pricing.service";
import type { PaymentStatusValue, PaymentView } from "@/types/payment";
import type { PublicUser } from "@/types/user";
import type { SimulatePaymentInput } from "@/validators/payment";

type PaymentRecord = PaymentDocument & { _id: Types.ObjectId; createdAt?: Date };

const DECLINED = "Declined by the simulated payment provider. No money was taken.";
const ALREADY_PAID = "This booking is already paid.";

function toPaymentView(payment: PaymentRecord): PaymentView {
  return {
    id: payment._id.toString(),
    bookingId: payment.bookingId.toString(),
    status: payment.status as PaymentStatusValue,
    currency: payment.currency ?? "INR",
    quote: {
      isPeak: payment.isPeak,
      sessionPrice: payment.sessionPrice,
      commissionPercent: payment.commissionPercent,
      commissionAmount: payment.commissionAmount,
      totalAmount: payment.totalAmount,
    },
    expiresAt: payment.expiresAt.toISOString(),
    providerReference: payment.providerReference ?? null,
    failureReason: payment.failureReason ?? null,
    paidAt: payment.paidAt ? payment.paidAt.toISOString() : null,
    createdAt: (payment.createdAt ?? new Date()).toISOString(),
  };
}

function findOpenPayment(bookingId: string) {
  return Payment.findOne({ bookingId, status: "pending" }).lean<PaymentRecord>();
}

export async function getOpenCheckout(bookingId: string, customerId: string, now = new Date()) {
  await connectToDatabase();
  const payment = isValidObjectId(bookingId)
    ? await Payment.findOne({ bookingId, customerId, status: "pending", expiresAt: { $gt: now } }).lean<PaymentRecord>()
    : null;
  return payment ? toPaymentView(payment) : null;
}

export async function getBookingPayment(bookingId: string, customerId: string) {
  await connectToDatabase();
  const payment = isValidObjectId(bookingId)
    ? await Payment.findOne({ bookingId, customerId, status: "paid" }).lean<PaymentRecord>()
    : null;
  return payment ? toPaymentView(payment) : null;
}

export async function startCheckout(bookingId: string, customerId: string, now = new Date()) {
  const { quote, ruleId } = await quoteBooking(bookingId, customerId, now);
  await Payment.init();

  const open = await findOpenPayment(bookingId);
  if (open && open.expiresAt > now) {
    return { payment: toPaymentView(open), created: false };
  }
  if (open) {
    await Payment.updateOne({ _id: open._id, status: "pending" }, { $set: { status: "expired" } });
  }

  try {
    const payment = await Payment.create({
      bookingId,
      customerId,
      ...quote,
      pricingRuleId: ruleId,
      expiresAt: addMinutes(now, QUOTE_TTL_MINUTES),
    });
    return { payment: toPaymentView(payment.toObject() as PaymentRecord), created: true };
  } catch (error) {
    const existing = isDuplicateKeyError(error) ? await findOpenPayment(bookingId) : null;
    if (existing) {
      return { payment: toPaymentView(existing), created: false };
    }
    throw error;
  }
}

export async function simulatePayment(customerId: string, input: SimulatePaymentInput, now = new Date()) {
  try {
    return await runTransaction(async (session) => {
      const payment = await Payment.findOne({ _id: input.paymentId, customerId }).session(session);

      if (!payment) {
        throw new ServiceError(404, "Payment not found");
      }
      if (payment.status === "paid") {
        return toPaymentView(payment.toObject() as PaymentRecord);
      }
      if (payment.status !== "pending") {
        throw new ServiceError(409, "This checkout is closed. Start a new checkout to try again.");
      }
      if (payment.expiresAt <= now) {
        throw new ServiceError(409, "Your price quote has expired. Review the updated price to continue.");
      }

      const booking = await findCustomerBooking(payment.bookingId.toString(), customerId, session);
      assertPayable(booking, now);

      if (input.outcome === "decline") {
        payment.set({ status: "failed", failureReason: DECLINED });
        await payment.save({ session });
        await Booking.updateOne({ _id: booking._id, paymentStatus: { $ne: "paid" } }, { $set: { paymentStatus: "failed" } }, { session });
        return toPaymentView(payment.toObject() as PaymentRecord);
      }

      payment.set({ status: "paid", providerReference: `sim_${randomUUID().slice(0, 18)}`, paidAt: now });
      await payment.save({ session });

      const updated = await Booking.updateOne(
        { _id: booking._id, paymentStatus: { $ne: "paid" } },
        {
          $set: {
            paymentStatus: "paid",
            sessionPrice: payment.sessionPrice,
            commissionAmount: payment.commissionAmount,
            totalAmount: payment.totalAmount,
          },
        },
        { session }
      );

      if (updated.modifiedCount === 0) {
        throw new ServiceError(409, ALREADY_PAID);
      }

      return toPaymentView(payment.toObject() as PaymentRecord);
    });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new ServiceError(409, ALREADY_PAID);
    }
    throw error;
  }
}

export async function getPaymentForViewer(id: string, viewer: PublicUser) {
  await connectToDatabase();
  const payment = isValidObjectId(id) ? await Payment.findById(id).lean<PaymentRecord>() : null;

  if (!payment || (viewer.role !== "admin" && payment.customerId.toString() !== viewer.id)) {
    throw new ServiceError(404, "Payment not found");
  }

  return toPaymentView(payment);
}
