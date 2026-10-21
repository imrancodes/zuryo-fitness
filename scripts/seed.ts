import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { DEMO_ACCOUNTS } from "@/lib/demo";
import { formatInr } from "@/lib/money";
import { calculateQuote, DEFAULT_PRICING, quoteForPrice } from "@/lib/pricing";
import { addDays, addMinutes, todayInZone, zonedToUtc } from "@/lib/time";
import type { ServiceZone } from "@/lib/zones";
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

const DEFAULT_DEMO_PASSWORD = "ZuryoDemo123!";
const SEED_DAYS = 8;
const SEED_PACKAGE_SESSIONS = 10;

const DEMO_PROFILE = {
  age: 32,
  weight: 76.4,
  fitnessGoals: ["build_muscle", "general_fitness"],
  experienceLevel: "intermediate",
  workoutPreferences: { workoutTypes: ["strength", "hiit"], preferredTimes: ["morning", "evening"] },
};

const DEMO_ASSESSMENTS = [
  { daysAgo: 30, weight: 78.2 },
  { daysAgo: 0, weight: 76.4 },
];

const HISTORY_SESSIONS = [
  {
    key: "seed-history-session-3",
    daysAgo: 15,
    exercises: [
      { name: "Bench press", sets: 3, reps: 10 },
      { name: "Seated row", sets: 3, reps: 12 },
      { name: "Plank", sets: 3, notes: "30 seconds" },
    ],
    trainerNotes: "First session. Good form on rows; bench press needs a slower lowering phase.",
    suggestedNextWorkout: "Full-body circuit with light dumbbells",
    feedback: { rating: 4, comment: "Clear coaching, slightly rushed warm-up." },
  },
  {
    key: "seed-history-session-2",
    daysAgo: 8,
    exercises: [
      { name: "Kettlebell swing", sets: 4, reps: 15 },
      { name: "Push-up", sets: 3, reps: 12 },
      { name: "Walking lunge", sets: 3, reps: 10 },
    ],
    trainerNotes: "Strong conditioning work. Keep the hinge on swings and avoid squatting the movement.",
    suggestedNextWorkout: "Lower body strength with goblet squats",
    feedback: null,
  },
  {
    key: "seed-history-session",
    daysAgo: 1,
    exercises: [
      { name: "Goblet squat", sets: 3, reps: 12 },
      { name: "Push-up", sets: 3, reps: 10, notes: "Knees down for the last set" },
      { name: "Plank", sets: 3, notes: "40 seconds" },
    ],
    trainerNotes: "Good energy today. Squat depth improved; keep the core braced on push-ups.",
    suggestedNextWorkout: "Lower body strength with lunges and Romanian deadlifts",
    feedback: null,
  },
];

const TRAINERS: { name: string; email: string; specialties: string[]; zones: [ServiceZone, ServiceZone] }[] = [
  { ...DEMO_ACCOUNTS.trainer, specialties: ["Strength", "Mobility"], zones: ["Indiranagar", "Koramangala"] },
  { name: "Rohan Das", email: "rohan.trainer@zuryo.dev", specialties: ["Yoga", "Flexibility"], zones: ["Koramangala", "HSR Layout"] },
  { name: "Meera Iyer", email: "meera.trainer@zuryo.dev", specialties: ["HIIT", "Weight loss"], zones: ["Whitefield", "Indiranagar"] },
  { name: "Kabir Singh", email: "kabir.trainer@zuryo.dev", specialties: ["Boxing", "Conditioning"], zones: ["Jayanagar", "HSR Layout"] },
];

const DAILY_WINDOWS = [
  { startTime: "06:00", endTime: "13:00" },
  { startTime: "14:00", endTime: "21:00" },
];

async function upsertUser(fields: { name: string; email: string; role: string; specialties?: string[] }, passwordHash: string) {
  await User.updateOne(
    { email: fields.email },
    { $set: { ...fields, passwordHash, isActive: true } },
    { upsert: true, runValidators: true }
  );
  return User.findOne({ email: fields.email }).orFail();
}

function buildAvailability(trainerId: mongoose.Types.ObjectId, zones: [ServiceZone, ServiceZone]) {
  const today = todayInZone();

  return Array.from({ length: SEED_DAYS }, (_, offset) => addDays(today, offset)).flatMap((date) =>
    DAILY_WINDOWS.map((window, index) => ({
      trainerId,
      date: zonedToUtc(date),
      startTime: zonedToUtc(date, window.startTime),
      endTime: zonedToUtc(date, window.endTime),
      serviceZone: zones[index],
      isAvailable: true,
    }))
  );
}

async function seedCustomerHistory() {
  const customer = await User.findOne({ email: DEMO_ACCOUNTS.customer.email }).orFail();
  const trainer = await User.findOne({ email: DEMO_ACCOUNTS.trainer.email }).orFail();
  const rule = await PricingRule.findOne({ name: "Standard" }).orFail();
  const seedPackage = await Package.findOneAndUpdate(
    { customerId: customer._id, source: "seed" },
    { $setOnInsert: { totalSessions: SEED_PACKAGE_SESSIONS, usedSessions: 0, remainingSessions: SEED_PACKAGE_SESSIONS, status: "active" } },
    { upsert: true, new: true }
  ).orFail();

  for (const history of HISTORY_SESSIONS) {
    await seedCompletedSession({ customerId: customer._id, trainerId: trainer._id, ruleId: rule._id, packageId: seedPackage._id, ...history });
  }

  const used = await PackageDeduction.countDocuments({ packageId: seedPackage._id, outcome: "deducted" });
  await Package.updateOne(
    { _id: seedPackage._id },
    {
      $set: {
        usedSessions: used,
        remainingSessions: SEED_PACKAGE_SESSIONS - used,
        status: used >= SEED_PACKAGE_SESSIONS ? "exhausted" : "active",
      },
    }
  );

  await FitnessProfile.updateOne({ customerId: customer._id }, { $set: { customerId: customer._id, ...DEMO_PROFILE } }, { upsert: true });
  await FitnessAssessment.deleteMany({ customerId: customer._id });
  await FitnessAssessment.insertMany(
    DEMO_ASSESSMENTS.map(({ daysAgo, weight }) => ({
      customerId: customer._id,
      age: DEMO_PROFILE.age,
      weight,
      fitnessGoals: DEMO_PROFILE.fitnessGoals,
      experienceLevel: DEMO_PROFILE.experienceLevel,
      createdAt: zonedToUtc(addDays(todayInZone(), -daysAgo), "09:00"),
    }))
  );
}

type SeedHistory = (typeof HISTORY_SESSIONS)[number] & {
  customerId: mongoose.Types.ObjectId;
  trainerId: mongoose.Types.ObjectId;
  ruleId: mongoose.Types.ObjectId;
  packageId: mongoose.Types.ObjectId;
};

async function seedCompletedSession({ customerId, trainerId, ruleId, packageId, key, daysAgo, exercises, trainerNotes, suggestedNextWorkout, feedback }: SeedHistory) {
  const startTime = zonedToUtc(addDays(todayInZone(), -daysAgo), "10:00");
  const endTime = addMinutes(startTime, 60);
  const quote = calculateQuote(DEFAULT_PRICING, startTime);
  const customer = { _id: customerId };
  const trainer = { _id: trainerId };
  const rule = { _id: ruleId };

  const booking = await Booking.findOneAndUpdate(
    { customerId: customer._id, idempotencyKey: key },
    {
      $set: {
        trainerId: trainer._id,
        startTime,
        endTime,
        bookingType: "scheduled",
        status: "completed",
        serviceZone: "Indiranagar",
        paymentStatus: "paid",
        sessionPrice: quote.sessionPrice,
        commissionAmount: quote.commissionAmount,
        totalAmount: quote.totalAmount,
      },
    },
    { upsert: true, new: true }
  ).orFail();

  await Payment.updateOne(
    { bookingId: booking._id, status: "paid" },
    {
      $set: {
        customerId: customer._id,
        ...quote,
        pricingRuleId: rule._id,
        expiresAt: startTime,
        providerReference: `sim_${key}`,
        paidAt: addMinutes(startTime, -120),
      },
    },
    { upsert: true }
  );

  const record = await SessionRecord.findOneAndUpdate(
    { bookingId: booking._id },
    {
      $set: {
        customerId: customer._id,
        trainerId: trainer._id,
        status: "completed",
        startedAt: startTime,
        endsAt: endTime,
        completedAt: endTime,
        durationMinutes: 60,
        exercises,
        trainerNotes,
        suggestedNextWorkout,
        ...(feedback && { customerFeedback: feedback }),
      },
    },
    { upsert: true, new: true }
  ).orFail();

  await PackageDeduction.updateOne(
    { bookingId: booking._id },
    { $setOnInsert: { sessionRecordId: record._id, customerId: customer._id, packageId, outcome: "deducted" } },
    { upsert: true }
  );
}

async function seed() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to seed demo data when NODE_ENV=production");
  }

  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error("MONGODB_URI is not defined");
  }

  await mongoose.connect(uri);
  console.log(`Seeding demo data into database "${mongoose.connection.name}"`);
  await Promise.all([User.init(), TrainerAvailability.init(), PricingRule.init(), Booking.init(), PackageDeduction.init(), FitnessProfile.init()]);

  const passwordHash = await bcrypt.hash(process.env.DEMO_PASSWORD || DEFAULT_DEMO_PASSWORD, 10);

  await upsertUser({ ...DEMO_ACCOUNTS.customer, role: "customer" }, passwordHash);
  await upsertUser({ ...DEMO_ACCOUNTS.admin, role: "admin" }, passwordHash);

  for (const { zones, ...trainer } of TRAINERS) {
    const user = await upsertUser({ ...trainer, role: "trainer" }, passwordHash);
    await TrainerAvailability.deleteMany({ trainerId: user._id });
    await TrainerAvailability.insertMany(buildAvailability(user._id, zones));
  }

  await PricingRule.updateMany({ name: { $ne: "Standard" } }, { $set: { isActive: false } });
  await PricingRule.syncIndexes();
  await PricingRule.updateOne({ name: "Standard" }, { $set: { ...DEFAULT_PRICING, isActive: true } }, { upsert: true });
  await seedCustomerHistory();

  console.log("Demo accounts ready:");
  console.log(`  customer  ${DEMO_ACCOUNTS.customer.email}`);
  console.log(`  admin     ${DEMO_ACCOUNTS.admin.email}`);
  for (const trainer of TRAINERS) {
    console.log(`  trainer   ${trainer.email.padEnd(26)} ${trainer.zones.join(" / ")}`);
  }
  console.log(`Availability: ${SEED_DAYS} days, 06:00–13:00 and 14:00–21:00 IST per trainer`);
  console.log("Customer history: profile + 2 assessments, 3 completed sessions with Priya Nair, 10-session package (3 used)");
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
