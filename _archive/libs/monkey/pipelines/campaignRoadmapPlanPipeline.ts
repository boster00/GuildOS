/**
 * Campaign Roadmap Plan Pipeline
 * Generates a campaign roadmap plan based on ICP, offer, and campaign context
 */

import { MonkeyTaskRequest, MonkeyTaskResponse } from "../references/types";
import { callStructured } from "../tools/runtime/callStructured";
import { log } from "../ui/logger";
import { registerPipeline } from "./registry";

interface Phase {
  id: string;
  name: string;
  objective: string;
  assets?: Array<{
    type: string;
    title: string;
    description?: string;
  }>;
}

interface CampaignRoadmap {
  explanation: string;
  phase2_choice: "none" | "scenario_listicle" | "comparison_guide";
  phase3_choice: "none" | "outcome_pillar";
  differentiationNotes?: string[];
  phases?: Phase[];
}

const campaignRoadmapSchema = {
  type: "object",
  properties: {
    explanation: {
      type: "string",
      description: "Clear explanation of the roadmap strategy and how it aligns with the ICP's journey and the offer's positioning"
    },
    phase2_choice: {
      type: "string",
      enum: ["none", "scenario_listicle", "comparison_guide"],
      description: "Phase 2 content strategy: 'none' to skip, 'scenario_listicle' for use-case scenarios, 'comparison_guide' for competitive comparison content"
    },
    phase3_choice: {
      type: "string",
      enum: ["none", "outcome_pillar"],
      description: "Phase 3 content strategy: 'none' to skip, 'outcome_pillar' for outcome-focused pillar content"
    },
    differentiationNotes: {
      type: "array",
      items: { type: "string" },
      description: "Key points about how this campaign differentiates the offer and addresses ICP needs (2-4 points)",
      minItems: 2,
      maxItems: 4,
    },
    phases: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string", description: "Phase identifier (e.g., 'phase1', 'phase2', 'phase3')" },
          name: { type: "string", description: "Phase name" },
          objective: { type: "string", description: "What this phase aims to achieve" },
          assets: {
            type: "array",
            items: {
              type: "object",
              properties: {
                type: { type: "string", description: "Asset type (e.g., 'landing_page', 'comparison_guide', 'listicle')" },
                title: { type: "string", description: "Asset title or name" },
                description: { type: "string", description: "Brief description of the asset" },
              },
              required: ["type", "title"],
            },
          },
        },
        required: ["id", "name", "objective"],
      },
      description: "Detailed phase breakdown (optional, for advanced planning)",
    },
  },
  required: ["explanation", "phase2_choice", "phase3_choice"],
};

/**
 * Generate campaign roadmap plan based on ICP, offer, and campaign context
 */
export async function campaignRoadmapPlanPipeline(
  request: MonkeyTaskRequest,
  options?: {
    apiKey?: string;
    userApiKeys?: Array<{ vendor: string; key: string }>;
  }
): Promise<MonkeyTaskResponse> {
  const runId = `campaign-roadmap-plan-${Date.now()}`;
  
  log("[campaignRoadmapPlanPipeline] Starting campaign roadmap plan generation");

  try {
    // Extract campaign context data
    const icp = request.campaignContext?.icp;
    const offer = request.campaignContext?.offer;
    const campaign = request.campaignContext?.campaign;
    const outcome = request.campaignContext?.outcome;
    const promise = request.campaignContext?.promise;
    
    if (!icp || !offer || !offer.name) {
      return {
        ok: false,
        runId,
        artifacts: {},
        errors: [{
          code: "INVALID_INPUT" as any,
          message: "ICP and Offer data are required for campaign roadmap planning. Please provide campaignContext.icp and campaignContext.offer with name and description.",
          step: "validation",
        }],
      };
    }

    log(`[campaignRoadmapPlanPipeline] Generating roadmap for Campaign: ${campaign?.name || "Unnamed"}, ICP: ${icp.name}, Offer: ${offer.name}`);

    // Resolve model tier
    const modelTier = request.model || "high";
    log(`[campaignRoadmapPlanPipeline] Using model tier: ${modelTier}`);

    // Build the prompt
    const systemPrompt = `You are an expert marketing strategist specializing in content roadmap planning and campaign architecture.

Your task is to create a strategic campaign roadmap that guides the ICP through their buyer's journey using the right content at each phase.

CAMPAIGN PHASES:
- Phase 1 (Awareness/Top-of-Funnel): Initial landing page/content that introduces the offer and captures interest
- Phase 2 (Decision/Mid-Funnel): Optional content that helps the ICP evaluate options
  - "scenario_listicle": Use-case scenarios, listicles, or case studies showing how the offer solves specific problems
  - "comparison_guide": Comparison content that positions your offer against alternatives
  - "none": Skip Phase 2 if the ICP has low decision complexity or the offer is straightforward
- Phase 3 (Outcome/Authority): Optional content that reinforces the outcome and builds authority
  - "outcome_pillar": Comprehensive pillar content focused on the desired outcome, positioning you as the authority
  - "none": Skip Phase 3 if outcomes are straightforward or Phase 1+2 are sufficient

Guidelines:
1. Consider the ICP's journey stage and decision complexity
2. Match content strategy to how the ICP researches and evaluates solutions
3. Use differentiation notes to highlight what makes this campaign unique
4. Choose phases that align with the offer's complexity and ICP's needs
5. Keep explanation clear and strategic (2-3 paragraphs)

Respond with valid JSON only.`;

    const icpInfo = icp.name ? `ICP: ${icp.name}${icp.description ? `\nDescription: ${icp.description}` : ""}` : "ICP: Not specified";
    const offerInfo = `Offer: ${offer.name}${offer.description ? `\nDescription: ${offer.description}` : ""}`;
    const campaignInfo = campaign?.name ? `Campaign: ${campaign.name}` : "";
    const outcomeInfo = outcome ? `Desired Outcome: ${outcome}` : "";
    const promiseInfo = promise ? `Peace of Mind Promise: ${promise}` : "";

    const userPrompt = `${icpInfo}
${offerInfo}
${campaignInfo ? campaignInfo + "\n" : ""}${outcomeInfo ? outcomeInfo + "\n" : ""}${promiseInfo ? promiseInfo + "\n" : ""}
TASK: Generate a strategic campaign roadmap that guides the ICP through their journey with this offer.

Consider:
- The ICP's research and decision-making process
- The offer's complexity and competitive landscape
- How to position the offer effectively at each stage
- What content types will be most effective for this ICP
- When to include Phase 2 (decision support) and Phase 3 (outcome authority)

Return the result as a JSON object with the structure specified in the schema.`;

    // Call AI with structured output
    const result = await callStructured(
      modelTier,
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      campaignRoadmapSchema,
      { 
        stepName: "campaignRoadmapPlan", 
        maxAttempts: 2,
      }
    );

    if (!result.ok || !result.data) {
      const errorMessage = result.error 
        ? (typeof result.error === 'string' ? result.error : result.error.message)
        : "Failed to generate campaign roadmap plan";
      
      return {
        ok: false,
        runId,
        artifacts: {},
        errors: [{
          code: "PROVIDER_ERROR" as any,
          message: errorMessage,
          step: "roadmapGeneration",
          details: result.error && typeof result.error !== 'string' ? result.error.details : undefined,
        }],
      };
    }

    const roadmap = result.data as CampaignRoadmap;

    log(`[campaignRoadmapPlanPipeline] Generated roadmap - Phase 2: ${roadmap.phase2_choice}, Phase 3: ${roadmap.phase3_choice}`);
    log(`[campaignRoadmapPlanPipeline] Explanation: ${roadmap.explanation.substring(0, 100)}...`);

    return {
      ok: true,
      runId,
      artifacts: {
        campaignRoadmap: {
          explanation: roadmap.explanation,
          phase2_choice: roadmap.phase2_choice,
          phase3_choice: roadmap.phase3_choice,
          differentiationNotes: roadmap.differentiationNotes || [],
          phases: roadmap.phases || [],
          campaignName: campaign?.name,
          icpName: icp.name,
          offerName: offer.name,
          generatedAt: new Date().toISOString(),
        },
      },
      meta: {
        modelTier: modelTier,
        phase2Enabled: roadmap.phase2_choice !== "none",
        phase3Enabled: roadmap.phase3_choice !== "none",
      },
    };

  } catch (error: any) {
    log(`[campaignRoadmapPlanPipeline] Error: ${error.message}`);
    
    return {
      ok: false,
      runId,
      artifacts: {},
      errors: [{
        code: "PROVIDER_ERROR" as any,
        message: error.message || "Unknown error in campaign roadmap plan pipeline",
        step: "execution",
        details: { stack: error.stack },
      }],
    };
  }
}

// Auto-register this pipeline
registerPipeline(
  "CAMPAIGN_ROADMAP_PLAN",
  "Campaign Roadmap Plan Generator",
  "Generate strategic campaign roadmap plans based on ICP, offer, and campaign context. Defines content strategy across phases (awareness, decision, outcome) with appropriate content types.",
  campaignRoadmapPlanPipeline
);
