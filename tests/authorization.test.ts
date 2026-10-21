import { beforeAll, describe, expect, test } from "bun:test";
import { GET as adminUsers } from "@/app/api/admin/users/route";
import { POST as login } from "@/app/api/auth/login/route";
import { GET as trainerAvailability } from "@/app/api/trainers/me/availability/route";
import type { Role } from "@/lib/roles";
import { signSession } from "@/lib/session";
import { PASSWORD, createUser, makeRequest, sessionFrom } from "./helpers";

const sessions = {} as Record<Role, string>;

beforeAll(async () => {
  for (const role of ["customer", "trainer", "admin"] as const) {
    const email = await createUser(role);
    sessions[role] = sessionFrom(await login(makeRequest("/api/auth/login", { method: "POST", body: { email, password: PASSWORD } })));
  }
});

const callAdmin = (session?: string) => adminUsers(makeRequest("/api/admin/users", { session }));
const callTrainer = (session?: string) => trainerAvailability(makeRequest("/api/trainers/me/availability", { session }));

describe("protected APIs", () => {
  test("reject unauthenticated requests", async () => {
    expect((await callAdmin()).status).toBe(401);
    expect((await callTrainer()).status).toBe(401);
  });

  test("a customer cannot reach trainer or admin APIs", async () => {
    expect((await callAdmin(sessions.customer)).status).toBe(403);
    expect((await callTrainer(sessions.customer)).status).toBe(403);
  });

  test("a trainer cannot reach admin APIs but can reach trainer APIs", async () => {
    expect((await callAdmin(sessions.trainer)).status).toBe(403);
    expect((await callTrainer(sessions.trainer)).status).toBe(200);
  });

  test("an admin can list users without password hashes", async () => {
    const response = await callAdmin(sessions.admin);

    expect(response.status).toBe(200);
    expect(await response.text()).not.toContain("passwordHash");
  });

  test("a tampered token is rejected", async () => {
    const [header, , signature] = sessions.customer.split(".");
    const forgedPayload = Buffer.from(JSON.stringify({ userId: "x", role: "admin" })).toString("base64url");

    expect((await callAdmin(`${header}.${forgedPayload}.${signature}`)).status).toBe(401);
  });

  test("a validly signed role claim cannot override the role stored in the database", async () => {
    const { userId } = JSON.parse(Buffer.from(sessions.customer.split(".")[1], "base64url").toString());
    const elevated = await signSession({ userId, role: "admin" });

    expect((await callAdmin(elevated)).status).toBe(403);
  });
});
