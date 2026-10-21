import "server-only";
import { createHash } from "node:crypto";
import { parseRecommendation } from "@/lib/ai/safety";
import { buildPromptInput, buildWorkoutPrompt, MAX_PROMPT_SESSIONS, PROMPT_VERSION, type PromptSession } from "@/lib/ai/workout-prompt";
import { ServiceError } from "@/lib/errors";
import type { FitnessProfileData } from "@/lib/fitness";
import { connectToDatabase } from "@/lib/mongodb";
import { buildRecommendations, RECOMMENDATION_DISCLAIMER } from "@/lib/recommendations";
import { formatDateTime, TIME_ZONE_LABEL } from "@/lib/time";
import { AiRecommendationCache, type AiRecommendationRecord } from "@/models/AiRecommendation";
import { AiError, aiModel, generateJson, isAiConfigured, type AiErrorKind } from "@/services/ai/gemini";
import { getProfile } from "@/services/fitness-profile.service";
import { listCompletedSessions } from "@/services/session.service";
import type { AiRecommendationResult, FallbackReason } from "@/types/recommendation";
import type { HistoryEntry } from "@/types/session";
import { aiRecommendationJsonSchema, type AiRecommendation } from "@/validators/ai-recommendation";

const CACHE_DAYS = 7;
const REGENERATION_LIMIT = 3;
const REGENERATION_WINDOW_MS = 24 * 60 * 60 * 1000;
const RATE_LIMIT_COOLDOWN_MS = 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export const AI_DISCLAIMER =
  "AI-generated general fitness guidance, not medical advice. Stop if you feel pain, dizziness or chest discomfort, and check with your trainer or a doctor before changing your routine.";

const FALLBACK_FOR: Record<AiErrorKind, FallbackReason> = {
  not_configured: "not_configured",
  rate_limited: "rate_limited",
  timeout: "timeout",
  failed: "provider_error",
};

const inFlight = new Map<string, Promise<AiRecommendationResult>>();

function toPromptSessions(history: HistoryEntry[]): PromptSession[] {
  return history.map((entry) => ({
    completedAt: new Date(entry.completedAt),
    exercises: entry.record.exercises,
    suggestedNextWorkout: entry.record.suggestedNextWorkout || null,
  }));
}

function hashInputs(profile: FitnessProfileData, history: HistoryEntry[], model: string) {
  const sessions = history.map((entry) => ({
    id: entry.id,
    completedAt: entry.completedAt,
    exercises: entry.record.exercises,
    suggestion: entry.record.suggestedNextWorkout,
  }));
  const relevantProfile = {
    fitnessGoals: profile.fitnessGoals,
    experienceLevel: profile.experienceLevel,
    workoutPreferences: profile.workoutPreferences,
  };
  return createHash("sha256").update(JSON.stringify({ relevantProfile, sessions, model, PROMPT_VERSION })).digest("hex");
}

function regenerationsLeft(record: AiRecommendationRecord | null, now: Date) {
  const recent = (record?.regenerations ?? []).filter((date) => date.getTime() > now.getTime() - REGENERATION_WINDOW_MS);
  return Math.max(0, REGENERATION_LIMIT - recent.length);
}

async function claimRegeneration(customerId: string, now: Date) {
  await AiRecommendationCache.updateOne({ customerId }, { $setOnInsert: { customerId } }, { upsert: true });
  await AiRecommendationCache.updateOne(
    { customerId },
    { $pull: { regenerations: { $lt: new Date(now.getTime() - REGENERATION_WINDOW_MS) } } }
  );
  const claimed = await AiRecommendationCache.findOneAndUpdate(
    { customerId, $expr: { $lt: [{ $size: { $ifNull: ["$regenerations", []] } }, REGENERATION_LIMIT] } },
    { $push: { regenerations: now } },
    { new: true }
  ).lean<AiRecommendationRecord>();

  if (!claimed) {
    const record = await AiRecommendationCache.findOne({ customerId }).lean<AiRecommendationRecord>();
    const oldest = [...(record?.regenerations ?? [])].sort((a, b) => a.getTime() - b.getTime())[0] ?? now;
    const retryAt = new Date(oldest.getTime() + REGENERATION_WINDOW_MS);
    throw new ServiceError(429, `You've used all ${REGENERATION_LIMIT} regenerations for today. Try again after ${formatDateTime(retryAt)} ${TIME_ZONE_LABEL}.`);
  }

  return claimed;
}

function aiResult(record: AiRecommendationRecord, cached: boolean, now: Date): AiRecommendationResult {
  return {
    status: "ready",
    source: "ai",
    recommendation: record.recommendation as AiRecommendation,
    generatedAt: (record.generatedAt ?? now).toISOString(),
    model: record.model ?? aiModel(),
    cached,
    regenerationsLeft: regenerationsLeft(record, now),
    disclaimer: AI_DISCLAIMER,
  };
}

async function fallback(
  customerId: string,
  reason: FallbackReason,
  profile: FitnessProfileData,
  history: HistoryEntry[],
  now: Date
): Promise<AiRecommendationResult> {
  const rules = buildRecommendations(profile, toPromptSessions(history), now);
  const record = await AiRecommendationCache.findOne({ customerId }).lean<AiRecommendationRecord>();
  return {
    status: "ready",
    source: "rules",
    fallbackReason: reason,
    suggestions: rules.status === "ready" ? rules.suggestions : [],
    regenerationsLeft: regenerationsLeft(record, now),
    disclaimer: RECOMMENDATION_DISCLAIMER,
  };
}

async function recordFailure(customerId: string, kind: string, now: Date) {
  await AiRecommendationCache.updateOne({ customerId }, { $set: { lastFailureAt: now, lastFailureKind: kind } }, { upsert: true });
}

async function generate(customerId: string, profile: FitnessProfileData, history: HistoryEntry[], inputHash: string, now: Date) {
  const prompt = buildWorkoutPrompt(buildPromptInput(profile, toPromptSessions(history), now));
  const model = aiModel();

  try {
    const raw = await generateJson({ system: prompt.system, prompt: prompt.user, jsonSchema: aiRecommendationJsonSchema() });
    const parsed = parseRecommendation(raw, profile.experienceLevel);

    if (!parsed.ok) {
      console.error(`Gemini output rejected (${parsed.failure})`);
      await recordFailure(customerId, "invalid_output", now);
      return fallback(customerId, "invalid_output", profile, history, now);
    }

    const record = await AiRecommendationCache.findOneAndUpdate(
      { customerId },
      {
        $set: {
          recommendation: parsed.recommendation,
          inputHash,
          model,
          promptVersion: PROMPT_VERSION,
          generatedAt: now,
          lastFailureAt: null,
          lastFailureKind: null,
        },
      },
      { upsert: true, new: true }
    ).lean<AiRecommendationRecord>();

    return aiResult(record!, false, now);
  } catch (error) {
    if (!(error instanceof AiError)) {
      throw error;
    }
    await recordFailure(customerId, error.kind, now);
    return fallback(customerId, FALLBACK_FOR[error.kind], profile, history, now);
  }
}

export async function getRecommendations(customerId: string, now = new Date()) {
  const [profile, history] = await Promise.all([getProfile(customerId), listCompletedSessions({ customerId }, now, 5)]);
  return buildRecommendations(profile, toPromptSessions(history), now);
}

export async function getAiRecommendation(customerId: string, options: { regenerate?: boolean; now?: Date } = {}) {
  const { regenerate = false, now = new Date() } = options;
  const [profile, history] = await Promise.all([
    getProfile(customerId),
    listCompletedSessions({ customerId }, now, MAX_PROMPT_SESSIONS),
  ]);

  if (!profile) {
    return {
      status: "needs_profile",
      message: "Complete your fitness assessment to get a personalized AI workout plan.",
    } satisfies AiRecommendationResult;
  }

  await connectToDatabase();
  await AiRecommendationCache.init();

  const inputHash = hashInputs(profile, history, aiModel());
  const record = await AiRecommendationCache.findOne({ customerId }).lean<AiRecommendationRecord>();
  const fresh = record?.generatedAt && now.getTime() - record.generatedAt.getTime() < CACHE_DAYS * DAY_MS;

  if (!regenerate && record?.recommendation && record.inputHash === inputHash && fresh) {
    return aiResult(record, true, now);
  }

  if (!isAiConfigured()) {
    return fallback(customerId, "not_configured", profile, history, now);
  }

  if (regenerate) {
    await claimRegeneration(customerId, now);
  }

  const coolingDown =
    !regenerate &&
    record?.lastFailureKind === "rate_limited" &&
    record.lastFailureAt &&
    now.getTime() - record.lastFailureAt.getTime() < RATE_LIMIT_COOLDOWN_MS;

  if (coolingDown) {
    return fallback(customerId, "rate_limited", profile, history, now);
  }

  const pending = inFlight.get(customerId);
  if (pending) {
    return pending;
  }

  const request = generate(customerId, profile, history, inputHash, now).finally(() => inFlight.delete(customerId));
  inFlight.set(customerId, request);
  return request;
}
