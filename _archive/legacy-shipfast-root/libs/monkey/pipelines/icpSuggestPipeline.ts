// ARCHIVED: Original path was libs/monkey/pipelines/icpSuggestPipeline.ts

/**
 * ICP Suggest Pipeline
 * Generates ideal customer profile suggestions based on offer data
 */

import { MonkeyTaskRequest, MonkeyTaskResponse } from "../references/types";
import { callStructured } from "../tools/runtime/callStructured";
import { log } from "../ui/logger";
import { registerPipeline } from "./registry";

interface ICPCandidate {
  name: string;
  who: string;
  whyFit: string;
  targetRoles: string[];
  painPoints: string[];
  decisionCriteria: string[];
}

interface ICPSuggestResult {
  icps: ICPCandidate[];
  reasoning: string;
}

const icpCandidateSchema = {
  type: "object",
  properties: {
    icps: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string", description: "Short name for this ICP segment (e.g., 'Enterprise IT Managers')" },
          who: { type: "string", description: "Brief description of who they are (1-2 sentences)" },
          whyFit: { type: "string", description: "Why this ICP is a good fit for the offer (2-3 sentences)" },
          targetRoles: { type: "array", items: { type: "string" }, description: "List of specific job titles/roles" },
          painPoints: { type: "array", items: { type: "string" }, description: "Key pain points this ICP faces" },
          decisionCriteria: { type: "array", items: { type: "string" }, description: "What factors influence their buying decisions" },
        },
        required: ["name", "who", "whyFit", "targetRoles", "painPoints", "decisionCriteria"],
      },
      minItems: 2,
      maxItems: 5,
    },
    reasoning: { 
      type: "string", 
      description: "Brief explanation of why these ICPs were selected" 
    },
  },
  required: ["icps", "reasoning"],
};

/**
 * Generate ICP suggestions based on offer
 */
export async function icpSuggestPipeline(
  request: MonkeyTaskRequest,
  options?: {
    apiKey?: string;
    userApiKeys?: Array<{ vendor: string; key: string }>;
  }
): Promise<MonkeyTaskResponse> {
  const runId = `icp-suggest-${Date.now()}`;
  
  log("[icpSuggestPipeline] Starting ICP suggestion generation");

  try {
    // Extract offer data from campaign context
    const offer = request.campaignContext?.offer;
    
    if (!offer || !offer.name) {
      return {
        ok: false,
        runId,
        artifacts: {},
        errors: [{
          code: "INVALID_INPUT" as any,
          message: "Offer data is required for ICP suggestion. Please provide campaignContext.offer with name and description.",
          step: "validation",
        }],
      };
    }

    log(`[icpSuggestPipeline] Generating ICPs for offer: ${offer.name}`);

    // Resolve model tier
    const modelTier = request.model || "high";
    log(`[icpSuggestPipeline] Using model tier: ${modelTier}`);

    // Build the prompt
    const systemPrompt = `You are an expert marketing strategist specializing in customer segmentation and ideal customer profiles (ICPs).

Your task is to analyze an offer and suggest 2-5 distinct ideal customer profiles that would be most interested in and benefit from this offer.

For each ICP, provide:
- A clear segment name
- Who they are (their role, industry, company size, etc.)
- Why they're a good fit for this specific offer
- Specific job titles/roles that match this ICP
- Key pain points they face that this offer addresses
- Decision criteria they use when evaluating solutions

Focus on segments that:
1. Have genuine pain points the offer solves
2. Have budget and authority to purchase
3. Are distinct from each other (different industries, company sizes, or use cases)
4. Are specific enough to target with marketing

Respond with valid JSON only.`;

    const userPrompt = `OFFER DETAILS:
Name: ${offer.name}
Description: ${offer.description || "No description provided"}

${offer.features ? `Features:\n${offer.features}` : ""}
${offer.benefits ? `Benefits:\n${offer.benefits}` : ""}
${offer.pricing ? `Pricing: ${offer.pricing}` : ""}

TASK: Generate 2-5 distinct ideal customer profiles for this offer. Each ICP should represent a different segment with unique characteristics and needs.

Return the result as a JSON object with the structure specified in the schema.`;

    // Call AI with structured output
    const result = await callStructured(
      modelTier,
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      icpCandidateSchema,
      { 
        stepName: "icpSuggest", 
        maxAttempts: 2,
      }
    );

    if (!result.ok || !result.data) {
      const errorMessage = result.error 
        ? (typeof result.error === 'string' ? result.error : result.error.message)
        : "Failed to generate ICP suggestions";
      
      return {
        ok: false,
        runId,
        artifacts: {},
        errors: [{
          code: "PROVIDER_ERROR" as any,
          message: errorMessage,
          step: "icpGeneration",
          details: result.error && typeof result.error !== 'string' ? result.error.details : undefined,
        }],
      };
    }

    const icpResult = result.data as ICPSuggestResult;

    log(`[icpSuggestPipeline] Generated ${icpResult.icps.length} ICP candidates`);
    log(`[icpSuggestPipeline] Reasoning: ${icpResult.reasoning}`);

    return {
      ok: true,
      runId,
      artifacts: {
        icpCandidates: {
          icps: icpResult.icps,
          reasoning: icpResult.reasoning,
          offerName: offer.name,
          generatedAt: new Date().toISOString(),
        },
      },
      meta: {
        modelTier: modelTier,
        icpCount: icpResult.icps.length,
      },
    };

  } catch (error: any) {
    log(`[icpSuggestPipeline] Error: ${error.message}`);
    
    return {
      ok: false,
      runId,
      artifacts: {},
      errors: [{
        code: "PROVIDER_ERROR" as any,
        message: error.message || "Unknown error in ICP suggestion pipeline",
        step: "execution",
        details: { stack: error.stack },
      }],
    };
  }
}

// Auto-register this pipeline
registerPipeline(
  "ICP_SUGGEST",
  "ICP Suggestion Generator",
  "Generate ideal customer profile suggestions based on offer data. Suggests 2-5 distinct ICP segments with roles, pain points, and decision criteria.",
  icpSuggestPipeline
);
