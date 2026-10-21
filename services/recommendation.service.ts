import "server-only";
import { buildRecommendations } from "@/lib/recommendations";
import { getProfile } from "@/services/fitness-profile.service";
import { listCompletedSessions } from "@/services/session.service";

export async function getRecommendations(customerId: string, now = new Date()) {
  const [profile, history] = await Promise.all([getProfile(customerId), listCompletedSessions({ customerId }, now, 5)]);

  return buildRecommendations(
    profile,
    history.map((entry) => ({
      completedAt: new Date(entry.completedAt),
      exercises: entry.record.exercises,
      suggestedNextWorkout: entry.record.suggestedNextWorkout || null,
    })),
    now
  );
}
