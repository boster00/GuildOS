/**
 * Review the complete article for quality issues
 * Open-ended analysis to catch repetition, inconsistencies, and other problems
 */

import { callStructured } from "../tools/runtime/callStructured";
import { log } from "../ui/logger";

export interface ReviewArticleInput {
  sections: Array<{
    sectionType: string;
    format: string;
    content: any;
    html: string;
  }>;
  icp: any;
  offer: any;
  fullHtml: string;
}

export interface ReviewResult {
  overallQuality: "excellent" | "good" | "needs_improvement" | "poor";
  issues: Array<{
    severity: "critical" | "major" | "minor";
    category: "repetition" | "inconsistency" | "tone" | "structure" | "clarity" | "other";
    description: string;
    affectedSections: string[];
    suggestion: string;
  }>;
  strengths: string[];
  recommendations: string[];
}

const reviewArticleSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    overallQuality: { 
      type: "string", 
      enum: ["excellent", "good", "needs_improvement", "poor"] 
    },
    issues: {
      type: "array",
      items: {
        type: "object",
        properties: {
          severity: { type: "string", enum: ["critical", "major", "minor"] },
          category: { 
            type: "string", 
            enum: ["repetition", "inconsistency", "tone", "structure", "clarity", "other"] 
          },
          description: { type: "string" },
          affectedSections: { type: "array", items: { type: "string" } },
          suggestion: { type: "string" },
        },
        required: ["severity", "category", "description", "affectedSections", "suggestion"],
      },
    },
    strengths: { type: "array", items: { type: "string" } },
    recommendations: { type: "array", items: { type: "string" } },
  },
  required: ["overallQuality", "issues", "strengths", "recommendations"],
};

/**
 * Review the complete article for quality issues
 */
export async function reviewArticle(
  model: "agent" | "high" | "mid",
  input: ReviewArticleInput
): Promise<ReviewResult> {
  log(`[reviewArticle] Reviewing article with ${input.sections.length} sections`);

  const systemPrompt = `You are an expert content quality reviewer for marketing landing pages.

Your job is to perform a comprehensive, open-ended review of the complete article to identify:
1. **Repetition**: Same points, benefits, or messaging repeated across sections
2. **Inconsistencies**: Conflicting information, tone shifts, or structural issues
3. **Tone problems**: Overly salesy, too technical, not audience-appropriate
4. **Structural issues**: Poor flow, missing transitions, illogical ordering
5. **Clarity problems**: Confusing language, jargon overload, unclear value props
6. **Other issues**: Anything else that hurts the article's effectiveness

For each issue you find:
- Rate severity: critical (must fix), major (should fix), minor (nice to fix)
- Categorize it: repetition, inconsistency, tone, structure, clarity, other
- Describe the specific problem
- List which sections are affected
- Provide a concrete suggestion for improvement

Also identify:
- **Strengths**: What the article does well
- **Recommendations**: High-level suggestions to improve overall quality

Be thorough but fair. If the article is genuinely good, say so. If there are problems, be specific.

CRITICAL: You MUST respond with ONLY valid JSON. Do not include any text before or after the JSON.`;

  const sectionsOverview = input.sections.map((s, idx) => {
    const contentPreview = typeof s.content === 'string' 
      ? s.content.substring(0, 200) 
      : JSON.stringify(s.content).substring(0, 200);
    
    return `Section ${idx + 1}: ${s.sectionType} (${s.format})
Content preview: ${contentPreview}...
HTML length: ${s.html?.length || 0} chars`;
  }).join("\n\n");

  const userPrompt = `Review this complete landing page article for quality issues.

ICP Context:
- Name: ${input.icp.name}
- Description: ${input.icp.description || "N/A"}
- Roles: ${input.icp.roles?.join(", ") || "N/A"}

Offer Context:
- Name: ${input.offer.name}
- Description: ${input.offer.description || "N/A"}

Article Structure:
${sectionsOverview}

Full HTML Preview (first 2000 chars):
${input.fullHtml.substring(0, 2000)}

Instructions:
1. Read through all sections carefully
2. Identify any repetition of points, benefits, or messaging across sections
3. Check for inconsistencies in tone, information, or structure
4. Evaluate if each section adds unique value or just rehashes previous content
5. Look for structural issues (poor flow, missing transitions, illogical ordering)
6. Check if the tone is appropriate for the ICP and offer
7. Identify any clarity problems (jargon, confusing language, unclear value props)
8. Note any other issues that hurt effectiveness
9. Also identify what the article does well (strengths)
10. Provide high-level recommendations for improvement

Be specific and actionable in your feedback. If you find repetition, quote the repeated content and list which sections it appears in.

Return ONLY valid JSON matching the schema.`;

  const messages = [
    { role: "system" as const, content: systemPrompt },
    { role: "user" as const, content: userPrompt },
  ];

  try {
    const result = await callStructured(
      model,
      messages,
      reviewArticleSchema,
      { stepName: "reviewArticle", maxAttempts: 2 }
    );

    if (!result.ok || !result.data) {
      throw new Error("Failed to review article: no result");
    }

    const review = result.data as ReviewResult;

    log(`[reviewArticle] ✅ Review complete: ${review.overallQuality}, ${review.issues.length} issues found`);

    return review;
  } catch (error: any) {
    log(`[reviewArticle] ❌ Error: ${error.message}`);
    throw new Error(`Failed to review article: ${error.message}`);
  }
}
