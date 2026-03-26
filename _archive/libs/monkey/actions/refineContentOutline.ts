// ARCHIVED: Original path was libs/monkey/actions/refineContentOutline.ts

/**
 * Refine content outline based on ICP/Offer needs and competitor evidence
 * Combines competitor-based outline from Step 2 with ICP needs and offer requirements
 */

import { callStructured } from "../tools/runtime/callStructured";
import { MarketingPageType, getPageTypeConfig, getSectionTemplate, type SectionType } from "../references/pageTypes/registry";
import { log } from "../ui/logger";

export interface RefinedSection {
  sectionType: SectionType;
  format: string;
  rationale: {
    competitorEvidence: Array<{ url: string; heading: string }>;
    icpOfferReason: string;
    registryReason?: string;
  };
  priority: number; // 1 = highest priority
}

export interface RefineContentOutlineInput {
  finalOutline: Array<{
    sectionType: SectionType;
    reasoning: string;
    competitorEvidence: Array<{ url: string; heading: string }>;
  }>;
  step1Output: {
    icp: any;
    offer: any;
    offerTypeAnalysis?: { offerType: string };
    talkPoints?: {
      uniqueSellingPoints: Array<{ point: string; category: string }>;
      transactionalFacts: Array<{ point: string; source: string }>;
    };
    hookPoints?: any;
  };
  pageType: MarketingPageType;
}

export interface RefineContentOutlineOutput {
  chosenSections: RefinedSection[];
  reasoning: string;
}

const refineContentOutlineSchema = {
  type: "object",
  properties: {
    chosenSections: {
      type: "array",
      items: {
        type: "object",
        properties: {
          sectionType: { type: "string" },
          format: { type: "string" },
          rationale: {
            type: "object",
            properties: {
              competitorEvidence: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    url: { type: "string" },
                    heading: { type: "string" },
                  },
                  required: ["url", "heading"],
                },
              },
              icpOfferReason: { type: "string" },
              registryReason: { type: "string" },
            },
            required: ["competitorEvidence", "icpOfferReason"],
          },
          priority: { type: "number" },
        },
        required: ["sectionType", "format", "rationale", "priority"],
      },
    },
    reasoning: { type: "string" },
  },
  required: ["chosenSections", "reasoning"],
};

export async function refineContentOutline(
  model: "agent" | "high" | "mid",
  input: RefineContentOutlineInput
): Promise<RefineContentOutlineOutput> {
  const { finalOutline, step1Output, pageType } = input;

  // Get page type configuration
  const pageConfig = getPageTypeConfig(pageType);
  const recommendedSections = pageConfig.recommended_sections || [];
  const optionalSections = pageConfig.optional_sections || [];

  // Build context about ICP and offer
  const icpContext = step1Output.icp
    ? `ICP: ${step1Output.icp.name || "Unknown"}
Description: ${step1Output.icp.description || "N/A"}
Roles: ${(step1Output.icp.roles || []).join(", ")}
Top Pains: ${(step1Output.icp.top_pains || []).join(", ")}`
    : "No ICP information provided";

  const offerContext = step1Output.offer
    ? `Offer: ${step1Output.offer.name || "Unknown"}
Description: ${step1Output.offer.description || "N/A"}`
    : "No offer information provided";

  const offerType = step1Output.offerTypeAnalysis?.offerType || "transactional";
  const usps = (step1Output.talkPoints?.uniqueSellingPoints || []).map((usp: any) => usp.point).join(", ");
  const transactionalFacts = (step1Output.talkPoints?.transactionalFacts || []).map((tf: any) => tf.point).join(", ");

  // Build competitor evidence summary
  const competitorEvidenceSummary = finalOutline
    .map((item, idx) => `${idx + 1}. ${item.sectionType}: ${item.reasoning} (from ${item.competitorEvidence.length} competitor(s))`)
    .join("\n");

  // Get available formats for each section type
  const sectionFormats: Record<string, string[]> = {};
  finalOutline.forEach((item) => {
    const template = getSectionTemplate(item.sectionType);
    if (template && template.recommended_formats) {
      sectionFormats[item.sectionType] = template.recommended_formats;
    }
  });

  const systemPrompt = `You are a landing page strategist refining a content outline based on competitor analysis, ICP needs, and offer requirements.

Your task is to:
1. Review the competitor-based outline from Step 2
2. Ensure all essential sections are included (especially HERO if missing)
3. Prioritize sections based on:
   - Competitor evidence (from Step 2)
   - ICP needs and pains (from Step 1)
   - Offer requirements (transactional facts, USPs)
   - Page type recommendations
4. Assign appropriate formats to each section based on content type and best practices

Available page type sections:
- Recommended: ${recommendedSections.join(", ")}
- Optional: ${optionalSections.join(", ")}

Section formats available:
${Object.entries(sectionFormats)
  .map(([type, formats]) => `- ${type}: ${formats.join(", ")}`)
  .join("\n")}

Return a refined outline with chosen sections, formats, rationale, and priority.`;

  const userPrompt = `Refine the following content outline:

**ICP Context:**
${icpContext}

**Offer Context:**
${offerContext}
Offer Type: ${offerType}
Unique Selling Points: ${usps || "None specified"}
Transactional Facts: ${transactionalFacts || "None specified"}

**Competitor-Based Outline from Step 2:**
${competitorEvidenceSummary}

**Page Type:** ${pageType}

**Task:**
1. Review the competitor-based outline
2. Add any missing essential sections (especially HERO if not present)
3. Prioritize sections (1 = highest priority)
4. Assign formats to each section
5. Provide clear rationale for each section choice

Return the refined outline as JSON with chosenSections array and overall reasoning.`;

  const messages = [
    { role: "system" as const, content: systemPrompt },
    { role: "user" as const, content: userPrompt },
  ];
  const result = await callStructured(
    model,
    messages,
    refineContentOutlineSchema,
    { maxAttempts: 2 }
  );

  if (!result.ok || !result.data) {
    throw new Error(`Failed to refine content outline: ${result.error || "Unknown error"}`);
  }

  // Validate and normalize section types
  // Valid section types from registry
  const validSectionTypes: SectionType[] = [
    "HERO", "CONVERSION_BLOCK", "BENEFITS", "USE_CASES", "CAPABILITIES_FIT",
    "PROCESS_HOW_IT_WORKS", "DELIVERABLES", "SCOPE_AND_REQUIREMENTS", "SOCIAL_PROOF",
    "CASE_STUDIES", "COMPARISON", "PRICING_OR_QUOTE_LOGIC", "RISK_REVERSAL",
    "FAQ_OBJECTIONS", "TRUST_CREDENTIALS", "RESOURCES_RELATED", "URGENCY",
    "EVENT_DETAILS", "LEAD_MAGNET_VALUE", "ROI_CALCULATOR"
  ];

  const chosenSections = result.data.chosenSections.map((section: any) => {
    // Ensure sectionType is valid
    const validSectionType = validSectionTypes.includes(section.sectionType as SectionType)
      ? (section.sectionType as SectionType)
      : finalOutline.find((item) => item.sectionType === section.sectionType)?.sectionType || "HERO";

    // Get format from template if not provided or invalid
    const template = getSectionTemplate(validSectionType);
    const validFormat =
      section.format && template?.recommended_formats?.includes(section.format)
        ? section.format
        : template?.recommended_formats?.[0] || "card_grid";

    return {
      sectionType: validSectionType,
      format: validFormat,
      rationale: section.rationale,
      priority: section.priority || 999,
    };
  });

  // Sort by priority
  chosenSections.sort((a, b) => a.priority - b.priority);

  return {
    chosenSections,
    reasoning: result.data.reasoning || "Outline refined based on competitor analysis and ICP/offer needs",
  };
}
