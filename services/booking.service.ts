import "server-only";
import { isValidObjectId, type ClientSession, type Types } from "mongoose";
import { ACTIVE_BOOKING_STATUSES, SESSION_MINUTES, startTimeError, type BookingMode, type BookingStatus } from "@/lib/booking";
import { isDuplicateKeyError, ServiceError } from "@/lib/errors";
import { connectToDatabase } from "@/lib/mongodb";
import { addMinutes } from "@/lib/time";
import type { ServiceZone } from "@/lib/zones";
import { Booking, type BookingDocument } from "@/models/Booking";
import { User } from "@/models/User";
import { openSlotsByTrainer } from "@/services/availability.service";
import { withTrainerLock } from "@/services/schedule-lock";
import type { BookingView } from "@/types/booking";
import type { PublicUser } from "@/types/user";
import type { CreateBookingInput } from "@/validators/booking";

type BookingRecord = BookingDocument & { _id: Types.ObjectId };

const SLOT_TAKEN = "This time was just taken. Choose another time.";
const PREFERRED_UNAVAILABLE = "Your preferred trainer isn't available at this time in this zone. Choose another time or trainer.";
const NO_TRAINERS = "No trainers are available at this time in this zone. Choose another time.";

async function toBookingViews(bookings: BookingRecord[]): Promise<BookingView[]> {
  const userIds = bookings.flatMap((booking) => [booking.customerId, booking.trainerId].filter(Boolean));
  const users = await User.find({ _id: { $in: userIds } }, "name").lean();
  const nameOf = new Map(users.map((user) => [user._id.toString(), user.name]));
  const person = (id: Types.ObjectId) => ({ id: id.toString(), name: nameOf.get(id.toString()) ?? "Unknown" });

  return bookings.map((booking) => ({
    id: booking._id.toString(),
    mode: booking.bookingType as BookingMode,
    status: booking.status as BookingStatus,
    startTime: booking.startTime.toISOString(),
    endTime: booking.endTime.toISOString(),
    serviceZone: booking.serviceZone as ServiceZone,
    trainer: booking.trainerId ? person(booking.trainerId) : null,
    customer: person(booking.customerId),
    paymentStatus: booking.paymentStatus ?? "unpaid",
    createdAt: (booking.createdAt ?? new Date()).toISOString(),
  }));
}

async function toBookingView(booking: BookingRecord) {
  const [view] = await toBookingViews([booking]);
  return view;
}

function findByIdempotencyKey(customerId: string, idempotencyKey: string, session: ClientSession | null = null) {
  return Booking.findOne({ customerId, idempotencyKey }).session(session).lean<BookingRecord>();
}

export async function createBooking(customerId: string, input: CreateBookingInput, now = new Date()) {
  await connectToDatabase();
  await Booking.init();

  const previous = await findByIdempotencyKey(customerId, input.idempotencyKey);
  if (previous) {
    return { booking: await toBookingView(previous), created: false };
  }

  const startTime = new Date(input.startTime);
  const problem = startTimeError(input.mode, startTime, now);
  if (problem) {
    throw new ServiceError(400, problem);
  }

  const endTime = addMinutes(startTime, SESSION_MINUTES);
  const preferred = input.preferredTrainerId;
  const slot = { serviceZone: input.serviceZone, starts: [startTime] };
  const candidates = [...(await openSlotsByTrainer({ ...slot, trainerId: preferred })).keys()];

  if (candidates.length === 0) {
    throw new ServiceError(409, preferred ? PREFERRED_UNAVAILABLE : NO_TRAINERS);
  }

  for (const trainerId of candidates) {
    try {
      const result = await withTrainerLock(trainerId, async (session) => {
        const replay = await findByIdempotencyKey(customerId, input.idempotencyKey, session);
        if (replay) {
          return { booking: replay, created: false };
        }

        const stillOpen = await openSlotsByTrainer({ ...slot, trainerId, session });
        if (!stillOpen.has(trainerId)) {
          throw new ServiceError(409, SLOT_TAKEN);
        }

        const [booking] = await Booking.create(
          [
            {
              customerId,
              trainerId,
              startTime,
              endTime,
              bookingType: input.mode,
              status: "confirmed",
              serviceZone: input.serviceZone,
              idempotencyKey: input.idempotencyKey,
            },
          ],
          { session }
        );
        return { booking: booking.toObject() as BookingRecord, created: true };
      });

      return { booking: await toBookingView(result.booking), created: result.created };
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        const duplicate = await findByIdempotencyKey(customerId, input.idempotencyKey);
        if (duplicate) {
          return { booking: await toBookingView(duplicate), created: false };
        }
      }
      if (!(error instanceof ServiceError) || error.status !== 409) {
        throw error;
      }
      if (preferred) {
        throw new ServiceError(409, PREFERRED_UNAVAILABLE);
      }
    }
  }

  throw new ServiceError(409, SLOT_TAKEN);
}

export async function getBookingForViewer(id: string, viewer: PublicUser) {
  await connectToDatabase();
  const booking = isValidObjectId(id) ? await Booking.findById(id).lean<BookingRecord>() : null;
  const canView =
    booking &&
    (viewer.role === "admin" || booking.customerId.toString() === viewer.id || booking.trainerId?.toString() === viewer.id);

  if (!canView) {
    throw new ServiceError(404, "Booking not found");
  }

  return toBookingView(booking);
}

export async function listCustomerBookings(customerId: string) {
  await connectToDatabase();
  const bookings = await Booking.find({ customerId }).sort({ startTime: -1 }).limit(50).lean<BookingRecord[]>();
  return toBookingViews(bookings);
}

export async function listUpcomingBookings(filter: { customerId: string } | { trainerId: string }, now = new Date()) {
  await connectToDatabase();
  const bookings = await Booking.find({
    ...filter,
    status: { $in: [...ACTIVE_BOOKING_STATUSES] },
    endTime: { $gt: now },
  })
    .sort({ startTime: 1 })
    .limit(20)
    .lean<BookingRecord[]>();
  return toBookingViews(bookings);
}
