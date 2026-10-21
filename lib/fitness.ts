export const FITNESS_GOALS = [
  "lose_weight",
  "build_muscle",
  "improve_endurance",
  "increase_flexibility",
  "general_fitness",
  "sports_performance",
] as const;
export const EXPERIENCE_LEVELS = ["beginner", "intermediate", "advanced"] as const;
export const WORKOUT_TYPES = ["strength", "cardio", "hiit", "yoga", "mobility", "boxing"] as const;
export const PREFERRED_TIMES = ["morning", "afternoon", "evening"] as const;

export type FitnessGoal = (typeof FITNESS_GOALS)[number];
export type ExperienceLevel = (typeof EXPERIENCE_LEVELS)[number];
export type WorkoutType = (typeof WORKOUT_TYPES)[number];
export type PreferredTime = (typeof PREFERRED_TIMES)[number];

export const FITNESS_GOAL_LABEL: Record<FitnessGoal, string> = {
  lose_weight: "Lose weight",
  build_muscle: "Build muscle",
  improve_endurance: "Improve endurance",
  increase_flexibility: "Increase flexibility",
  general_fitness: "General fitness",
  sports_performance: "Sports performance",
};

export const EXPERIENCE_LEVEL_LABEL: Record<ExperienceLevel, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

export const WORKOUT_TYPE_LABEL: Record<WorkoutType, string> = {
  strength: "Strength",
  cardio: "Cardio",
  hiit: "HIIT",
  yoga: "Yoga",
  mobility: "Mobility",
  boxing: "Boxing",
};

export const PREFERRED_TIME_LABEL: Record<PreferredTime, string> = {
  morning: "Morning",
  afternoon: "Afternoon",
  evening: "Evening",
};

export const AGE_RANGE = { min: 16, max: 90 };
export const WEIGHT_RANGE_KG = { min: 30, max: 250 };
export const MAX_GOALS = 3;

export type WorkoutPreferences = {
  workoutTypes: WorkoutType[];
  preferredTimes: PreferredTime[];
};

export type FitnessProfileData = {
  age: number;
  weight: number;
  fitnessGoals: FitnessGoal[];
  experienceLevel: ExperienceLevel;
  workoutPreferences: WorkoutPreferences;
};
