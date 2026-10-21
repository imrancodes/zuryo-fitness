import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { FitnessProfileInput } from "@/validators/fitness";

const prompts: string[] = [];
const state = { configured: true, respond: async (): Promise<string> => JSON.stringify(VALID_PLAN) };

class FakeAiError extends Error {
  constructor(public readonly kind: string) {
    super(kind);
  }
}

mock.module("@/services/ai/gemini", () => ({
  AiError: FakeAiError,
  DEFAULT_AI_MODEL: "test-model",
  aiModel: () => "test-model",
  isAiConfigured: () => state.configured,
  generateJson: async ({ prompt }: { prompt: string }) => {
    prompts.push(prompt);
    return state.respond();
  },
}));

const { GET: getRecommendation } = await import("@/app/api/recommendations/me/route");
const { POST: regenerate } = await import("@/app/api/recommendations/me/regenerate/route");
const { connectToDatabase } = await import("@/lib/mongodb");
const { AiRecommendationCache } = await import("@/models/AiRecommendation");
const { Booking } = await import("@/models/Booking");
const { FitnessAssessment } = await import("@/models/FitnessAssessment");
const { FitnessProfile } = await import("@/models/FitnessProfile");
const { SessionRecord } = await import("@/models/SessionRecord");
const { User } = await import("@/models/User");
const { saveProfile } = await import("@/services/fitness-profile.service");
const { getAiRecommendation } = await import("@/services/recommendation.service");
const { saveWorkoutRecord, startSession } = await import("@/services/session.service");
const { createAccount, createExpiredSession, createPaidBooking, makeRequest } = await import("./helpers");
const { VALID_PLAN } = await import("./ai-fixtures");

type Account = { id: string; session: string };

const muscleProfile: FitnessProfileInput = {
  age: 34,
  weight: 82,
  fitnessGoals: ["build_muscle"],
  experienceLevel: "intermediate",
  workoutPreferences: { workoutTypes: ["strength"], preferredTimes: ["morning"] },
};

const fetchPlan = (account: Partial<Account>, query = "") =>
  getRecommendation(makeRequest(`/api/recommendations/me${query}`, { session: account.session }));
const regeneratePlan = (account: Partial<Account>) =>
  regenerate(makeRequest("/api/recommendations/me/regenerate", { method: "POST", session: account.session }));

async function customerWithProfile(profile = muscleProfile) {
  const customer = await createAccount("customer");
  await saveProfile(customer.id, profile);
  return customer;
}

async function completeWorkout(customerId: string, exercise: string, suggestion = "") {
  const { bookingId, trainerId } = await createExpiredSession(customerId);
  await saveWorkoutRecord(bookingId, trainerId, {
    exercises: [{ name: exercise, sets: 3, reps: 10 }],
    trainerNotes: `Private trainer note about ${exercise}`,
    suggestedNextWorkout: suggestion,
  });
}

beforeEach(async () => {
  await connectToDatabase();
  await Promise.all([
    AiRecommendationCache.deleteMany({}),
    FitnessProfile.deleteMany({}),
    FitnessAssessment.deleteMany({}),
    SessionRecord.deleteMany({}),
    Booking.deleteMany({}),
  ]);
  prompts.length = 0;
  state.configured = true;
  state.respond = async () => JSON.stringify(VALID_PLAN);
});

describe("access", () => {
  test("only signed-in customers can get or regenerate recommendations", async () => {
    const trainer = await createAccount("trainer");

    expect((await fetchPlan({})).status).toBe(401);
    expect((await regeneratePlan({})).status).toBe(401);
    expect((await fetchPlan(trainer)).status).toBe(403);
    expect(prompts).toHaveLength(0);
  });

  test("a customer always gets a plan built from their own profile, whatever the query says", async () => {
    const customer = await customerWithProfile();
    const other = await customerWithProfile({ ...muscleProfile, fitnessGoals: ["increase_flexibility"] });

    const response = await fetchPlan(customer, `?customerId=${other.id}`);

    expect(response.status).toBe(200);
    expect((await response.json()).source).toBe("ai");
    expect(prompts[0]).toContain("Build muscle");
    expect(prompts[0]).not.toContain("Increase flexibility");
  });

  test("only the customer's own completed workouts are sent, without identifying details", async () => {
    const customer = await customerWithProfile();
    const other = await customerWithProfile();
    const trainer = await createAccount("trainer");
    const user = await User.findById(customer.id).lean();
    await completeWorkout(customer.id, "Bench press", "Upper body push focus");
    await completeWorkout(other.id, "Marathon prep run");
    const running = await createPaidBooking(customer.id, trainer.id, new Date(Math.floor(Date.now() / 60_000) * 60_000));
    await startSession(running, trainer.id);
    await saveWorkoutRecord(running, trainer.id, { exercises: [{ name: "Unfinished deadlift" }], trainerNotes: "", suggestedNextWorkout: "" });

    await fetchPlan(customer);
    const [prompt] = prompts;

    expect(prompt).toContain("Bench press");
    expect(prompt).toContain("Upper body push focus");
    for (const forbidden of ["Marathon prep run", "Unfinished deadlift", "Private trainer note", user!.email, user!.name, customer.id, "82"]) {
      expect(prompt).not.toContain(forbidden);
    }
  });

  test("credentials and prompts are never returned to the client", async () => {
    process.env.GEMINI_API_KEY = "test-secret-gemini-key";
    const customer = await customerWithProfile();

    const body = await (await fetchPlan(customer)).text();
    process.env.GEMINI_API_KEY = "";

    expect(body).not.toContain("test-secret-gemini-key");
    expect(body).not.toContain("customer_data");
    expect(body).not.toContain("You are a fitness coaching assistant");
  });
});

describe("fallbacks", () => {
  test("a missing profile asks for the assessment without calling the model", async () => {
    const customer = await createAccount("customer");

    const result = await (await fetchPlan(customer)).json();

    expect(result).toMatchObject({ status: "needs_profile" });
    expect(prompts).toHaveLength(0);
  });

  test("without an API key the rules-based suggestions are returned", async () => {
    state.configured = false;
    const customer = await customerWithProfile();

    const result = await (await fetchPlan(customer)).json();

    expect(result).toMatchObject({ status: "ready", source: "rules", fallbackReason: "not_configured" });
    expect(result.suggestions.length).toBeGreaterThan(0);
    expect(prompts).toHaveLength(0);
  });

  test.each([
    ["non-JSON output", "Sure! Here is a plan."],
    ["a schema violation", JSON.stringify({ ...VALID_PLAN, durationMinutes: 300 })],
    ["unsafe advice", JSON.stringify({ ...VALID_PLAN, recoveryAdvice: "No pain, no gain: push through the pain." })],
    ["oversized output", JSON.stringify({ ...VALID_PLAN, summary: "x".repeat(9000) })],
  ])("%s falls back safely and is not cached", async (_label, output) => {
    state.respond = async () => output;
    const customer = await customerWithProfile();

    const result = await (await fetchPlan(customer)).json();

    expect(result).toMatchObject({ source: "rules", fallbackReason: "invalid_output" });
    expect((await AiRecommendationCache.findOne({ customerId: customer.id }).lean())?.recommendation ?? null).toBeNull();
  });

  test("provider errors fall back, and a rate limit triggers a short cooldown", async () => {
    const customer = await customerWithProfile();

    state.respond = async () => {
      throw new FakeAiError("failed");
    };
    expect((await (await fetchPlan(customer)).json()).fallbackReason).toBe("provider_error");

    state.respond = async () => {
      throw new FakeAiError("timeout");
    };
    expect((await (await fetchPlan(customer)).json()).fallbackReason).toBe("timeout");

    state.respond = async () => {
      throw new FakeAiError("rate_limited");
    };
    expect((await (await fetchPlan(customer)).json()).fallbackReason).toBe("rate_limited");
    const callsAfterLimit = prompts.length;
    expect((await (await fetchPlan(customer)).json()).fallbackReason).toBe("rate_limited");
    expect(prompts).toHaveLength(callsAfterLimit);
  });
});

describe("caching and regeneration", () => {
  test("reuses the saved plan until the profile or completed sessions change, or it is 7 days old", async () => {
    const customer = await customerWithProfile();

    const first = await (await fetchPlan(customer)).json();
    const second = await (await fetchPlan(customer)).json();
    expect([first.cached, second.cached, prompts.length]).toEqual([false, true, 1]);

    await saveProfile(customer.id, { ...muscleProfile, fitnessGoals: ["build_muscle", "general_fitness"] });
    await fetchPlan(customer);
    expect(prompts).toHaveLength(2);

    await completeWorkout(customer.id, "Goblet squat");
    await fetchPlan(customer);
    expect(prompts).toHaveLength(3);

    await getAiRecommendation(customer.id, { now: new Date(Date.now() + 8 * 24 * 60 * 60_000) });
    expect(prompts).toHaveLength(4);
  });

  test("regeneration is limited to 3 per day", async () => {
    const customer = await customerWithProfile();

    const statuses = [];
    for (let attempt = 0; attempt < 4; attempt += 1) {
      statuses.push((await regeneratePlan(customer)).status);
    }

    expect(statuses).toEqual([200, 200, 200, 429]);
    expect(prompts).toHaveLength(3);
  });

  test("simultaneous regenerations cannot exceed the limit", async () => {
    const customer = await customerWithProfile();

    const statuses = (await Promise.all(Array.from({ length: 6 }, () => regeneratePlan(customer)))).map((response) => response.status);

    expect(statuses.filter((status) => status === 200).length).toBeLessThanOrEqual(3);
    expect(statuses.filter((status) => status === 429).length).toBeGreaterThanOrEqual(3);
    expect((await AiRecommendationCache.findOne({ customerId: customer.id }).lean())?.regenerations).toHaveLength(3);
  });
});

describe("regeneration without configuration", () => {
  test("does not use up a regeneration when AI is not configured", async () => {
    state.configured = false;
    const customer = await customerWithProfile();

    const result = await (await regeneratePlan(customer)).json();

    expect(result).toMatchObject({ source: "rules", fallbackReason: "not_configured", regenerationsLeft: 3 });
  });
});
