// ARCHIVED: Original path was libs/monkey/pipelines/organizeOutlinePipeline.ts

/**
 * Organize Outline Pipeline
 * Organizes talk points into a structured outline with PageBrief and SectionSpecs
 * Following best practices for landing page content strategy
 */

import { MonkeyTaskRequest, MonkeyTaskResponse } from "../references/types";
import { callStructured } from "../tools/runtime/callStructured";
import { log } from "../ui/logger";
import { registerPipeline } from "./registry";

// Detailed strategic context for outline organization
interface DetailedStrategicContext {
  icpMentalState: string;              // What's their mindset when landing?
  expectedQuestions: string[];         // Comprehensive question list
  whatTheyWantToSee: string[];        // Info they're actively seeking
  whatWeWantThemToSee: string[];      // Strategic messaging priorities
  decisionFactors: string[];           // What will influence their decision
  riskFactors: string[];               // What might make them hesitate
  competitiveContext: string;          // How this differs from alternatives
}

// Section specification with tier classification
interface SimplifiedSectionSpec {
  sectionTitle: string;          // Creatively rewritten header for better UX
  formatId: string;               // Format choice (hero, contentSection, cardGrid, etc.)
  variant?: string;               // Optional variant for formats that support it (contentSection, keyValueList, conversionBlock)
  tier: 1 | 2 | 3;                // Cognitive priority tier
  tierRationale: string;          // Why this tier
  constraints: string[];          // Word limits, tone rules, specific guidelines
  instructionalPrompt: string;    // Comprehensive open-ended writing guidance
  talkPointIds: string[];         // Which talk points this section covers
}

interface SimplifiedOutlineResult {
  strategicContext: DetailedStrategicContext;
  sections: SimplifiedSectionSpec[];
}

// Schema factory for outline organization
function createSimplifiedOutlineSchema(targetCount: number) {
  return {
    type: "object",
    properties: {
      strategicContext: {
        type: "object",
        properties: {
          icpMentalState: { type: "string" },
          expectedQuestions: { type: "array", items: { type: "string" } },
          whatTheyWantToSee: { type: "array", items: { type: "string" } },
          whatWeWantThemToSee: { type: "array", items: { type: "string" } },
          decisionFactors: { type: "array", items: { type: "string" } },
          riskFactors: { type: "array", items: { type: "string" } },
          competitiveContext: { type: "string" },
        },
        required: ["icpMentalState", "expectedQuestions", "whatTheyWantToSee", "whatWeWantThemToSee"],
      },
      sections: {
        type: "array",
        items: {
          type: "object",
          properties: {
            sectionTitle: { type: "string" },
            formatId: { type: "string" },
            variant: { type: "string" },
            tier: { type: "number", enum: [1, 2, 3] },
            tierRationale: { type: "string" },
            constraints: { type: "array", items: { type: "string" } },
            instructionalPrompt: { type: "string" },
            talkPointIds: { type: "array", items: { type: "string" } },
          },
          required: ["sectionTitle", "formatId", "tier", "tierRationale", "constraints", "instructionalPrompt", "talkPointIds"],
        },
        minItems: Math.max(3, Math.floor(targetCount * 0.6)), // At least 60% of target
        maxItems: Math.min(15, Math.ceil(targetCount * 1.3)), // Up to 30% over target
      },
    },
    required: ["strategicContext", "sections"],
    additionalProperties: true,
  };
}

/**
 * Validate tier ordering in sections
 */
function validateTierOrdering(sections: SimplifiedSectionSpec[]): { valid: boolean; warnings: string[] } {
  const warnings: string[] = [];
  let lastTier = 0;
  
  sections.forEach((section, index) => {
    if (section.tier < lastTier) {
      warnings.push(`Section "${section.sectionTitle}" (Tier ${section.tier}) appears after Tier ${lastTier} section`);
    }
    if (section.tier > lastTier + 1 && lastTier !== 0) {
      warnings.push(`Gap in tier progression: jumped from Tier ${lastTier} to Tier ${section.tier}`);
    }
    lastTier = section.tier;
  });
  
  const tier1Exists = sections.some(s => s.tier === 1);
  if (!tier1Exists) {
    warnings.push("No Tier 1 sections found - page lacks immediate relevance establishment");
  }
  
  return {
    valid: warnings.length === 0,
    warnings,
  };
}

/**
 * Get slot schema for a format
 * NOTE: This function is deprecated - slotSchema is no longer used.
 * Kept for backward compatibility but not called.
 */
function getSlotSchemaForFormat(format: string): Record<string, string> {
  // Deprecated - slotSchema removed from workflow
  // This function is kept for backward compatibility but returns empty object
  return {};
}

/**
 * Organize talk points into a structured outline
 */
export async function organizeOutlinePipeline(
  request: MonkeyTaskRequest,
  options?: {
    apiKey?: string;
    userApiKeys?: Array<{ vendor: string; key: string }>;
  }
): Promise<MonkeyTaskResponse> {
  const runId = `organize-outline-${Date.now()}`;
  
  log("[organizeOutlinePipeline] Starting outline organization with structured PageBrief + SectionSpecs");

  try {
    // Extract campaign context and talk points
    const campaignContext = request.campaignContext || {};
    const icp = campaignContext.icp;
    const offer = campaignContext.offer;
    const talkPoints = request.constraints?.talkPoints || [];
    const userPrompt = request.userInput?.query || "";
    const feedback = request.constraints?.feedback || "";
    const previousOutline = request.constraints?.previousOutline;
    
    // Get phase strategy if available
    const phaseStrategy = campaignContext.phaseStrategy;
    
    // Get main keyword from campaign context assets
    const mainKeyword = campaignContext.assets?.main_keyword || null;
    
    // Get target sections count from constraints
    const targetSectionsCount = request.constraints?.targetSectionsCount || 5;

    if (!icp || !offer || !offer.name) {
      return {
        ok: false,
        runId,
        artifacts: {},
        errors: [{
          code: "INVALID_INPUT" as any,
          message: "ICP and Offer data are required for outline organization. Please provide campaignContext.icp and campaignContext.offer.",
          step: "validation",
        }],
      };
    }

    if (!talkPoints || talkPoints.length === 0) {
      return {
        ok: false,
        runId,
        artifacts: {},
        errors: [{
          code: "INVALID_INPUT" as any,
          message: "Talk points are required for outline organization. Please provide constraints.talkPoints.",
          step: "validation",
        }],
      };
    }

    log(`[organizeOutlinePipeline] Organizing outline for ICP: ${icp.name}, Offer: ${offer.name}, ${talkPoints.length} talk points`);

    // Resolve model tier
    const modelTier = request.model || "high";
    log(`[organizeOutlinePipeline] Using model tier: ${modelTier}`);

    // Build the prompt
    const systemPrompt = `You are an expert landing page content organizer who converts talk points into structured sections with writing instructions and tier prioritization.

YOUR ROLE:
- Organize talk points into logical sections
- Assign tiers to sections based on strategic context and audience intent
- Create writing instructions for each section based on the talk points
- Select appropriate formats and variants for each section

PHASE 1: STRATEGIC CONTEXT ANALYSIS
Generate detailed strategic context to inform writing instructions and tier assignment (this is supplementary to Step 1's strategic context):

1. **icpMentalState**: What mindset is the user in when they land on this page?
2. **expectedQuestions**: Questions they need answered (prioritized by tier)
3. **whatTheyWantToSee** vs **whatWeWantThemToSee**: Information alignment
4. **decisionFactors** & **riskFactors**: What influences their decision
5. **competitiveContext**: How this differs from alternatives

PHASE 2: ORGANIZE SECTIONS AND ASSIGN TIERS
Organize talk points into sections and assign tiers to sections based on strategic context:

**TIER 1 SECTIONS** (Must appear first):
- PURPOSE: Address what the customer wants to know (based on strategic context decisionFactors, immediateQuestions, primaryIntent)
- CONTENT: Sections that establish relevance, answer immediate questions, or address decision criteria from strategic context
- FORMAT SELECTION: Prioritize visual interest and engagement. Use varied formats:
  - hero: For the opening section (ONLY ONE per page)
  - cardGrid: For 3-6 key benefits/features that establish relevance
  - contentSection (twoColumn): For comparisons or side-by-side explanations
  - keyValueList: For specs, facts, or structured information
  - stepsTimeline: For processes or workflows
  - AVOID defaulting to contentSection (single) - it's visually boring. Use it sparingly, only when narrative flow is essential.
- ASSIGNMENT: Assign sections to Tier 1 if they address items from the strategic context's decisionFactors array or immediateQuestions

**TIER 2 SECTIONS** (After all Tier 1):
- PURPOSE: Address why we are good (credibility, differentiation, competitive advantages)
- CONTENT: Sections that build credibility, show differentiation, or demonstrate value/trust
- FORMAT SELECTION: Use engaging, scannable formats:
  - cardGrid: For multiple benefits, features, or differentiators (3-6 items)
  - contentSection (twoColumn): For comparisons, before/after, or side-by-side content
  - quoteBlock: For testimonials or proof (if real quotes exist)
  - keyValueList: For specs, features, or structured benefits
  - table: For pricing, comparisons, or structured data
  - AVOID contentSection (single) unless narrative flow is absolutely necessary
- ASSIGNMENT: Assign sections to Tier 2 if they build credibility/differentiation but do NOT address decisionFactors from strategic context

**TIER 3 SECTIONS** (Last):
- PURPOSE: Reduce friction and provide completeness
- CONTENT: Sections with auxiliary information, FAQs, edge cases, or supporting details
- FORMAT SELECTION: Use appropriate formats for completeness:
  - faqAccordion: For Q&A and objections
  - keyValueList: For checklists, specs, or structured info
  - contentSection: Acceptable here for detailed explanations
- ASSIGNMENT: Assign sections to Tier 3 if they provide completeness but are not critical for relevance or credibility

TIER ASSIGNMENT RULES:
1. Assign Tier 1 to sections that address items from the strategic context's decisionFactors array or immediateQuestions
2. Assign Tier 2 to sections that build credibility/differentiation but do NOT address decisionFactors
3. Assign Tier 3 to sections that provide completeness but are not critical
4. Use the strategic context (from Step 1 and PHASE 1) as the source of truth for tier assignment
5. Each section gets ONE tier - assign it based on the section's primary purpose

For each section, provide:
1. **sectionTitle**: Creatively rewrite the section header for better UX and clarity. Use the talk point "topic" as inspiration, but improve it:
   - For hero sections (formatId: "hero"): The H1 title should prioritize clarity over benefit. State what it is first, then add value if space allows. Include the main keyword when available. Structure: "[Main Keyword] [What It Is] [Value if space allows]"
   - For other sections: Write clear, descriptive headers that communicate the section's purpose and value
   - Make headers scannable, specific, and user-focused
   - Aim for 3-8 words for optimal readability
2. **formatId**: Strategic format choice based on content type and tier. CRITICAL: Prioritize visual interest and engagement, especially for Tier 1 and Tier 2 sections. Avoid defaulting to contentSection (single) - it's visually boring. Use varied formats like cardGrid, twoColumn, keyValueList, stepsTimeline, etc. to make the article more engaging and scannable.
3. **tier**: Integer 1, 2, or 3 - Assign based on strategic context. Tier 1 if addresses decisionFactors/immediateQuestions, Tier 2 if builds credibility/differentiation, Tier 3 otherwise.
4. **tierRationale**: Brief explanation why this tier (1-2 sentences), referencing strategic context (decisionFactors, immediateQuestions, or credibility/differentiation focus).
5. **constraints**: Specific guidelines (e.g., ["≤120 words", "no jargon"])
6. **instructionalPrompt**: Detailed writing guidance including user intent, talk points, competitor strategies, and structural direction (3-6 sentences)
7. **talkPointIds**: List of talk point names covered

AVAILABLE FORMATS (Prioritize visual interest and engagement):
- hero: Opening (headline + subhead + bullets + CTA) - ONLY ONE per page. Variants: "default" (two-column with image), "fullWidth" (centered), "twoColumnWithForm" (form on right)
- cardGrid: 3-6 cards for benefits/features (parallel scanning) - HIGHLY RECOMMENDED for Tier 1 & 2 sections with multiple points
- contentSection: Narrative/explanatory content. Variants: "twoColumn" (side-by-side comparison - PREFERRED) or "single" (standard paragraphs - use sparingly, only when narrative flow is essential)
- keyValueList: Structured lists - GREAT for specs, features, facts. Variants: "labelValue" (facts/specs), "checklist" (requirements), "stats" (metrics, ONLY if real numbers exist)
- stepsTimeline: Process/workflow steps (3-6 steps) - EXCELLENT for Tier 1 sections explaining processes
- table: Structured data (pricing, specs, comparisons) requiring alignment - PERFECT for comparisons or structured information
- quoteBlock: Testimonials/proof (ONLY if real quotes exist) - GREAT for Tier 2 credibility
- conversionBlock: Data capture or CTA. Variants: "form" (data capture) or "cta" (call-to-action banner)
- faqAccordion: Q&A for objections/edge cases - Good for Tier 3

FORMAT SELECTION GUIDELINES:
- Tier 1 & 2: Prioritize cardGrid, twoColumn, keyValueList, stepsTimeline, table - formats that are visually engaging and scannable
- Avoid contentSection (single) unless absolutely necessary for narrative flow
- Use cardGrid when you have 3-6 parallel items (benefits, features, differentiators)
- Use twoColumn for comparisons, before/after, or side-by-side explanations
- Use keyValueList for structured information (specs, features, facts, checklists)
- Use stepsTimeline for processes or workflows
- Use table for pricing, comparisons, or structured data requiring alignment

RETURN JSON STRUCTURE:
{
  "strategicContext": {
    "icpMentalState": "Description of user mindset",
    "expectedQuestions": ["Question 1", "Question 2", ...],
    "whatTheyWantToSee": ["Info they seek", ...],
    "whatWeWantThemToSee": ["Strategic messages", ...],
    "decisionFactors": ["Factor 1", ...],
    "riskFactors": ["Risk 1", ...],
    "competitiveContext": "How this differs from alternatives"
  },
  "sections": [
    {
      "sectionTitle": "Clear, user-focused header (creatively rewritten for better UX)",
      "formatId": "hero",
      "variant": "optional_variant_if_format_supports_it",
      "tier": 1,
      "tierRationale": "Establishes core relevance by...",
      "constraints": ["≤120 words", "no jargon"],
      "instructionalPrompt": "Detailed guidance...",
      "talkPointIds": ["talk_point_1", "talk_point_2"]
    }
  ]
}

CRITICAL:
- Must include BOTH "strategicContext" and "sections"
- Sections must be ordered by tier (all Tier 1, then all Tier 2, then all Tier 3)
- Creatively rewrite section titles for better UX - use talk point topics as inspiration but improve clarity and user focus
- For hero sections, prioritize clarity over benefit in the H1 title
- Return ONLY valid JSON, no markdown`;

    // Build context information
    const phaseInfo = phaseStrategy
      ? `Campaign Phase: ${phaseStrategy.name}\nGoal: ${phaseStrategy.goal}\n\n`
      : "";
    
    const icpInfo = `ICP: ${icp.name}${icp.description ? `\nDescription: ${icp.description}` : ""}`;
    const offerInfo = `Offer: ${offer.name}${offer.description ? `\nDescription: ${offer.description}` : ""}`;
    const mainKeywordInfo = mainKeyword ? `\nMain Keyword: ${mainKeyword}` : "";
    
    // Include transactional facts from offer
    const transactionalFactsInfo = offer.transactional_facts
      ? `\nTransactional Facts:\n${offer.transactional_facts}`
      : "";
    
    // Include campaign context fields
    const outcomeInfo = campaignContext.outcome ? `\nOutcome: ${campaignContext.outcome}` : "";
    const promiseInfo = campaignContext.promise || campaignContext.peaceOfMind 
      ? `\nPeace of Mind Promise: ${campaignContext.promise || campaignContext.peaceOfMind}` 
      : "";

    // Format talk points for the prompt (talk points do NOT have tiers)
    const talkPointsInfo = talkPoints.length > 0
      ? `\n\nTalk Points to Organize:\n${talkPoints.map((tp: any, idx: number) => {
          const name = tp.name || `talk_point_${idx + 1}`;
          const details = tp.details || "";
          const topic = tp.topic || "General";
          return `ID: "${name}"\nTopic: ${topic}\nDetails: ${details}`;
        }).join("\n\n")}`
      : "";

    const userPromptText = userPrompt
      ? `\n\nUser Instructions: ${userPrompt}`
      : "";

    // Include feedback and previous outline if provided
    const feedbackContext = feedback
      ? `\n\nUSER FEEDBACK ON PREVIOUS OUTLINE:\n${feedback}\n\nPlease incorporate this feedback when creating the new outline.`
      : "";

    const previousOutlineContext = previousOutline
      ? `\n\nPREVIOUS OUTLINE (for reference - user provided feedback, so revise accordingly):\nPage Brief: ${JSON.stringify(previousOutline.pageBrief, null, 2)}\n\nSections:\n${previousOutline.sections.map((s: any, idx: number) => 
          `${idx + 1}. ${s.sectionTitle} (${s.formatId}): ${s.objective}`
        ).join("\n")}`
      : "";

    const userPromptFull = `${phaseInfo}${icpInfo}
${offerInfo}${mainKeywordInfo}${transactionalFactsInfo}${outcomeInfo}${promiseInfo}${talkPointsInfo}${userPromptText}${feedbackContext}${previousOutlineContext}

TASK: Create strategic context analysis, organize talk points into sections, and assign tiers to sections.

${feedback ? `\nIMPORTANT: User feedback on previous outline. Review and incorporate changes.` : ""}

INSTRUCTIONS:

PHASE 1 - STRATEGIC CONTEXT:
Analyze the ICP, offer, and campaign to determine:
- User's mental state when landing (problem-aware? solution-aware? comparing?)
- Questions they need answered (prioritize by tier)
- What they want to see vs what we want them to see
- Decision factors and risk factors
- Competitive positioning

PHASE 2 - ORGANIZE SECTIONS AND ASSIGN TIERS:
Group talk points into approximately ${targetSectionsCount} sections (target: ${targetSectionsCount}, range: ${Math.max(3, Math.floor(targetSectionsCount * 0.6))}-${Math.min(15, Math.ceil(targetSectionsCount * 1.3))}).
Then assign tiers to each section based on strategic context.

**Tier 1 Sections** (First):
- Assign Tier 1 to sections that address decisionFactors or immediateQuestions from strategic context
- These address "what the customer wants to know"
- FORMAT SELECTION: Prioritize visual interest - use cardGrid, twoColumn, keyValueList, stepsTimeline, table. AVOID contentSection (single) - it's visually boring. Use varied formats to make the article engaging upfront.
- Group related talk points that address strategic context decisionFactors/immediateQuestions

**Tier 2 Sections** (After Tier 1):
- Assign Tier 2 to sections that build credibility/differentiation but do NOT address decisionFactors
- These address "why we are good"
- FORMAT SELECTION: Use engaging formats - cardGrid, twoColumn, quoteBlock, keyValueList, table. AVOID contentSection (single) unless absolutely necessary.
- Group related talk points that demonstrate credibility/differentiation

**Tier 3 Sections** (Last):
- Assign Tier 3 to sections that provide completeness but are not critical
- These are "everything else"
- FORMAT SELECTION: faqAccordion, keyValueList, or contentSection (acceptable here for detailed explanations)
- Group related talk points that provide auxiliary information

For each section:
- **sectionTitle**: Creatively rewrite the section header for better UX. Use talk point topics as inspiration but improve clarity and user focus. For hero sections, prioritize clarity over benefit in the H1 (state what it is first, include main keyword if available). For other sections, write clear, scannable headers (3-8 words).
- **formatId**: Choose engaging, visually interesting formats. CRITICAL: Avoid defaulting to contentSection (single) - it's visually boring. Prioritize:
  - cardGrid for 3-6 parallel items (benefits, features, differentiators)
  - contentSection (twoColumn) for comparisons or side-by-side content
  - keyValueList for structured information (specs, features, facts)
  - stepsTimeline for processes or workflows
  - table for pricing, comparisons, or structured data
  - quoteBlock for testimonials (if real quotes exist)
  - Use contentSection (single) sparingly, only when narrative flow is essential
- **tier**: Assign 1, 2, or 3 based on strategic context (1 = addresses decisionFactors/immediateQuestions, 2 = builds credibility/differentiation, 3 = completeness)
- **tierRationale**: Explain why this tier based on strategic context (1-2 sentences)
- **constraints**: Specific guidelines (word limits, tone rules, etc.)
- **instructionalPrompt**: Detailed writing instructions (3-6 sentences) - include user intent, talk points to cover, competitor strategies if applicable, and writing direction
- **talkPointIds**: List of talk point names/IDs that belong to this section

TIER ORDERING:
- ALL Tier 1 sections first
- Then ALL Tier 2 sections
- Finally ALL Tier 3 sections
- Sections ordered by their assigned tier

CRITICAL: Return valid JSON with "strategicContext" and "sections". Sections ordered by tier.`;

    // Log prompt size for evaluation
    const systemPromptSize = systemPrompt.length;
    const userPromptSize = userPromptFull.length;
    const totalPromptSize = systemPromptSize + userPromptSize;
    log(`[organizeOutlinePipeline] Prompt size - System: ${systemPromptSize} chars, User: ${userPromptSize} chars, Total: ${totalPromptSize} chars`);
    
    // Use high model for large prompts
    const effectiveModelTier = totalPromptSize > 5000 ? "high" : (modelTier || "high");
    if (effectiveModelTier !== modelTier) {
      log(`[organizeOutlinePipeline] Using ${effectiveModelTier} model due to large prompt size (${totalPromptSize} chars)`);
    }

    // Call AI with structured output
    const result = await callStructured(
      effectiveModelTier,
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPromptFull },
      ],
      createSimplifiedOutlineSchema(targetSectionsCount),
      { 
        stepName: "organizeOutline", 
        maxAttempts: 2,
      }
    );

    if (!result.ok || !result.data) {
      const errorMessage = result.error 
        ? (typeof result.error === 'string' ? result.error : result.error.message)
        : "Failed to organize outline";
      
      return {
        ok: false,
        runId,
        artifacts: {},
        errors: [{
          code: "PROVIDER_ERROR" as any,
          message: errorMessage,
          step: "outlineOrganization",
          details: result.error && typeof result.error !== 'string' ? result.error.details : undefined,
        }],
      };
    }

    const outlineResult = result.data as SimplifiedOutlineResult;

    // Validate tier ordering
    const tierValidation = validateTierOrdering(outlineResult.sections);
    if (!tierValidation.valid) {
      console.log(`[organizeOutlinePipeline] ⚠️  TIER ORDERING WARNINGS:`);
      tierValidation.warnings.forEach(warning => console.log(`  - ${warning}`));
    } else {
      console.log(`[organizeOutlinePipeline] ✅ Tier ordering validated successfully`);
    }

    log(`[organizeOutlinePipeline] Generated strategic context and ${outlineResult.sections.length} sections`);

    // Include prompt in dev mode for debugging
    const isDev = process.env.NODE_ENV !== "production";
    const response: MonkeyTaskResponse = {
      ok: true,
      runId,
      artifacts: {
        strategicContext: outlineResult.strategicContext,
        sections: outlineResult.sections,
        tierValidation: tierValidation,
        generatedAt: new Date().toISOString(),
      },
      meta: {
        modelTier: effectiveModelTier,
        sectionsCount: outlineResult.sections.length,
        tier1Count: outlineResult.sections.filter(s => s.tier === 1).length,
        tier2Count: outlineResult.sections.filter(s => s.tier === 2).length,
        tier3Count: outlineResult.sections.filter(s => s.tier === 3).length,
        tierOrderingValid: tierValidation.valid,
        // Include prompt in dev mode only
        ...(isDev && {
          _devPrompt: {
            system: systemPrompt,
            user: userPromptFull,
            totalSize: totalPromptSize,
          },
        }),
      },
    };

    return response;

  } catch (error: any) {
    log(`[organizeOutlinePipeline] Error: ${error.message}`);
    
    return {
      ok: false,
      runId,
      artifacts: {},
      errors: [{
        code: "PROVIDER_ERROR" as any,
        message: error.message || "Unknown error in outline organization pipeline",
        step: "execution",
        details: { stack: error.stack },
      }],
    };
  }
}

// Auto-register this pipeline
registerPipeline(
  "ORGANIZE_OUTLINE",
  "Organize Outline",
  "Organize talk points into page sections with strategic writing guidance. Returns sections with format, constraints, and instructional prompts that include user intent, talk points, and competitor strategies.",
  organizeOutlinePipeline
);
