// ARCHIVED: Original path was libs/monkey/tools/runtime/providers/perplexity.ts

/**
 * Perplexity provider - OpenAI-compatible API
 * Base URL: https://api.perplexity.ai
 */

import { log, shouldLogFull } from "../../../ui/logger";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatOptions {
  temperature?: number;
  maxTokens?: number;
  responseFormat?: "json_object" | "text";
}

export interface ChatResponse {
  text: string;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  credits?: number;
  raw?: any;
}

const PERPLEXITY_BASE_URL = "https://api.perplexity.ai";

export async function callPerplexity(
  apiKey: string,
  modelId: string,
  messages: ChatMessage[],
  options: ChatOptions = {}
): Promise<ChatResponse> {
  const { temperature = 0.7, maxTokens = 1024 } = options;

  if (shouldLogFull()) {
    log(`Calling Perplexity: ${modelId}`, {
      messageCount: messages.length,
      temperature,
      maxTokens,
    });
  }

  const url = `${PERPLEXITY_BASE_URL}/chat/completions`;
  const body: Record<string, unknown> = {
    model: modelId,
    messages,
    temperature,
    max_tokens: maxTokens,
  };

  const startTime = Date.now();

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    const duration = Date.now() - startTime;

    if (!response.ok) {
      const errorText = await response.text();
      log(`❌ Perplexity API error (${duration}ms): ${response.status} - ${errorText}`);
      throw new Error(`Perplexity API error: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content ?? "";

    log(`✓ Perplexity API: ${duration}ms`);

    return {
      text,
      usage: data.usage,
      raw: data,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    log(`Perplexity API call failed: ${message}`);
    throw error;
  }
}

export function getPerplexityApiKey(
  userApiKeys?: Array<{ vendor: string; key: string }>
): string {
  if (userApiKeys) {
    const key = userApiKeys.find((k) => k.vendor === "perplexity")?.key;
    if (key) return key;
  }
  const envKey = process.env.PERPLEXITY_API_KEY;
  if (envKey) return envKey;
  throw new Error(
    "No Perplexity API key found. Set PERPLEXITY_API_KEY in environment or provide user API keys."
  );
}
