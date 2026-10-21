import { beforeEach, describe, expect, test } from "bun:test";
import { GET as getProfile, PUT as putProfile } from "@/app/api/fitness-profile/me/route";
import { connectToDatabase } from "@/lib/mongodb";
import { FitnessAssessment } from "@/models/FitnessAssessment";
import { FitnessProfile } from "@/models/FitnessProfile";
import { createAccount, makeRequest } from "./helpers";

type Account = { id: string; session: string };

const valid = {
  age: 29,
  weight: 72.5,
  fitnessGoals: ["build_muscle", "general_fitness"],
  experienceLevel: "intermediate",
  workoutPreferences: { workoutTypes: ["strength"], preferredTimes: ["morning"] },
};

const save = (account: Partial<Account>, body: unknown) =>
  putProfile(makeRequest("/api/fitness-profile/me", { method: "PUT", session: account.session, body }));
const read = async (account: Account) => (await (await getProfile(makeRequest("/api/fitness-profile/me", { session: account.session }))).json()).profile;

beforeEach(async () => {
  await connectToDatabase();
  await Promise.all([FitnessProfile.deleteMany({}), FitnessAssessment.deleteMany({})]);
});

describe("fitness profile", () => {
  test("a customer can create and update their own profile, keeping each assessment", async () => {
    const customer = await createAccount("customer");

    expect(await read(customer)).toBeNull();
    expect((await save(customer, valid)).status).toBe(200);
    expect((await save(customer, { ...valid, weight: 71 })).status).toBe(200);

    expect(await read(customer)).toMatchObject({ weight: 71, fitnessGoals: ["build_muscle", "general_fitness"] });
    expect(await FitnessProfile.countDocuments({ customerId: customer.id })).toBe(1);
    expect(await FitnessAssessment.countDocuments({ customerId: customer.id })).toBe(2);
  });

  test("a customer cannot write another customer's profile", async () => {
    const [owner, other] = [await createAccount("customer"), await createAccount("customer")];
    await save(owner, valid);

    await save(other, { ...valid, weight: 99, customerId: owner.id });

    expect((await read(owner)).weight).toBe(72.5);
    expect((await read(other)).weight).toBe(99);
  });

  test("only signed-in customers can use the profile API", async () => {
    const trainer = await createAccount("trainer");

    expect((await save({}, valid)).status).toBe(401);
    expect((await save(trainer, valid)).status).toBe(403);
  });

  test.each([
    ["age below the minimum", { age: 10 }],
    ["age above the maximum", { age: 120 }],
    ["a non-integer age", { age: 29.5 }],
    ["weight below the minimum", { weight: 10 }],
    ["weight with two decimals", { weight: 72.55 }],
    ["no goals", { fitnessGoals: [] }],
    ["an unknown goal", { fitnessGoals: ["fly"] }],
    ["more than three goals", { fitnessGoals: ["lose_weight", "build_muscle", "improve_endurance", "general_fitness"] }],
    ["an unknown experience level", { experienceLevel: "pro" }],
    ["an unknown workout type", { workoutPreferences: { workoutTypes: ["parkour"], preferredTimes: [] } }],
  ])("rejects %s", async (_label, change) => {
    const customer = await createAccount("customer");
    const response = await save(customer, { ...valid, ...change });

    expect(response.status).toBe(400);
    expect(await FitnessProfile.countDocuments({ customerId: customer.id })).toBe(0);
  });
});
