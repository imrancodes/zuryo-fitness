import { z } from "zod";

const optionalCount = (max: number, label: string) =>
  z
    .number({ error: `${label} must be a number` })
    .int(`${label} must be a whole number`)
    .min(0, `${label} can't be negative`)
    .max(max, `${label} must be at most ${max}`)
    .optional();

export const exerciseSchema = z.object({
  name: z.string().trim().min(1, "Name each exercise").max(80, "Keep exercise names under 80 characters"),
  sets: optionalCount(50, "Sets"),
  reps: optionalCount(500, "Reps"),
  notes: z.string().trim().max(200, "Keep exercise notes under 200 characters").optional(),
});

export const workoutRecordSchema = z.object({
  exercises: z.array(exerciseSchema).max(30, "Log at most 30 exercises"),
  trainerNotes: z.string().trim().max(2000, "Keep notes under 2,000 characters"),
  suggestedNextWorkout: z.string().trim().max(500, "Keep the suggestion under 500 characters"),
});

export const SESSION_FILTERS = ["upcoming", "in_progress", "completed", "all"] as const;

export const sessionListQuerySchema = z.object({
  status: z.enum(SESSION_FILTERS).default("upcoming"),
});

export type WorkoutRecordInput = z.infer<typeof workoutRecordSchema>;
export type SessionFilter = (typeof SESSION_FILTERS)[number];
