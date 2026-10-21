import { beforeEach, describe, expect, test } from "bun:test";
import { GET as myBookings } from "@/app/api/bookings/me/route";
import { PUT as putProfile } from "@/app/api/fitness-profile/me/route";
import { GET as myProgress } from "@/app/api/progress/me/route";
import { GET as myRecommendations } from "@/app/api/recommendations/me/route";
import { PUT as putFeedback } from "@/app/api/sessions/[id]/feedback/route";
import { GET as readSession } from "@/app/api/sessions/[id]/route";
import { GET as myHistory } from "@/app/api/sessions/history/me/route";
import { connectToDatabase } from "@/lib/mongodb";
import { signSession } from "@/lib/session";
import { Booking } from "@/models/Booking";
import { FitnessAssessment } from "@/models/FitnessAssessment";
import { FitnessProfile } from "@/models/FitnessProfile";
import { SessionRecord } from "@/models/SessionRecord";
import { saveWorkoutRecord, startSession } from "@/services/session.service";
import { createAccount, createExpiredSession, createPaidBooking, makeRequest, routeContext } from "./helpers";

type Account = { id: string; session: string };

const profile = {
  age: 31,
  weight: 80,
  fitnessGoals: ["build_muscle"],
  experienceLevel: "intermediate",
  workoutPreferences: { workoutTypes: ["strength"], preferredTimes: ["evening"] },
};

const get = async (handler: (request: ReturnType<typeof makeRequest>) => Promise<Response>, account: Account, path: string) =>
  (await handler(makeRequest(path, { session: account.session }))).json();

async function completedWithNotes(customer: Account, suggestion: string) {
  const { bookingId, trainerId } = await createExpiredSession(customer.id);
  await saveWorkoutRecord(bookingId, trainerId, {
    exercises: [{ name: "Bench press", sets: 3, reps: 10 }],
    trainerNotes: `Notes for ${suggestion}`,
    suggestedNextWorkout: suggestion,
  });
  return { bookingId, trainerId };
}

beforeEach(async () => {
  await connectToDatabase();
  await Promise.all([Booking.deleteMany({}), SessionRecord.deleteMany({}), FitnessProfile.deleteMany({}), FitnessAssessment.deleteMany({})]);
});

describe("booking history", () => {
  test("filters only the signed-in customer's bookings by session status", async () => {
    const [customer, other] = [await createAccount("customer"), await createAccount("customer")];
    const trainer = await createAccount("trainer");
    await createPaidBooking(customer.id, trainer.id, new Date(Date.now() + 2 * 24 * 60 * 60_000));
    await createExpiredSession(customer.id);
    await createPaidBooking(customer.id, trainer.id, new Date(Date.now() + 3 * 24 * 60 * 60_000), { status: "cancelled" });
    await createPaidBooking(other.id, trainer.id, new Date(Date.now() + 2 * 24 * 60 * 60_000));

    const list = async (status: string) => (await get(myBookings, customer, `/api/bookings/me?status=${status}`)).bookings;

    expect(await list("upcoming")).toHaveLength(1);
    expect(await list("completed")).toHaveLength(1);
    expect(await list("cancelled")).toHaveLength(1);
    expect(await list("in_progress")).toHaveLength(0);
    expect(await list("all")).toHaveLength(3);
    expect((await myBookings(makeRequest("/api/bookings/me?status=archived", { session: customer.session }))).status).toBe(400);
  });
});

describe("workout history and feedback", () => {
  test("history contains only the customer's completed sessions", async () => {
    const [customer, other] = [await createAccount("customer"), await createAccount("customer")];
    const { bookingId } = await completedWithNotes(customer, "Upper body push");
    await completedWithNotes(other, "Leg day");

    const { sessions } = await get(myHistory, customer, "/api/sessions/history/me");

    expect(sessions).toHaveLength(1);
    expect(sessions[0]).toMatchObject({ id: bookingId, durationMinutes: 60, record: { trainerNotes: "Notes for Upper body push" } });
  });

  test("customers rate their own completed sessions without touching trainer notes", async () => {
    const [customer, other] = [await createAccount("customer"), await createAccount("customer")];
    const trainer = await createAccount("trainer");
    const { bookingId } = await completedWithNotes(customer, "Core work");
    const running = await createPaidBooking(customer.id, trainer.id, new Date(Math.floor(Date.now() / 60_000) * 60_000));
    await startSession(running, trainer.id);

    const rate = (account: Account, id: string, body: unknown) =>
      putFeedback(makeRequest(`/api/sessions/${id}/feedback`, { method: "PUT", session: account.session, body }), routeContext({ id }));

    expect((await rate(customer, bookingId, { rating: 5, comment: "Great session", trainerNotes: "hacked" })).status).toBe(200);
    expect((await rate(customer, bookingId, { rating: 6, comment: "" })).status).toBe(400);
    expect((await rate(other, bookingId, { rating: 1, comment: "" })).status).toBe(404);
    expect((await rate(trainer, bookingId, { rating: 1, comment: "" })).status).toBe(403);
    expect((await rate(customer, running, { rating: 4, comment: "" })).status).toBe(409);

    const [entry] = (await get(myHistory, customer, "/api/sessions/history/me")).sessions;
    expect(entry.feedback).toEqual({ rating: 5, comment: "Great session" });
    expect(entry.record.trainerNotes).toBe("Notes for Core work");
  });

  test("trainers see only a minimal profile snapshot and their own past sessions with the customer", async () => {
    const customer = await createAccount("customer");
    await putProfile(makeRequest("/api/fitness-profile/me", { method: "PUT", session: customer.session, body: profile }));
    const { trainerId } = await completedWithNotes(customer, "Pull day");
    const trainer = { id: trainerId, session: await signSession({ userId: trainerId, role: "trainer" }) };
    const upcoming = await createPaidBooking(customer.id, trainerId, new Date(Date.now() + 5 * 60_000));

    const { session } = await (await readSession(makeRequest(`/api/sessions/${upcoming}`, { session: trainer.session }), routeContext({ id: upcoming }))).json();

    expect(session.customerProfile).toEqual({
      fitnessGoals: ["build_muscle"],
      experienceLevel: "intermediate",
      workoutPreferences: { workoutTypes: ["strength"], preferredTimes: ["evening"] },
    });
    expect(session.previousSessions).toHaveLength(1);
  });
});

describe("progress and recommendations", () => {
  test("progress is built from the customer's own stored assessments and sessions", async () => {
    const [customer, other] = [await createAccount("customer"), await createAccount("customer")];
    const save = (body: unknown) => putProfile(makeRequest("/api/fitness-profile/me", { method: "PUT", session: customer.session, body }));
    await save(profile);
    await save({ ...profile, weight: 78.5 });
    await completedWithNotes(customer, "Row variations");
    await completedWithNotes(other, "Squats");
    await completedWithNotes(other, "Lunges");

    const { progress } = await get(myProgress, customer, "/api/progress/me");

    expect(progress.completedTotal).toBe(1);
    expect(progress.completedLast30Days).toBe(1);
    expect(progress.weights.map((point: { weight: number }) => point.weight)).toEqual([80, 78.5]);
    expect(progress.weightChange.deltaKg).toBe(-1.5);
    expect(progress.consistency).toEqual({ activeWeeks: 1, totalWeeks: 8 });
  });

  test("recommendations need a profile and use only the customer's own history", async () => {
    const [customer, other] = [await createAccount("customer"), await createAccount("customer")];

    expect(await get(myRecommendations, customer, "/api/recommendations/me")).toMatchObject({ status: "needs_profile" });

    await putProfile(makeRequest("/api/fitness-profile/me", { method: "PUT", session: customer.session, body: profile }));
    await completedWithNotes(customer, "Upper body push");
    await completedWithNotes(other, "Marathon prep");

    const result = await get(myRecommendations, customer, "/api/recommendations/me");
    const titles = result.suggestions.map((suggestion: { title: string }) => suggestion.title);

    expect(result.status).toBe("ready");
    expect(titles).toContain("Upper body push");
    expect(titles).not.toContain("Marathon prep");
    expect(titles.some((title: string) => title.startsWith("Strength training"))).toBe(true);
  });
});
