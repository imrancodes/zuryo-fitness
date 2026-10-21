import { Check, ClipboardList } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Intensity, RecommendationResult } from "@/lib/recommendations";

const INTENSITY_LABEL: Record<Intensity, string> = {
  light: "Light",
  moderate: "Moderate",
  challenging: "Challenging",
};

export function RecommendationList({ result }: { result: RecommendationResult }) {
  if (result.status === "needs_profile") {
    return (
      <EmptyState icon={ClipboardList} title="Complete your fitness assessment" description={result.message}>
        <Button nativeButton={false} render={<Link href="/customer/profile" />}>
          Start assessment
        </Button>
      </EmptyState>
    );
  }

  return (
    <div className="space-y-3">
      <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {result.suggestions.map((suggestion) => (
          <li key={suggestion.title} className="space-y-3 rounded-xl border bg-card p-4">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-medium">{suggestion.title}</h3>
              <Badge variant="outline">{INTENSITY_LABEL[suggestion.intensity]}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">{suggestion.description}</p>
            <ul className="space-y-1.5 text-sm">
              {suggestion.reasons.map((reason) => (
                <li key={reason} className="flex gap-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
                  {reason}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">{result.disclaimer}</p>
    </div>
  );
}
