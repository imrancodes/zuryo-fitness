import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { DEMO_ACCOUNTS } from "@/lib/demo";
import { formatInr } from "@/lib/money";
import { DEFAULT_PRICING, quoteForPrice } from "@/lib/pricing";
import { addDays, todayInZone, zonedToUtc } from "@/lib/time";
import type { ServiceZone } from "@/lib/zones";
import { Booking } from "@/models/Booking";
import { PricingRule } from "@/models/PricingRule";
import { TrainerAvailability } from "@/models/TrainerAvailability";
import { User } from "@/models/User";

const DEFAULT_DEMO_PASSWORD = "ZuryoDemo123!";
const SEED_DAYS = 8;

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

  console.log("Demo accounts ready:");
  console.log(`  customer  ${DEMO_ACCOUNTS.customer.email}`);
  console.log(`  admin     ${DEMO_ACCOUNTS.admin.email}`);
  for (const trainer of TRAINERS) {
    console.log(`  trainer   ${trainer.email.padEnd(26)} ${trainer.zones.join(" / ")}`);
  }
  console.log(`Availability: ${SEED_DAYS} days, 06:00–13:00 and 14:00–21:00 IST per trainer`);
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
