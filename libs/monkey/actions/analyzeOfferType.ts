/**
 * Action to analyze offer type (transactional vs preaching)
 */

import { callStructured } from "../tools/runtime/callStructured";
import { ChatMessage } from "../tools/runtime/providers/openai";
import { log } from "../ui/logger";

export interface AnalyzeOfferTypeResult {
  offerType: "transactional" | "preaching";
  icpReadiness: "high" | "medium" | "low";
  riskLevel: "low" | "medium" | "high";
  reasoning: string;
  landingPageStrategy: string;
}

const analyzeOfferTypeSchema = {
  type: "object",
  additionalProperties: true,
  properties: {
    offerType: {
      type: "string",
      enum: ["transactional", "preaching"],
    },
    icpReadiness: {
      type: "string",
      enum: ["high", "medium", "low"],
    },
    riskLevel: {
      type: "string",
      enum: ["low", "medium", "high"],
    },
    reasoning: {
      type: "string",
    },
    landingPageStrategy: {
      type: "string",
    },
  },
  required: ["offerType", "icpReadiness", "riskLevel", "reasoning", "landingPageStrategy"],
};

/**
 * Analyze ICP's knowledge of offer, risk perception, and transaction readiness
 * to determine if landing page should be transactional (order-focused) or preaching (education-focused)
 */
export async function analyzeOfferType(
  model: "agent" | "high" | "mid",
  icpData: any,
  offerData: any
): Promise<AnalyzeOfferTypeResult> {
  log(`[analyzeOfferType] Analyzing offer type for ICP: ${icpData?.name}, Offer: ${offerData?.name}`);

  const systemPrompt = `You are a landing page strategy analyst. Analyze the ICP's relationship with the offer to determine the optimal landing page approach.

CRITICAL: You MUST respond with ONLY valid JSON. Do not include any text before or after the JSON. Do not use markdown code blocks. Output pure JSON only.

Your task is to evaluate:
1. ICP's education level about the offer (how much do they already know?)
2. Perceived risk level of the offer (how risky does the ICP perceive this transaction?)
3. Transaction readiness (how ready are they to make a purchase/commitment?)

Based on these factors, determine if the landing page should be:
- "transactional": Order-focused, minimal education needed, low friction, direct CTA
- "preaching": Education-focused, needs to build trust/understanding, more content before CTA

Output your analysis as valid JSON matching this exact structure:
{
  "offerType": "transactional" or "preaching",
  "icpReadiness": "high" or "medium" or "low",
  "riskLevel": "low" or "medium" or "high",
  "reasoning": "your detailed explanation here",
  "landingPageStrategy": "your strategy description here"
}`;

  const userPrompt = `ICP DATA:
${JSON.stringify(icpData, null, 2)}

OFFER DATA:
${JSON.stringify(offerData, null, 2)}

TASK: Analyze and return ONLY valid JSON (no markdown, no code blocks, no explanatory text).

Analyze:
1. How educated is this ICP about this offer? (Consider their role, industry knowledge, search triggers)
2. What is the perceived risk level? (Consider offer type, cost, commitment level, alternatives they consider)
3. How transaction-ready are they? (Consider decision criteria, hesitations, what gets in their way)

Determine the landing page strategy: transactional (order-focused) or preaching (education-focused).

Return JSON with these exact fields:
- offerType: "transactional" or "preaching"
- icpReadiness: "high", "medium", or "low"
- riskLevel: "low", "medium", or "high"
- reasoning: detailed explanation (2-4 sentences)
- landingPageStrategy: brief strategy description (1-2 sentences)

IMPORTANT: Output ONLY the JSON object. No markdown, no code blocks, no additional text.`;

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];

  const result = await callStructured(
    model,
    messages,
    analyzeOfferTypeSchema,
    { stepName: "analyzeOfferType", maxAttempts: 2 }
  );

  if (!result.ok || !result.data) {
    log(`[analyzeOfferType] Failed to analyze offer type`);
    throw new Error("Failed to analyze offer type");
  }

  return result.data as AnalyzeOfferTypeResult;
}
