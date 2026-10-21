import { beforeEach, describe, expect, test } from "bun:test";
import { GET as getPricing, PUT as putPricing } from "@/app/api/admin/pricing/route";
import { POST as postCheckout } from "@/app/api/bookings/[id]/checkout/route";
import { GET as getQuote } from "@/app/api/bookings/[id]/quote/route";
import { GET as getPayment } from "@/app/api/payments/[id]/route";
import { POST as postSimulate } from "@/app/api/payments/simulate/route";
import { connectToDatabase } from "@/lib/mongodb";
import { DEFAULT_PRICING } from "@/lib/pricing";
import { addDays, addMinutes, todayInZone, weekdayInZone, zonedToUtc } from "@/lib/time";
import { Booking } from "@/models/Booking";
import { Payment } from "@/models/Payment";
import { PricingRule } from "@/models/PricingRule";
import { createAccount, makeRequest, routeContext } from "./helpers";

type Account = { id: string; session: string };

function nextWeekday(weekday: number) {
  for (let offset = 1; offset <= 7; offset += 1) {
    const date = addDays(todayInZone(), offset);
    if (weekdayInZone(zonedToUtc(date, "12:00")) === weekday) {
      return date;
    }
  }
  throw new Error("unreachable");
}

const monday = nextWeekday(1);
const NORMAL = zonedToUtc(monday, "11:00");
const PEAK = zonedToUtc(monday, "07:00");

async function createBooking(customer: Account, startTime = NORMAL, overrides: Record<string, unknown> = {}) {
  const trainer = await createAccount("trainer");
  const booking = await Booking.create({
    customerId: customer.id,
    trainerId: trainer.id,
    startTime,
    endTime: addMinutes(startTime, 60),
    bookingType: "scheduled",
    status: "confirmed",
    serviceZone: "Indiranagar",
    ...overrides,
  });
  return booking._id.toString();
}

const quote = (account: Partial<Account>, id: string) =>
  getQuote(makeRequest(`/api/bookings/${id}/quote`, { session: account.session }), routeContext({ id }));

const checkout = (account: Partial<Account>, id: string, body?: unknown) =>
  postCheckout(makeRequest(`/api/bookings/${id}/checkout`, { method: "POST", session: account.session, body }), routeContext({ id }));

const pay = (account: Partial<Account>, paymentId: string, outcome = "approve", extra: Record<string, unknown> = {}) =>
  postSimulate(
    makeRequest("/api/payments/simulate", { method: "POST", session: account.session, body: { paymentId, outcome, ...extra } })
  );

const viewPayment = (account: Partial<Account>, id: string) =>
  getPayment(makeRequest(`/api/payments/${id}`, { session: account.session }), routeContext({ id }));

async function openCheckout(customer: Account, bookingId: string) {
  return (await (await checkout(customer, bookingId)).json()).payment;
}

beforeEach(async () => {
  await connectToDatabase();
  await Promise.all([Booking.deleteMany({}), Payment.deleteMany({}), PricingRule.deleteMany({})]);
  await PricingRule.create({ name: "Standard", ...DEFAULT_PRICING, isActive: true });
});

describe("quotes", () => {
  test("the server quotes ₹438.90 for a normal slot and ₹548.90 for a peak slot", async () => {
    const customer = await createAccount("customer");
    const normal = await (await quote(customer, await createBooking(customer, NORMAL))).json();
    const peak = await (await quote(customer, await createBooking(customer, PEAK))).json();

    expect(normal.quote).toMatchObject({ isPeak: false, sessionPrice: 39900, commissionAmount: 3990, totalAmount: 43890 });
    expect(peak.quote).toMatchObject({ isPeak: true, sessionPrice: 49900, commissionAmount: 4990, totalAmount: 54890 });
  });

  test("checkout is paused when no pricing rule is active", async () => {
    const customer = await createAccount("customer");
    const bookingId = await createBooking(customer);
    await PricingRule.updateMany({}, { isActive: false });

    expect((await quote(customer, bookingId)).status).toBe(503);
  });
});

describe("simulated payment", () => {
  test("client-supplied prices cannot change the amount charged", async () => {
    const customer = await createAccount("customer");
    const bookingId = await createBooking(customer, PEAK);
    const payment = (await (await checkout(customer, bookingId, { totalAmount: 1, isPeak: false })).json()).payment;

    const response = await pay(customer, payment.id, "approve", { totalAmount: 1, sessionPrice: 1, commissionAmount: 0 });
    const result = (await response.json()).payment;
    const booking = await Booking.findById(bookingId).lean();

    expect(response.status).toBe(200);
    expect(result.quote.totalAmount).toBe(54890);
    expect(booking?.totalAmount).toBe(54890);
  });

  test("an approved payment marks the booking paid without changing its lifecycle status", async () => {
    const customer = await createAccount("customer");
    const bookingId = await createBooking(customer);
    const payment = await openCheckout(customer, bookingId);

    const result = (await (await pay(customer, payment.id)).json()).payment;
    const booking = await Booking.findById(bookingId).lean();

    expect(result.status).toBe("paid");
    expect(result.providerReference).toStartWith("sim_");
    expect(booking).toMatchObject({ status: "confirmed", paymentStatus: "paid", sessionPrice: 39900, commissionAmount: 3990, totalAmount: 43890 });
  });

  test("a declined payment does not mark the booking paid and can be retried", async () => {
    const customer = await createAccount("customer");
    const bookingId = await createBooking(customer);
    const first = await openCheckout(customer, bookingId);

    const declined = (await (await pay(customer, first.id, "decline")).json()).payment;
    const afterDecline = await Booking.findById(bookingId).lean();

    expect(declined.status).toBe("failed");
    expect(afterDecline).toMatchObject({ status: "confirmed", paymentStatus: "failed", totalAmount: null });
    expect((await pay(customer, first.id, "approve")).status).toBe(409);

    const retry = await checkout(customer, bookingId);
    const second = (await retry.json()).payment;
    expect(retry.status).toBe(201);
    expect(second.id).not.toBe(first.id);
    expect((await (await pay(customer, second.id)).json()).payment.status).toBe("paid");
  });

  test("ineligible bookings cannot be paid", async () => {
    const customer = await createAccount("customer");
    const cancelled = await createBooking(customer, NORMAL, { status: "cancelled" });
    const paid = await createBooking(customer, PEAK, { paymentStatus: "paid" });
    const ended = await createBooking(customer, zonedToUtc(addDays(todayInZone(), -2), "10:00"));

    expect((await checkout(customer, cancelled)).status).toBe(409);
    expect((await checkout(customer, paid)).status).toBe(409);
    expect((await checkout(customer, ended)).status).toBe(409);
    expect(await Payment.countDocuments()).toBe(0);
  });

  test("an expired quote must be refreshed before paying", async () => {
    const customer = await createAccount("customer");
    const bookingId = await createBooking(customer);
    const payment = await openCheckout(customer, bookingId);
    await Payment.updateOne({ _id: payment.id }, { expiresAt: new Date(Date.now() - 1000) });

    expect((await pay(customer, payment.id)).status).toBe(409);

    const refreshed = await checkout(customer, bookingId);
    expect(refreshed.status).toBe(201);
    expect(await Payment.countDocuments({ status: "expired" })).toBe(1);
  });

  test("a price change after checkout opens does not change the locked quote", async () => {
    const customer = await createAccount("customer");
    const bookingId = await createBooking(customer);
    const payment = await openCheckout(customer, bookingId);
    await PricingRule.updateOne({ name: "Standard" }, { normalPrice: 99900 });

    const result = (await (await pay(customer, payment.id)).json()).payment;

    expect(result.quote.totalAmount).toBe(43890);
  });
});

describe("duplicates and concurrency", () => {
  test("repeated checkout and payment requests return the same records", async () => {
    const customer = await createAccount("customer");
    const bookingId = await createBooking(customer);

    const first = await checkout(customer, bookingId);
    const second = await checkout(customer, bookingId);
    const { payment } = await first.json();

    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    expect((await second.json()).payment.id).toBe(payment.id);

    const paidOnce = (await (await pay(customer, payment.id)).json()).payment;
    const paidAgain = (await (await pay(customer, payment.id)).json()).payment;

    expect(paidAgain).toEqual(paidOnce);
    expect(await Payment.countDocuments({ bookingId, status: "paid" })).toBe(1);
  });

  test("simultaneous payment attempts on one checkout charge exactly once", async () => {
    const customer = await createAccount("customer");
    const bookingId = await createBooking(customer);
    const payment = await openCheckout(customer, bookingId);

    const responses = await Promise.all(Array.from({ length: 5 }, () => pay(customer, payment.id)));
    const results = await Promise.all(responses.map((response) => response.json()));

    expect(responses.every((response) => response.status === 200)).toBe(true);
    expect(new Set(results.map((result) => result.payment.providerReference)).size).toBe(1);
    expect(await Payment.countDocuments({ bookingId, status: "paid" })).toBe(1);
  });

  test("simultaneous checkout-and-pay flows for one booking produce a single successful payment", async () => {
    const customer = await createAccount("customer");
    const bookingId = await createBooking(customer);

    const outcomes = await Promise.all(
      Array.from({ length: 5 }, async () => {
        const opened = await checkout(customer, bookingId);
        if (!opened.ok) {
          return opened.status;
        }
        return (await pay(customer, (await opened.json()).payment.id)).status;
      })
    );

    expect(outcomes.filter((status) => status === 200).length).toBeGreaterThanOrEqual(1);
    expect(outcomes.every((status) => status === 200 || status === 409)).toBe(true);
    expect(await Payment.countDocuments({ bookingId, status: "paid" })).toBe(1);
    expect((await Booking.findById(bookingId).lean())?.paymentStatus).toBe("paid");
  });
});

describe("access control", () => {
  test("unauthenticated checkout requests are rejected", async () => {
    const customer = await createAccount("customer");
    const bookingId = await createBooking(customer);
    const payment = await openCheckout(customer, bookingId);

    expect((await quote({}, bookingId)).status).toBe(401);
    expect((await checkout({}, bookingId)).status).toBe(401);
    expect((await pay({}, payment.id)).status).toBe(401);
    expect((await viewPayment({}, payment.id)).status).toBe(401);
  });

  test("a customer cannot quote, open or pay for another customer's booking", async () => {
    const [owner, stranger] = [await createAccount("customer"), await createAccount("customer")];
    const admin = await createAccount("admin");
    const bookingId = await createBooking(owner);
    const payment = await openCheckout(owner, bookingId);

    expect((await quote(stranger, bookingId)).status).toBe(404);
    expect((await checkout(stranger, bookingId)).status).toBe(404);
    expect((await pay(stranger, payment.id)).status).toBe(404);
    expect((await viewPayment(stranger, payment.id)).status).toBe(404);
    expect((await viewPayment(owner, payment.id)).status).toBe(200);
    expect((await viewPayment(admin, payment.id)).status).toBe(200);
    expect((await Booking.findById(bookingId).lean())?.paymentStatus).toBe("unpaid");
  });
});

describe("admin pricing", () => {
  const body = { ...DEFAULT_PRICING, normalPrice: 45000, isActive: true };
  const update = (account: Partial<Account>, payload: unknown = body) =>
    putPricing(makeRequest("/api/admin/pricing", { method: "PUT", session: account.session, body: payload }));

  test("only admins can view or change pricing", async () => {
    const [customer, trainer] = [await createAccount("customer"), await createAccount("trainer")];

    expect((await update({})).status).toBe(401);
    expect((await update(customer)).status).toBe(403);
    expect((await update(trainer)).status).toBe(403);
    expect((await getPricing(makeRequest("/api/admin/pricing", { session: customer.session }))).status).toBe(403);
    expect((await PricingRule.findOne({ name: "Standard" }).lean())?.normalPrice).toBe(39900);
  });

  test("an admin can update pricing and the new price applies to new quotes", async () => {
    const admin = await createAccount("admin");
    const customer = await createAccount("customer");

    const response = await update(admin);
    const { rule } = await response.json();

    expect(response.status).toBe(200);
    expect(rule).toMatchObject({ normalPrice: 45000, peakPrice: 49900, commissionPercent: 10, isActive: true });
    expect((await (await quote(customer, await createBooking(customer))).json()).quote.totalAmount).toBe(49500);
  });

  test("invalid pricing configurations are rejected", async () => {
    const admin = await createAccount("admin");
    const invalid = [
      { ...body, normalPrice: -1 },
      { ...body, commissionPercent: 150 },
      { ...body, peakPrice: 499.5 },
      { ...body, peakSlots: [{ daysOfWeek: [1], startTime: "10:00", endTime: "06:00" }] },
      {
        ...body,
        peakSlots: [
          { daysOfWeek: [1], startTime: "06:00", endTime: "10:00" },
          { daysOfWeek: [1], startTime: "09:00", endTime: "11:00" },
        ],
      },
    ];

    for (const payload of invalid) {
      expect((await update(admin, payload)).status).toBe(400);
    }
    expect((await PricingRule.findOne({ name: "Standard" }).lean())?.normalPrice).toBe(39900);
  });
});
