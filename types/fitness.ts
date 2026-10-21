import type { FitnessProfileData } from "@/lib/fitness";
import type { WeeklyCount, WeightPoint } from "@/lib/progress";
import type { PackageSummary } from "@/types/package";

export type FitnessProfileView = FitnessProfileData & { updatedAt: string };

export type ProfileSnapshot = Pick<FitnessProfileData, "fitnessGoals" | "experienceLevel" | "workoutPreferences">;

export type ProgressView = {
  profile: FitnessProfileView | null;
  weights: WeightPoint[];
  weightChange: { first: WeightPoint; latest: WeightPoint; deltaKg: number } | null;
  weekly: WeeklyCount[];
  consistency: { activeWeeks: number; totalWeeks: number };
  completedTotal: number;
  completedLast30Days: number;
  firstSessionAt: string | null;
  packages: PackageSummary;
};
