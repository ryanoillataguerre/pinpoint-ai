import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";

// ─── Clients ───────────────────────────────────────────────

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// OpenRouter uses OpenAI-compatible API
const openrouter = process.env.OPENROUTER_API_KEY
  ? new OpenAI({
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: process.env.OPENROUTER_API_KEY,
    })
  : null;

// ─── Types ─────────────────────────────────────────────────

export type LLMProvider = "anthropic" | "openrouter";

export interface LLMRequest {
  model?: string;
  system?: string;
  messages: Array<{
    role: "user" | "assistant";
    content: string | Anthropic.MessageCreateParams["messages"][0]["content"];
  }>;
  maxTokens?: number;
  temperature?: number;
  provider?: LLMProvider;
}

export interface LLMResponse {
  text: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
  provider: LLMProvider;
  model: string;
}

// ─── Model defaults per task ───────────────────────────────

export const MODELS = {
  // Expensive — use for ranking/matching decisions
  SONNET: "claude-sonnet-4-6",
  // Cheap — use for normalization, query generation, simple extraction
  HAIKU: "claude-haiku-4-5",
  // Fallback via OpenRouter
  OPENROUTER_FALLBACK: "anthropic/claude-haiku-4-5",
} as const;

// ─── Core call function ────────────────────────────────────

export async function llmCall(request: LLMRequest): Promise<LLMResponse> {
  const provider = request.provider || "anthropic";
  const maxTokens = request.maxTokens || 4096;
  const temperature = request.temperature ?? 0.0;

  if (provider === "anthropic") {
    return callAnthropic(request, maxTokens, temperature);
  }

  if (provider === "openrouter" && openrouter) {
    return callOpenRouter(request, maxTokens, temperature);
  }

  // Fallback: try Anthropic, then OpenRouter
  try {
    return await callAnthropic(request, maxTokens, temperature);
  } catch (err) {
    console.warn("Anthropic call failed, trying OpenRouter fallback:", err);
    if (openrouter) {
      return callOpenRouter(request, maxTokens, temperature);
    }
    throw err;
  }
}

// ─── Anthropic implementation ──────────────────────────────

async function callAnthropic(
  request: LLMRequest,
  maxTokens: number,
  temperature: number
): Promise<LLMResponse> {
  const model = request.model || MODELS.SONNET;

  const response = await anthropic.messages.create({
    model,
    max_tokens: maxTokens,
    temperature,
    ...(request.system && { system: request.system }),
    messages: request.messages as Anthropic.MessageCreateParams["messages"],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  const text = textBlock && "text" in textBlock ? textBlock.text : "";

  return {
    text,
    usage: {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    },
    provider: "anthropic",
    model,
  };
}

// ─── OpenRouter implementation ─────────────────────────────

async function callOpenRouter(
  request: LLMRequest,
  maxTokens: number,
  temperature: number
): Promise<LLMResponse> {
  if (!openrouter) throw new Error("OpenRouter not configured");

  const model = request.model || MODELS.OPENROUTER_FALLBACK;

  const response = await openrouter.chat.completions.create({
    model,
    max_tokens: maxTokens,
    temperature,
    messages: [
      ...(request.system
        ? [{ role: "system" as const, content: request.system }]
        : []),
      ...request.messages.map((m) => ({
        role: m.role as "user" | "assistant",
        content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
      })),
    ],
  });

  const text = response.choices[0]?.message?.content || "";

  return {
    text,
    usage: {
      inputTokens: response.usage?.prompt_tokens || 0,
      outputTokens: response.usage?.completion_tokens || 0,
    },
    provider: "openrouter",
    model,
  };
}

// ─── Structured output helper ──────────────────────────────

export async function llmCallJSON<T>(
  request: LLMRequest & { jsonSchema?: string }
): Promise<{ parsed: T; raw: LLMResponse }> {
  const systemWithSchema = [
    request.system || "",
    "You MUST respond with valid JSON only. No markdown, no explanation, just the JSON object.",
    request.jsonSchema
      ? `Respond according to this schema:\n${request.jsonSchema}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const raw = await llmCall({
    ...request,
    system: systemWithSchema,
  });

  // Extract JSON from response (handle potential markdown wrapping)
  let jsonStr = raw.text.trim();
  const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1].trim();
  }

  const parsed = JSON.parse(jsonStr) as T;
  return { parsed, raw };
}

// ─── Vision helper (Anthropic only) ────────────────────────

export async function llmVisionCall(
  imageBase64: string,
  mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif",
  prompt: string,
  options: { model?: string; system?: string; maxTokens?: number } = {}
): Promise<LLMResponse> {
  const model = options.model || MODELS.SONNET;

  const response = await anthropic.messages.create({
    model,
    max_tokens: options.maxTokens || 4096,
    ...(options.system && { system: options.system }),
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: mediaType, data: imageBase64 },
          },
          { type: "text", text: prompt },
        ],
      },
    ],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  const text = textBlock && "text" in textBlock ? textBlock.text : "";

  return {
    text,
    usage: {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    },
    provider: "anthropic",
    model,
  };
}
