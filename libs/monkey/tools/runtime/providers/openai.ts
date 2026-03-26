/**
 * OpenAI provider implementation
 */

import { log, logTruncated, shouldLogFull } from "../../../ui/logger";

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
  credits?: number; // CJGEO credits consumed (1 credit = $0.10 USD)
  raw?: any;
}

export async function callChat(
  apiKey: string,
  modelId: string,
  messages: ChatMessage[],
  options: ChatOptions = {}
): Promise<ChatResponse> {
  const { temperature = 0.7, maxTokens, responseFormat } = options;
  
  // Only log API call details in full log mode
  if (shouldLogFull()) {
    log(`Calling OpenAI: ${modelId}`, {
      messageCount: messages.length,
      temperature,
      maxTokens,
      responseFormat,
    });
  }
  
  const url = "https://api.openai.com/v1/chat/completions";
  
  const body: any = {
    model: modelId,
    messages,
    temperature,
  };
  
  if (maxTokens) {
    body.max_tokens = maxTokens;
  }
  
  // Add response_format for JSON mode (supported by gpt-4o, gpt-4-turbo, gpt-3.5-turbo)
  if (responseFormat === "json_object") {
    body.response_format = { type: "json_object" };
  }
  
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
      const errorData = await response.json().catch(() => ({}));
      log(`❌ OpenAI API error (${duration}ms): ${response.status} - ${errorData.error?.message || response.statusText}`);
      throw new Error(`OpenAI API error: ${errorData.error?.message || response.statusText}`);
    }
    
    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || "";
    
    // Calculate credits (using same pricing as monkey.calculateCredits)
    // Pricing per 1M tokens
    const pricing: Record<string, { input: number; output: number }> = {
      'gpt-4o': { input: 5.0, output: 15.0 },
      'gpt-4o-2024-08-06': { input: 5.0, output: 15.0 },
      'gpt-4o-mini': { input: 0.15, output: 0.60 },
      'gpt-4o-mini-2024-07-18': { input: 0.15, output: 0.60 },
      'gpt-4-turbo': { input: 10.0, output: 30.0 },
      'gpt-4': { input: 30.0, output: 60.0 },
      'gpt-3.5-turbo': { input: 0.50, output: 1.50 },
    };
    
    const modelPricing = pricing[modelId] || pricing['gpt-4o'];
    const promptTokens = data.usage?.prompt_tokens || 0;
    const completionTokens = data.usage?.completion_tokens || 0;
    
    const inputCost = (promptTokens / 1_000_000) * modelPricing.input;
    const outputCost = (completionTokens / 1_000_000) * modelPricing.output;
    const costUSD = inputCost + outputCost;
    
    // Apply markup (0 = no markup, 1 = 100% markup) - default to 0 for runtime
    const markup = 0; // TODO: Get from monkey instance if available
    const costWithMarkup = costUSD * (1 + markup);
    
    // Convert to credits (1 credit = $0.10 USD)
    const credits = Math.round((costWithMarkup / 0.10) * 10000) / 10000;
    
    // Log timing and token usage
    const usage = data.usage ? ` (${data.usage.total_tokens} tokens, ${credits} credits)` : "";
    log(`✓ OpenAI API: ${duration}ms${usage}`);
    
    // Always log first 300 chars of response for troubleshooting
    if (text && text.length > 0) {
      const preview = text.substring(0, 300);
      log(`  Response preview: ${preview}${text.length > 300 ? '...' : ''}`);
    }
    
    // Full response in full log mode
    if (shouldLogFull()) {
      logTruncated("OpenAI full response", text);
    }
    
    return {
      text,
      usage: data.usage,
      credits: credits,
      raw: data,
    };
  } catch (error: any) {
    log(`OpenAI API call failed: ${error.message}`);
    throw error;
  }
}

/**
 * Get API key from environment or user context
 */
export function getOpenAIApiKey(userApiKeys?: Array<{ vendor: string; key: string }>): string {
  // Try user API keys first
  if (userApiKeys) {
    const openaiKey = userApiKeys.find(k => k.vendor === "openai")?.key;
    if (openaiKey) {
      return openaiKey;
    }
  }
  
  // Fall back to environment
  const envKey = process.env.CHATGPT_API_KEY || process.env.OPENAI_API_KEY;
  if (envKey) {
    return envKey;
  }
  
  throw new Error("No OpenAI API key found. Set CHATGPT_API_KEY or OPENAI_API_KEY in environment, or provide user API keys.");
}
