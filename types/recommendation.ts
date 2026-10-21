import type { Suggestion } from "@/lib/recommendations";
import type { AiRecommendation } from "@/validators/ai-recommendation";

export type FallbackReason = "not_configured" | "rate_limited" | "timeout" | "provider_error" | "invalid_output";

export type AiRecommendationResult =
  | { status: "needs_profile"; message: string }
  | {
      status: "ready";
      source: "ai";
      recommendation: AiRecommendation;
      generatedAt: string;
      model: string;
      cached: boolean;
      regenerationsLeft: number;
      disclaimer: string;
    }
  | {
      status: "ready";
      source: "rules";
      fallbackReason: FallbackReason;
      suggestions: Suggestion[];
      regenerationsLeft: number;
      disclaimer: string;
    };
