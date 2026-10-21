import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { DEMO_ACCOUNTS } from "@/lib/demo";
import { formatInr } from "@/lib/money";
import { calculateQuote, DEFAULT_PRICING, quoteForPrice } from "@/lib/pricing";
import { addDays, addMinutes, todayInZone, zonedToUtc } from "@/lib/time";
import type { ServiceZone } from "@/lib/zones";
import { Booking } from "@/models/Booking";
import { Payment } from "@/models/Payment";
import { PricingRule } from "@/models/PricingRule";
import { SessionRecord } from "@/models/SessionRecord";
import { TrainerAvailability } from "@/models/TrainerAvailability";
import { User } from "@/models/User";

const DEFAULT_DEMO_PASSWORD = "ZuryoDemo123!";
const SEED_DAYS = 8;
const HISTORY_BOOKING_KEY = "seed-history-session";

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

async function seedCompletedSession() {
  const customer = await User.findOne({ email: DEMO_ACCOUNTS.customer.email }).orFail();
  const trainer = await User.findOne({ email: DEMO_ACCOUNTS.trainer.email }).orFail();
  const rule = await PricingRule.findOne({ name: "Standard" }).orFail();
  const startTime = zonedToUtc(addDays(todayInZone(), -1), "10:00");
  const endTime = addMinutes(startTime, 60);
  const quote = calculateQuote(DEFAULT_PRICING, startTime);

  const booking = await Booking.findOneAndUpdate(
    { customerId: customer._id, idempotencyKey: HISTORY_BOOKING_KEY },
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
        providerReference: "sim_seed_history",
        paidAt: addMinutes(startTime, -120),
      },
    },
    { upsert: true }
  );

  await SessionRecord.updateOne(
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
        exercises: [
          { name: "Goblet squat", sets: 3, reps: 12 },
          { name: "Push-up", sets: 3, reps: 10, notes: "Knees down for the last set" },
          { name: "Plank", sets: 3, notes: "40 seconds" },
        ],
        trainerNotes: "Good energy today. Squat depth improved; keep the core braced on push-ups.",
        suggestedNextWorkout: "Lower body strength with lunges and Romanian deadlifts",
      },
    },
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
  await Promise.all([User.init(), TrainerAvailability.init(), PricingRule.init(), Booking.init()]);

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
  await seedCompletedSession();

  console.log("Demo accounts ready:");
  console.log(`  customer  ${DEMO_ACCOUNTS.customer.email}`);
  console.log(`  admin     ${DEMO_ACCOUNTS.admin.email}`);
  for (const trainer of TRAINERS) {
    console.log(`  trainer   ${trainer.email.padEnd(26)} ${trainer.zones.join(" / ")}`);
  }
  console.log(`Availability: ${SEED_DAYS} days, 06:00–13:00 and 14:00–21:00 IST per trainer`);
  console.log("History: one completed demo session yesterday (customer with Priya Nair)");
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
