import type { WorkoutRecordView } from "@/types/session";

function exerciseDetail(sets?: number, reps?: number) {
  if (sets != null && reps != null) {
    return `${sets} × ${reps}`;
  }
  if (sets != null) {
    return `${sets} sets`;
  }
  return reps != null ? `${reps} reps` : null;
}

export function WorkoutSummary({ record }: { record: WorkoutRecordView }) {
  const empty = record.exercises.length === 0 && !record.trainerNotes && !record.suggestedNextWorkout;

  if (empty) {
    return <p className="text-sm text-muted-foreground">No workout has been logged for this session yet.</p>;
  }

  return (
    <div className="space-y-5 text-sm">
      {record.exercises.length > 0 && (
        <section className="space-y-2">
          <h3 className="font-medium">Exercises</h3>
          <ul className="divide-y rounded-xl border">
            {record.exercises.map((exercise, index) => (
              <li key={`${exercise.name}-${index}`} className="flex flex-wrap items-baseline justify-between gap-2 px-3 py-2">
                <span className="font-medium">{exercise.name}</span>
                <span className="text-muted-foreground tabular-nums">
                  {[exerciseDetail(exercise.sets, exercise.reps), exercise.notes].filter(Boolean).join(" · ")}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {record.trainerNotes && (
        <section className="space-y-1">
          <h3 className="font-medium">Trainer notes</h3>
          <p className="whitespace-pre-line text-muted-foreground">{record.trainerNotes}</p>
        </section>
      )}
      {record.suggestedNextWorkout && (
        <section className="space-y-1">
          <h3 className="font-medium">Suggested next workout</h3>
          <p className="text-muted-foreground">{record.suggestedNextWorkout}</p>
        </section>
      )}
    </div>
  );
}
