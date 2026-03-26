// ARCHIVED: Original path was libs/monkey/actions/evaluateTalkPointsCoverage.ts

/**
 * Evaluate whether talk points from Step 1 are properly covered in written sections
 */

import { callStructured } from "../tools/runtime/callStructured";
import { SectionContent } from "../references/marketingTypes";
import { log } from "../ui/logger";

export interface TalkPointsCoverageResult {
  coverage: {
    uniqueSellingPoints: Array<{
      point: string;
      covered: boolean;
      sectionReferences: string[]; // Section types where it appears
      notes?: string;
    }>;
    transactionalFacts: Array<{
      point: string;
      covered: boolean;
      sectionReferences: string[];
      notes?: string;
    }>;
  };
  overallCoverage: number; // 0-1
  missingPoints: string[];
  recommendations: string[];
}

const evaluateTalkPointsCoverageSchema = {
  type: "object",
  additionalProperties: true,
  properties: {
    coverage: {
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
              covered: { type: "boolean" },
              sectionReferences: {
                type: "array",
                items: { type: "string" },
              },
              notes: { type: "string" },
            },
            required: ["point", "covered", "sectionReferences"],
          },
        },
        transactionalFacts: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: true,
            properties: {
              point: { type: "string" },
              covered: { type: "boolean" },
              sectionReferences: {
                type: "array",
                items: { type: "string" },
              },
              notes: { type: "string" },
            },
            required: ["point", "covered", "sectionReferences"],
          },
        },
      },
      required: ["uniqueSellingPoints", "transactionalFacts"],
    },
    overallCoverage: { type: "number", minimum: 0, maximum: 1 },
    missingPoints: {
      type: "array",
      items: { type: "string" },
    },
    recommendations: {
      type: "array",
      items: { type: "string" },
    },
  },
  required: ["coverage", "overallCoverage", "missingPoints", "recommendations"],
};

/**
 * Evaluate whether talk points are properly covered in written sections
 */
export async function evaluateTalkPointsCoverage(
  model: "agent" | "high" | "mid",
  sections: SectionContent[],
  talkPoints: {
    uniqueSellingPoints: Array<{ point: string; category: string }>;
    transactionalFacts: Array<{ point: string; source: string }>;
  }
): Promise<TalkPointsCoverageResult> {
  log(`[evaluateTalkPointsCoverage] Evaluating coverage of ${talkPoints.uniqueSellingPoints.length} USPs and ${talkPoints.transactionalFacts.length} transactional facts`);

  // Build sections summary for the prompt
  const sectionsSummary = sections.map((section, idx) => {
    const contentStr = JSON.stringify(section.content, null, 2);
    return `Section ${idx + 1}: ${section.sectionType} (format: ${section.format})\n${contentStr.substring(0, 500)}${contentStr.length > 500 ? "..." : ""}`;
  }).join("\n\n");

  const systemPrompt = `You are evaluating whether all required talk points are properly covered in the written landing page sections.

Your task:
1. Check if each unique selling point (USP) is mentioned or implied in at least one section.
2. Check if each transactional fact is mentioned or implied in at least one section.
3. Identify which sections reference each point.
4. Calculate overall coverage (0-1).
5. List any missing points.
6. Provide recommendations for improvement.

CRITICAL: You MUST respond with ONLY valid JSON. Do not include any text before or after the JSON. Do not use markdown code blocks.`;

  const userPrompt = `Evaluate talk points coverage in these written sections:

Sections:
${sectionsSummary}

Required Talk Points:

Unique Selling Points:
${talkPoints.uniqueSellingPoints.map((usp, idx) => `${idx + 1}. ${usp.point} (${usp.category})`).join("\n")}

Transactional Facts:
${talkPoints.transactionalFacts.map((tf, idx) => `${idx + 1}. ${tf.point}`).join("\n")}

Instructions:
1. For each USP and transactional fact, determine if it's covered (mentioned or clearly implied) in any section.
2. List which section types reference each point.
3. Calculate overall coverage as a percentage (0-1).
4. List any points that are missing or not clearly covered.
5. Provide recommendations for improving coverage if needed.

Return ONLY valid JSON matching the schema.`;

  const messages = [
    { role: "system" as const, content: systemPrompt },
    { role: "user" as const, content: userPrompt },
  ];

  try {
    const result = await callStructured(
      model,
      messages,
      evaluateTalkPointsCoverageSchema,
      { stepName: "evaluateTalkPointsCoverage", maxAttempts: 2 }
    );

    if (!result.ok || !result.data) {
      throw new Error("Failed to evaluate talk points coverage: no result");
    }

    const artifact = result.data;

    log(`[evaluateTalkPointsCoverage] ✅ Coverage: ${(artifact.overallCoverage * 100).toFixed(0)}%, Missing: ${artifact.missingPoints.length} points`);

    return artifact as TalkPointsCoverageResult;
  } catch (error: any) {
    log(`[evaluateTalkPointsCoverage] ❌ Error: ${error.message}`);
    throw new Error(`Failed to evaluate talk points coverage: ${error.message}`);
  }
}
