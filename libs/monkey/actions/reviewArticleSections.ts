/**
 * Review all sections for duplicates, empty content, and goal achievement
 */

import { callStructured } from "../tools/runtime/callStructured";
import { log } from "../ui/logger";

export interface ReviewSectionsInput {
  sections: Array<{
    sectionType: string;
    html: string;
    content?: any;
  }>;
  icp: any;
  offer: any;
  clarificationAnswers?: any;
  pageGoals?: string;
}

export interface SectionIssue {
  sectionIndex: number;
  sectionType: string;
  issueType: "empty" | "duplicate" | "off-goal" | "poor-quality";
  severity: "critical" | "high" | "medium" | "low";
  description: string;
  suggestion: string;
  duplicateWith?: number; // Index of the section it duplicates
}

export interface ArticleSectionsReview {
  overallAssessment: string;
  goalsAchieved: boolean;
  goalsAnalysis: string;
  issues: SectionIssue[];
  strengths: string[];
  recommendations: string[];
}

const reviewSectionsSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    overallAssessment: { type: "string" },
    goalsAchieved: { type: "boolean" },
    goalsAnalysis: { type: "string" },
    issues: {
      type: "array",
      items: {
        type: "object",
        properties: {
          sectionIndex: { type: "number" },
          sectionType: { type: "string" },
          issueType: { type: "string", enum: ["empty", "duplicate", "off-goal", "poor-quality"] },
          severity: { type: "string", enum: ["critical", "high", "medium", "low"] },
          description: { type: "string" },
          suggestion: { type: "string" },
          duplicateWith: { type: "number" },
        },
        required: ["sectionIndex", "sectionType", "issueType", "severity", "description", "suggestion"],
      },
    },
    strengths: { type: "array", items: { type: "string" } },
    recommendations: { type: "array", items: { type: "string" } },
  },
  required: ["overallAssessment", "goalsAchieved", "goalsAnalysis", "issues", "strengths", "recommendations"],
};

export async function reviewArticleSections(
  model: "agent" | "high" | "mid",
  input: ReviewSectionsInput
): Promise<ArticleSectionsReview> {
  log(`[reviewArticleSections] Reviewing ${input.sections.length} sections`);

  // Extract text content from HTML for analysis
  const sectionsForReview = input.sections.map((section, index) => {
    const textContent = section.html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    return {
      index,
      sectionType: section.sectionType,
      textContent: textContent.substring(0, 500), // First 500 chars for analysis
      fullLength: textContent.length,
    };
  });

  const systemPrompt = `You are a landing page quality reviewer. Your job is to identify issues in the generated article sections.

CRITICAL REVIEW CRITERIA:

1. EMPTY SECTIONS (severity: critical)
   - Sections with only a heading and no meaningful content
   - Sections with less than 50 characters of text
   - Sections with placeholder text or generic filler

2. DUPLICATE SECTIONS (severity: high)
   - Sections that cover the same topic or message
   - Sections with >60% overlapping content
   - Sections that repeat the same benefits/features/points
   - Example: "Capabilities Fit" and "Scope and Requirements" both showing comparison tables with similar content

3. OFF-GOAL SECTIONS (severity: medium-high)
   - Sections that don't support the page's primary goal
   - Sections that contradict the ICP's needs or offer's positioning
   - Sections that are generic and could apply to any service

4. POOR QUALITY (severity: medium)
   - Vague or generic content
   - Missing specific details or examples
   - Weak value proposition
   - Poor flow or structure

GOALS ACHIEVEMENT ANALYSIS:
Evaluate whether the article as a whole achieves its intended goals:
- Does it clearly communicate the offer's value to the ICP?
- Does it address the ICP's pain points and needs?
- Does it provide enough information to drive the desired action?
- Does it differentiate from competitors?
- Is the messaging consistent and compelling?

Return a comprehensive review with specific, actionable feedback.`;

  const userPrompt = `Review the following landing page sections:

TARGET AUDIENCE (ICP):
${JSON.stringify(input.icp, null, 2)}

OFFER:
${JSON.stringify(input.offer, null, 2)}

${input.clarificationAnswers ? `USER'S CLARIFICATION ANSWERS:
${JSON.stringify(input.clarificationAnswers, null, 2)}` : ""}

${input.pageGoals ? `PAGE GOALS:
${input.pageGoals}` : ""}

SECTIONS TO REVIEW:
${sectionsForReview.map((s, idx) => `
Section ${idx + 1}: ${s.sectionType}
Content Length: ${s.fullLength} characters
Content Preview: ${s.textContent}
---`).join("\n")}

TASK:
1. Identify ALL empty sections (sections with only headings or minimal content)
2. Identify ALL duplicate sections (sections covering the same topic or repeating content)
3. Evaluate if the article achieves its goals (clear value prop, addresses ICP needs, drives action)
4. Provide specific, actionable recommendations

For duplicates, specify which sections are duplicates of each other using the "duplicateWith" field (the index of the first occurrence).

Return your analysis as JSON.`;

  const messages = [
    { role: "system" as const, content: systemPrompt },
    { role: "user" as const, content: userPrompt },
  ];
  const result = await callStructured(
    model,
    messages,
    reviewSectionsSchema,
    { maxAttempts: 2 }
  );

  if (!result.ok || !result.data) {
    throw new Error("Failed to review article sections");
  }

  log(`[reviewArticleSections] Found ${result.data.issues.length} issues`);
  
  return result.data as ArticleSectionsReview;
}
