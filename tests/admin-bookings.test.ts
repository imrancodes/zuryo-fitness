import { beforeEach, describe, expect, test } from "bun:test";
import { Types } from "mongoose";
import { GET as adminBookingDetail } from "@/app/api/admin/bookings/[id]/route";
import { GET as adminBookings } from "@/app/api/admin/bookings/route";
import { connectToDatabase } from "@/lib/mongodb";
import { addDays, addMinutes, todayInZone, zonedToUtc } from "@/lib/time";
import { Booking } from "@/models/Booking";
import { Payment } from "@/models/Payment";
import { SessionRecord } from "@/models/SessionRecord";
import { User } from "@/models/User";
import { signSession } from "@/lib/session";
import { saveWorkoutRecord } from "@/services/session.service";
import type { AdminBookingDetail, AdminBookingPage } from "@/types/booking";
import { createAccount, createExpiredSession, createPaidBooking, makeRequest, routeContext } from "./helpers";

type Account = { id: string; session: string };

const day = addDays(todayInZone(), 3);
const at = (time: string, date = day) => zonedToUtc(date, time);

let admin: Account;
let customer: Account;
let trainer: Account;

async function namedAccount(role: "customer" | "trainer", name: string) {
  const user = await User.create({ name, email: `${crypto.randomUUID()}@test.dev`, passwordHash: "not-used", role });
  const id = user._id.toString();
  return { id, session: await signSession({ userId: id, role }) };
}

function list(query = "", session = admin.session) {
  return adminBookings(makeRequest(`/api/admin/bookings${query}`, { session }));
}

async function listOk(query = "") {
  const response = await list(query);
  expect(response.status).toBe(200);
  return (await response.json()) as AdminBookingPage;
}

function detail(id: string, session = admin.session) {
  return adminBookingDetail(makeRequest(`/api/admin/bookings/${id}`, { session }), routeContext({ id }));
}

beforeEach(async () => {
  await connectToDatabase();
  await Promise.all([Booking.deleteMany({}), Payment.deleteMany({}), SessionRecord.deleteMany({})]);
  admin = await createAccount("admin");
  customer = await createAccount("customer");
  trainer = await createAccount("trainer");
});

describe("admin booking access", () => {
  test("unauthenticated requests are rejected", async () => {
    const bookingId = await createPaidBooking(customer.id, trainer.id, at("10:00"));

    expect((await adminBookings(makeRequest("/api/admin/bookings"))).status).toBe(401);
    expect((await adminBookingDetail(makeRequest(`/api/admin/bookings/${bookingId}`), routeContext({ id: bookingId }))).status).toBe(401);
  });

  test("customers and trainers cannot read admin booking data", async () => {
    const bookingId = await createPaidBooking(customer.id, trainer.id, at("10:00"));

    for (const account of [customer, trainer]) {
      expect((await list("", account.session)).status).toBe(403);
      expect((await detail(bookingId, account.session)).status).toBe(403);
    }
  });
});

describe("admin booking list", () => {
  test("lists bookings with contacts, amounts and statuses but no auth fields", async () => {
    await createPaidBooking(customer.id, trainer.id, at("10:00"), { sessionPrice: 39900, commissionAmount: 3990, totalAmount: 43890 });
    await createPaidBooking(customer.id, trainer.id, at("12:00"), { paymentStatus: "unpaid" });

    const response = await list();
    const text = await response.text();
    const page = JSON.parse(text) as AdminBookingPage;

    expect(text).not.toContain("passwordHash");
    expect(page.total).toBe(2);
    expect(page.bookings.map((booking) => booking.startTime)).toEqual([at("12:00").toISOString(), at("10:00").toISOString()]);

    const [unpaid, paid] = page.bookings;
    expect(paid.customer).toMatchObject({ id: customer.id, name: expect.stringContaining("Test customer") });
    expect(paid.customer.email).toContain("@test.dev");
    expect(paid.trainer?.id).toBe(trainer.id);
    expect(paid.amounts).toEqual({ sessionPrice: 39900, commissionAmount: 3990, totalAmount: 43890 });
    expect(paid).toMatchObject({ mode: "scheduled", status: "confirmed", paymentStatus: "paid", sessionStatus: "scheduled" });
    expect(unpaid.amounts).toBeNull();
    expect(unpaid.paymentStatus).toBe("unpaid");
  });

  test("filters by booking status and payment status", async () => {
    await createPaidBooking(customer.id, trainer.id, at("08:00"));
    await createPaidBooking(customer.id, trainer.id, at("09:00"), { status: "cancelled" });
    await createPaidBooking(customer.id, trainer.id, at("10:00"), { paymentStatus: "failed" });

    expect((await listOk("?status=cancelled")).bookings.map((booking) => booking.status)).toEqual(["cancelled"]);
    expect((await listOk("?payment=failed")).bookings.map((booking) => booking.paymentStatus)).toEqual(["failed"]);
    expect((await listOk("?status=confirmed&payment=paid")).total).toBe(1);
  });

  test("filters by IST date, including the day boundaries", async () => {
    const nextDay = addDays(day, 1);
    await createPaidBooking(customer.id, trainer.id, at("00:00"));
    await createPaidBooking(customer.id, trainer.id, at("23:00"));
    await createPaidBooking(customer.id, trainer.id, at("00:00", nextDay));

    const page = await listOk(`?date=${day}`);

    expect(page.total).toBe(2);
    expect(page.bookings.map((booking) => booking.startTime)).toEqual([at("23:00").toISOString(), at("00:00").toISOString()]);
  });

  test("searches by customer name, trainer name and exact booking id", async () => {
    const riya = await namedAccount("customer", "Riya Sharma");
    const kabir = await namedAccount("trainer", "Kabir Rao");
    const riyaBooking = await createPaidBooking(riya.id, trainer.id, at("08:00"));
    const kabirBooking = await createPaidBooking(customer.id, kabir.id, at("09:00"));
    await createPaidBooking(customer.id, trainer.id, at("10:00"));

    expect((await listOk("?q=riya")).bookings.map((booking) => booking.id)).toEqual([riyaBooking]);
    expect((await listOk("?q=KABIR%20R")).bookings.map((booking) => booking.id)).toEqual([kabirBooking]);
    expect((await listOk(`?q=${kabirBooking}`)).bookings.map((booking) => booking.id)).toEqual([kabirBooking]);
    expect((await listOk("?q=(a+")).total).toBe(0);
  });

  test("paginates 20 bookings per page", async () => {
    for (let index = 0; index < 25; index++) {
      await createPaidBooking(customer.id, trainer.id, addMinutes(at("06:00"), index * 30));
    }

    const first = await listOk();
    const second = await listOk("?page=2");

    expect(first).toMatchObject({ page: 1, pageSize: 20, total: 25, totalPages: 2 });
    expect(first.bookings).toHaveLength(20);
    expect(second.bookings).toHaveLength(5);
    expect(new Set([...first.bookings, ...second.bookings].map((booking) => booking.id)).size).toBe(25);
  });

  test("returns an empty page when nothing matches", async () => {
    await createPaidBooking(customer.id, trainer.id, at("10:00"));

    expect(await listOk("?status=pending")).toMatchObject({ bookings: [], total: 0, totalPages: 0 });
    expect(await listOk("?q=nobody-has-this-name")).toMatchObject({ bookings: [], total: 0 });
  });

  test("treats blank filters as unset and rejects invalid ones", async () => {
    await createPaidBooking(customer.id, trainer.id, at("10:00"));

    expect((await listOk("?status=&payment=&date=&q=&page=")).total).toBe(1);

    for (const query of ["?status=bogus", "?payment=free", "?date=22-10-2026", "?page=0"]) {
      const response = await list(query);
      expect(response.status).toBe(400);
      expect((await response.json()).fieldErrors).toBeDefined();
    }
  });

  test("handles bookings whose customer or trainer no longer exist", async () => {
    const ghost = new Types.ObjectId().toString();
    await createPaidBooking(ghost, ghost, at("10:00"));
    await createPaidBooking(customer.id, trainer.id, at("11:00"), { trainerId: null, status: "pending", paymentStatus: "unpaid" });

    const page = await listOk();
    const [unassigned, orphan] = page.bookings;

    expect(orphan.customer).toEqual({ id: ghost, name: "Unknown", email: null });
    expect(orphan.trainer).toEqual({ id: ghost, name: "Unknown", email: null });
    expect(unassigned.trainer).toBeNull();
  });

  test("an expired session is reconciled before filtering by completed", async () => {
    const { bookingId } = await createExpiredSession(customer.id, trainer.id);

    const page = await listOk("?status=completed");

    expect(page.bookings.map((booking) => booking.id)).toEqual([bookingId]);
    expect(page.bookings[0].sessionStatus).toBe("completed");
  });
});

describe("admin booking detail", () => {
  test("returns contacts, payment attempts and session timestamps without workout notes", async () => {
    const { bookingId } = await createExpiredSession(customer.id, trainer.id);
    await saveWorkoutRecord(bookingId, trainer.id, { exercises: [{ name: "Squat" }], trainerNotes: "Private note", suggestedNextWorkout: "" }, addMinutes(new Date(), -20));
    const base = { bookingId, customerId: customer.id, isPeak: false, sessionPrice: 39900, commissionPercent: 10, commissionAmount: 3990, totalAmount: 43890, pricingRuleId: new Types.ObjectId() };
    await Payment.create({ ...base, status: "failed", failureReason: "Declined", expiresAt: new Date() });
    await Payment.create({ ...base, status: "paid", providerReference: "sim_test", paidAt: new Date(), expiresAt: new Date() });

    const response = await detail(bookingId);
    const text = await response.text();
    const body = JSON.parse(text) as AdminBookingDetail;

    expect(response.status).toBe(200);
    expect(text).not.toContain("Private note");
    expect(text).not.toContain("passwordHash");
    expect(body.booking.customer.id).toBe(customer.id);
    expect(body.booking.trainer?.id).toBe(trainer.id);
    expect(body.payments.map((payment) => payment.status).sort()).toEqual(["failed", "paid"]);
    expect(body.session.status).toBe("completed");
    expect(body.session.startedAt).not.toBeNull();
    expect(body.session.endsAt).not.toBeNull();
    expect(body.session.completedAt).toBe(body.session.endsAt);
  });

  test("a booking without a session reports it as not started", async () => {
    const bookingId = await createPaidBooking(customer.id, trainer.id, at("10:00"));

    const body = (await (await detail(bookingId)).json()) as AdminBookingDetail;

    expect(body.session).toMatchObject({ status: "scheduled", startedAt: null, endsAt: null, completedAt: null });
    expect(body.payments).toEqual([]);
  });

  test("malformed and unknown booking ids return 404", async () => {
    expect((await detail("not-an-id")).status).toBe(404);
    expect((await detail(new Types.ObjectId().toString())).status).toBe(404);
  });
});
