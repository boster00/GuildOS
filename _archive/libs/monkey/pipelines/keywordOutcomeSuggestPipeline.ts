// ARCHIVED: Original path was libs/monkey/pipelines/keywordOutcomeSuggestPipeline.ts

/**
 * Keyword Outcome Suggest Pipeline
 * Generates primary and secondary outcome keywords based on ICP and offer data
 */

import { MonkeyTaskRequest, MonkeyTaskResponse } from "../references/types";
import { callStructured } from "../tools/runtime/callStructured";
import { log } from "../ui/logger";
import { registerPipeline } from "./registry";

interface KeywordOutcome {
  primaryKeyword: string;
  secondaryKeywords: string[];
  reasoning: string;
}

const keywordOutcomeSchema = {
  type: "object",
  properties: {
    primaryKeyword: { 
      type: "string", 
      description: "The main outcome keyword that best represents the desired result (1-4 words, action-oriented)" 
    },
    secondaryKeywords: { 
      type: "array", 
      items: { type: "string" },
      description: "Additional outcome keywords that represent related desired results (2-5 keywords, each 1-4 words)",
      minItems: 2,
      maxItems: 5,
    },
    reasoning: { 
      type: "string", 
      description: "Brief explanation of why these keywords were selected and how they align with the ICP and offer" 
    },
  },
  required: ["primaryKeyword", "secondaryKeywords", "reasoning"],
};

/**
 * Generate keyword outcome suggestions based on ICP and offer
 */
export async function keywordOutcomeSuggestPipeline(
  request: MonkeyTaskRequest,
  options?: {
    apiKey?: string;
    userApiKeys?: Array<{ vendor: string; key: string }>;
  }
): Promise<MonkeyTaskResponse> {
  const runId = `keyword-outcome-suggest-${Date.now()}`;
  
  log("[keywordOutcomeSuggestPipeline] Starting keyword outcome suggestion generation");

  try {
    // Extract ICP and offer data from campaign context
    const icp = request.campaignContext?.icp;
    const offer = request.campaignContext?.offer;
    
    if (!icp || !offer || !offer.name) {
      return {
        ok: false,
        runId,
        artifacts: {},
        errors: [{
          code: "INVALID_INPUT" as any,
          message: "ICP and Offer data are required for keyword outcome suggestion. Please provide campaignContext.icp and campaignContext.offer with name and description.",
          step: "validation",
        }],
      };
    }

    log(`[keywordOutcomeSuggestPipeline] Generating keyword outcomes for ICP: ${icp.name}, Offer: ${offer.name}`);

    // Resolve model tier
    const modelTier = request.model || "high";
    log(`[keywordOutcomeSuggestPipeline] Using model tier: ${modelTier}`);

    // Check for previous suggestions and feedback
    const previousSuggestions = request.constraints?.previousSuggestions;
    const feedback = request.constraints?.feedback || request.userInput?.query?.match(/User feedback: (.+)/)?.[1] || "";

    // Build the prompt
    const systemPrompt = `You are an expert SEO and content strategist specializing in outcome-focused keyword generation.

Your task is to generate outcome keywords that represent the desired results or transformations that the ICP wants to achieve with the offer.

OUTCOME KEYWORDS are action-oriented phrases that describe:
- What the ICP wants to achieve (e.g., "increase conversion rates", "reduce operational costs")
- The transformation they seek (e.g., "scale business operations", "improve team productivity")
- The end result they desire (e.g., "achieve compliance", "boost revenue")

Guidelines:
1. Primary keyword should be the most important, high-value outcome (1-4 words)
2. Secondary keywords should be related but distinct outcomes (2-5 keywords, each 1-4 words)
3. Keywords should be specific to the ICP's needs and the offer's value proposition
4. Use action verbs and measurable outcomes when possible
5. Focus on business value and transformation, not just features
6. Keywords should be searchable and relevant for content targeting

Respond with valid JSON only.`;

    const icpInfo = icp.name ? `ICP: ${icp.name}${icp.description ? `\nDescription: ${icp.description}` : ""}` : "ICP: Not specified";
    const offerInfo = `Offer: ${offer.name}${offer.description ? `\nDescription: ${offer.description}` : ""}`;
    
    const previousContext = previousSuggestions && previousSuggestions.length > 0
      ? `\n\nPrevious suggestions: ${Array.isArray(previousSuggestions) ? previousSuggestions.join(", ") : String(previousSuggestions)}`
      : "";
    
    const feedbackContext = feedback
      ? `\n\nUser feedback: ${feedback}`
      : "";

    const userPrompt = `${icpInfo}
${offerInfo}${previousContext}${feedbackContext}

TASK: Generate outcome keywords that represent what the ICP wants to achieve with this offer.

Consider:
- The ICP's pain points and goals
- The offer's value proposition
- Measurable, actionable outcomes
- Search intent and content targeting opportunities

Return the result as a JSON object with the structure specified in the schema.`;

    // Call AI with structured output
    const result = await callStructured(
      modelTier,
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      keywordOutcomeSchema,
      { 
        stepName: "keywordOutcomeSuggest", 
        maxAttempts: 2,
      }
    );

    if (!result.ok || !result.data) {
      const errorMessage = result.error 
        ? (typeof result.error === 'string' ? result.error : result.error.message)
        : "Failed to generate keyword outcome suggestions";
      
      return {
        ok: false,
        runId,
        artifacts: {},
        errors: [{
          code: "PROVIDER_ERROR" as any,
          message: errorMessage,
          step: "keywordOutcomeGeneration",
          details: result.error && typeof result.error !== 'string' ? result.error.details : undefined,
        }],
      };
    }

    const keywordOutcome = result.data as KeywordOutcome;

    log(`[keywordOutcomeSuggestPipeline] Generated primary keyword: ${keywordOutcome.primaryKeyword}`);
    log(`[keywordOutcomeSuggestPipeline] Generated ${keywordOutcome.secondaryKeywords.length} secondary keywords`);
    log(`[keywordOutcomeSuggestPipeline] Reasoning: ${keywordOutcome.reasoning}`);

    return {
      ok: true,
      runId,
      artifacts: {
        keywordOutcome: {
          primaryKeyword: keywordOutcome.primaryKeyword,
          secondaryKeywords: keywordOutcome.secondaryKeywords,
          reasoning: keywordOutcome.reasoning,
          icpName: icp.name,
          offerName: offer.name,
          generatedAt: new Date().toISOString(),
        },
      },
      meta: {
        modelTier: modelTier,
        keywordCount: 1 + keywordOutcome.secondaryKeywords.length,
      },
    };

  } catch (error: any) {
    log(`[keywordOutcomeSuggestPipeline] Error: ${error.message}`);
    
    return {
      ok: false,
      runId,
      artifacts: {},
      errors: [{
        code: "PROVIDER_ERROR" as any,
        message: error.message || "Unknown error in keyword outcome suggestion pipeline",
        step: "execution",
        details: { stack: error.stack },
      }],
    };
  }
}

// Auto-register this pipeline
registerPipeline(
  "KEYWORD_OUTCOME_SUGGEST",
  "Keyword Outcome Suggestion Generator",
  "Generate primary and secondary outcome keywords based on ICP and offer data. Outcome keywords represent desired results or transformations the ICP wants to achieve.",
  keywordOutcomeSuggestPipeline
);
