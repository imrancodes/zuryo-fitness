import {
  EXPERIENCE_LEVEL_LABEL,
  FITNESS_GOAL_LABEL,
  WORKOUT_TYPE_LABEL,
  type ExperienceLevel,
  type FitnessGoal,
  type FitnessProfileData,
  type WorkoutType,
} from "@/lib/fitness";
import { formatDate } from "@/lib/time";

const DAY_MS = 24 * 60 * 60 * 1000;

export type Intensity = "light" | "moderate" | "challenging";

export type Suggestion = {
  title: string;
  description: string;
  intensity: Intensity;
  reasons: string[];
};

export type RecentSession = {
  completedAt: Date;
  exercises: { name: string }[];
  suggestedNextWorkout?: string | null;
};

export type RecommendationResult =
  | { status: "needs_profile"; message: string }
  | { status: "ready"; suggestions: Suggestion[]; disclaimer: string };

export const RECOMMENDATION_DISCLAIMER =
  "Suggestions come from simple rules using your profile and session history. They are not medical advice. Check with your trainer or a doctor before changing your routine, especially if you have an injury or health condition.";

const GOAL_PLANS: Record<FitnessGoal, { title: string; description: string; types: WorkoutType[] }> = {
  lose_weight: {
    title: "Fat-burning conditioning",
    description: "Intervals that mix cardio and full-body movements with short rests.",
    types: ["hiit", "cardio", "boxing"],
  },
  build_muscle: {
    title: "Strength training",
    description: "Compound lifts and controlled accessory work with full rest between sets.",
    types: ["strength"],
  },
  improve_endurance: {
    title: "Endurance builder",
    description: "Steady cardio blocks and longer intervals that build aerobic capacity.",
    types: ["cardio", "hiit"],
  },
  increase_flexibility: {
    title: "Mobility and stretching",
    description: "Yoga-style flows and joint mobility drills held for slow, controlled breaths.",
    types: ["yoga", "mobility"],
  },
  general_fitness: {
    title: "Full-body circuit",
    description: "A balanced mix of strength, cardio and core work.",
    types: ["strength", "cardio", "hiit"],
  },
  sports_performance: {
    title: "Power and agility",
    description: "Explosive movements, footwork drills and core stability.",
    types: ["hiit", "boxing", "strength"],
  },
};

const LEVELS: Record<ExperienceLevel, { intensity: Intensity; guidance: string }> = {
  beginner: { intensity: "light", guidance: "2–3 sets at a comfortable effort, focusing on technique" },
  intermediate: { intensity: "moderate", guidance: "3–4 sets at a steady, controlled effort" },
  advanced: { intensity: "challenging", guidance: "4–5 sets while still leaving 1–2 reps in reserve" },
};

const BODY_AREAS = {
  "lower body": ["squat", "lunge", "deadlift", "leg", "glute", "calf", "step-up", "bridge"],
  "upper body": ["push-up", "press", "row", "pull", "curl", "dip", "bench", "shoulder", "chest"],
  core: ["plank", "crunch", "core", "twist", "sit-up", "dead bug"],
} as const;

type BodyArea = keyof typeof BODY_AREAS;

const ROTATION: Record<BodyArea, BodyArea> = {
  "lower body": "upper body",
  "upper body": "lower body",
  core: "lower body",
};

function areaOf(session: RecentSession): BodyArea | null {
  const counts = new Map<BodyArea, number>();
  for (const exercise of session.exercises) {
    const name = exercise.name.toLowerCase();
    for (const [area, keywords] of Object.entries(BODY_AREAS) as [BodyArea, readonly string[]][]) {
      if (keywords.some((keyword) => name.includes(keyword))) {
        counts.set(area, (counts.get(area) ?? 0) + 1);
      }
    }
  }
  const [top] = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  return top ? top[0] : null;
}

function goalSuggestion(goal: FitnessGoal, profile: FitnessProfileData): Suggestion {
  const plan = GOAL_PLANS[goal];
  const level = LEVELS[profile.experienceLevel];
  const preferred = profile.workoutPreferences.workoutTypes.find((type) => plan.types.includes(type));

  return {
    title: preferred ? `${plan.title} · ${WORKOUT_TYPE_LABEL[preferred]}` : plan.title,
    description: plan.description,
    intensity: level.intensity,
    reasons: [
      `Matches your goal: ${FITNESS_GOAL_LABEL[goal]}.`,
      `Set for your ${EXPERIENCE_LEVEL_LABEL[profile.experienceLevel].toLowerCase()} level: ${level.guidance}.`,
      ...(preferred ? [`Uses a workout type you prefer: ${WORKOUT_TYPE_LABEL[preferred]}.`] : []),
    ],
  };
}

export function buildRecommendations(profile: FitnessProfileData | null, recent: RecentSession[], now: Date): RecommendationResult {
  if (!profile) {
    return {
      status: "needs_profile",
      message: "Complete your fitness assessment to get workout suggestions based on your goals and experience.",
    };
  }

  const sessions = [...recent].sort((a, b) => b.completedAt.getTime() - a.completedAt.getTime());
  const latest = sessions[0];
  const daysSinceLast = latest ? (now.getTime() - latest.completedAt.getTime()) / DAY_MS : null;
  const suggestions: Suggestion[] = [];

  if (daysSinceLast !== null && daysSinceLast < 1) {
    suggestions.push({
      title: "Light mobility and recovery",
      description: "Gentle stretching, walking or a mobility flow before your next hard session.",
      intensity: "light",
      reasons: ["You trained less than 24 hours ago, so give those muscles time to recover."],
    });
  }

  if (latest?.suggestedNextWorkout) {
    suggestions.push({
      title: latest.suggestedNextWorkout,
      description: "Picked by your trainer after your last session.",
      intensity: LEVELS[profile.experienceLevel].intensity,
      reasons: [`Your trainer suggested this after your session on ${formatDate(latest.completedAt)}.`],
    });
  }

  const primary = goalSuggestion(profile.fitnessGoals[0], profile);
  if (daysSinceLast === null || daysSinceLast > 14) {
    primary.intensity = "light";
    primary.reasons.push(
      daysSinceLast === null
        ? "You haven't completed a session yet, so start gently."
        : "It's been over two weeks since your last session, so ease back in."
    );
  }
  suggestions.push(primary);

  const [lastArea, previousArea] = sessions.slice(0, 2).map(areaOf);
  if (lastArea && lastArea === previousArea) {
    suggestions.push({
      title: `${ROTATION[lastArea][0].toUpperCase()}${ROTATION[lastArea].slice(1)} focus`,
      description: `Give your ${lastArea} a break and train your ${ROTATION[lastArea]} instead.`,
      intensity: LEVELS[profile.experienceLevel].intensity,
      reasons: [`Your last two sessions focused on your ${lastArea}.`],
    });
  } else if (profile.fitnessGoals[1]) {
    suggestions.push(goalSuggestion(profile.fitnessGoals[1], profile));
  }

  const unique = suggestions.filter((suggestion, index) => suggestions.findIndex((other) => other.title === suggestion.title) === index);
  return { status: "ready", suggestions: unique.slice(0, 3), disclaimer: RECOMMENDATION_DISCLAIMER };
}
