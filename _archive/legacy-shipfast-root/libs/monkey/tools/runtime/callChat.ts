/**
 * Provider-agnostic chat call wrapper
 */

import { resolveModel, ResolvedModel } from "./modelResolver";
import { callChat as callOpenAI, getOpenAIApiKey, ChatMessage, ChatOptions, ChatResponse } from "./providers/openai";
import { MonkeyModel } from "../../references/types";
import { log, shouldLogFull } from "../../ui/logger";

export interface CallChatOptions extends ChatOptions {
  apiKey?: string;
  userApiKeys?: Array<{ vendor: string; key: string }>;
  responseFormat?: "json_object" | "text";
}

export async function callChatWrapper(
  model: MonkeyModel,
  messages: ChatMessage[],
  options: CallChatOptions = {}
): Promise<ChatResponse> {
  const resolved = resolveModel(model);
  
  if (resolved.provider !== "openai") {
    throw new Error(`Unsupported provider: ${resolved.provider}`);
  }
  
  const apiKey = options.apiKey || getOpenAIApiKey(options.userApiKeys);
  
  // Only log in full mode - too verbose otherwise
  if (shouldLogFull()) {
    log(`Calling ${resolved.provider} with model ${resolved.modelId}`);
  }
  
  return callOpenAI(apiKey, resolved.modelId, messages, {
    temperature: options.temperature,
    maxTokens: options.maxTokens,
    responseFormat: options.responseFormat,
  });
}
