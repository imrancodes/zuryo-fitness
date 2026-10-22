import "server-only";
import { isValidObjectId, type Types } from "mongoose";
import { SESSION_MINUTES, type BookingMode, type BookingStatus, type PaymentStatus } from "@/lib/booking";
import { isDuplicateKeyError, ServiceError } from "@/lib/errors";
import { connectToDatabase } from "@/lib/mongodb";
import {
  deriveSessionStatus,
  isRecordEditable,
  recordEditableUntil,
  sessionEndsAt,
  startWindow,
  startWindowError,
  type SessionStatus,
} from "@/lib/session-timer";
import { formatTime, TIME_ZONE_LABEL } from "@/lib/time";
import { runTransaction } from "@/lib/transaction";
import type { ServiceZone } from "@/lib/zones";
import { Booking, type BookingRecord } from "@/models/Booking";
import { PackageDeduction } from "@/models/PackageDeduction";
import { SessionRecord, type SessionRecordRecord } from "@/models/SessionRecord";
import { namesById } from "@/services/auth.service";
import { getProfileSnapshot } from "@/services/fitness-profile.service";
import { consumeSessionCredit } from "@/services/package.service";
import type { HistoryEntry, SessionView } from "@/types/session";
import type { PublicUser } from "@/types/user";
import type { FeedbackInput, SessionFilter, WorkoutRecordInput } from "@/validators/session";

const FILTER_STATUSES: Record<SessionFilter, SessionStatus[]> = {
  upcoming: ["scheduled"],
  in_progress: ["in_progress"],
  completed: ["completed"],
  all: ["scheduled", "in_progress", "completed", "missed", "cancelled"],
};

async function reconcile(record: SessionRecordRecord, now: Date) {
  if (record.status !== "in_progress" || !record.endsAt || record.endsAt > now) {
    return { record, transitioned: false };
  }

  await PackageDeduction.init();

  return runTransaction(async (session) => {
    const completed = await SessionRecord.findOneAndUpdate(
      { _id: record._id, status: "in_progress", endsAt: { $lte: now } },
      { $set: { status: "completed", completedAt: record.endsAt, durationMinutes: SESSION_MINUTES } },
      { new: true, session }
    ).lean<SessionRecordRecord>();

    if (!completed) {
      const current = await SessionRecord.findById(record._id).session(session).lean<SessionRecordRecord>();
      return { record: current ?? record, transitioned: false };
    }

    await Booking.updateOne({ _id: record.bookingId, status: "confirmed" }, { $set: { status: "completed" } }, { session });
    await consumeSessionCredit({ bookingId: completed.bookingId, sessionRecordId: completed._id, customerId: completed.customerId }, session);
    return { record: completed, transitioned: true };
  });
}

async function reconcileAll(records: SessionRecordRecord[], now: Date) {
  return Promise.all(records.map(async (record) => (await reconcile(record, now)).record));
}

async function findRecords(bookingIds: Types.ObjectId[], now: Date) {
  const records = await SessionRecord.find({ bookingId: { $in: bookingIds } }).lean<SessionRecordRecord[]>();
  const reconciled = await reconcileAll(records, now);
  return new Map(reconciled.map((record) => [record.bookingId.toString(), record]));
}

async function toSessionViews(bookings: BookingRecord[], now: Date, includeRecord: boolean): Promise<SessionView[]> {
  const [records, person] = await Promise.all([
    findRecords(bookings.map((booking) => booking._id), now),
    namesById(bookings.flatMap((booking) => [booking.customerId, booking.trainerId])),
  ]);

  return bookings.map((booking) => {
    const record = records.get(booking._id.toString()) ?? null;
    const status = deriveSessionStatus(booking.status as BookingStatus, toRecordState(record), booking.startTime, now);
    const window = startWindow(booking.startTime);
    const startBlockedReason = record ? null : startProblem(booking, now);

    return {
      id: booking._id.toString(),
      status,
      mode: booking.bookingType as BookingMode,
      serviceZone: booking.serviceZone as ServiceZone,
      paymentStatus: (booking.paymentStatus ?? "unpaid") as PaymentStatus,
      customer: person(booking.customerId),
      trainer: booking.trainerId ? person(booking.trainerId) : null,
      scheduledStart: booking.startTime.toISOString(),
      scheduledEnd: booking.endTime.toISOString(),
      startWindow: { opensAt: window.opensAt.toISOString(), closesAt: window.closesAt.toISOString() },
      canStart: status === "scheduled" && startBlockedReason === null,
      startBlockedReason: status === "scheduled" ? startBlockedReason : null,
      startedAt: record?.startedAt?.toISOString() ?? null,
      endsAt: record?.endsAt?.toISOString() ?? null,
      completedAt: record?.completedAt?.toISOString() ?? null,
      durationMinutes: record?.durationMinutes ?? SESSION_MINUTES,
      record: record && includeRecord ? toWorkoutView(record, now) : null,
      serverNow: now.toISOString(),
    };
  });
}

function toRecordState(record: SessionRecordRecord | null) {
  return record && record.endsAt ? { status: record.status ?? "in_progress", endsAt: record.endsAt, completedAt: record.completedAt } : null;
}

function toWorkoutView(record: SessionRecordRecord, now: Date) {
  const state = toRecordState(record);
  const until = recordEditableUntil(state);
  return {
    exercises: (record.exercises ?? []).map(({ name, sets, reps, notes }) => ({
      name,
      ...(sets != null && { sets }),
      ...(reps != null && { reps }),
      ...(notes && { notes }),
    })),
    trainerNotes: record.trainerNotes ?? "",
    suggestedNextWorkout: record.suggestedNextWorkout ?? "",
    editable: isRecordEditable(state, now),
    editableUntil: until ? until.toISOString() : null,
  };
}

function startProblem(booking: BookingRecord, now: Date) {
  if (booking.status === "cancelled") {
    return "This booking was cancelled, so the session can't start.";
  }
  if (booking.status !== "confirmed") {
    return "Only confirmed bookings can start a session.";
  }
  if (booking.paymentStatus !== "paid") {
    return "The customer hasn't paid for this booking yet.";
  }
  return startWindowError(booking.startTime, now);
}

async function findBookingForTrainer(bookingId: string, trainerId: string) {
  await connectToDatabase();
  const booking = isValidObjectId(bookingId) ? await Booking.findOne({ _id: bookingId, trainerId }).lean<BookingRecord>() : null;

  if (!booking) {
    throw new ServiceError(404, "Session not found");
  }

  return booking;
}

async function viewFor(booking: BookingRecord, now: Date) {
  const [view] = await toSessionViews([booking], now, true);
  return view;
}

function findRecord(bookingId: Types.ObjectId) {
  return SessionRecord.findOne({ bookingId }).lean<SessionRecordRecord>();
}

export async function startSession(bookingId: string, trainerId: string, now = new Date()) {
  const booking = await findBookingForTrainer(bookingId, trainerId);
  const existing = await findRecord(booking._id);

  if (existing) {
    return { session: await viewFor(booking, now), created: false };
  }

  const problem = startProblem(booking, now);
  if (problem) {
    throw new ServiceError(409, problem);
  }

  await SessionRecord.init();

  try {
    await SessionRecord.create({
      bookingId: booking._id,
      customerId: booking.customerId,
      trainerId,
      status: "in_progress",
      startedAt: now,
      endsAt: sessionEndsAt(now),
    });
    return { session: await viewFor(booking, now), created: true };
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      return { session: await viewFor(booking, now), created: false };
    }
    throw error;
  }
}

export async function completeSession(bookingId: string, trainerId: string, now = new Date()) {
  const booking = await findBookingForTrainer(bookingId, trainerId);
  const record = await findRecord(booking._id);

  if (!record || !record.endsAt) {
    throw new ServiceError(409, "This session hasn't started yet.");
  }
  if (record.status === "in_progress" && record.endsAt > now) {
    throw new ServiceError(409, `This session ends at ${formatTime(record.endsAt)} ${TIME_ZONE_LABEL} and can't be completed early.`);
  }

  const { transitioned } = await reconcile(record, now);
  return { session: await viewFor(booking, now), transitioned };
}

export async function saveWorkoutRecord(bookingId: string, trainerId: string, input: WorkoutRecordInput, now = new Date()) {
  const booking = await findBookingForTrainer(bookingId, trainerId);
  const existing = await findRecord(booking._id);

  if (!existing) {
    throw new ServiceError(409, "Start the session before logging the workout.");
  }

  const { record } = await reconcile(existing, now);
  if (!isRecordEditable(toRecordState(record), now)) {
    throw new ServiceError(409, "This workout record is locked. Notes can be edited up to 24 hours after the session.");
  }

  await SessionRecord.updateOne(
    { _id: record._id, trainerId },
    { $set: { exercises: input.exercises, trainerNotes: input.trainerNotes, suggestedNextWorkout: input.suggestedNextWorkout } }
  );
  return viewFor(booking, now);
}

export async function getSessionForViewer(bookingId: string, viewer: PublicUser, now = new Date()) {
  await connectToDatabase();
  const booking = isValidObjectId(bookingId) ? await Booking.findById(bookingId).lean<BookingRecord>() : null;
  const allowed =
    booking &&
    (viewer.role === "admin" ||
      (viewer.role === "customer" && booking.customerId.toString() === viewer.id) ||
      (viewer.role === "trainer" && booking.trainerId?.toString() === viewer.id));

  if (!allowed) {
    throw new ServiceError(404, "Session not found");
  }

  const session = await viewFor(booking, now);

  if (viewer.role === "customer") {
    return session.status === "completed" ? session : { ...session, record: null };
  }

  if (viewer.role === "trainer") {
    const customerId = booking.customerId.toString();
    const [customerProfile, history] = await Promise.all([
      getProfileSnapshot(customerId),
      listCompletedSessions({ customerId, trainerId: viewer.id }, now),
    ]);
    return { ...session, customerProfile, previousSessions: history.filter((entry) => entry.id !== session.id).slice(0, 5) };
  }

  return session;
}

async function reconcileExpired(filter: { customerId?: string }, now: Date, limit = 200) {
  await connectToDatabase();
  const expired = await SessionRecord.find({ ...filter, status: "in_progress", endsAt: { $lte: now } })
    .limit(limit)
    .lean<SessionRecordRecord[]>();
  await reconcileAll(expired, now);
}

export function reconcileExpiredForCustomer(customerId: string, now = new Date()) {
  return reconcileExpired({ customerId }, now);
}

export function reconcileExpiredSessions(now = new Date()) {
  return reconcileExpired({}, now);
}

export async function listCompletedSessions(filter: { customerId: string; trainerId?: string }, now = new Date(), limit = 50) {
  await reconcileExpiredForCustomer(filter.customerId, now);

  const records = await SessionRecord.find({
    customerId: filter.customerId,
    status: "completed",
    ...(filter.trainerId && { trainerId: filter.trainerId }),
  })
    .sort({ completedAt: -1 })
    .limit(limit)
    .lean<SessionRecordRecord[]>();

  const [bookings, person] = await Promise.all([
    Booking.find({ _id: { $in: records.map((record) => record.bookingId) } }, "serviceZone").lean(),
    namesById(records.map((record) => record.trainerId)),
  ]);
  const zoneOf = new Map(bookings.map((booking) => [booking._id.toString(), booking.serviceZone as ServiceZone]));

  return records.map(
    (record): HistoryEntry => ({
      id: record.bookingId.toString(),
      trainer: person(record.trainerId),
      serviceZone: zoneOf.get(record.bookingId.toString()) ?? null,
      startedAt: record.startedAt?.toISOString() ?? null,
      completedAt: (record.completedAt ?? record.endsAt ?? now).toISOString(),
      durationMinutes: record.durationMinutes ?? SESSION_MINUTES,
      record: toWorkoutView(record, now),
      feedback: record.customerFeedback?.rating
        ? { rating: record.customerFeedback.rating, comment: record.customerFeedback.comment ?? "" }
        : null,
    })
  );
}

export async function saveFeedback(bookingId: string, customerId: string, input: FeedbackInput, now = new Date()) {
  await connectToDatabase();
  const booking = isValidObjectId(bookingId) ? await Booking.findOne({ _id: bookingId, customerId }).lean<BookingRecord>() : null;
  const existing = booking ? await findRecord(booking._id) : null;

  if (!booking) {
    throw new ServiceError(404, "Session not found");
  }

  const record = existing ? (await reconcile(existing, now)).record : null;
  if (record?.status !== "completed") {
    throw new ServiceError(409, "You can rate a session once it's completed.");
  }

  await SessionRecord.updateOne(
    { _id: record._id, customerId, status: "completed" },
    { $set: { customerFeedback: { rating: input.rating, comment: input.comment } } }
  );
  return { rating: input.rating, comment: input.comment };
}

export async function listTrainerSessions(trainerId: string, filter: SessionFilter, now = new Date()) {
  await connectToDatabase();
  const bookings = await Booking.find({ trainerId, status: { $in: ["confirmed", "completed", "cancelled"] } })
    .sort({ startTime: filter === "upcoming" || filter === "in_progress" ? 1 : -1 })
    .limit(100)
    .lean<BookingRecord[]>();
  const sessions = await toSessionViews(bookings, now, false);
  return sessions.filter((session) => FILTER_STATUSES[filter].includes(session.status));
}

export async function sessionStatusesFor(bookings: BookingRecord[], now = new Date()) {
  const records = await findRecords(
    bookings.map((booking) => booking._id),
    now
  );
  return new Map(
    bookings.map((booking) => [
      booking._id.toString(),
      deriveSessionStatus(booking.status as BookingStatus, toRecordState(records.get(booking._id.toString()) ?? null), booking.startTime, now),
    ])
  );
}
