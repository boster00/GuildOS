/**
 * AI provider for visibility tracker - runs prompts via ChatGPT, Claude, Perplexity.
 * All models are routed through Eden AI (libs/ai/eden); no direct OpenAI/Anthropic/Perplexity calls.
 */

import { sendChatPrompt } from "@/libs/ai/eden/chatGateway";
import { getModel } from "@/libs/ai/eden/modelRegistry";
import { createHash } from "crypto";

/** Visibility tracker model key → Eden registry canonical id */
const EDEN_MODEL_IDS = {
  chatgpt: "openai-gpt-4o",
  claude: "anthropic-claude-sonnet",
  perplexity: "perplexity-sonar-large",
};

/**
 * Run a prompt with the given model (via Eden AI).
 * @param {{ model: 'chatgpt'|'claude'|'perplexity', promptText: string }} opts
 * @returns {{ text: string, rawJson?: any }}
 */
export async function runPrompt({ model, promptText }) {
  

  const canonicalId = EDEN_MODEL_IDS[model];
  if (!canonicalId) {
    throw new Error(`Unknown model: ${model}`);
  }

  const modelDef = getModel(canonicalId);
  if (!modelDef) {
    throw new Error(`Eden model not registered: ${canonicalId}`);
  }

  try {
    const result = await sendChatPrompt({
      prompt: promptText,
      model: canonicalId,
      temperature: 0.7,
      maxTokens: 2048,
      stream: false,
    });

    const text = result?.data?.text ?? "";
    return { text, rawJson: result?.raw ?? null };
  } catch (error) {
    
    throw error;
  }
}

export function extractMentions({ responseText, brandTerms, domain }) {
  const text = (responseText || "").toLowerCase();
  const terms = Array.isArray(brandTerms) ? brandTerms : [];

  const mentionsBrand = terms.some((term) =>
    text.includes(String(term).toLowerCase())
  );
  const mentionsDomain = domain
    ? text.includes(domain.toLowerCase())
    : false;
  return { mentionsBrand, mentionsDomain };
}

export function extractCitations({ responseText, rawJson, domain }) {
  const urlRegex = /https?:\/\/[^\s<>"]+/g;
  const urls = (responseText || "").match(urlRegex) || [];
  const structuredCitations = rawJson?.citations || [];
  const allCitations = [...new Set([...urls, ...structuredCitations])];
  const domainCitations = domain
    ? allCitations.filter((url) =>
        String(url).toLowerCase().includes(domain.toLowerCase())
      )
    : allCitations;
  return {
    allCitations,
    domainCitations,
  };
}

export function hashResponse(text) {
  return createHash("sha256").update(text || "").digest("hex");
}
