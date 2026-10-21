import { Clock3, MapPin, Star } from "lucide-react";
import { InitialsAvatar } from "@/components/initials-avatar";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { FeedbackForm } from "@/features/sessions/feedback-form";
import { WorkoutSummary } from "@/features/sessions/workout-summary";
import { formatDate, formatTime, TIME_ZONE_LABEL } from "@/lib/time";
import type { HistoryEntry } from "@/types/session";

type HistoryListProps = {
  entries: HistoryEntry[];
  viewer: "customer" | "trainer";
};

export function HistoryList({ entries, viewer }: HistoryListProps) {
  return (
    <ul className="space-y-4">
      {entries.map((entry) => (
        <li key={entry.id}>
          <Card>
            <CardHeader className="flex flex-wrap items-center gap-3">
              <InitialsAvatar name={entry.trainer.name} />
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  {formatDate(entry.completedAt)} · {viewer === "customer" ? `with ${entry.trainer.name}` : "your session"}
                </p>
                <p className="flex flex-wrap items-center gap-x-3 text-sm text-muted-foreground">
                  {entry.startedAt && (
                    <span>
                      {formatTime(entry.startedAt)} – {formatTime(entry.completedAt)} {TIME_ZONE_LABEL}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1">
                    <Clock3 className="size-3.5" aria-hidden />
                    {entry.durationMinutes} min
                  </span>
                  {entry.serviceZone && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="size-3.5" aria-hidden />
                      {entry.serviceZone}
                    </span>
                  )}
                </p>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <WorkoutSummary record={entry.record} />
              {viewer === "customer" ? (
                <div className="border-t pt-4">
                  <FeedbackForm sessionId={entry.id} feedback={entry.feedback} />
                </div>
              ) : (
                entry.feedback && (
                  <p className="flex items-center gap-1.5 border-t pt-4 text-sm text-muted-foreground">
                    <Star className="size-4" aria-hidden />
                    Customer rated {entry.feedback.rating}/5{entry.feedback.comment && `: “${entry.feedback.comment}”`}
                  </p>
                )
              )}
            </CardContent>
          </Card>
        </li>
      ))}
    </ul>
  );
}
