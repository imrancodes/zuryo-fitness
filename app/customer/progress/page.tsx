import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { StatTile } from "@/components/stat-tile";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ProfileSnapshot } from "@/features/fitness/profile-snapshot";
import { WeeklyBars } from "@/features/progress/weekly-bars";
import { WeightHistory } from "@/features/progress/weight-history";
import { RecommendationList } from "@/features/recommendations/recommendation-list";
import { requireRole } from "@/lib/auth";
import { formatDate } from "@/lib/time";
import { getProgress } from "@/services/progress.service";
import { getRecommendations } from "@/services/recommendation.service";

export const metadata: Metadata = { title: "Progress" };

function signed(value: number) {
  return `${value > 0 ? "+" : ""}${value} kg`;
}

export default async function ProgressPage() {
  const user = await requireRole("customer");
  const [progress, recommendations] = await Promise.all([getProgress(user.id), getRecommendations(user.id)]);
  const { weekly, consistency, weightChange } = progress;

  return (
    <>
      <PageHeader
        title="Progress"
        description="Built only from your saved assessments and completed sessions."
        breadcrumbs={[{ label: "Customer", href: "/customer" }, { label: "Progress" }]}
      />

      <section aria-label="Summary" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Completed workouts"
          value={progress.completedTotal}
          detail={progress.firstSessionAt ? `Since ${formatDate(progress.firstSessionAt)}` : "None yet"}
        />
        <StatTile label="Last 30 days" value={progress.completedLast30Days} detail="Completed sessions" />
        <StatTile label="Active weeks" value={`${consistency.activeWeeks} of ${consistency.totalWeeks}`} detail="Weeks with at least one session" />
        <StatTile label="Sessions remaining" value={progress.packages.remaining} detail={progress.packages.purchased ? `Of ${progress.packages.purchased} in your packages` : "No package yet"} />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Completed sessions per week</CardTitle>
            <CardDescription>Last 8 weeks, ending today</CardDescription>
          </CardHeader>
          <CardContent>
            {progress.completedTotal > 0 ? (
              <WeeklyBars weeks={weekly} />
            ) : (
              <p className="text-sm text-muted-foreground">Your weekly activity appears here after your first completed session.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Weight (kg)</CardTitle>
            <CardDescription>
              {weightChange
                ? `${signed(weightChange.deltaKg)} between ${formatDate(weightChange.first.recordedAt)} and ${formatDate(weightChange.latest.recordedAt)}`
                : "From your saved assessments"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {progress.weights.length >= 2 ? (
              <WeightHistory points={progress.weights} />
            ) : (
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>
                  {progress.weights.length === 1
                    ? `Your current assessment: ${progress.weights[0].weight} kg. A trend appears after you update your assessment again.`
                    : "Save your fitness assessment to start tracking weight over time."}
                </p>
                <Button variant="outline" size="sm" nativeButton={false} render={<Link href="/customer/profile" />}>
                  {progress.weights.length ? "Update assessment" : "Start assessment"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {progress.profile && (
        <Card>
          <CardHeader>
            <CardTitle>Current assessment</CardTitle>
            <CardDescription>
              Age {progress.profile.age} · {progress.profile.weight} kg
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ProfileSnapshot profile={progress.profile} />
          </CardContent>
        </Card>
      )}

      <section aria-labelledby="suggestions" className="space-y-3">
        <h2 id="suggestions" className="text-sm font-medium text-muted-foreground">
          Suggested next workouts
        </h2>
        <RecommendationList result={recommendations} />
      </section>

      <p className="text-xs text-muted-foreground">
        Completing workouts shows consistency; on its own it doesn&apos;t prove changes in fitness or health.
      </p>
    </>
  );
}
