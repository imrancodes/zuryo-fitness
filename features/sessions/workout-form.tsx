"use client";

import { Loader2, Plus, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { z } from "zod";
import { FormField } from "@/components/form-field";
import { FormStatus } from "@/components/form-status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useApiMutation } from "@/hooks/use-api-mutation";
import { formatDateTime, TIME_ZONE_LABEL } from "@/lib/time";
import type { ExerciseEntry, WorkoutRecordView } from "@/types/session";
import { workoutRecordSchema } from "@/validators/session";

type Row = { name: string; sets: string; reps: string; notes: string };

const EMPTY_ROW: Row = { name: "", sets: "", reps: "", notes: "" };

function toRow(exercise: ExerciseEntry): Row {
  return { name: exercise.name, sets: exercise.sets?.toString() ?? "", reps: exercise.reps?.toString() ?? "", notes: exercise.notes ?? "" };
}

function toNumber(value: string) {
  return value.trim() === "" ? undefined : Number(value);
}

export function WorkoutForm({ sessionId, record }: { sessionId: string; record: WorkoutRecordView }) {
  const [rows, setRows] = useState<Row[]>(record.exercises.length > 0 ? record.exercises.map(toRow) : [EMPTY_ROW]);
  const [trainerNotes, setTrainerNotes] = useState(record.trainerNotes);
  const [suggestion, setSuggestion] = useState(record.suggestedNextWorkout);
  const [saved, setSaved] = useState(false);
  const { pending, error, fieldErrors, setFieldErrors, run } = useApiMutation();

  function updateRow(index: number, change: Partial<Row>) {
    setRows(rows.map((row, current) => (current === index ? { ...row, ...change } : row)));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaved(false);

    const parsed = workoutRecordSchema.safeParse({
      exercises: rows
        .filter((row) => Object.values(row).some((value) => value.trim() !== ""))
        .map((row) => ({ name: row.name, sets: toNumber(row.sets), reps: toNumber(row.reps), notes: row.notes.trim() || undefined })),
      trainerNotes,
      suggestedNextWorkout: suggestion,
    });

    if (!parsed.success) {
      setFieldErrors(z.flattenError(parsed.error).fieldErrors);
      return;
    }

    setSaved(await run(`/api/sessions/${sessionId}/record`, "PATCH", parsed.data));
  }

  return (
    <form noValidate onSubmit={onSubmit} onChange={() => setSaved(false)} className="space-y-5">
      <FormStatus error={error} success={saved ? "Workout saved." : null} />

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">Exercises</legend>
        {rows.map((row, index) => (
          <div key={index} className="grid grid-cols-[1fr_4.5rem_4.5rem_auto] items-center gap-2 sm:grid-cols-[1fr_4.5rem_4.5rem_1fr_auto]">
            <Input aria-label={`Exercise ${index + 1} name`} placeholder="Exercise" value={row.name} onChange={(event) => updateRow(index, { name: event.target.value })} className="h-9 bg-card" />
            <Input aria-label={`Exercise ${index + 1} sets`} placeholder="Sets" inputMode="numeric" value={row.sets} onChange={(event) => updateRow(index, { sets: event.target.value })} className="h-9 bg-card" />
            <Input aria-label={`Exercise ${index + 1} reps`} placeholder="Reps" inputMode="numeric" value={row.reps} onChange={(event) => updateRow(index, { reps: event.target.value })} className="h-9 bg-card" />
            <Input aria-label={`Exercise ${index + 1} notes`} placeholder="Notes" value={row.notes} onChange={(event) => updateRow(index, { notes: event.target.value })} className="col-span-3 h-9 bg-card sm:col-span-1" />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="row-start-1 text-muted-foreground sm:row-start-auto"
              aria-label={`Remove exercise ${index + 1}`}
              onClick={() => setRows(rows.length > 1 ? rows.filter((_, current) => current !== index) : [EMPTY_ROW])}
            >
              <Trash2 />
            </Button>
          </div>
        ))}
        {fieldErrors.exercises && <p className="text-sm text-destructive">{fieldErrors.exercises[0]}</p>}
        <Button type="button" variant="outline" size="sm" onClick={() => setRows([...rows, EMPTY_ROW])}>
          <Plus aria-hidden />
          Add exercise
        </Button>
      </fieldset>

      <div className="grid gap-2">
        <Label htmlFor="trainerNotes">Trainer notes</Label>
        <Textarea
          id="trainerNotes"
          rows={4}
          value={trainerNotes}
          onChange={(event) => setTrainerNotes(event.target.value)}
          placeholder="How did the session go? Form cues, energy, anything to remember."
          aria-invalid={fieldErrors.trainerNotes ? true : undefined}
          className="bg-card"
        />
        {fieldErrors.trainerNotes && <p className="text-sm text-destructive">{fieldErrors.trainerNotes[0]}</p>}
      </div>

      <FormField
        id="suggestedNextWorkout"
        label="Suggested next workout"
        placeholder="e.g. Upper body push focus"
        value={suggestion}
        onChange={(event) => setSuggestion(event.target.value)}
        error={fieldErrors.suggestedNextWorkout?.[0]}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {record.editableUntil ? `Editable until ${formatDateTime(record.editableUntil)} ${TIME_ZONE_LABEL}` : "Editable during the session and for 24 hours after."}
        </p>
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="animate-spin" aria-hidden />}
          Save workout
        </Button>
      </div>
    </form>
  );
}
