import { beforeEach, describe, expect, test } from "bun:test";
import { GET as myBookings } from "@/app/api/bookings/me/route";
import { POST as postComplete } from "@/app/api/sessions/[id]/complete/route";
import { PATCH as patchRecord } from "@/app/api/sessions/[id]/record/route";
import { GET as getSession } from "@/app/api/sessions/[id]/route";
import { POST as postStart } from "@/app/api/sessions/[id]/start/route";
import { GET as mySessions } from "@/app/api/sessions/me/route";
import { connectToDatabase } from "@/lib/mongodb";
import { addMinutes } from "@/lib/time";
import { Booking } from "@/models/Booking";
import { SessionRecord } from "@/models/SessionRecord";
import { completeSession, saveWorkoutRecord, startSession } from "@/services/session.service";
import { createAccount, makeRequest, routeContext } from "./helpers";

type Account = { id: string; session: string };

const workout = {
  exercises: [{ name: "Goblet squat", sets: 3, reps: 12 }, { name: "Plank", sets: 3, notes: "45 seconds" }],
  trainerNotes: "Strong session. Watch knee alignment on squats.",
  suggestedNextWorkout: "Upper body push focus",
};

function soon(minutes = 5) {
  return new Date(Math.floor(Date.now() / 60_000) * 60_000 + minutes * 60_000);
}

async function setup(startTime = soon(), overrides: Record<string, unknown> = {}) {
  const [customer, trainer] = [await createAccount("customer"), await createAccount("trainer")];
  const booking = await Booking.create({
    customerId: customer.id,
    trainerId: trainer.id,
    startTime,
    endTime: addMinutes(startTime, 60),
    bookingType: "scheduled",
    status: "confirmed",
    paymentStatus: "paid",
    serviceZone: "Indiranagar",
    ...overrides,
  });
  return { customer, trainer, bookingId: booking._id.toString(), startTime };
}

async function setupExpired() {
  const scheduled = addMinutes(new Date(), -70);
  const context = await setup(scheduled);
  await startSession(context.bookingId, context.trainer.id, scheduled);
  return context;
}

const request = (account: Partial<Account>, path: string, method = "GET", body?: unknown) =>
  makeRequest(path, { method, session: account.session, body });

const start = (account: Partial<Account>, id: string, body?: unknown) =>
  postStart(request(account, `/api/sessions/${id}/start`, "POST", body), routeContext({ id }));
const complete = (account: Partial<Account>, id: string) =>
  postComplete(request(account, `/api/sessions/${id}/complete`, "POST"), routeContext({ id }));
const read = (account: Partial<Account>, id: string) => getSession(request(account, `/api/sessions/${id}`), routeContext({ id }));
const saveRecord = (account: Partial<Account>, id: string, body: unknown = workout) =>
  patchRecord(request(account, `/api/sessions/${id}/record`, "PATCH", body), routeContext({ id }));

beforeEach(async () => {
  await connectToDatabase();
  await Promise.all([Booking.deleteMany({}), SessionRecord.deleteMany({})]);
});

describe("starting sessions", () => {
  test("the assigned trainer starts an eligible session with a server-set 60-minute end", async () => {
    const { trainer, bookingId } = await setup();
    const before = Date.now();

    const response = await start(trainer, bookingId, { startedAt: "2000-01-01T00:00:00.000Z", endsAt: "2100-01-01T00:00:00.000Z" });
    const { session } = await response.json();
    const startedAt = new Date(session.startedAt).getTime();

    expect(response.status).toBe(201);
    expect(session.status).toBe("in_progress");
    expect(startedAt).toBeGreaterThanOrEqual(before);
    expect(new Date(session.endsAt).getTime() - startedAt).toBe(60 * 60_000);
  });

  test("an unrelated trainer and a customer cannot start or complete the session", async () => {
    const { customer, bookingId } = await setup();
    const stranger = await createAccount("trainer");

    expect((await start(stranger, bookingId)).status).toBe(404);
    expect((await start(customer, bookingId)).status).toBe(403);
    expect((await complete(customer, bookingId)).status).toBe(403);
    expect((await start({}, bookingId)).status).toBe(401);
    expect(await SessionRecord.countDocuments()).toBe(0);
  });

  test("repeated start requests keep the original start time and a single record", async () => {
    const { trainer, bookingId } = await setup();

    const first = await (await start(trainer, bookingId)).json();
    const again = await start(trainer, bookingId);

    expect(again.status).toBe(200);
    expect((await again.json()).session.startedAt).toBe(first.session.startedAt);
    expect(await SessionRecord.countDocuments({ bookingId })).toBe(1);
  });

  test("simultaneous start requests persist one authoritative start time", async () => {
    const { trainer, bookingId } = await setup();

    const responses = await Promise.all(Array.from({ length: 5 }, () => start(trainer, bookingId)));
    const bodies = await Promise.all(responses.map((response) => response.json()));

    expect(responses.map((response) => response.status).sort()).toEqual([200, 200, 200, 200, 201]);
    expect(new Set(bodies.map((body) => body.session.startedAt)).size).toBe(1);
    expect(await SessionRecord.countDocuments({ bookingId })).toBe(1);
  });

  test("cancelled, unpaid and out-of-window bookings cannot start", async () => {
    const cancelled = await setup(soon(), { status: "cancelled" });
    const unpaid = await setup(soon(), { paymentStatus: "unpaid" });
    const tooEarly = await setup(soon(120));
    const tooLate = await setup(addMinutes(new Date(), -40));

    for (const { trainer, bookingId } of [cancelled, unpaid, tooEarly, tooLate]) {
      expect((await start(trainer, bookingId)).status).toBe(409);
    }
    expect((await (await read(tooLate.trainer, tooLate.bookingId)).json()).session.status).toBe("missed");
    expect(await SessionRecord.countDocuments()).toBe(0);
  });
});

describe("completing sessions", () => {
  test("a session cannot be completed before its end time", async () => {
    const { trainer, bookingId } = await setup();
    await start(trainer, bookingId);

    const response = await complete(trainer, bookingId);

    expect(response.status).toBe(409);
    expect((await (await read(trainer, bookingId)).json()).session.status).toBe("in_progress");
  });

  test("an expired session is completed when read, at its authoritative end time", async () => {
    const { customer, trainer, bookingId } = await setupExpired();

    const { session } = await (await read(customer, bookingId)).json();
    const booking = await Booking.findById(bookingId).lean();

    expect(session.status).toBe("completed");
    expect(session.completedAt).toBe(session.endsAt);
    expect(booking).toMatchObject({ status: "completed", paymentStatus: "paid" });

    const reread = (await (await read(trainer, bookingId)).json()).session;
    expect([reread.startedAt, reread.endsAt, reread.completedAt]).toEqual([session.startedAt, session.endsAt, session.completedAt]);
    expect((await start(trainer, bookingId)).status).toBe(200);
    expect((await (await read(trainer, bookingId)).json()).session.startedAt).toBe(session.startedAt);
  });

  test("simultaneous completion requests produce exactly one transition", async () => {
    const { trainer, bookingId } = await setupExpired();

    const results = await Promise.all(Array.from({ length: 5 }, () => completeSession(bookingId, trainer.id)));
    const responses = await Promise.all(Array.from({ length: 3 }, () => complete(trainer, bookingId)));

    expect(results.filter((result) => result.transitioned)).toHaveLength(1);
    expect(new Set(results.map((result) => result.session.completedAt)).size).toBe(1);
    expect(responses.every((response) => response.status === 200)).toBe(true);
    expect(await SessionRecord.countDocuments({ bookingId, status: "completed" })).toBe(1);
  });

  test("customers see the session status in their bookings", async () => {
    const { customer } = await setupExpired();

    const { bookings } = await (await myBookings(request(customer, "/api/bookings/me"))).json();

    expect(bookings[0]).toMatchObject({ sessionStatus: "completed", status: "completed", paymentStatus: "paid" });
  });
});

describe("workout records", () => {
  test("only the assigned trainer can save notes, and timestamps cannot be changed through the form", async () => {
    const { customer, trainer, bookingId } = await setup();
    const stranger = await createAccount("trainer");
    const started = (await (await start(trainer, bookingId)).json()).session;

    expect((await saveRecord(stranger, bookingId)).status).toBe(404);
    expect((await saveRecord(customer, bookingId)).status).toBe(403);

    const response = await saveRecord(trainer, bookingId, { ...workout, startedAt: "2000-01-01T00:00:00.000Z", status: "completed" });
    const { session } = await response.json();

    expect(response.status).toBe(200);
    expect(session.record).toMatchObject({ trainerNotes: workout.trainerNotes, suggestedNextWorkout: workout.suggestedNextWorkout });
    expect(session.record.exercises).toHaveLength(2);
    expect([session.startedAt, session.status]).toEqual([started.startedAt, "in_progress"]);
  });

  test("notes require a started session, validate input and lock 24 hours after completion", async () => {
    const pending = await setup();
    expect((await saveRecord(pending.trainer, pending.bookingId)).status).toBe(409);
    expect((await saveRecord(pending.trainer, pending.bookingId, { ...workout, exercises: [{ name: "" }] })).status).toBe(400);

    const { trainer, bookingId } = await setupExpired();
    const { session } = await (await read(trainer, bookingId)).json();
    const lockedAt = addMinutes(new Date(session.completedAt), 24 * 60 + 1);

    await expect(saveWorkoutRecord(bookingId, trainer.id, workout, lockedAt)).rejects.toMatchObject({ status: 409 });
    expect((await saveRecord(trainer, bookingId)).status).toBe(200);
  });

  test("customers can read only their own session history", async () => {
    const { customer, trainer, bookingId } = await setupExpired();
    const otherCustomer = await createAccount("customer");
    await saveRecord(trainer, bookingId);

    expect((await read(otherCustomer, bookingId)).status).toBe(404);

    const { session } = await (await read(customer, bookingId)).json();
    expect(session.record.trainerNotes).toBe(workout.trainerNotes);
  });
});

describe("trainer session list", () => {
  test("filters sessions by status and only lists the trainer's own", async () => {
    const { trainer, bookingId } = await setup();
    await setup();
    await start(trainer, bookingId);

    const list = async (status: string) =>
      (await (await mySessions(request(trainer, `/api/sessions/me?status=${status}`))).json()).sessions;

    expect(await list("in_progress")).toHaveLength(1);
    expect(await list("upcoming")).toHaveLength(0);
    expect(await list("all")).toHaveLength(1);
  });
});
