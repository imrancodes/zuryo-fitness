import "server-only";
import { connectToDatabase } from "@/lib/mongodb";
import { consistency, countSince, weeklySessionCounts, weightChange } from "@/lib/progress";
import { SessionRecord } from "@/models/SessionRecord";
import { getProfile, getWeightHistory } from "@/services/fitness-profile.service";
import { getPackageSummary } from "@/services/package.service";
import { reconcileExpiredForCustomer } from "@/services/session.service";
import type { ProgressView } from "@/types/fitness";

export async function getProgress(customerId: string, now = new Date()): Promise<ProgressView> {
  await connectToDatabase();
  await reconcileExpiredForCustomer(customerId, now);

  const [profile, weights, records, packages] = await Promise.all([
    getProfile(customerId),
    getWeightHistory(customerId),
    SessionRecord.find({ customerId, status: "completed" }, "completedAt").sort({ completedAt: 1 }).lean(),
    getPackageSummary(customerId),
  ]);

  const completedAt = records.flatMap((record) => (record.completedAt ? [record.completedAt] : []));
  const weekly = weeklySessionCounts(completedAt, now);

  return {
    profile,
    weights,
    weightChange: weightChange(weights),
    weekly,
    consistency: consistency(weekly),
    completedTotal: completedAt.length,
    completedLast30Days: countSince(completedAt, now, 30),
    firstSessionAt: completedAt[0]?.toISOString() ?? null,
    packages,
  };
}
