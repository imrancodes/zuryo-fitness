import "server-only";
import { connectToDatabase } from "@/lib/mongodb";
import type { ExperienceLevel, FitnessGoal, FitnessProfileData, PreferredTime, WorkoutType } from "@/lib/fitness";
import type { WeightPoint } from "@/lib/progress";
import { runTransaction } from "@/lib/transaction";
import { FitnessAssessment } from "@/models/FitnessAssessment";
import { FitnessProfile, type FitnessProfileRecord } from "@/models/FitnessProfile";
import type { FitnessProfileView, ProfileSnapshot } from "@/types/fitness";
import type { FitnessProfileInput } from "@/validators/fitness";

function toProfileData(profile: FitnessProfileRecord): FitnessProfileData {
  return {
    age: profile.age,
    weight: profile.weight,
    fitnessGoals: (profile.fitnessGoals ?? []) as FitnessGoal[],
    experienceLevel: profile.experienceLevel as ExperienceLevel,
    workoutPreferences: {
      workoutTypes: (profile.workoutPreferences?.workoutTypes ?? []) as WorkoutType[],
      preferredTimes: (profile.workoutPreferences?.preferredTimes ?? []) as PreferredTime[],
    },
  };
}

function toProfileView(profile: FitnessProfileRecord): FitnessProfileView {
  return { ...toProfileData(profile), updatedAt: (profile.updatedAt ?? new Date()).toISOString() };
}

export async function getProfile(customerId: string) {
  await connectToDatabase();
  const profile = await FitnessProfile.findOne({ customerId }).lean<FitnessProfileRecord>();
  return profile ? toProfileView(profile) : null;
}

export async function getProfileSnapshot(customerId: string): Promise<ProfileSnapshot | null> {
  const profile = await getProfile(customerId);
  return profile
    ? { fitnessGoals: profile.fitnessGoals, experienceLevel: profile.experienceLevel, workoutPreferences: profile.workoutPreferences }
    : null;
}

export async function saveProfile(customerId: string, input: FitnessProfileInput) {
  await connectToDatabase();
  await Promise.all([FitnessProfile.init(), FitnessAssessment.init()]);

  return runTransaction(async (session) => {
    const profile = await FitnessProfile.findOneAndUpdate(
      { customerId },
      { $set: input },
      { upsert: true, new: true, runValidators: true, session }
    ).lean<FitnessProfileRecord>();

    await FitnessAssessment.create(
      [{ customerId, age: input.age, weight: input.weight, fitnessGoals: input.fitnessGoals, experienceLevel: input.experienceLevel }],
      { session }
    );

    return toProfileView(profile!);
  });
}

export async function getWeightHistory(customerId: string): Promise<WeightPoint[]> {
  await connectToDatabase();
  const assessments = await FitnessAssessment.find({ customerId }, "weight createdAt").sort({ createdAt: 1 }).limit(50).lean();
  return assessments.map((assessment) => ({
    weight: assessment.weight,
    recordedAt: (assessment.createdAt ?? new Date()).toISOString(),
  }));
}
