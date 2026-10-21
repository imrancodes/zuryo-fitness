import "server-only";
import { isValidObjectId, type ClientSession, type Types } from "mongoose";
import { ACTIVE_BOOKING_STATUSES, candidateStarts, SESSION_MINUTES } from "@/lib/booking";
import { ServiceError } from "@/lib/errors";
import { connectToDatabase } from "@/lib/mongodb";
import { addMinutes, dayBoundsUtc, zonedToUtc } from "@/lib/time";
import type { ServiceZone } from "@/lib/zones";
import { Booking } from "@/models/Booking";
import { TrainerAvailability } from "@/models/TrainerAvailability";
import { User } from "@/models/User";
import { withTrainerLock } from "@/services/schedule-lock";
import type { AvailabilityWindowView, OpenSlots, TrainerSummary } from "@/types/booking";
import type { AvailabilityInput } from "@/validators/availability";
import type { AvailabilityQuery } from "@/validators/booking";

const activeStatus = { $in: [...ACTIVE_BOOKING_STATUSES] };

type Interval = { startTime: Date; endTime: Date };

const overlaps = (a: Interval, b: Interval) => a.startTime < b.endTime && a.endTime > b.startTime;
const covers = (outer: Interval, inner: Interval) => outer.startTime <= inner.startTime && outer.endTime >= inner.endTime;

function toWindow(input: AvailabilityInput) {
  return {
    date: zonedToUtc(input.date),
    startTime: zonedToUtc(input.date, input.startTime),
    endTime: zonedToUtc(input.date, input.endTime),
    serviceZone: input.serviceZone,
  };
}

function activeBookingsBetween(trainerId: string, range: Interval, session: ClientSession | null = null) {
  return Booking.find({
    trainerId,
    status: activeStatus,
    startTime: { $lt: range.endTime },
    endTime: { $gt: range.startTime },
  })
    .sort({ startTime: 1 })
    .session(session)
    .lean();
}

async function assertNoWindowOverlap(trainerId: string, window: Interval, session: ClientSession, excludeId?: Types.ObjectId) {
  const overlap = await TrainerAvailability.exists({
    trainerId,
    ...(excludeId && { _id: { $ne: excludeId } }),
    startTime: { $lt: window.endTime },
    endTime: { $gt: window.startTime },
  }).session(session);

  if (overlap) {
    throw new ServiceError(409, "This time overlaps another availability window. Edit that window instead.");
  }
}

async function findOwnWindow(trainerId: string, id: string, session: ClientSession) {
  const window = isValidObjectId(id) ? await TrainerAvailability.findOne({ _id: id, trainerId }).session(session) : null;

  if (!window) {
    throw new ServiceError(404, "Availability not found");
  }

  return window;
}

function assertFuture(window: Interval, now: Date) {
  if (window.startTime <= now) {
    throw new ServiceError(400, "Availability must start in the future");
  }
}

export async function listTrainerAvailability(trainerId: string, date: string): Promise<AvailabilityWindowView[]> {
  await connectToDatabase();
  const { start, end } = dayBoundsUtc(date);
  const day = { startTime: start, endTime: end };

  const [windows, bookings] = await Promise.all([
    TrainerAvailability.find({ trainerId, startTime: { $lt: end }, endTime: { $gt: start } }).sort({ startTime: 1 }).lean(),
    activeBookingsBetween(trainerId, day),
  ]);
  const customers = await User.find({ _id: { $in: bookings.map((booking) => booking.customerId) } }, "name").lean();
  const customerName = new Map(customers.map((customer) => [customer._id.toString(), customer.name]));

  return windows.map((window) => ({
    id: window._id.toString(),
    startTime: window.startTime.toISOString(),
    endTime: window.endTime.toISOString(),
    serviceZone: window.serviceZone as ServiceZone,
    bookings: bookings
      .filter((booking) => overlaps(booking, window))
      .map((booking) => ({
        id: booking._id.toString(),
        startTime: booking.startTime.toISOString(),
        endTime: booking.endTime.toISOString(),
        customerName: customerName.get(booking.customerId.toString()) ?? "Customer",
      })),
  }));
}

export async function createAvailability(trainerId: string, input: AvailabilityInput, now = new Date()) {
  const window = toWindow(input);
  assertFuture(window, now);

  return withTrainerLock(trainerId, async (session) => {
    await assertNoWindowOverlap(trainerId, window, session);
    const [created] = await TrainerAvailability.create([{ trainerId, ...window }], { session });
    return { id: created._id.toString() };
  });
}

export async function updateAvailability(trainerId: string, id: string, input: AvailabilityInput, now = new Date()) {
  const next = toWindow(input);
  assertFuture(next, now);

  return withTrainerLock(trainerId, async (session) => {
    const window = await findOwnWindow(trainerId, id, session);
    const bookings = await activeBookingsBetween(trainerId, window, session);

    if (bookings.some((booking) => !covers(next, booking) || booking.serviceZone !== next.serviceZone)) {
      throw new ServiceError(409, "Booked sessions in this window would no longer be covered. Keep their time and zone inside the new window.");
    }

    await assertNoWindowOverlap(trainerId, next, session, window._id);
    window.set(next);
    await window.save({ session });
    return { id: window._id.toString() };
  });
}

export async function deleteAvailability(trainerId: string, id: string) {
  return withTrainerLock(trainerId, async (session) => {
    const window = await findOwnWindow(trainerId, id, session);
    const bookings = await activeBookingsBetween(trainerId, window, session);

    if (bookings.length > 0) {
      throw new ServiceError(409, "This window has booked sessions and can't be removed.");
    }

    await window.deleteOne({ session });
    return { id };
  });
}

type OpenSlotsOptions = {
  serviceZone: ServiceZone;
  starts: Date[];
  trainerId?: string;
  session?: ClientSession | null;
};

export async function openSlotsByTrainer({ serviceZone, starts, trainerId, session = null }: OpenSlotsOptions) {
  const open = new Map<string, { trainer: TrainerSummary; slots: Date[] }>();

  if (starts.length === 0) {
    return open;
  }

  await connectToDatabase();
  const range = { startTime: starts[0], endTime: addMinutes(starts[starts.length - 1], SESSION_MINUTES) };
  const windows = await TrainerAvailability.find({
    serviceZone,
    isAvailable: true,
    ...(trainerId && { trainerId }),
    startTime: { $lt: range.endTime },
    endTime: { $gt: range.startTime },
  })
    .session(session)
    .lean();

  const trainerIds = [...new Set(windows.map((window) => window.trainerId.toString()))];
  const [trainers, bookings] = await Promise.all([
    User.find({ _id: { $in: trainerIds }, role: "trainer", isActive: true }, "name specialties").sort({ _id: 1 }).session(session).lean(),
    Booking.find({
      trainerId: { $in: trainerIds },
      status: activeStatus,
      startTime: { $lt: range.endTime },
      endTime: { $gt: range.startTime },
    })
      .session(session)
      .lean(),
  ]);

  for (const trainer of trainers) {
    const id = trainer._id.toString();
    const ownWindows = windows.filter((window) => window.trainerId.toString() === id);
    const ownBookings = bookings.filter((booking) => booking.trainerId?.toString() === id);
    const slots = starts.filter((startTime) => {
      const slot = { startTime, endTime: addMinutes(startTime, SESSION_MINUTES) };
      return ownWindows.some((window) => covers(window, slot)) && !ownBookings.some((booking) => overlaps(booking, slot));
    });

    if (slots.length > 0) {
      open.set(id, { trainer: { id, name: trainer.name, specialties: trainer.specialties ?? [] }, slots });
    }
  }

  return open;
}

export async function findOpenSlots(query: AvailabilityQuery, now = new Date()): Promise<OpenSlots> {
  const open = await openSlotsByTrainer({
    serviceZone: query.serviceZone,
    starts: candidateStarts(query.mode, query.date, now),
  });
  const trainers = [...open.values()].map(({ trainer, slots }) => ({ trainer, slots: slots.map((slot) => slot.toISOString()) }));
  const slots = [...new Set(trainers.flatMap((entry) => entry.slots))].sort();

  return { trainers, slots };
}

export async function findAvailableTrainers(serviceZone: ServiceZone, startTime: Date) {
  const open = await openSlotsByTrainer({ serviceZone, starts: [startTime] });
  return [...open.values()].map((entry) => entry.trainer);
}
