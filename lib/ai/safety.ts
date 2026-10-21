import type { ExperienceLevel } from "@/lib/fitness";
import { aiRecommendationSchema, type AiRecommendation } from "@/validators/ai-recommendation";

export const MAX_RAW_OUTPUT_LENGTH = 8000;
export const MAX_TOTAL_SETS = 30;
export const BEGINNER_MAX_SETS = 4;

const UNSAFE_PATTERNS = [
  /diagnos/i,
  /\bmedication|\bmedicine\b|\bprescri/i,
  /\b(push|train|work|power)\s+(through|past)\s+(the\s+|any\s+)?pain/i,
  /\bignore\s+(the\s+|any\s+)?pain/i,
  /no\s+pain,?\s+no\s+gain/i,
  /one[\s-]rep\s+max|\b1\s?rm\b/i,
  /\bto\s+failure\b|\bmax(imal|imum)?\s+effort/i,
  /\bguarantee/i,
  /\bcures?\b/i,
];

export type ParseFailure = "too_long" | "not_json" | "schema" | "volume" | "unsafe_content";
export type ParseResult = { ok: true; recommendation: AiRecommendation } | { ok: false; failure: ParseFailure };

function textOf(recommendation: AiRecommendation) {
  return [
    recommendation.title,
    recommendation.summary,
    recommendation.goal,
    ...recommendation.reasoning,
    recommendation.recoveryAdvice,
    recommendation.limitations,
    ...recommendation.exercises.flatMap((exercise) => [exercise.name, exercise.notes]),
  ].join("\n");
}

export function parseRecommendation(raw: string, experienceLevel: ExperienceLevel): ParseResult {
  if (raw.length > MAX_RAW_OUTPUT_LENGTH) {
    return { ok: false, failure: "too_long" };
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { ok: false, failure: "not_json" };
  }

  const parsed = aiRecommendationSchema.safeParse(json);
  if (!parsed.success) {
    return { ok: false, failure: "schema" };
  }

  const recommendation = parsed.data;
  const totalSets = recommendation.exercises.reduce((sum, exercise) => sum + (exercise.sets ?? 0), 0);
  const tooHeavyForBeginner =
    experienceLevel === "beginner" && recommendation.exercises.some((exercise) => (exercise.sets ?? 0) > BEGINNER_MAX_SETS);

  if (totalSets > MAX_TOTAL_SETS || tooHeavyForBeginner) {
    return { ok: false, failure: "volume" };
  }

  if (UNSAFE_PATTERNS.some((pattern) => pattern.test(textOf(recommendation)))) {
    return { ok: false, failure: "unsafe_content" };
  }

  return { ok: true, recommendation };
}
