import "server-only";
import { ApiError, GoogleGenAI } from "@google/genai";

export const DEFAULT_AI_MODEL = "gemini-3.5-flash-lite";
export const AI_TIMEOUT_MS = 20_000;
export const AI_MAX_OUTPUT_TOKENS = 1500;

export type AiErrorKind = "not_configured" | "rate_limited" | "timeout" | "failed";

export class AiError extends Error {
  constructor(public readonly kind: AiErrorKind) {
    super(`AI request failed: ${kind}`);
  }
}

let cached: { apiKey: string; client: GoogleGenAI } | null = null;

function clientFor(apiKey: string) {
  if (cached?.apiKey !== apiKey) {
    cached = { apiKey, client: new GoogleGenAI({ apiKey }) };
  }
  return cached.client;
}

export function aiModel() {
  return process.env.GEMINI_MODEL?.trim() || DEFAULT_AI_MODEL;
}

export function isAiConfigured() {
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}

type GenerateJsonInput = {
  system: string;
  prompt: string;
  jsonSchema: unknown;
};

export async function generateJson({ system, prompt, jsonSchema }: GenerateJsonInput) {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new AiError("not_configured");
  }

  const model = aiModel();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

  try {
    const response = await clientFor(apiKey).models.generateContent({
      model,
      contents: prompt,
      config: {
        systemInstruction: system,
        responseMimeType: "application/json",
        responseJsonSchema: jsonSchema,
        maxOutputTokens: AI_MAX_OUTPUT_TOKENS,
        temperature: 0.4,
        abortSignal: controller.signal,
      },
    });

    if (!response.text) {
      throw new AiError("failed");
    }
    return response.text;
  } catch (error) {
    if (error instanceof AiError) {
      throw error;
    }
    const kind: AiErrorKind = controller.signal.aborted
      ? "timeout"
      : error instanceof ApiError && error.status === 429
        ? "rate_limited"
        : "failed";
    console.error(`Gemini request failed (${kind}${error instanceof ApiError ? `, status ${error.status}` : ""})`);
    throw new AiError(kind);
  } finally {
    clearTimeout(timer);
  }
}
