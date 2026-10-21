import { z } from "zod";

export const aiExerciseSchema = z
  .object({
    name: z.string().trim().min(2).max(60),
    sets: z.number().int().min(1).max(6).optional(),
    reps: z.number().int().min(1).max(30).optional(),
    durationSeconds: z.number().int().min(10).max(600).optional(),
    notes: z.string().trim().max(160),
  })
  .refine((exercise) => exercise.sets != null || exercise.reps != null || exercise.durationSeconds != null, {
    message: "Each exercise needs sets, reps or a duration",
  });

export const aiRecommendationSchema = z.object({
  title: z.string().trim().min(3).max(80),
  summary: z.string().trim().min(10).max(400),
  goal: z.string().trim().min(3).max(80),
  reasoning: z.array(z.string().trim().min(3).max(200)).min(1).max(5),
  exercises: z.array(aiExerciseSchema).min(3).max(8),
  durationMinutes: z.number().int().min(15).max(75),
  recoveryAdvice: z.string().trim().min(10).max(300),
  limitations: z.string().trim().min(10).max(300),
});

export type AiExercise = z.infer<typeof aiExerciseSchema>;
export type AiRecommendation = z.infer<typeof aiRecommendationSchema>;

export function aiRecommendationJsonSchema() {
  const schema: Record<string, unknown> = { ...z.toJSONSchema(aiRecommendationSchema) };
  delete schema.$schema;
  return schema;
}
