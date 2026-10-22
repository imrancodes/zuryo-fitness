import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import type { Role } from "@/lib/roles";
import { SESSION_COOKIE, signSession } from "@/lib/session";
import type { ServiceZone } from "@/lib/zones";
import { Booking } from "@/models/Booking";
import { TrainerAvailability } from "@/models/TrainerAvailability";
import { hashPassword } from "@/services/auth.service";
import { startSession } from "@/services/session.service";
import { User } from "@/models/User";

export const PASSWORD = "Password123!";

export function makeRequest(path: string, options: { method?: string; body?: unknown; session?: string } = {}) {
  const headers = new Headers({ "content-type": "application/json" });

  if (options.session) {
    headers.set("cookie", `${SESSION_COOKIE}=${options.session}`);
  }

  return new NextRequest(new URL(path, "http://localhost:3000"), {
    method: options.method ?? "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
}

export function sessionFrom(response: Response) {
  const match = response.headers.get("set-cookie")?.match(new RegExp(`${SESSION_COOKIE}=([^;]*)`));
  return match?.[1] ?? "";
}

export function routeContext<T extends Record<string, string>>(params: T) {
  return { params: Promise.resolve(params) };
}

export async function createUser(role: Role, email = `${role}-${crypto.randomUUID()}@test.dev`) {
  await connectToDatabase();
  await User.create({ name: `Test ${role}`, email, passwordHash: await hashPassword(PASSWORD), role });
  return email;
}

export async function createAccount(role: Role) {
  await connectToDatabase();
  const user = await User.create({
    name: `Test ${role} ${crypto.randomUUID().slice(0, 4)}`,
    email: `${role}-${crypto.randomUUID()}@test.dev`,
    passwordHash: "not-used",
    role,
  });
  const id = user._id.toString();
  return { id, session: await signSession({ userId: id, role }) };
}

export async function createPaidBooking(customerId: string, trainerId: string, startTime: Date, overrides: Record<string, unknown> = {}) {
  await connectToDatabase();
  const booking = await Booking.create({
    customerId,
    trainerId,
    startTime,
    endTime: new Date(startTime.getTime() + 60 * 60_000),
    bookingType: "scheduled",
    status: "confirmed",
    paymentStatus: "paid",
    serviceZone: "Mumbai",
    ...overrides,
  });
  return booking._id.toString();
}

export async function createExpiredSession(customerId: string, trainerId?: string) {
  const trainer = trainerId ?? (await createAccount("trainer")).id;
  const startTime = new Date(Date.now() - 70 * 60_000);
  const bookingId = await createPaidBooking(customerId, trainer, startTime);
  await startSession(bookingId, trainer, startTime);
  return { bookingId, trainerId: trainer };
}

export async function addWindow(trainerId: string, serviceZone: ServiceZone, startTime: Date, endTime: Date) {
  const date = new Date(startTime);
  date.setUTCHours(0, 0, 0, 0);
  await TrainerAvailability.create({ trainerId, date, startTime, endTime, serviceZone });
}
