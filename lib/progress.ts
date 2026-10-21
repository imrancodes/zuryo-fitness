const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

export type WeeklyCount = { start: string; end: string; count: number };
export type WeightPoint = { weight: number; recordedAt: string };

export function weeklySessionCounts(completedAt: Date[], now: Date, weeks = 8): WeeklyCount[] {
  return Array.from({ length: weeks }, (_, index) => {
    const end = now.getTime() - (weeks - 1 - index) * WEEK_MS;
    const start = end - WEEK_MS;
    return {
      start: new Date(start).toISOString(),
      end: new Date(end).toISOString(),
      count: completedAt.filter((date) => date.getTime() > start && date.getTime() <= end).length,
    };
  });
}

export function consistency(weekly: WeeklyCount[]) {
  return { activeWeeks: weekly.filter((week) => week.count > 0).length, totalWeeks: weekly.length };
}

export function countSince(completedAt: Date[], now: Date, days: number) {
  const since = now.getTime() - days * DAY_MS;
  return completedAt.filter((date) => date.getTime() > since && date.getTime() <= now.getTime()).length;
}

export function weightChange(points: WeightPoint[]) {
  if (points.length < 2) {
    return null;
  }

  const sorted = [...points].sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
  const first = sorted[0];
  const latest = sorted[sorted.length - 1];

  return {
    first,
    latest,
    deltaKg: Math.round((latest.weight - first.weight) * 10) / 10,
  };
}
