import "server-only";
import { connectToDatabase } from "@/lib/mongodb";
import { TrainerAvailability } from "@/models/TrainerAvailability";

export async function listTrainerAvailability(trainerId: string) {
  await connectToDatabase();
  const slots = await TrainerAvailability.find({ trainerId }).sort({ startTime: 1 }).limit(100);

  return slots.map((slot) => ({
    id: slot._id.toString(),
    date: slot.date,
    startTime: slot.startTime,
    endTime: slot.endTime,
    serviceZone: slot.serviceZone,
    isAvailable: slot.isAvailable,
  }));
}
