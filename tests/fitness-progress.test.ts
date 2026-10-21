import { describe, expect, test } from "bun:test";
import type { FitnessProfileData } from "@/lib/fitness";
import { consistency, countSince, weeklySessionCounts, weightChange } from "@/lib/progress";
import { buildRecommendations, type RecentSession } from "@/lib/recommendations";

const now = new Date("2026-10-21T12:00:00.000Z");
const daysAgo = (days: number, hours = 0) => new Date(now.getTime() - (days * 24 + hours) * 60 * 60_000);

const profile: FitnessProfileData = {
  age: 30,
  weight: 75,
  fitnessGoals: ["build_muscle"],
  experienceLevel: "beginner",
  workoutPreferences: { workoutTypes: [], preferredTimes: [] },
};

const session = (completedAt: Date, exercises: string[], suggestedNextWorkout?: string): RecentSession => ({
  completedAt,
  exercises: exercises.map((name) => ({ name })),
  suggestedNextWorkout,
});

describe("progress calculations", () => {
  test("counts completed sessions per week from the stored dates only", () => {
    const weekly = weeklySessionCounts([daysAgo(1), daysAgo(2), daysAgo(10), daysAgo(90)], now, 8);

    expect(weekly).toHaveLength(8);
    expect(weekly[7].count).toBe(2);
    expect(weekly[6].count).toBe(1);
    expect(weekly.reduce((sum, week) => sum + week.count, 0)).toBe(3);
    expect(consistency(weekly)).toEqual({ activeWeeks: 2, totalWeeks: 8 });
    expect(countSince([daysAgo(1), daysAgo(29), daysAgo(31)], now, 30)).toBe(2);
  });

  test("weight change needs at least two saved assessments", () => {
    expect(weightChange([{ weight: 80, recordedAt: daysAgo(30).toISOString() }])).toBeNull();
    expect(
      weightChange([
        { weight: 78.4, recordedAt: daysAgo(1).toISOString() },
        { weight: 80, recordedAt: daysAgo(30).toISOString() },
      ])
    ).toMatchObject({ deltaKg: -1.6, first: { weight: 80 }, latest: { weight: 78.4 } });
  });
});

describe("recommendations", () => {
  test("ask for the assessment when there is no profile", () => {
    expect(buildRecommendations(null, [], now).status).toBe("needs_profile");
  });

  test("follow the goal and keep beginners at a light intensity", () => {
    const result = buildRecommendations(profile, [session(daysAgo(3), ["Plank"])], now);

    expect(result.status).toBe("ready");
    if (result.status === "ready") {
      expect(result.suggestions[0].title).toContain("Strength training");
      expect(result.suggestions.every((suggestion) => suggestion.intensity !== "challenging")).toBe(true);
      expect(result.disclaimer).toContain("not medical advice");
    }
  });

  test("use preferred workout types, experience and a second goal", () => {
    const result = buildRecommendations(
      {
        ...profile,
        fitnessGoals: ["lose_weight", "increase_flexibility"],
        experienceLevel: "advanced",
        workoutPreferences: { workoutTypes: ["boxing", "yoga"], preferredTimes: [] },
      },
      [session(daysAgo(3), ["Plank"])],
      now
    );

    expect(result.status === "ready" && result.suggestions.map((suggestion) => suggestion.title)).toEqual([
      "Fat-burning conditioning · Boxing",
      "Mobility and stretching · Yoga",
    ]);
    expect(result.status === "ready" && result.suggestions[0].intensity).toBe("challenging");
  });

  test("put recovery first after a recent session and include the trainer's suggestion", () => {
    const result = buildRecommendations(profile, [session(daysAgo(0, 3), ["Squat"], "Upper body push focus")], now);

    expect(result.status === "ready" && result.suggestions.slice(0, 2).map((suggestion) => suggestion.title)).toEqual([
      "Light mobility and recovery",
      "Upper body push focus",
    ]);
  });

  test("rotate away from a body area trained twice in a row", () => {
    const result = buildRecommendations(profile, [session(daysAgo(2), ["Goblet squat", "Lunge"]), session(daysAgo(5), ["Deadlift"])], now);

    expect(result.status === "ready" && result.suggestions.map((suggestion) => suggestion.title)).toContain("Upper body focus");
  });

  test("ease back in after a long break", () => {
    const result = buildRecommendations({ ...profile, experienceLevel: "advanced" }, [session(daysAgo(20), ["Plank"])], now);

    expect(result.status === "ready" && result.suggestions[0]).toMatchObject({ intensity: "light" });
  });
});
