import { beforeEach, describe, expect, test } from "bun:test";
import { GET as adminPackages, POST as grant } from "@/app/api/admin/packages/route";
import { GET as myPackages } from "@/app/api/packages/me/route";
import { GET as mySummary } from "@/app/api/packages/me/summary/route";
import { GET as readSession } from "@/app/api/sessions/[id]/route";
import { connectToDatabase } from "@/lib/mongodb";
import { Booking } from "@/models/Booking";
import { Package } from "@/models/Package";
import { PackageDeduction } from "@/models/PackageDeduction";
import { SessionRecord } from "@/models/SessionRecord";
import { User } from "@/models/User";
import { completeSession, startSession } from "@/services/session.service";
import { createAccount, createExpiredSession, createPaidBooking, makeRequest, routeContext } from "./helpers";

type Account = { id: string; session: string };

async function givePackage(customerId: string, totalSessions: number, usedSessions = 0) {
  const created = await Package.create({
    customerId,
    totalSessions,
    usedSessions,
    remainingSessions: totalSessions - usedSessions,
    status: totalSessions === usedSessions ? "exhausted" : "active",
    source: "seed",
  });
  return created._id.toString();
}

const summaryOf = async (account: Account) => (await (await mySummary(makeRequest("/api/packages/me/summary", { session: account.session }))).json()).summary;

beforeEach(async () => {
  await connectToDatabase();
  await Promise.all([Booking.deleteMany({}), SessionRecord.deleteMany({}), Package.deleteMany({}), PackageDeduction.deleteMany({})]);
});

describe("package balances", () => {
  test("summarise purchased, used and remaining sessions", async () => {
    const customer = await createAccount("customer");
    await givePackage(customer.id, 10, 3);
    await givePackage(customer.id, 5, 5);

    expect(await summaryOf(customer)).toEqual({ purchased: 15, used: 8, remaining: 7, activePackages: 1 });
  });

  test("customers only see their own packages", async () => {
    const [customer, other] = [await createAccount("customer"), await createAccount("customer")];
    await givePackage(customer.id, 10);
    await givePackage(other.id, 3);

    const { packages } = await (await myPackages(makeRequest("/api/packages/me", { session: customer.session }))).json();

    expect(packages).toHaveLength(1);
    expect(packages[0].totalSessions).toBe(10);
  });
});

describe("deductions on session completion", () => {
  test("completing a session deducts exactly one credit and records it", async () => {
    const customer = await createAccount("customer");
    const packageId = await givePackage(customer.id, 5);
    const { bookingId, trainerId } = await createExpiredSession(customer.id);

    await completeSession(bookingId, trainerId);
    const pkg = await Package.findById(packageId).lean();
    const ledger = await PackageDeduction.find({ bookingId }).lean();

    expect(pkg).toMatchObject({ usedSessions: 1, remainingSessions: 4, status: "active" });
    expect(ledger).toHaveLength(1);
    expect(ledger[0]).toMatchObject({ outcome: "deducted" });
    expect(ledger[0].packageId?.toString()).toBe(packageId);
  });

  test("in-progress and cancelled sessions do not consume credits", async () => {
    const customer = await createAccount("customer");
    const trainer = await createAccount("trainer");
    await givePackage(customer.id, 5);
    const start = new Date(Math.floor(Date.now() / 60_000) * 60_000);
    const running = await createPaidBooking(customer.id, trainer.id, start);
    await startSession(running, trainer.id, start);
    await createPaidBooking(customer.id, trainer.id, new Date(Date.now() - 3 * 60 * 60_000), { status: "cancelled" });

    await readSession(makeRequest(`/api/sessions/${running}`, { session: trainer.session }), routeContext({ id: running }));

    expect(await PackageDeduction.countDocuments()).toBe(0);
    expect((await summaryOf(customer)).remaining).toBe(5);
  });

  test("retrying completion never deducts twice", async () => {
    const customer = await createAccount("customer");
    await givePackage(customer.id, 5);
    const { bookingId, trainerId } = await createExpiredSession(customer.id);

    await completeSession(bookingId, trainerId);
    await completeSession(bookingId, trainerId);
    await readSession(makeRequest(`/api/sessions/${bookingId}`, { session: customer.session }), routeContext({ id: bookingId }));

    expect((await summaryOf(customer)).used).toBe(1);
    expect(await PackageDeduction.countDocuments({ bookingId })).toBe(1);
  });

  test("simultaneous completions of one session deduct once", async () => {
    const customer = await createAccount("customer");
    await givePackage(customer.id, 5);
    const { bookingId, trainerId } = await createExpiredSession(customer.id);

    await Promise.all(Array.from({ length: 5 }, () => completeSession(bookingId, trainerId)));

    expect((await summaryOf(customer)).used).toBe(1);
    expect(await PackageDeduction.countDocuments({ bookingId })).toBe(1);
  });

  test("simultaneous completions cannot over-consume the last credit", async () => {
    const customer = await createAccount("customer");
    const packageId = await givePackage(customer.id, 1);
    const sessions = await Promise.all([1, 2, 3].map(() => createExpiredSession(customer.id)));

    await Promise.all(sessions.map(({ bookingId, trainerId }) => completeSession(bookingId, trainerId)));
    const outcomes = (await PackageDeduction.find({ customerId: customer.id }).lean()).map((entry) => entry.outcome).sort();

    expect(outcomes).toEqual(["deducted", "no_package", "no_package"]);
    expect(await Package.findById(packageId).lean()).toMatchObject({ usedSessions: 1, remainingSessions: 0, status: "exhausted" });
  });

  test("with no credits left the session still completes and nothing goes negative", async () => {
    const customer = await createAccount("customer");
    const packageId = await givePackage(customer.id, 2, 2);
    const { bookingId, trainerId } = await createExpiredSession(customer.id);

    const { session } = await completeSession(bookingId, trainerId);

    expect(session.status).toBe("completed");
    expect((await PackageDeduction.findOne({ bookingId }).lean())?.outcome).toBe("no_package");
    expect(await Package.findById(packageId).lean()).toMatchObject({ usedSessions: 2, remainingSessions: 0 });
  });
});

describe("granting packages", () => {
  const grantAs = (account: Partial<Account>, body: unknown) =>
    grant(makeRequest("/api/admin/packages", { method: "POST", session: account.session, body }));

  test("only admins can grant packages, and the balance updates", async () => {
    const [customer, trainer, admin] = [await createAccount("customer"), await createAccount("trainer"), await createAccount("admin")];
    const email = (await User.findById(customer.id).lean())!.email;

    expect((await grantAs(customer, { email, sessions: 5 })).status).toBe(403);
    expect((await grantAs(trainer, { email, sessions: 5 })).status).toBe(403);
    expect((await grantAs(admin, { email, sessions: 0 })).status).toBe(400);
    expect((await grantAs(admin, { email: "nobody@example.com", sessions: 5 })).status).toBe(404);
    expect((await grantAs(admin, { email, sessions: 5 })).status).toBe(201);

    expect(await summaryOf(customer)).toMatchObject({ purchased: 5, remaining: 5 });
    const { packages } = await (await adminPackages(makeRequest("/api/admin/packages", { session: admin.session }))).json();
    expect(packages[0].customer.id).toBe(customer.id);
  });
});
