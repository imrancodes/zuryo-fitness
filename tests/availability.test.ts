import { beforeEach, describe, expect, test } from "bun:test";
import { DELETE as deleteWindow, PATCH as updateWindow } from "@/app/api/trainers/me/availability/[id]/route";
import { GET as listWindows, POST as createWindow } from "@/app/api/trainers/me/availability/route";
import { POST as postBooking } from "@/app/api/bookings/route";
import { connectToDatabase } from "@/lib/mongodb";
import { addDays, todayInZone, zonedToUtc } from "@/lib/time";
import { Booking } from "@/models/Booking";
import { TrainerAvailability } from "@/models/TrainerAvailability";
import { createAccount, makeRequest, routeContext } from "./helpers";

const date = addDays(todayInZone(), 3);
const window = { date, startTime: "09:00", endTime: "12:00", serviceZone: "Mumbai" };

type Account = { id: string; session: string };

const create = (trainer: Account, body: Record<string, unknown> = window) =>
  createWindow(makeRequest("/api/trainers/me/availability", { method: "POST", session: trainer.session, body }));

const update = (trainer: Account, id: string, body: Record<string, unknown>) =>
  updateWindow(
    makeRequest(`/api/trainers/me/availability/${id}`, { method: "PATCH", session: trainer.session, body }),
    routeContext({ id })
  );

const remove = (trainer: Account, id: string) =>
  deleteWindow(makeRequest(`/api/trainers/me/availability/${id}`, { method: "DELETE", session: trainer.session }), routeContext({ id }));

beforeEach(async () => {
  await connectToDatabase();
  await Promise.all([Booking.deleteMany({}), TrainerAvailability.deleteMany({})]);
});

describe("trainer availability", () => {
  test("a trainer can add and list availability", async () => {
    const trainer = await createAccount("trainer");

    expect((await create(trainer)).status).toBe(201);

    const { windows } = await (
      await listWindows(makeRequest(`/api/trainers/me/availability?date=${date}`, { session: trainer.session }))
    ).json();
    expect(windows).toHaveLength(1);
    expect(windows[0]).toMatchObject({ startTime: zonedToUtc(date, "09:00").toISOString(), serviceZone: "Mumbai" });
  });

  test("rejects ranges where the end is not after the start", async () => {
    const trainer = await createAccount("trainer");
    const response = await create(trainer, { ...window, startTime: "12:00", endTime: "09:00" });

    expect(response.status).toBe(400);
    expect((await response.json()).fieldErrors.endTime[0]).toContain("after the start");
  });

  test("rejects availability in the past", async () => {
    const trainer = await createAccount("trainer");
    const response = await create(trainer, { ...window, date: addDays(todayInZone(), -1) });

    expect(response.status).toBe(400);
  });

  test("rejects overlapping windows for the same trainer but not for others", async () => {
    const [trainer, other] = [await createAccount("trainer"), await createAccount("trainer")];
    await create(trainer);

    expect((await create(trainer, { ...window, startTime: "11:00", endTime: "13:00" })).status).toBe(409);
    expect((await create(other)).status).toBe(201);
  });

  test("windows with booked sessions cannot be removed or shrunk around the booking", async () => {
    const trainer = await createAccount("trainer");
    const customer = await createAccount("customer");
    const { id } = await (await create(trainer)).json();
    await postBooking(
      makeRequest("/api/bookings", {
        method: "POST",
        session: customer.session,
        body: {
          mode: "scheduled",
          startTime: zonedToUtc(date, "10:00").toISOString(),
          serviceZone: "Mumbai",
          idempotencyKey: crypto.randomUUID(),
        },
      })
    );

    expect((await remove(trainer, id)).status).toBe(409);
    expect((await update(trainer, id, { ...window, startTime: "10:30" })).status).toBe(409);
    expect((await update(trainer, id, { ...window, endTime: "13:00" })).status).toBe(200);
  });

  test("a free window can be deleted", async () => {
    const trainer = await createAccount("trainer");
    const { id } = await (await create(trainer)).json();

    expect((await remove(trainer, id)).status).toBe(200);
    expect(await TrainerAvailability.countDocuments()).toBe(0);
  });

  test("trainers cannot modify another trainer's availability and customers cannot manage any", async () => {
    const [owner, intruder] = [await createAccount("trainer"), await createAccount("trainer")];
    const customer = await createAccount("customer");
    const { id } = await (await create(owner)).json();

    expect((await update(intruder, id, window)).status).toBe(404);
    expect((await remove(intruder, id)).status).toBe(404);
    expect((await create(customer)).status).toBe(403);
    expect(await TrainerAvailability.countDocuments()).toBe(1);
  });
});
