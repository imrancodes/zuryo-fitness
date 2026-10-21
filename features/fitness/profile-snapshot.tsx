import { Badge } from "@/components/ui/badge";
import { EXPERIENCE_LEVEL_LABEL, FITNESS_GOAL_LABEL, PREFERRED_TIME_LABEL, WORKOUT_TYPE_LABEL } from "@/lib/fitness";
import type { ProfileSnapshot as Snapshot } from "@/types/fitness";

function Row({ label, values }: { label: string; values: string[] }) {
  return (
    <div className="space-y-1.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="flex flex-wrap gap-1.5">
        {values.length > 0 ? values.map((value) => <Badge key={value} variant="secondary">{value}</Badge>) : <span className="text-sm text-muted-foreground">Not set</span>}
      </dd>
    </div>
  );
}

export function ProfileSnapshot({ profile }: { profile: Snapshot }) {
  return (
    <dl className="space-y-4">
      <Row label="Goals" values={profile.fitnessGoals.map((goal) => FITNESS_GOAL_LABEL[goal])} />
      <Row label="Experience" values={[EXPERIENCE_LEVEL_LABEL[profile.experienceLevel]]} />
      <Row label="Preferred workouts" values={profile.workoutPreferences.workoutTypes.map((type) => WORKOUT_TYPE_LABEL[type])} />
      <Row label="Preferred times" values={profile.workoutPreferences.preferredTimes.map((time) => PREFERRED_TIME_LABEL[time])} />
    </dl>
  );
}
