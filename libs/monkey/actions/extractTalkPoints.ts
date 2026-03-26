/**
 * Action to extract talk points from ICP and Offer data
 */

import { callStructured } from "../tools/runtime/callStructured";
import { ChatMessage } from "../tools/runtime/providers/openai";
import { log } from "../ui/logger";

export interface TalkPoint {
  point: string;
  category?: string;
  evidence?: string;
  source?: string;
}

export interface ExtractTalkPointsResult {
  uniqueSellingPoints: Array<{ point: string; category: string }>;
  transactionalFacts: Array<{ point: string; source: string }>;
}

const extractTalkPointsSchema = {
  type: "object",
  additionalProperties: true,
  properties: {
    uniqueSellingPoints: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: true,
        properties: {
          point: { type: "string" },
          category: { type: "string" },
        },
        required: ["point", "category"],
      },
    },
    transactionalFacts: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: true,
        properties: {
          point: { type: "string" },
          source: { type: "string" },
        },
        required: ["point", "source"],
      },
    },
  },
  required: ["uniqueSellingPoints", "transactionalFacts"],
};

/**
 * Extract all points that must be included in the landing page
 */
export async function extractTalkPoints(
  model: "agent" | "high" | "mid",
  icpData: any,
  offerData: any
): Promise<ExtractTalkPointsResult> {
  log(`[extractTalkPoints] Extracting talk points for ICP: ${icpData?.name}, Offer: ${offerData?.name}`);

  const systemPrompt = `You are a content strategist extracting key points that must be included in a landing page.

CRITICAL: You MUST respond with ONLY valid JSON. Do not include any text before or after the JSON. Do not use markdown code blocks. Output pure JSON only.

Extract:
1. Unique Selling Points (USPs): What makes this offer unique and valuable? Categorize each point (e.g., "speed", "quality", "price", "service", "selection", "expertise")
2. Transactional Facts: Critical information that customers need to know before making a decision. This includes:
   - Lead times, delivery timelines, turnaround times
   - Pricing information, payment terms
   - Process steps, requirements, prerequisites
   - Guarantees, warranties, service level agreements
   - Any facts from the offer's transactional_facts field
   
   These are facts that should be proactively stated on the landing page so customers don't have to ask.

Only extract points that are explicitly stated or clearly implied in the provided data. Do not invent claims.

Output your analysis as valid JSON matching this exact structure:
{
  "uniqueSellingPoints": [{"point": "...", "category": "..."}],
  "transactionalFacts": [{"point": "...", "source": "..."}]
}`;

  const userPrompt = `ICP DATA:
${JSON.stringify(icpData, null, 2)}

OFFER DATA:
${JSON.stringify(offerData, null, 2)}

TASK: Extract all points that must be included in the landing page and return ONLY valid JSON (no markdown, no code blocks, no explanatory text).

Extract:
- Unique selling points: What makes this offer unique and valuable? Categorize each (e.g., "speed", "quality", "service")
- Transactional facts: Critical information customers need before deciding (lead times, pricing, process, guarantees, etc.). Pay special attention to the transactional_facts field if present.

Return JSON with these exact fields:
- uniqueSellingPoints: array of {point: string, category: string}
- transactionalFacts: array of {point: string, source: string}

IMPORTANT: Output ONLY the JSON object. No markdown, no code blocks, no additional text.`;

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];

  const result = await callStructured(
    model,
    messages,
    extractTalkPointsSchema,
    { stepName: "extractTalkPoints", maxAttempts: 2 }
  );

  if (!result.ok || !result.data) {
    log(`[extractTalkPoints] Failed to extract talk points`);
    throw new Error("Failed to extract talk points");
  }

  return result.data as ExtractTalkPointsResult;
}
