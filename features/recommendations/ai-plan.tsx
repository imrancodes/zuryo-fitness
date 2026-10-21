import { Check, Clock3, Sparkles, Target } from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { formatDateTime, TIME_ZONE_LABEL } from "@/lib/time";
import type { AiExercise, AiRecommendation } from "@/validators/ai-recommendation";

function volume(exercise: AiExercise) {
  const amount = exercise.reps != null ? `${exercise.reps}` : exercise.durationSeconds != null ? `${exercise.durationSeconds}s` : null;
  if (exercise.sets != null && amount) {
    return `${exercise.sets} × ${amount}`;
  }
  if (exercise.sets != null) {
    return `${exercise.sets} sets`;
  }
  return exercise.reps != null ? `${exercise.reps} reps` : amount ?? "—";
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h4 className="text-sm font-medium">{title}</h4>
      {children}
    </section>
  );
}

type AiPlanProps = {
  recommendation: AiRecommendation;
  generatedAt: string;
  cached: boolean;
  disclaimer: string;
};

export function AiPlan({ recommendation, generatedAt, cached, disclaimer }: AiPlanProps) {
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="brand">
            <Sparkles aria-hidden />
            AI-generated
          </Badge>
          {cached && <Badge variant="outline">Saved plan</Badge>}
        </div>
        <h3 className="text-lg font-semibold tracking-tight">{recommendation.title}</h3>
        <p className="text-sm text-muted-foreground">{recommendation.summary}</p>
        <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Target className="size-4" aria-hidden />
            {recommendation.goal}
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock3 className="size-4" aria-hidden />
            {recommendation.durationMinutes} min
          </span>
        </p>
      </div>

      <Section title="Why this plan">
        <ul className="space-y-1.5 text-sm">
          {recommendation.reasoning.map((reason) => (
            <li key={reason} className="flex gap-2">
              <Check className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
              {reason}
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Exercises">
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead className="bg-secondary/60 text-left text-xs text-muted-foreground">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium">Exercise</th>
                <th scope="col" className="px-3 py-2 font-medium whitespace-nowrap">Sets × reps / time</th>
                <th scope="col" className="hidden px-3 py-2 font-medium sm:table-cell">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {recommendation.exercises.map((exercise) => (
                <tr key={exercise.name}>
                  <td className="px-3 py-2 font-medium">
                    {exercise.name}
                    {exercise.notes && <p className="text-xs font-normal text-muted-foreground sm:hidden">{exercise.notes}</p>}
                  </td>
                  <td className="px-3 py-2 tabular-nums">{volume(exercise)}</td>
                  <td className="hidden px-3 py-2 text-muted-foreground sm:table-cell">{exercise.notes || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <div className="grid gap-5 sm:grid-cols-2">
        <Section title="Recovery">
          <p className="text-sm text-muted-foreground">{recommendation.recoveryAdvice}</p>
        </Section>
        <Section title="Limitations">
          <p className="text-sm text-muted-foreground">{recommendation.limitations}</p>
        </Section>
      </div>

      <p className="text-xs text-muted-foreground">
        {disclaimer} Generated {formatDateTime(generatedAt)} {TIME_ZONE_LABEL}.
      </p>
    </div>
  );
}
