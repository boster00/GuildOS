/**
 * Action to infer hook points (pain points, identity, use scenario)
 */

import { callStructured } from "../tools/runtime/callStructured";
import { ChatMessage } from "../tools/runtime/providers/openai";
import { log } from "../ui/logger";

export interface HookPoint {
  type: "pain_point" | "identity" | "use_scenario";
  statement: string;
  specificity: number; // 0-1
  uniqueness: number; // 0-1
  resonanceScore: number; // 0-1 (calculated: specificity * uniqueness)
}

export interface InferHookPointsResult {
  selected: HookPoint;
  alternatives: HookPoint[];
  reasoning: string;
}

const inferHookPointsSchema = {
  type: "object",
  additionalProperties: true,
  properties: {
    painPoint: {
      type: "object",
      additionalProperties: true,
      properties: {
        statement: { type: "string" },
        specificity: { type: "number", minimum: 0, maximum: 1 },
        uniqueness: { type: "number", minimum: 0, maximum: 1 },
      },
      required: ["statement", "specificity", "uniqueness"],
    },
    identity: {
      type: "object",
      additionalProperties: true,
      properties: {
        statement: { type: "string" },
        specificity: { type: "number", minimum: 0, maximum: 1 },
        uniqueness: { type: "number", minimum: 0, maximum: 1 },
      },
      required: ["statement", "specificity", "uniqueness"],
    },
    useScenario: {
      type: "object",
      additionalProperties: true,
      properties: {
        statement: { type: "string" },
        specificity: { type: "number", minimum: 0, maximum: 1 },
        uniqueness: { type: "number", minimum: 0, maximum: 1 },
      },
      required: ["statement", "specificity", "uniqueness"],
    },
    reasoning: {
      type: "string",
    },
  },
  required: ["painPoint", "identity", "useScenario", "reasoning"],
};

/**
 * Infer hook points: pain points, identity, and use scenario callouts
 * Select the most effective one based on specificity and uniqueness
 */
export async function inferHookPoints(
  model: "agent" | "high" | "mid",
  icpData: any,
  offerData: any,
  organizedAssets?: any
): Promise<InferHookPointsResult> {
  log(`[inferHookPoints] Inferring hook points for ICP: ${icpData?.name}`);

  const systemPrompt = `You are a conversion copywriter specializing in hook statements that resonate with target audiences.

CRITICAL: You MUST respond with ONLY valid JSON. Do not include any text before or after the JSON. Do not use markdown code blocks. Output pure JSON only.

Generate three types of hook statements:
1. Pain Point Callout: Directly addresses a problem they face (e.g., "Got a flooded basement?")
2. Identity Callout: Calls out their role/responsibility (e.g., "Are you in charge of outsourcing to CROs?")
3. Use Scenario Callout: Calls out their specific use case (e.g., "Do you work with non-model organisms for research?")

For each hook, evaluate:
- Specificity (0-1): How specific is this to the ICP? Generic = 0, highly specific = 1
- Uniqueness (0-1): How unique is this to this ICP/offer combination? Common = 0, rare = 1

The hook with the highest resonance (specificity × uniqueness) will be most effective. Generic callouts get less response.

Output your analysis as valid JSON matching this exact structure:
{
  "painPoint": {"statement": "...", "specificity": 0-1, "uniqueness": 0-1},
  "identity": {"statement": "...", "specificity": 0-1, "uniqueness": 0-1},
  "useScenario": {"statement": "...", "specificity": 0-1, "uniqueness": 0-1},
  "reasoning": "explanation of which hook is most effective and why"
}`;

  const userPrompt = `ICP DATA:
${JSON.stringify(icpData, null, 2)}

OFFER DATA:
${JSON.stringify(offerData, null, 2)}

${organizedAssets ? `ORGANIZED ASSETS:\n${JSON.stringify(organizedAssets, null, 2)}` : ""}

TASK: Generate three hook statements and return ONLY valid JSON (no markdown, no code blocks, no explanatory text).

Generate three hook statements:
1. Pain Point Callout: Address a specific problem they face
2. Identity Callout: Call out their specific role/responsibility
3. Use Scenario Callout: Call out their specific use case

For each hook, provide:
- statement: The hook statement (as a question or direct statement)
- specificity: number 0-1 (how specific to this ICP?)
- uniqueness: number 0-1 (how unique to this ICP/offer combination?)

Then provide reasoning explaining which hook will be most effective and why (considering specificity × uniqueness = resonance).

Return JSON with these exact fields:
- painPoint: {statement, specificity, uniqueness}
- identity: {statement, specificity, uniqueness}
- useScenario: {statement, specificity, uniqueness}
- reasoning: detailed explanation for which hook is most effective

IMPORTANT: Output ONLY the JSON object. No markdown, no code blocks, no additional text.`;

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];

  const result = await callStructured(
    model,
    messages,
    inferHookPointsSchema,
    { stepName: "inferHookPoints", maxAttempts: 2 }
  );

  if (!result.ok || !result.data) {
    log(`[inferHookPoints] Failed to infer hook points`);
    throw new Error("Failed to infer hook points");
  }

  const data = result.data as any;
  
  // Convert to HookPoint format and calculate resonance scores
  const painPoint: HookPoint = {
    type: "pain_point",
    statement: data.painPoint.statement,
    specificity: data.painPoint.specificity,
    uniqueness: data.painPoint.uniqueness,
    resonanceScore: data.painPoint.specificity * data.painPoint.uniqueness,
  };

  const identity: HookPoint = {
    type: "identity",
    statement: data.identity.statement,
    specificity: data.identity.specificity,
    uniqueness: data.identity.uniqueness,
    resonanceScore: data.identity.specificity * data.identity.uniqueness,
  };

  const useScenario: HookPoint = {
    type: "use_scenario",
    statement: data.useScenario.statement,
    specificity: data.useScenario.specificity,
    uniqueness: data.useScenario.uniqueness,
    resonanceScore: data.useScenario.specificity * data.useScenario.uniqueness,
  };

  // Select the hook with highest resonance score
  const allHooks = [painPoint, identity, useScenario];
  const selected = allHooks.reduce((best, current) => 
    current.resonanceScore > best.resonanceScore ? current : best
  );

  const alternatives = allHooks.filter(h => h !== selected);

  return {
    selected,
    alternatives,
    reasoning: data.reasoning,
  };
}
