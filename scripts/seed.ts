import bcrypt from "bcryptjs";
import mongoose, { type Types } from "mongoose";
import { DEMO_ACCOUNTS } from "@/lib/demo";
import { ROLES } from "@/lib/roles";
import { PricingRule } from "@/models/PricingRule";
import { TrainerAvailability } from "@/models/TrainerAvailability";
import { User } from "@/models/User";

const DEFAULT_DEMO_PASSWORD = "ZuryoDemo123!";
const DEMO_SLOTS = [
  { hour: 7, serviceZone: "Demo Zone · Indiranagar" },
  { hour: 18, serviceZone: "Demo Zone · Koramangala" },
];

function buildAvailability(trainerId: Types.ObjectId) {
  return [1, 2, 3].flatMap((offset) => {
    const date = new Date();
    date.setDate(date.getDate() + offset);
    date.setHours(0, 0, 0, 0);

    return DEMO_SLOTS.map(({ hour, serviceZone }) => {
      const startTime = new Date(date);
      startTime.setHours(hour);
      const endTime = new Date(startTime);
      endTime.setHours(hour + 1);
      return { trainerId, date, startTime, endTime, serviceZone, isAvailable: true };
    });
  });
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
  await Promise.all([User.init(), TrainerAvailability.init(), PricingRule.init()]);

  const passwordHash = await bcrypt.hash(process.env.DEMO_PASSWORD || DEFAULT_DEMO_PASSWORD, 10);

  for (const role of ROLES) {
    const { name, email } = DEMO_ACCOUNTS[role];
    await User.updateOne(
      { email },
      { $set: { name, role, passwordHash, isActive: true } },
      { upsert: true, runValidators: true }
    );
  }

  const trainer = await User.findOne({ email: DEMO_ACCOUNTS.trainer.email }).orFail();
  await TrainerAvailability.deleteMany({ trainerId: trainer._id });
  await TrainerAvailability.insertMany(buildAvailability(trainer._id));

  await PricingRule.updateOne(
    { name: "Standard" },
    {
      $set: {
        normalPrice: 80000,
        peakPrice: 100000,
        commissionPercent: 20,
        peakSlots: [
          { daysOfWeek: [1, 2, 3, 4, 5], startTime: "06:00", endTime: "09:00" },
          { daysOfWeek: [1, 2, 3, 4, 5], startTime: "17:00", endTime: "20:00" },
        ],
        isActive: true,
      },
    },
    { upsert: true, runValidators: true }
  );

  console.log("Demo accounts ready:");
  for (const role of ROLES) {
    console.log(`  ${role.padEnd(8)} ${DEMO_ACCOUNTS[role].email}`);
  }
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
