/**
 * Evaluate competitor section outlines against our content wall
 * Maps competitor sections to our section types and builds final outline
 */

import { callStructured } from "../tools/runtime/callStructured";
import { SectionType, getSectionTemplate, getPageTypeConfig } from "../references/pageTypes/registry";
import { MarketingPageType } from "../references/pageTypes/registry";
import { PageSectionOutline } from "../tools/extractSectionOutlines";
import { log } from "../ui/logger";

export interface CompetitorSectionMapping {
  heading: string;
  preview: string;
  mappedSectionType: SectionType | null; // null if no match
  confidence: number; // 0-1
  reasoning: string;
}

export interface CompetitorOutlineWithMapping {
  url: string;
  title: string;
  sections: CompetitorSectionMapping[];
}

export interface SectionCoverage {
  [sectionType: string]: {
    count: number; // how many competitors have this
    competitors: Array<{
      url: string;
      heading: string;
      preview: string;
    }>;
    examples: Array<{
      competitor_url: string;
      example_writing: string; // Actual text from competitor page
      brief_reasoning: string;
    }>;
  };
}

export interface FinalOutlineItem {
  sectionType: SectionType;
  reasoning: string;
  competitorEvidence: Array<{
    url: string;
    heading: string;
  }>;
}

export interface EvaluateSectionOutlinesResult {
  competitorOutlines: CompetitorOutlineWithMapping[];
  sectionCoverage: SectionCoverage;
  finalOutline: FinalOutlineItem[];
}

const evaluateSectionOutlinesSchema = {
  type: "object",
  additionalProperties: true,
  properties: {
    competitorMappings: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: true,
        properties: {
          url: { type: "string" },
          title: { type: "string" },
          sections: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: true,
              properties: {
                heading: { type: "string" },
                preview: { type: "string" },
                mappedSectionType: { type: ["string", "null"] },
                confidence: { type: "number", minimum: 0, maximum: 1 },
                reasoning: { type: "string" },
                exampleWriting: { type: "string" }, // Actual text from competitor page
              },
              required: ["heading", "preview", "mappedSectionType", "confidence", "reasoning"],
            },
          },
        },
        required: ["url", "title", "sections"],
      },
    },
    sectionCoverageExamples: {
      type: "object",
      additionalProperties: {
        type: "object",
        additionalProperties: true,
        properties: {
          examples: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: true,
              properties: {
                competitor_url: { type: "string" },
                example_writing: { type: "string" },
                brief_reasoning: { type: "string" },
              },
              required: ["competitor_url", "example_writing", "brief_reasoning"],
            },
          },
        },
        required: ["examples"],
      },
    },
    finalOutline: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: true,
        properties: {
          sectionType: { type: "string" },
          reasoning: { type: "string" },
          competitorEvidence: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: true,
              properties: {
                url: { type: "string" },
                heading: { type: "string" },
              },
              required: ["url", "heading"],
            },
          },
        },
        required: ["sectionType", "reasoning", "competitorEvidence"],
      },
    },
  },
  required: ["competitorMappings", "sectionCoverageExamples", "finalOutline"],
};

/**
 * Evaluate section outlines from all competitor pages against our content wall
 */
export async function evaluateSectionOutlines(
  model: "agent" | "high" | "mid",
  competitorOutlines: PageSectionOutline[],
  pageType: MarketingPageType,
  availableSectionTypes: SectionType[]
): Promise<EvaluateSectionOutlinesResult> {
  log(`[evaluateSectionOutlines] Evaluating ${competitorOutlines.length} competitor outlines against ${availableSectionTypes.length} section types`);

  // Build section type descriptions for the prompt
  const sectionDescriptions = availableSectionTypes.map((st) => {
    const template = getSectionTemplate(st);
    return `- ${st}: ${template?.purpose || "No description available"}`;
  }).join("\n");

  // Limit to 5 competitors
  const limitedOutlines = competitorOutlines.slice(0, 5);
  log(`[evaluateSectionOutlines] Processing ${limitedOutlines.length} competitors (limited from ${competitorOutlines.length})`);

  // Build competitor outlines summary for the prompt with full content when available
  const competitorSummary = limitedOutlines.map((outline, idx) => {
    const sectionsList = outline.sections
      .map((s, i) => `  ${i + 1}. [${s.level === 1 ? "H1" : s.level === 2 ? "H2" : "H3"}] ${s.heading}${s.preview ? ` - ${s.preview}` : ""}`)
      .join("\n");
    
    // Note: Full HTML content is not available in PageSectionOutline, only section previews
    const contentNote = "";
    
    return `Competitor ${idx + 1}: ${outline.title} (${outline.url})\n${sectionsList}${contentNote}`;
  }).join("\n\n");

  const systemPrompt = `You are analyzing competitor landing pages to identify which content sections they use.

Your task:
1. For each competitor's section outline, map each section (heading + preview) to one of our available section types, or mark as null if it doesn't match.
2. For each mapped section, extract the ACTUAL TEXT from the competitor page that demonstrates this section type. This is critical - do not make up examples.
3. Build section coverage examples showing actual competitor text for each section type.
4. Build a final outline of recommended sections based on which sections appear in multiple competitors.

Available section types:
${sectionDescriptions}

CRITICAL: You MUST respond with ONLY valid JSON. Do not include any text before or after the JSON. Do not use markdown code blocks.

IMPORTANT: When extracting example_writing, use the ACTUAL TEXT from the competitor page content provided. Do not summarize or paraphrase - extract the real text that demonstrates the section type. If full content is provided, use it to find the exact text.

Example JSON structure:
{
  "competitorMappings": [
    {
      "url": "https://example.com",
      "title": "Example Service",
      "sections": [
        {
          "heading": "Our Services",
          "preview": "We offer comprehensive solutions...",
          "mappedSectionType": "BENEFITS",
          "confidence": 0.85,
          "reasoning": "This section describes service benefits in a list format",
          "exampleWriting": "• Fast turnaround times (5-10 days)\n• Expert team with 20+ years experience\n• Competitive pricing with no hidden fees"
        }
      ]
    }
  ],
  "sectionCoverageExamples": {
    "BENEFITS": {
      "examples": [
        {
          "competitor_url": "https://example.com",
          "example_writing": "• Fast turnaround times (5-10 days)\n• Expert team with 20+ years experience\n• Competitive pricing with no hidden fees",
          "brief_reasoning": "Uses bullet list format to present service benefits clearly"
        }
      ]
    }
  },
  "finalOutline": [
    {
      "sectionType": "BENEFITS",
      "reasoning": "Found in 3 out of 5 competitors, important for service pages",
      "competitorEvidence": [
        { "url": "https://example.com", "heading": "Our Services" }
      ]
    }
  ]
}`;

  // Note: Full HTML content is not available in PageSectionOutline
  // Only section previews are available
  const fullContentSections = "";

  const userPrompt = `Analyze these competitor section outlines and map them to our section types:

${competitorSummary}${fullContentSections}

Instructions:
1. For each competitor section, determine if it matches one of our section types (${availableSectionTypes.length} available).
2. For EACH mapped section, extract the ACTUAL TEXT from the full content above that demonstrates this section type. This is critical - use real text, not summaries.
3. Provide confidence score (0-1) and reasoning for each mapping.
4. Build sectionCoverageExamples object with actual competitor text examples for each section type that appears.
5. Build a final outline of sections that appear in multiple competitors or are clearly important.
6. Include competitor evidence (URL + heading) for each section in the final outline.

CRITICAL: The example_writing field must contain ACTUAL TEXT from the competitor page, not a summary or description. Extract the real content that demonstrates the section type.

Return ONLY valid JSON matching the schema.`;

  const messages = [
    { role: "system" as const, content: systemPrompt },
    { role: "user" as const, content: userPrompt },
  ];

  try {
    const result = await callStructured(
      model,
      messages,
      evaluateSectionOutlinesSchema,
      { stepName: "evaluateSectionOutlines", maxAttempts: 2 }
    );

    if (!result.ok || !result.data) {
      throw new Error("Failed to evaluate section outlines: no result");
    }

    const artifact = result.data;

    // Build section coverage map with examples
    const sectionCoverage: SectionCoverage = {};
    
    // First, populate from competitor mappings
    artifact.competitorMappings.forEach((mapping) => {
      mapping.sections.forEach((section) => {
        if (section.mappedSectionType) {
          const sectionType = section.mappedSectionType;
          if (!sectionCoverage[sectionType]) {
            sectionCoverage[sectionType] = {
              count: 0,
              competitors: [],
              examples: [],
            };
          }
          sectionCoverage[sectionType].count++;
          sectionCoverage[sectionType].competitors.push({
            url: mapping.url,
            heading: section.heading,
            preview: section.preview,
          });
        }
      });
    });

    // Then, add examples from sectionCoverageExamples
    if (artifact.sectionCoverageExamples) {
      Object.entries(artifact.sectionCoverageExamples).forEach(([sectionType, data]: [string, any]) => {
        if (data.examples && Array.isArray(data.examples)) {
          if (!sectionCoverage[sectionType]) {
            sectionCoverage[sectionType] = {
              count: 0,
              competitors: [],
              examples: [],
            };
          }
          sectionCoverage[sectionType].examples = data.examples.map((ex: any) => ({
            competitor_url: ex.competitor_url,
            example_writing: ex.example_writing,
            brief_reasoning: ex.brief_reasoning,
          }));
        }
      });
    }

    log(`[evaluateSectionOutlines] ✅ Mapped sections: ${Object.keys(sectionCoverage).length} unique section types found`);
    
    // Log examples for verification
    Object.entries(sectionCoverage).forEach(([sectionType, data]) => {
      log(`[evaluateSectionOutlines] Section ${sectionType}: ${data.count} competitors, ${data.examples.length} examples`);
      data.examples.forEach((ex, idx) => {
        log(`[evaluateSectionOutlines]   Example ${idx + 1} from ${ex.competitor_url}:`);
        log(`[evaluateSectionOutlines]     Writing: ${ex.example_writing.substring(0, 150)}${ex.example_writing.length > 150 ? "..." : ""}`);
        log(`[evaluateSectionOutlines]     Reasoning: ${ex.brief_reasoning}`);
      });
    });

    return {
      competitorOutlines: artifact.competitorMappings.map((m) => ({
        url: m.url,
        title: m.title,
        sections: m.sections.map((s) => ({
          heading: s.heading,
          preview: s.preview,
          mappedSectionType: s.mappedSectionType as SectionType | null,
          confidence: s.confidence,
          reasoning: s.reasoning,
        })),
      })),
      sectionCoverage,
      finalOutline: artifact.finalOutline.map((item) => ({
        sectionType: item.sectionType as SectionType,
        reasoning: item.reasoning,
        competitorEvidence: item.competitorEvidence,
      })),
    };
  } catch (error: any) {
    log(`[evaluateSectionOutlines] ❌ Error: ${error.message}`);
    throw new Error(`Failed to evaluate section outlines: ${error.message}`);
  }
}
