import bcrypt from "bcryptjs";
import mongoose, { type Collection, type Types } from "mongoose";
import { SESSION_MINUTES, type BookingStatus, type PaymentStatus } from "@/lib/booking";
import { DEMO_ACCOUNTS } from "@/lib/demo";
import { formatInr } from "@/lib/money";
import { calculateQuote, DEFAULT_PRICING, QUOTE_TTL_MINUTES, quoteForPrice } from "@/lib/pricing";
import { addDays, addMinutes, todayInZone, zonedToUtc } from "@/lib/time";
import { LEGACY_ZONE_NAMES, type ServiceZone } from "@/lib/zones";
import { AiRecommendationCache } from "@/models/AiRecommendation";
import { Booking } from "@/models/Booking";
import { FitnessAssessment } from "@/models/FitnessAssessment";
import { FitnessProfile } from "@/models/FitnessProfile";
import { Package } from "@/models/Package";
import { PackageDeduction } from "@/models/PackageDeduction";
import { Payment } from "@/models/Payment";
import { PricingRule } from "@/models/PricingRule";
import { SessionRecord } from "@/models/SessionRecord";
import { TrainerAvailability } from "@/models/TrainerAvailability";
import { User } from "@/models/User";
import {
  BOOKINGS,
  CUSTOMERS,
  DAILY_WINDOWS,
  SEED_DAYS,
  TRAINERS,
  type SeedBooking,
  type SeedOutcome,
  type SeedTrainer,
} from "./seed-data";

const DEFAULT_DEMO_PASSWORD = "ZuryoDemo123!";
const DEMO_EMAIL = /@zuryo\.dev$/;
const DECLINED = "Declined by the simulated payment provider. No money was taken.";
const RESET = process.argv.includes("--reset");

type SeededModel = { collection: Collection; init(): Promise<unknown> };

const ALL_MODELS: SeededModel[] = [
  User,
  Booking,
  Payment,
  SessionRecord,
  PackageDeduction,
  Package,
  TrainerAvailability,
  FitnessProfile,
  FitnessAssessment,
  AiRecommendationCache,
  PricingRule,
];

const UPCOMING: SeedOutcome[] = ["upcoming_paid", "upcoming_unpaid", "expired_checkout", "failed_payment"];
const PAID: SeedOutcome[] = ["completed", "upcoming_paid", "missed_paid"];
const FAILED: SeedOutcome[] = ["failed_payment", "cancelled_failed"];

const BOOKING_STATE: Record<SeedOutcome, { status: BookingStatus; paymentStatus: PaymentStatus }> = {
  completed: { status: "completed", paymentStatus: "paid" },
  upcoming_paid: { status: "confirmed", paymentStatus: "paid" },
  missed_paid: { status: "confirmed", paymentStatus: "paid" },
  upcoming_unpaid: { status: "confirmed", paymentStatus: "unpaid" },
  missed_unpaid: { status: "confirmed", paymentStatus: "unpaid" },
  expired_checkout: { status: "confirmed", paymentStatus: "unpaid" },
  failed_payment: { status: "confirmed", paymentStatus: "failed" },
  cancelled: { status: "cancelled", paymentStatus: "unpaid" },
  cancelled_failed: { status: "cancelled", paymentStatus: "failed" },
};

const toMinutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));

function validateScenarios() {
  const trainers = new Map(TRAINERS.map((trainer) => [trainer.email, trainer]));
  const customers = new Set(CUSTOMERS.map((customer) => customer.email));
  const busy = new Map<string, [number, number][]>();

  for (const booking of BOOKINGS) {
    const trainer = trainers.get(booking.trainer);
    const fail = (problem: string) => {
      throw new Error(`Seed booking ${booking.key}: ${problem}`);
    };

    if (!trainer || !customers.has(booking.customer)) fail("unknown trainer or customer");
    const zoneIndex = trainer!.zones.indexOf(booking.zone);
    if (zoneIndex < 0) fail(`${booking.trainer} doesn't serve ${booking.zone}`);
    if (toMinutes(booking.time) % 15 !== 0) fail("start time must be on a 15-minute mark");

    const upcoming = UPCOMING.includes(booking.outcome);
    if (upcoming && (booking.day < 1 || booking.day >= SEED_DAYS)) fail(`upcoming bookings need a day from 1 to ${SEED_DAYS - 1}`);
    if (!upcoming && booking.day > -1) fail("past outcomes need a negative day");

    const start = toMinutes(booking.time);
    const end = start + SESSION_MINUTES;
    const window = DAILY_WINDOWS[zoneIndex];
    if (upcoming && (start < toMinutes(window.startTime) || end > toMinutes(window.endTime))) {
      fail(`outside ${trainer!.name}'s ${booking.zone} window ${window.startTime}–${window.endTime}`);
    }

    if (!booking.outcome.startsWith("cancelled")) {
      const absolute: [number, number] = [booking.day * 1440 + start, booking.day * 1440 + end];
      const taken = busy.get(booking.trainer) ?? [];
      if (taken.some(([from, to]) => absolute[0] < to && from < absolute[1])) fail(`overlaps another booking for ${booking.trainer}`);
      busy.set(booking.trainer, [...taken, absolute]);
    }
    if (booking.outcome === "completed" && !booking.workout) fail("completed bookings need a workout");
  }
}

async function wipeEverything() {
  console.log(`Reset: deleting ALL documents in database "${mongoose.connection.name}"`);
  for (const model of ALL_MODELS) {
    const { deletedCount } = await model.collection.deleteMany({});
    console.log(`  ${model.collection.collectionName.padEnd(22)} ${deletedCount} deleted`);
  }
}

async function removeDemoData() {
  const demoUsers = await User.find({ email: DEMO_EMAIL }, "_id").lean();
  const ids = demoUsers.map((user) => user._id);
  const bookingIds = (await Booking.find({ $or: [{ customerId: { $in: ids } }, { trainerId: { $in: ids } }] }, "_id").lean()).map(
    (booking) => booking._id
  );
  const keep = [DEMO_ACCOUNTS.admin.email, ...TRAINERS.map((trainer) => trainer.email), ...CUSTOMERS.map((customer) => customer.email)];

  await Promise.all([
    Payment.deleteMany({ bookingId: { $in: bookingIds } }),
    SessionRecord.deleteMany({ bookingId: { $in: bookingIds } }),
    PackageDeduction.deleteMany({ bookingId: { $in: bookingIds } }),
    Booking.deleteMany({ _id: { $in: bookingIds } }),
    Package.deleteMany({ customerId: { $in: ids } }),
    FitnessProfile.deleteMany({ customerId: { $in: ids } }),
    FitnessAssessment.deleteMany({ customerId: { $in: ids } }),
    AiRecommendationCache.deleteMany({ customerId: { $in: ids } }),
    TrainerAvailability.deleteMany({ trainerId: { $in: ids } }),
  ]);
  await User.deleteMany({ email: { $regex: DEMO_EMAIL, $nin: keep } });
  console.log(`Removed previous demo data: ${bookingIds.length} bookings and their payments, sessions and credits`);
}

async function renameLegacyZones() {
  let renamed = 0;

  for (const [legacy, zone] of Object.entries(LEGACY_ZONE_NAMES)) {
    const results = await Promise.all([
      Booking.collection.updateMany({ serviceZone: legacy }, { $set: { serviceZone: zone } }),
      TrainerAvailability.collection.updateMany({ serviceZone: legacy }, { $set: { serviceZone: zone } }),
    ]);
    renamed += results.reduce((total, result) => total + result.modifiedCount, 0);
  }

  if (renamed > 0) {
    console.log(`Renamed ${renamed} bookings and availability windows from old service zone names`);
  }
}

function backdate(model: Pick<SeededModel, "collection">, id: Types.ObjectId, createdAt: Date, withUpdatedAt = true) {
  return model.collection.updateOne({ _id: id }, { $set: { createdAt, ...(withUpdatedAt && { updatedAt: createdAt }) } });
}

async function upsertUser(fields: { name: string; email: string; role: string; specialties?: string[] }, passwordHash: string) {
  await User.updateOne(
    { email: fields.email },
    { $set: { ...fields, passwordHash, isActive: true } },
    { upsert: true, runValidators: true }
  );
  return User.findOne({ email: fields.email }).orFail();
}

function buildAvailability(trainerId: Types.ObjectId, zones: SeedTrainer["zones"]) {
  const today = todayInZone();

  return Array.from({ length: SEED_DAYS }, (_, offset) => addDays(today, offset)).flatMap((date) =>
    DAILY_WINDOWS.map((window, index) => ({
      trainerId,
      date: zonedToUtc(date),
      startTime: zonedToUtc(date, window.startTime),
      endTime: zonedToUtc(date, window.endTime),
      serviceZone: zones[index] as ServiceZone,
      isAvailable: true,
    }))
  );
}

function bookedAt(booking: SeedBooking, start: Date, now: Date) {
  if (booking.mode === "instant") {
    return addMinutes(start, -40);
  }
  const threeDaysBefore = addMinutes(start, -3 * 24 * 60);
  const recently = addMinutes(now, -120);
  return threeDaysBefore < recently ? threeDaysBefore : recently;
}

async function seedCustomers(adminId: Types.ObjectId, passwordHash: string) {
  const today = todayInZone();
  const users = new Map<string, Types.ObjectId>();
  const packages = new Map<string, { id: Types.ObjectId; total: number; used: number }>();

  for (const { profile, package: credit, ...customer } of CUSTOMERS) {
    const user = await upsertUser({ ...customer, role: "customer" }, passwordHash);
    users.set(customer.email, user._id);

    if (profile) {
      const { assessments, ...fields } = profile;
      const latest = assessments[assessments.length - 1];
      await FitnessProfile.create({ customerId: user._id, ...fields, weight: latest.weight });
      for (const { daysAgo, weight } of assessments) {
        const assessment = await FitnessAssessment.create({ customerId: user._id, age: fields.age, weight, fitnessGoals: fields.fitnessGoals, experienceLevel: fields.experienceLevel });
        await backdate(FitnessAssessment, assessment._id, zonedToUtc(addDays(today, -daysAgo), "09:00"), false);
      }
    }

    if (credit) {
      const created = await Package.create({
        customerId: user._id,
        totalSessions: credit.totalSessions,
        usedSessions: 0,
        remainingSessions: credit.totalSessions,
        status: "active",
        source: credit.source,
        grantedBy: credit.source === "admin" ? adminId : null,
      });
      await backdate(Package, created._id, zonedToUtc(addDays(today, -credit.daysAgo), "09:00"));
      packages.set(customer.email, { id: created._id, total: credit.totalSessions, used: 0 });
    }
  }

  return { users, packages };
}

async function seedBookings(
  customers: Map<string, Types.ObjectId>,
  trainers: Map<string, Types.ObjectId>,
  packages: Map<string, { id: Types.ObjectId; total: number; used: number }>,
  ruleId: Types.ObjectId
) {
  const today = todayInZone();
  const now = new Date();
  const scheduled = BOOKINGS.map((booking) => ({ booking, start: zonedToUtc(addDays(today, booking.day), booking.time) })).sort(
    (a, b) => a.start.getTime() - b.start.getTime()
  );

  for (const { booking: seed, start } of scheduled) {
    const customerId = customers.get(seed.customer)!;
    const trainerId = trainers.get(seed.trainer)!;
    const quote = calculateQuote(DEFAULT_PRICING, start);
    const paid = PAID.includes(seed.outcome);
    const createdAt = bookedAt(seed, start, now);

    const booking = await Booking.create({
      customerId,
      trainerId,
      startTime: start,
      endTime: addMinutes(start, SESSION_MINUTES),
      bookingType: seed.mode,
      serviceZone: seed.zone,
      idempotencyKey: seed.key,
      ...BOOKING_STATE[seed.outcome],
      ...(paid && { sessionPrice: quote.sessionPrice, commissionAmount: quote.commissionAmount, totalAmount: quote.totalAmount }),
    });
    await backdate(Booking, booking._id, createdAt);

    const attempt = paid ? "paid" : FAILED.includes(seed.outcome) ? "failed" : seed.outcome === "expired_checkout" ? "expired" : null;
    if (attempt) {
      const checkoutAt = addMinutes(createdAt, seed.mode === "instant" ? 3 : 10);
      const payment = await Payment.create({
        bookingId: booking._id,
        customerId,
        status: attempt,
        ...quote,
        pricingRuleId: ruleId,
        expiresAt: addMinutes(checkoutAt, QUOTE_TTL_MINUTES),
        providerReference: attempt === "paid" ? `sim_${seed.key}` : null,
        failureReason: attempt === "failed" ? DECLINED : null,
        paidAt: attempt === "paid" ? addMinutes(checkoutAt, 2) : null,
      });
      await backdate(Payment, payment._id, checkoutAt);
    }

    if (seed.outcome === "completed" && seed.workout) {
      const { feedback, ...workout } = seed.workout;
      const startedAt = addMinutes(start, 2);
      const endsAt = addMinutes(startedAt, SESSION_MINUTES);
      const record = await SessionRecord.create({
        bookingId: booking._id,
        customerId,
        trainerId,
        status: "completed",
        startedAt,
        endsAt,
        completedAt: endsAt,
        durationMinutes: SESSION_MINUTES,
        ...workout,
        ...(feedback && { customerFeedback: feedback }),
      });
      await backdate(SessionRecord, record._id, startedAt);

      const credit = packages.get(seed.customer);
      const deducted = credit && credit.used < credit.total;
      if (deducted) {
        credit.used += 1;
      }
      const deduction = await PackageDeduction.create({
        bookingId: booking._id,
        sessionRecordId: record._id,
        customerId,
        packageId: deducted ? credit.id : null,
        outcome: deducted ? "deducted" : "no_package",
      });
      await backdate(PackageDeduction, deduction._id, endsAt, false);
    }
  }

  for (const credit of packages.values()) {
    const remaining = credit.total - credit.used;
    await Package.updateOne(
      { _id: credit.id },
      { $set: { usedSessions: credit.used, remainingSessions: remaining, status: remaining === 0 ? "exhausted" : "active" } }
    );
  }
}

async function seed() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to seed demo data when NODE_ENV=production");
  }

  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error("MONGODB_URI is not defined");
  }

  validateScenarios();
  await mongoose.connect(uri);
  console.log(`Seeding demo data into database "${mongoose.connection.name}"`);

  if (RESET) {
    await wipeEverything();
  } else {
    await removeDemoData();
    await renameLegacyZones();
  }

  await Promise.all(ALL_MODELS.map((model) => model.init()));

  const passwordHash = await bcrypt.hash(process.env.DEMO_PASSWORD || DEFAULT_DEMO_PASSWORD, 10);
  const admin = await upsertUser({ ...DEMO_ACCOUNTS.admin, role: "admin" }, passwordHash);

  const trainers = new Map<string, Types.ObjectId>();
  for (const { zones, ...trainer } of TRAINERS) {
    const user = await upsertUser({ ...trainer, role: "trainer" }, passwordHash);
    trainers.set(trainer.email, user._id);
    await TrainerAvailability.deleteMany({ trainerId: user._id });
    await TrainerAvailability.insertMany(buildAvailability(user._id, zones));
  }

  await PricingRule.updateMany({ name: { $ne: "Standard" } }, { $set: { isActive: false } });
  await PricingRule.syncIndexes();
  await PricingRule.updateOne({ name: "Standard" }, { $set: { ...DEFAULT_PRICING, isActive: true } }, { upsert: true });
  const rule = await PricingRule.findOne({ name: "Standard" }).orFail();

  const { users: customers, packages } = await seedCustomers(admin._id, passwordHash);
  await seedBookings(customers, trainers, packages, rule._id);

  const outcomes = Object.entries(Object.groupBy(BOOKINGS, (booking) => booking.outcome)).map(([outcome, list]) => `${outcome} ${list?.length}`);
  console.log("Demo accounts ready:");
  console.log(`  admin     ${DEMO_ACCOUNTS.admin.email}`);
  for (const customer of CUSTOMERS) {
    console.log(`  customer  ${customer.email}`);
  }
  for (const trainer of TRAINERS) {
    console.log(`  trainer   ${trainer.email.padEnd(26)} ${trainer.zones.join(" / ")}`);
  }
  console.log(`Availability: ${SEED_DAYS} days, 06:00–13:00 and 14:00–21:00 IST per trainer`);
  console.log(`Bookings: ${BOOKINGS.length} (${outcomes.join(", ")})`);
  const { normalPrice, peakPrice, commissionPercent } = DEFAULT_PRICING;
  console.log(
    `Pricing: normal ${formatInr(quoteForPrice(normalPrice, commissionPercent, false).totalAmount)}, ` +
      `peak ${formatInr(quoteForPrice(peakPrice, commissionPercent, true).totalAmount)} (incl. ${commissionPercent}% commission)`
  );
  console.log(
    process.env.DEMO_PASSWORD
      ? "Password: value of DEMO_PASSWORD"
      : `Password: ${DEFAULT_DEMO_PASSWORD} (development default, set DEMO_PASSWORD to change it)`
  );
}

seed()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Seeding failed");
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
