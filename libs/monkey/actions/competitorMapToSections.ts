/**
 * Map competitor pages to section types from registry
 */

import { callStructured } from "../tools/runtime/callStructured";
import { ContentBlock } from "../tools/competitorSegment";
import { SectionType } from "../references/pageTypes/registry";
import { getSectionTemplate } from "../references/pageTypes/registry";
import { ChatMessage } from "../tools/runtime/providers/openai";
import { log, shouldLogFull } from "../ui/logger";

// Toggle: Use headers-only mode for section analysis
// When true, only headings (H1-H3) are used instead of full page text
// Set to false to revert to full text analysis
const USE_HEADERS_ONLY_MODE = true;

export interface CompetitorSectionMapping {
  sectionType: SectionType;
  confidence: number;
  competitorExample?: string;
  evidenceBlocks: Array<{
    blockId: string;
    heading: string;
    snippet: string;
  }>;
}

/**
 * Analyze a full competitor page and identify ALL section types present
 * @param model - Model tier to use
 * @param fullPageText - Full competitor page text (used when USE_HEADERS_ONLY_MODE is false)
 * @param blocks - Content blocks from the page
 * @param availableSectionTypes - Available section types to match against
 * @param competitorUrl - URL of the competitor page (for logging)
 * @param headings - Optional array of headings (H1-H3) from the page (used when USE_HEADERS_ONLY_MODE is true)
 */
export async function mapCompetitorPageToSections(
  model: "agent" | "high" | "mid",
  fullPageText: string,
  blocks: ContentBlock[],
  availableSectionTypes: SectionType[],
  competitorUrl: string,
  headings?: string[]
): Promise<CompetitorSectionMapping[]> {
  // Build section type descriptions for the prompt
  const sectionDescriptions = availableSectionTypes.map((st) => {
    const template = getSectionTemplate(st);
    return `- ${st}: ${template?.purpose || "No description available"}`;
  }).join("\n");

  // Build schema for array of section mappings
  const dynamicSchema = {
    type: "object",
    additionalProperties: true,
    properties: {
      sections: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: true,
          properties: {
            sectionType: {
              type: "string",
              enum: availableSectionTypes, // Force AI to use only available options
            },
            confidence: { type: "number", minimum: 0, maximum: 1 },
            competitorExample: { type: "string" },
            evidenceBlocks: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: true,
                properties: {
                  blockId: { type: "string" },
                  heading: { type: "string" },
                  snippet: { type: "string" },
                },
              },
            },
          },
          required: ["sectionType", "confidence"],
        },
      },
    },
    required: ["sections"],
  };

  // Determine analysis mode
  const useHeadersOnly = USE_HEADERS_ONLY_MODE && headings && headings.length > 0;
  
  const systemPrompt = `Analyze this competitor page and identify ALL section types that are present. A single page can have multiple sections.

Available section types:
${sectionDescriptions}

IMPORTANT: For service/quote pages, look for these common sections:
- Process/How it works sections (PROCESS_HOW_IT_WORKS, HOW_IT_WORKS_STEPS)
- Deliverables/What you get sections (DELIVERABLES_WHAT_YOU_GET)
- Scope/Inclusions-Exclusions sections (SCOPE_INCLUSIONS_EXCLUSIONS)
- Requirements/Checklist sections (REQUIREMENTS_CHECKLIST)
- Target audience sections (WHO_ITS_FOR)
- Pricing/Quote information (OFFER_SNAPSHOT, PRICING_RANGE_OR_QUOTE_LOGIC)
- Process trust sections (PROCESS_TRUST, TRUST_OR_PROCESS_TRUST)

Output JSON with an array of all sections found on this page. Each section should include:
- sectionType: one of the available section types
- confidence: 0-1 how confident you are this section exists (be generous - include sections even if confidence is 0.4+)
- competitorExample: brief summary of how this competitor implemented this section
- evidenceBlocks: array of content blocks that support this section type`;

  let contentLength: number;
  let contentPreview: string;
  let blocksSummary: string;
  let userPrompt: string;

  if (useHeadersOnly) {
    // Headers-only mode: use headings to infer sections
    const headingsText = headings!.join("\n");
    contentLength = headingsText.length;
    contentPreview = headingsText;
    blocksSummary = blocks.map((b, i) => `${i + 1}. ${b.heading} (${b.snippet.substring(0, 100)}...)`).join("\n");

    userPrompt = `Analyze this competitor page and identify ALL section types present based on the page structure (headings). A page can have multiple sections.

Competitor URL: ${competitorUrl}
Page headings (H1-H3) that define the page structure:
${headingsText}

Content blocks found:
${blocksSummary}

TASK: Based on the headings and page structure, identify ALL section types that exist on this page. Headings often reveal the page structure:
- Headings like "How It Works", "Our Process", "Workflow" → PROCESS_HOW_IT_WORKS or HOW_IT_WORKS_STEPS
- Headings like "What's Included", "Deliverables", "What You Get" → DELIVERABLES_WHAT_YOU_GET
- Headings like "Requirements", "What We Need", "Checklist" → REQUIREMENTS_CHECKLIST
- Headings like "Who This Is For", "Ideal For", "Target Audience" → WHO_ITS_FOR
- Headings like "Pricing", "Cost", "Quote" → PRICING_RANGE_OR_QUOTE_LOGIC or OFFER_SNAPSHOT
- Headings like "Why Choose Us", "Benefits", "Advantages" → BENEFITS_LIST_OR_CARDS
- Headings like "FAQ", "Questions", "Common Questions" → OBJECTION_FAQ
- Headings like "Trust", "Credentials", "Why Trust Us" → TRUST_OR_PROCESS_TRUST

Be thorough - include all sections that can be inferred from the headings. Use confidence 0.4+ for sections that are clearly present based on heading patterns.`;
  } else {
    // Full text mode: use full page content
    contentLength = fullPageText.length;
    contentPreview = fullPageText.length > 4000 
      ? fullPageText.substring(0, 4000) + `\n\n[... ${contentLength - 4000} more characters ...]`
      : fullPageText;
    blocksSummary = blocks.map((b, i) => `${i + 1}. ${b.heading} (${b.snippet.substring(0, 100)}...)`).join("\n");

    userPrompt = `Analyze this competitor page and identify ALL section types present. A page can have multiple sections.

Competitor URL: ${competitorUrl}
Full page content (${contentLength} chars):
${contentPreview}

Content blocks found:
${blocksSummary}

TASK: Return ALL section types that exist on this page. Be thorough - include:
- Process/workflow explanations (even if brief)
- Deliverables lists (what's included)
- Requirements/checklist sections
- Target audience mentions
- Pricing/quote information
- Trust signals and credentials
- Any other sections that match the available section types

Include multiple sections if the page has them. Use confidence 0.4+ for sections that are clearly present.`;
  }

  // Log the exact prompt being used
  log(`[competitorMapToSections] ========== ANALYZING COMPETITOR PAGE ==========`);
  log(`[competitorMapToSections] Mode: ${useHeadersOnly ? "HEADERS-ONLY" : "FULL-TEXT"}`);
  log(`[competitorMapToSections] Competitor URL: ${competitorUrl}`);
  log(`[competitorMapToSections] System prompt:\n${systemPrompt}`);
  log(`[competitorMapToSections] User prompt (${contentLength} chars):\n${userPrompt}`);
  log(`[competitorMapToSections] Available section types (${availableSectionTypes.length}): ${availableSectionTypes.join(", ")}`);
  if (useHeadersOnly) {
    log(`[competitorMapToSections] Headings used (${headings!.length}): ${headings!.join(", ")}`);
  }
  log(`[competitorMapToSections] ================================================`);

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];

  const result = await callStructured(
    model,
    messages,
    dynamicSchema,
    { stepName: "competitorMapToSections", maxAttempts: 2 }
  );

  if (!result.ok || !result.data) {
    if (shouldLogFull()) log(`[competitorMapToSections] Failed to analyze competitor page ${competitorUrl}`);
    return [];
  }

  const response = result.data as { sections: CompetitorSectionMapping[] };
  const sections = response.sections || [];
  
  // Validate all section types - lowered threshold to 0.4 to capture more sections
  const CONFIDENCE_THRESHOLD = 0.4;
  const validSections: CompetitorSectionMapping[] = [];
  const skippedSections: Array<{ sectionType: string; confidence: number; reason: string }> = [];
  
  for (const section of sections) {
    if (section.sectionType && availableSectionTypes.includes(section.sectionType as SectionType)) {
      if (section.confidence >= CONFIDENCE_THRESHOLD) {
        validSections.push(section);
        log(`[competitorMapToSections] ✓ Found section: ${section.sectionType} (confidence: ${section.confidence.toFixed(2)})`);
      } else {
        skippedSections.push({
          sectionType: section.sectionType,
          confidence: section.confidence,
          reason: `confidence ${section.confidence.toFixed(2)} < ${CONFIDENCE_THRESHOLD}`
        });
        log(`[competitorMapToSections] ⚠️ Skipping ${section.sectionType} (low confidence: ${section.confidence.toFixed(2)} < ${CONFIDENCE_THRESHOLD})`);
      }
    } else {
      log(`[competitorMapToSections] ⚠️ Invalid sectionType: ${section.sectionType}`);
      skippedSections.push({
        sectionType: section.sectionType || "unknown",
        confidence: section.confidence || 0,
        reason: "not in available section types"
      });
    }
  }

  log(`[competitorMapToSections] Found ${validSections.length} valid sections on ${competitorUrl} (threshold: ${CONFIDENCE_THRESHOLD})`);
  if (skippedSections.length > 0) {
    log(`[competitorMapToSections] Skipped ${skippedSections.length} sections: ${skippedSections.map(s => `${s.sectionType} (${s.reason})`).join(", ")}`);
  }
  return validSections;
}
