import { z } from "zod";
import {
  AGE_RANGE,
  EXPERIENCE_LEVELS,
  FITNESS_GOALS,
  MAX_GOALS,
  PREFERRED_TIMES,
  WEIGHT_RANGE_KG,
  WORKOUT_TYPES,
} from "@/lib/fitness";

const unique = <T>(values: T[]) => new Set(values).size === values.length;

export const fitnessProfileSchema = z.object({
  age: z
    .number({ error: "Enter your age" })
    .int("Age must be a whole number")
    .min(AGE_RANGE.min, `Age must be at least ${AGE_RANGE.min}`)
    .max(AGE_RANGE.max, `Age must be at most ${AGE_RANGE.max}`),
  weight: z
    .number({ error: "Enter your weight in kg" })
    .min(WEIGHT_RANGE_KG.min, `Weight must be at least ${WEIGHT_RANGE_KG.min} kg`)
    .max(WEIGHT_RANGE_KG.max, `Weight must be at most ${WEIGHT_RANGE_KG.max} kg`)
    .refine((value) => Math.abs(value * 10 - Math.round(value * 10)) < 1e-6, "Use at most one decimal place"),
  fitnessGoals: z
    .array(z.enum(FITNESS_GOALS, { error: "Choose goals from the list" }))
    .min(1, "Pick at least one goal")
    .max(MAX_GOALS, `Pick up to ${MAX_GOALS} goals`)
    .refine(unique, "Goals must not repeat"),
  experienceLevel: z.enum(EXPERIENCE_LEVELS, { error: "Choose your experience level" }),
  workoutPreferences: z.object({
    workoutTypes: z.array(z.enum(WORKOUT_TYPES)).max(WORKOUT_TYPES.length).refine(unique, "Workout types must not repeat"),
    preferredTimes: z.array(z.enum(PREFERRED_TIMES)).max(PREFERRED_TIMES.length).refine(unique, "Times must not repeat"),
  }),
});

export type FitnessProfileInput = z.infer<typeof fitnessProfileSchema>;
