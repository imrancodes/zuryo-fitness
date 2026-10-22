import { beforeEach, describe, expect, test } from "bun:test";
import { GET as findSlots } from "@/app/api/availability/route";
import { GET as getBooking } from "@/app/api/bookings/[id]/route";
import { GET as myBookings } from "@/app/api/bookings/me/route";
import { POST as postBooking } from "@/app/api/bookings/route";
import { connectToDatabase } from "@/lib/mongodb";
import { addDays, addMinutes, MINUTE_MS, todayInZone, zonedToUtc } from "@/lib/time";
import type { ServiceZone } from "@/lib/zones";
import { Booking } from "@/models/Booking";
import { TrainerAvailability } from "@/models/TrainerAvailability";
import { addWindow, createAccount, makeRequest, routeContext } from "./helpers";

const ZONE: ServiceZone = "Mumbai";
const day = addDays(todayInZone(), 2);
const at = (time: string) => zonedToUtc(day, time);

type Account = { id: string; session: string };

function book(customer: Account, body: Record<string, unknown>) {
  return postBooking(
    makeRequest("/api/bookings", {
      method: "POST",
      session: customer.session,
      body: { mode: "scheduled", serviceZone: ZONE, idempotencyKey: crypto.randomUUID(), ...body },
    })
  );
}

async function trainerAvailable(zone: ServiceZone = ZONE, from = at("08:00"), to = at("14:00")) {
  const trainer = await createAccount("trainer");
  await addWindow(trainer.id, zone, from, to);
  return trainer;
}

function nextQuarter() {
  const step = 15 * MINUTE_MS;
  return new Date(Math.floor(Date.now() / step) * step + step);
}

beforeEach(async () => {
  await connectToDatabase();
  await Promise.all([Booking.deleteMany({}), TrainerAvailability.deleteMany({})]);
});

describe("creating bookings", () => {
  test("a valid scheduled booking is confirmed with a trainer and a fixed 60-minute session", async () => {
    const trainer = await trainerAvailable();
    const customer = await createAccount("customer");

    const response = await book(customer, { startTime: at("10:00").toISOString(), status: "completed" });
    const { booking } = await response.json();

    expect(response.status).toBe(201);
    expect(booking).toMatchObject({ status: "confirmed", mode: "scheduled", serviceZone: ZONE });
    expect(booking.trainer.id).toBe(trainer.id);
    expect(booking.customer.id).toBe(customer.id);
    expect(new Date(booking.endTime).getTime() - new Date(booking.startTime).getTime()).toBe(60 * MINUTE_MS);
  });

  test("an instant booking within the next hour succeeds", async () => {
    const start = nextQuarter();
    await trainerAvailable(ZONE, addMinutes(start, -60), addMinutes(start, 180));
    const customer = await createAccount("customer");

    const response = await book(customer, { mode: "instant", startTime: start.toISOString() });

    expect(response.status).toBe(201);
  });

  test("instant booking rejects a session starting more than 60 minutes ahead", async () => {
    const start = addMinutes(nextQuarter(), 60);
    await trainerAvailable(ZONE, addMinutes(start, -120), addMinutes(start, 180));
    const customer = await createAccount("customer");

    const response = await book(customer, { mode: "instant", startTime: start.toISOString() });

    expect(response.status).toBe(400);
    expect((await response.json()).error).toContain("within the next 60 minutes");
  });

  test("past bookings are rejected", async () => {
    const start = addMinutes(nextQuarter(), -60);
    await trainerAvailable(ZONE, addMinutes(start, -60), addMinutes(start, 180));
    const customer = await createAccount("customer");

    const response = await book(customer, { startTime: start.toISOString() });

    expect(response.status).toBe(400);
    expect(await Booking.countDocuments()).toBe(0);
  });

  test("a trainer outside the requested zone is not assigned", async () => {
    await trainerAvailable("Thane");
    const inZone = await trainerAvailable("Mumbai");
    const customer = await createAccount("customer");

    const assigned = await (await book(customer, { startTime: at("10:00").toISOString() })).json();
    const elsewhere = await book(customer, { startTime: at("11:00").toISOString(), serviceZone: "Delhi" });

    expect(assigned.booking.trainer.id).toBe(inZone.id);
    expect(elsewhere.status).toBe(409);
  });

  test("a trainer without availability for the whole session is not assigned", async () => {
    await trainerAvailable(ZONE, at("08:00"), at("10:30"));
    const covering = await trainerAvailable();
    const customer = await createAccount("customer");

    const { booking } = await (await book(customer, { startTime: at("10:00").toISOString() })).json();

    expect(booking.trainer.id).toBe(covering.id);
  });

  test("auto-assignment picks the eligible trainer with the earliest id", async () => {
    const first = await trainerAvailable();
    await trainerAvailable();
    const customer = await createAccount("customer");

    const { booking } = await (await book(customer, { startTime: at("10:00").toISOString() })).json();

    expect(booking.trainer.id).toBe(first.id);
  });

  test("an available preferred trainer is selected", async () => {
    await trainerAvailable();
    const preferred = await trainerAvailable();
    const customer = await createAccount("customer");

    const { booking } = await (
      await book(customer, { startTime: at("10:00").toISOString(), preferredTrainerId: preferred.id })
    ).json();

    expect(booking.trainer.id).toBe(preferred.id);
  });

  test("an unavailable preferred trainer gets a clear conflict and is never swapped", async () => {
    await trainerAvailable();
    const busy = await trainerAvailable(ZONE, at("13:00"), at("16:00"));
    const customer = await createAccount("customer");

    const response = await book(customer, { startTime: at("10:00").toISOString(), preferredTrainerId: busy.id });

    expect(response.status).toBe(409);
    expect((await response.json()).error).toContain("preferred trainer");
    expect(await Booking.countDocuments()).toBe(0);
  });

  test("overlapping bookings for the same trainer are prevented", async () => {
    await trainerAvailable();
    const [first, second] = [await createAccount("customer"), await createAccount("customer")];

    expect((await book(first, { startTime: at("10:00").toISOString() })).status).toBe(201);
    expect((await book(second, { startTime: at("10:30").toISOString() })).status).toBe(409);
    expect(await Booking.countDocuments()).toBe(1);
  });
});

describe("concurrency", () => {
  test("simultaneous requests cannot reserve one trainer for conflicting sessions", async () => {
    const trainer = await trainerAvailable();
    const customers = await Promise.all(Array.from({ length: 5 }, () => createAccount("customer")));
    const starts = ["10:00", "10:15", "10:30", "10:45", "10:00"];

    const responses = await Promise.all(
      customers.map((customer, index) =>
        book(customer, { startTime: at(starts[index]).toISOString(), preferredTrainerId: trainer.id })
      )
    );
    const statuses = responses.map((response) => response.status).sort();

    expect(statuses).toEqual([201, 409, 409, 409, 409]);
    expect(await Booking.countDocuments({ trainerId: trainer.id })).toBe(1);
  });

  test("simultaneous auto-assigned requests use each trainer at most once", async () => {
    await trainerAvailable();
    await trainerAvailable();
    const customers = await Promise.all(Array.from({ length: 3 }, () => createAccount("customer")));

    const responses = await Promise.all(customers.map((customer) => book(customer, { startTime: at("10:00").toISOString() })));
    const created = responses.filter((response) => response.status === 201);
    const trainerIds = await Promise.all(created.map(async (response) => (await response.json()).booking.trainer.id));

    expect(created).toHaveLength(2);
    expect(new Set(trainerIds).size).toBe(2);
    expect(responses.filter((response) => response.status === 409)).toHaveLength(1);
  });

  test("duplicate submissions return the same booking instead of creating another", async () => {
    await trainerAvailable();
    await trainerAvailable();
    const customer = await createAccount("customer");
    const sequentialKey = crypto.randomUUID();
    const concurrentKey = crypto.randomUUID();

    const first = await book(customer, { startTime: at("09:00").toISOString(), idempotencyKey: sequentialKey });
    const retry = await book(customer, { startTime: at("09:00").toISOString(), idempotencyKey: sequentialKey });
    const parallel = await Promise.all(
      [1, 2, 3].map(() => book(customer, { startTime: at("12:00").toISOString(), idempotencyKey: concurrentKey }))
    );
    const parallelIds = await Promise.all(parallel.map(async (response) => (await response.json()).booking.id));

    expect(first.status).toBe(201);
    expect(retry.status).toBe(200);
    expect((await retry.json()).booking.id).toBe((await first.json()).booking.id);
    expect(new Set(parallelIds).size).toBe(1);
    expect(await Booking.countDocuments({ customerId: customer.id })).toBe(2);
  });
});

describe("booking access", () => {
  test("only signed-in customers can create bookings", async () => {
    await trainerAvailable();
    const trainer = await createAccount("trainer");
    const body = { startTime: at("10:00").toISOString() };

    const anonymous = await postBooking(
      makeRequest("/api/bookings", { method: "POST", body: { ...body, mode: "scheduled", serviceZone: ZONE, idempotencyKey: crypto.randomUUID() } })
    );

    expect(anonymous.status).toBe(401);
    expect((await book(trainer, body)).status).toBe(403);
  });

  test("customers cannot view another customer's booking", async () => {
    const trainer = await trainerAvailable();
    const [owner, stranger] = [await createAccount("customer"), await createAccount("customer")];
    const otherTrainer = await createAccount("trainer");
    const { booking } = await (await book(owner, { startTime: at("10:00").toISOString() })).json();
    const view = (viewer: Account) =>
      getBooking(makeRequest(`/api/bookings/${booking.id}`, { session: viewer.session }), routeContext({ id: booking.id }));

    expect((await view(owner)).status).toBe(200);
    expect((await view(trainer)).status).toBe(200);
    expect((await view(stranger)).status).toBe(404);
    expect((await view(otherTrainer)).status).toBe(404);

    const strangerList = await (await myBookings(makeRequest("/api/bookings/me", { session: stranger.session }))).json();
    expect(strangerList.bookings).toHaveLength(0);
  });
});

describe("availability search", () => {
  test("lists open slots per trainer and hides booked times", async () => {
    const trainer = await trainerAvailable(ZONE, at("09:00"), at("12:00"));
    const customer = await createAccount("customer");
    await book(customer, { startTime: at("10:00").toISOString() });

    const response = await findSlots(
      makeRequest(`/api/availability?mode=scheduled&serviceZone=${ZONE}&date=${day}`, { session: customer.session })
    );
    const { trainers, slots } = await response.json();

    expect(response.status).toBe(200);
    expect(trainers[0].trainer.id).toBe(trainer.id);
    expect(slots).toEqual([at("09:00").toISOString(), at("11:00").toISOString()]);
  });
});
