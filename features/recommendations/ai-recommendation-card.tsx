"use client";

import { Info, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { FormStatus } from "@/components/form-status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AiPlan } from "@/features/recommendations/ai-plan";
import { RecommendationList } from "@/features/recommendations/recommendation-list";
import { requestJson, type ApiResult } from "@/lib/request";
import type { AiRecommendationResult, FallbackReason } from "@/types/recommendation";

const ENDPOINT = "/api/recommendations/me";

const FALLBACK_MESSAGE: Record<FallbackReason, string> = {
  not_configured: "AI recommendations aren't set up yet, so here are rule-based suggestions.",
  rate_limited: "The AI service is busy right now (free-tier limit). Here are rule-based suggestions; try again in a minute.",
  timeout: "The AI took too long to respond, so here are rule-based suggestions.",
  provider_error: "The AI service couldn't be reached, so here are rule-based suggestions.",
  invalid_output: "The AI response didn't pass our safety checks, so here are rule-based suggestions instead.",
};

type State = { phase: "loading" } | { phase: "error"; message: string } | { phase: "loaded"; result: AiRecommendationResult };

function toState(result: ApiResult<AiRecommendationResult>): State {
  return result.ok ? { phase: "loaded", result: result.data } : { phase: "error", message: result.error };
}

export function AiRecommendationCard() {
  const [state, setState] = useState<State>({ phase: "loading" });
  const [regenerating, setRegenerating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    requestJson<AiRecommendationResult>(ENDPOINT).then((result) => {
      if (active) {
        setState(toState(result));
      }
    });
    return () => {
      active = false;
    };
  }, []);

  async function retry() {
    setNotice(null);
    setState({ phase: "loading" });
    setState(toState(await requestJson<AiRecommendationResult>(ENDPOINT)));
  }

  async function regenerate() {
    setNotice(null);
    setRegenerating(true);
    const result = await requestJson<AiRecommendationResult>(`${ENDPOINT}/regenerate`, { method: "POST" });
    setRegenerating(false);

    if (result.ok) {
      setState({ phase: "loaded", result: result.data });
    } else {
      setNotice(result.error);
    }
  }

  if (state.phase === "loading") {
    return (
      <Card aria-busy>
        <CardContent className="space-y-4">
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Sparkles className="size-4 text-brand" aria-hidden />
            Creating your personalized plan…
          </p>
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-32 w-full rounded-xl" />
        </CardContent>
      </Card>
    );
  }

  if (state.phase === "error") {
    return (
      <Card>
        <CardContent className="space-y-3">
          <FormStatus error={`We couldn't load your recommendation. ${state.message}`} />
          <Button variant="outline" onClick={retry}>
            <RefreshCw aria-hidden />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  const { result } = state;

  if (result.status === "needs_profile") {
    return <RecommendationList result={result} />;
  }

  if (result.source === "rules") {
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-dashed bg-card p-4">
          <div className="space-y-1">
            <Badge variant="outline">Rules-based suggestions</Badge>
            <p className="flex items-start gap-1.5 text-sm text-muted-foreground">
              <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
              {FALLBACK_MESSAGE[result.fallbackReason]}
            </p>
          </div>
          {result.fallbackReason !== "not_configured" && (
            <Button variant="outline" size="sm" onClick={retry}>
              <Sparkles aria-hidden />
              Try AI again
            </Button>
          )}
        </div>
        <RecommendationList result={{ status: "ready", suggestions: result.suggestions, disclaimer: result.disclaimer }} />
      </div>
    );
  }

  return (
    <Card>
      <CardContent className="space-y-5">
        <AiPlan recommendation={result.recommendation} generatedAt={result.generatedAt} cached={result.cached} disclaimer={result.disclaimer} />
        <FormStatus error={notice} />
        <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
          <p className="text-xs text-muted-foreground">
            {result.regenerationsLeft > 0
              ? `${result.regenerationsLeft} of 3 regenerations left today.`
              : "You've used today's regenerations. Your plan also refreshes when your profile or sessions change."}
          </p>
          <Button variant="outline" size="sm" onClick={regenerate} disabled={regenerating || result.regenerationsLeft === 0}>
            {regenerating ? <Loader2 className="animate-spin" aria-hidden /> : <RefreshCw aria-hidden />}
            {regenerating ? "Generating…" : "Regenerate"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
