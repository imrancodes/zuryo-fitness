"use client";

import { Loader2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { z } from "zod";
import { ChoiceChip } from "@/components/choice-chip";
import { FormField } from "@/components/form-field";
import { FormStatus } from "@/components/form-status";
import { OptionCard } from "@/components/option-card";
import { Button } from "@/components/ui/button";
import { useApiMutation } from "@/hooks/use-api-mutation";
import {
  AGE_RANGE,
  EXPERIENCE_LEVEL_LABEL,
  EXPERIENCE_LEVELS,
  FITNESS_GOAL_LABEL,
  FITNESS_GOALS,
  MAX_GOALS,
  PREFERRED_TIME_LABEL,
  PREFERRED_TIMES,
  WEIGHT_RANGE_KG,
  WORKOUT_TYPE_LABEL,
  WORKOUT_TYPES,
  type ExperienceLevel,
} from "@/lib/fitness";
import type { FitnessProfileView } from "@/types/fitness";
import { fitnessProfileSchema } from "@/validators/fitness";

const EXPERIENCE_DESCRIPTION: Record<ExperienceLevel, string> = {
  beginner: "New to structured training or returning after a long break",
  intermediate: "Training regularly for a few months",
  advanced: "Consistent training for a year or more",
};

function toggle<T>(values: T[], value: T) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

function ChipGroup<T extends string>({
  legend,
  hint,
  name,
  options,
  labels,
  selected,
  onToggle,
  error,
}: {
  legend: string;
  hint?: string;
  name: string;
  options: readonly T[];
  labels: Record<T, string>;
  selected: T[];
  onToggle: (value: T) => void;
  error?: string;
}) {
  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-medium">{legend}</legend>
      {hint && <p className="-mt-1 text-xs text-muted-foreground">{hint}</p>}
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <ChoiceChip
            key={option}
            type="checkbox"
            name={name}
            value={option}
            label={labels[option]}
            checked={selected.includes(option)}
            onSelect={() => onToggle(option)}
          />
        ))}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </fieldset>
  );
}

export function FitnessProfileForm({ profile }: { profile: FitnessProfileView | null }) {
  const [age, setAge] = useState(profile ? String(profile.age) : "");
  const [weight, setWeight] = useState(profile ? String(profile.weight) : "");
  const [goals, setGoals] = useState(profile?.fitnessGoals ?? []);
  const [experience, setExperience] = useState<ExperienceLevel | null>(profile?.experienceLevel ?? null);
  const [workoutTypes, setWorkoutTypes] = useState(profile?.workoutPreferences.workoutTypes ?? []);
  const [preferredTimes, setPreferredTimes] = useState(profile?.workoutPreferences.preferredTimes ?? []);
  const [saved, setSaved] = useState(false);
  const { pending, error, fieldErrors, setFieldErrors, run } = useApiMutation();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaved(false);

    const parsed = fitnessProfileSchema.safeParse({
      age: age.trim() ? Number(age) : Number.NaN,
      weight: weight.trim() ? Number(weight) : Number.NaN,
      fitnessGoals: goals,
      experienceLevel: experience ?? undefined,
      workoutPreferences: { workoutTypes, preferredTimes },
    });

    if (!parsed.success) {
      setFieldErrors(z.flattenError(parsed.error).fieldErrors);
      return;
    }

    setSaved(await run("/api/fitness-profile/me", "PUT", parsed.data));
  }

  return (
    <form noValidate onSubmit={onSubmit} onChange={() => setSaved(false)} className="space-y-8">
      <FormStatus error={error} success={saved ? "Assessment saved. Your suggestions and progress are updated." : null} />

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          id="age"
          label="Age"
          inputMode="numeric"
          value={age}
          onChange={(event) => setAge(event.target.value)}
          placeholder={`${AGE_RANGE.min}–${AGE_RANGE.max}`}
          error={fieldErrors.age?.[0]}
        />
        <FormField
          id="weight"
          label="Weight (kg)"
          inputMode="decimal"
          value={weight}
          onChange={(event) => setWeight(event.target.value)}
          placeholder={`${WEIGHT_RANGE_KG.min}–${WEIGHT_RANGE_KG.max}`}
          error={fieldErrors.weight?.[0]}
        />
      </div>

      <ChipGroup
        legend="Fitness goals"
        hint={`Pick up to ${MAX_GOALS}. Your first goal shapes your suggestions most.`}
        name="fitnessGoals"
        options={FITNESS_GOALS}
        labels={FITNESS_GOAL_LABEL}
        selected={goals}
        onToggle={(goal) => setGoals((current) => toggle(current, goal))}
        error={fieldErrors.fitnessGoals?.[0]}
      />

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">Experience level</legend>
        <div className="grid gap-3 sm:grid-cols-3">
          {EXPERIENCE_LEVELS.map((level) => (
            <OptionCard
              key={level}
              name="experienceLevel"
              value={level}
              label={EXPERIENCE_LEVEL_LABEL[level]}
              description={EXPERIENCE_DESCRIPTION[level]}
              checked={experience === level}
              onSelect={() => setExperience(level)}
              className="p-3"
            />
          ))}
        </div>
        {fieldErrors.experienceLevel && <p className="text-sm text-destructive">{fieldErrors.experienceLevel[0]}</p>}
      </fieldset>

      <ChipGroup
        legend="Preferred workout types"
        name="workoutTypes"
        options={WORKOUT_TYPES}
        labels={WORKOUT_TYPE_LABEL}
        selected={workoutTypes}
        onToggle={(type) => setWorkoutTypes((current) => toggle(current, type))}
      />

      <ChipGroup
        legend="Preferred times"
        name="preferredTimes"
        options={PREFERRED_TIMES}
        labels={PREFERRED_TIME_LABEL}
        selected={preferredTimes}
        onToggle={(time) => setPreferredTimes((current) => toggle(current, time))}
        error={fieldErrors.workoutPreferences?.[0]}
      />

      <div className="flex justify-end">
        <Button type="submit" size="lg" disabled={pending}>
          {pending && <Loader2 className="animate-spin" aria-hidden />}
          {profile ? "Save changes" : "Save assessment"}
        </Button>
      </div>
    </form>
  );
}
