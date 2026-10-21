"use client";

import { Loader2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { ChoiceChip } from "@/components/choice-chip";
import { FormStatus } from "@/components/form-status";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useApiMutation } from "@/hooks/use-api-mutation";
import type { SessionFeedback } from "@/types/session";
import { feedbackSchema } from "@/validators/session";

const RATINGS = ["1", "2", "3", "4", "5"];

export function FeedbackForm({ sessionId, feedback }: { sessionId: string; feedback: SessionFeedback | null }) {
  const [rating, setRating] = useState(feedback ? String(feedback.rating) : "");
  const [comment, setComment] = useState(feedback?.comment ?? "");
  const [saved, setSaved] = useState(false);
  const { pending, error, fieldErrors, setFieldErrors, run } = useApiMutation();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaved(false);
    const parsed = feedbackSchema.safeParse({ rating: rating ? Number(rating) : undefined, comment });

    if (!parsed.success) {
      setFieldErrors({ rating: parsed.error.issues.map((issue) => issue.message) });
      return;
    }

    setSaved(await run(`/api/sessions/${sessionId}/feedback`, "PUT", parsed.data));
  }

  return (
    <form noValidate onSubmit={onSubmit} className="space-y-3">
      <FormStatus error={error} success={saved ? "Thanks for your feedback." : null} />
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Rate this session</legend>
        <p className="text-xs text-muted-foreground">1 = poor, 5 = excellent</p>
        <div className="flex gap-2">
          {RATINGS.map((value) => (
            <ChoiceChip key={value} name={`rating-${sessionId}`} value={value} label={value} checked={rating === value} onSelect={setRating} />
          ))}
        </div>
        {fieldErrors.rating && <p className="text-sm text-destructive">{fieldErrors.rating[0]}</p>}
      </fieldset>
      <div className="grid gap-2">
        <Label htmlFor={`comment-${sessionId}`}>Comment (optional)</Label>
        <Textarea id={`comment-${sessionId}`} rows={2} value={comment} onChange={(event) => setComment(event.target.value)} className="bg-card" />
      </div>
      <Button type="submit" variant="outline" size="sm" disabled={pending}>
        {pending && <Loader2 className="animate-spin" aria-hidden />}
        {feedback ? "Update feedback" : "Send feedback"}
      </Button>
    </form>
  );
}
