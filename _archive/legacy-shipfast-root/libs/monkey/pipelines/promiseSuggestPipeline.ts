// ARCHIVED: Original path was libs/monkey/pipelines/promiseSuggestPipeline.ts

/**
 * Promise Suggest Pipeline
 * Generates peace of mind promises based on ICP and offer data
 */

import { MonkeyTaskRequest, MonkeyTaskResponse } from "../references/types";
import { callStructured } from "../tools/runtime/callStructured";
import { log } from "../ui/logger";
import { registerPipeline } from "./registry";

interface PromiseOption {
  promise: string;
  reasoning: string;
}

interface PromiseSuggestResult {
  options: PromiseOption[];
  summary: string;
}

const promiseSuggestSchema = {
  type: "object",
  properties: {
    options: {
      type: "array",
      items: {
        type: "object",
        properties: {
          promise: { 
            type: "string", 
            description: "A peace of mind promise that addresses ICP concerns and builds trust (1-2 sentences, action-oriented)" 
          },
          reasoning: { 
            type: "string", 
            description: "Brief explanation of why this promise resonates with the ICP's concerns and needs" 
          },
        },
        required: ["promise", "reasoning"],
      },
      minItems: 3,
      maxItems: 5,
    },
    summary: { 
      type: "string", 
      description: "Brief summary of how these promises address the ICP's peace of mind concerns" 
    },
  },
  required: ["options", "summary"],
};

/**
 * Generate peace of mind promise suggestions based on ICP and offer
 */
export async function promiseSuggestPipeline(
  request: MonkeyTaskRequest,
  options?: {
    apiKey?: string;
    userApiKeys?: Array<{ vendor: string; key: string }>;
  }
): Promise<MonkeyTaskResponse> {
  const runId = `promise-suggest-${Date.now()}`;
  
  log("[promiseSuggestPipeline] Starting peace of mind promise suggestion generation");

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
          message: "ICP and Offer data are required for promise suggestion. Please provide campaignContext.icp and campaignContext.offer with name and description.",
          step: "validation",
        }],
      };
    }

    log(`[promiseSuggestPipeline] Generating promises for ICP: ${icp.name}, Offer: ${offer.name}`);

    // Resolve model tier
    const modelTier = request.model || "high";
    log(`[promiseSuggestPipeline] Using model tier: ${modelTier}`);

    // Check for previous suggestions and feedback
    const previousSuggestions = request.constraints?.previousSuggestions;
    const feedback = request.constraints?.feedback || request.userInput?.query?.match(/User feedback: (.+)/)?.[1] || "";

    // Build the prompt
    const systemPrompt = `You are an expert copywriter and conversion strategist specializing in trust-building and peace of mind messaging.

Your task is to generate peace of mind promises that address the ICP's concerns, fears, and hesitations, while building trust and confidence in the offer.

PEACE OF MIND PROMISES are assurances that:
- Address specific concerns or objections the ICP might have
- Build trust and reduce perceived risk
- Emphasize guarantees, security, support, or reliability
- Are specific and believable (avoid generic platitudes)
- Focus on outcomes that matter to the ICP
- Use language that resonates with the ICP's values and priorities

Guidelines:
1. Each promise should be 1-2 sentences, clear and specific
2. Address real concerns (risk, cost, quality, support, results, etc.)
3. Use concrete guarantees or reassurances when possible
4. Focus on outcomes and benefits, not just features
5. Match the tone and language style of the ICP
6. Be credible and realistic - avoid overpromising
7. Generate 3-5 distinct promises that address different concerns

Respond with valid JSON only.`;

    const icpInfo = icp.name ? `ICP: ${icp.name}${icp.description ? `\nDescription: ${icp.description}` : ""}` : "ICP: Not specified";
    const offerInfo = `Offer: ${offer.name}${offer.description ? `\nDescription: ${offer.description}` : ""}`;
    
    const previousContext = previousSuggestions && previousSuggestions.length > 0
      ? `\n\nPrevious promises: ${Array.isArray(previousSuggestions) ? previousSuggestions.join(", ") : String(previousSuggestions)}`
      : "";
    
    const feedbackContext = feedback
      ? `\n\nUser feedback: ${feedback}`
      : "";

    const userPrompt = `${icpInfo}
${offerInfo}${previousContext}${feedbackContext}

TASK: Generate peace of mind promises that address the ICP's concerns and build trust in this offer.

Consider:
- What risks or concerns might the ICP have about this offer?
- What guarantees or reassurances would reduce their hesitation?
- What outcomes matter most to this ICP?
- How can you build confidence and trust?
- What specific concerns does the ICP profile suggest?

Return the result as a JSON object with the structure specified in the schema.`;

    // Call AI with structured output
    const result = await callStructured(
      modelTier,
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      promiseSuggestSchema,
      { 
        stepName: "promiseSuggest", 
        maxAttempts: 2,
      }
    );

    if (!result.ok || !result.data) {
      const errorMessage = result.error 
        ? (typeof result.error === 'string' ? result.error : result.error.message)
        : "Failed to generate promise suggestions";
      
      return {
        ok: false,
        runId,
        artifacts: {},
        errors: [{
          code: "PROVIDER_ERROR" as any,
          message: errorMessage,
          step: "promiseGeneration",
          details: result.error && typeof result.error !== 'string' ? result.error.details : undefined,
        }],
      };
    }

    const promiseResult = result.data as PromiseSuggestResult;

    log(`[promiseSuggestPipeline] Generated ${promiseResult.options.length} promise options`);
    log(`[promiseSuggestPipeline] Summary: ${promiseResult.summary}`);

    return {
      ok: true,
      runId,
      artifacts: {
        promiseOptions: {
          options: promiseResult.options,
          summary: promiseResult.summary,
          icpName: icp.name,
          offerName: offer.name,
          generatedAt: new Date().toISOString(),
        },
      },
      meta: {
        modelTier: modelTier,
        promiseCount: promiseResult.options.length,
      },
    };

  } catch (error: any) {
    log(`[promiseSuggestPipeline] Error: ${error.message}`);
    
    return {
      ok: false,
      runId,
      artifacts: {},
      errors: [{
        code: "PROVIDER_ERROR" as any,
        message: error.message || "Unknown error in promise suggestion pipeline",
        step: "execution",
        details: { stack: error.stack },
      }],
    };
  }
}

// Auto-register this pipeline
registerPipeline(
  "PROMISE_SUGGEST",
  "Peace of Mind Promise Suggestion Generator",
  "Generate peace of mind promises based on ICP and offer data. Promises address concerns, build trust, and reduce perceived risk.",
  promiseSuggestPipeline
);
