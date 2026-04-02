import { NextResponse } from "next/server";
import { createClient } from "@/libs/supabase/server";
import { callStructured } from "@/libs/monkey/tools/runtime/callStructured";

const log = (...args: any[]) => {
  if (process.env.NODE_ENV === "development") {
  }
};

// Schema for research review
const reviewSchema = {
  type: "object",
  additionalProperties: true,
  properties: {
    filteredIdeas: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: true,
        properties: {
          text: { type: "string" },
          rationale: { type: "string" },
          action: { 
            type: "string",
            enum: ["keep", "expand", "remove"]
          },
          expandedPrompt: { type: "string" }, // If action is "expand"
          reason: { type: "string" }, // Why this action
        },
        required: ["text", "action", "reason"]
      }
    }
  },
  required: ["filteredIdeas"]
};

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { researchData, articleHtml, icp, offer } = body;

    if (!researchData) {
      return NextResponse.json(
        { error: "Missing required field: researchData" },
        { status: 400 }
      );
    }

    log(`Reviewing research data: ${Object.keys(researchData).length} keys`);

    // Extract existing sections from article HTML
    const existingSections = extractSectionTitles(articleHtml || "");

    // Flatten all research ideas
    const allIdeas: Array<{ text: string; type: string; rationale: string }> = [];
    
    const { competitorUrls = [], commonSections = [], contentSections = {}, contentPatterns = {}, insights = [], uniqueValueProps = [], qualitySignals = [] } = researchData;

    // Add common sections
    commonSections.forEach((section: string) => {
      allIdeas.push({
        text: section,
        rationale: "Common section found across competitor pages",
        type: "section"
      });
    });

    // Add content sections
    Object.entries(contentSections).forEach(([sectionName, sectionData]: [string, any]) => {
      if (sectionData?.examples && sectionData.examples.length > 0) {
        allIdeas.push({
          text: sectionName,
          rationale: `Full section content found in ${sectionData.examples.length} competitor(s). ${sectionData.commonApproach || ''}`,
          type: "content_section",
          originalData: sectionData // Preserve original data for reconstruction
        } as any);
      } else if (sectionData?.expanded) {
        // This is an expanded idea - use the commonApproach as the expanded prompt
        allIdeas.push({
          text: sectionName,
          rationale: sectionData.commonApproach || sectionName,
          type: "content_section",
          expanded: true,
          originalData: sectionData
        } as any);
      }
    });

    // Add content patterns (backward compatibility)
    Object.entries(contentPatterns).forEach(([category, patterns]: [string, any]) => {
      if (!contentSections[category] && Array.isArray(patterns)) {
        patterns.forEach((pattern: string) => {
          allIdeas.push({
            text: pattern,
            rationale: `Content approach used in "${category}" sections`,
            type: "pattern"
          });
        });
      }
    });

    // Add insights
    insights.forEach((insight: string) => {
      allIdeas.push({
        text: insight,
        rationale: "Key insight from competitive analysis",
        type: "insight"
      });
    });

    // Add unique value props
    uniqueValueProps.forEach((prop: string) => {
      allIdeas.push({
        text: prop,
        rationale: "Unique value proposition to differentiate your offer",
        type: "value_prop"
      });
    });

    // Add quality signals
    qualitySignals.forEach((signal: string) => {
      allIdeas.push({
        text: signal,
        rationale: "Quality signal that builds trust",
        type: "quality"
      });
    });

    log(`Total ideas to review: ${allIdeas.length}, Existing sections: ${existingSections.join(", ")}`);

    // Use AI to review and filter ideas
    const systemPrompt = `You are reviewing research suggestions for a landing page article.

**Context:**
- Target Audience: ${icp?.name || "Target audience"} - ${icp?.description || ""}
- Offer: ${offer?.name || "Product/Service"} - ${offer?.description || ""}
- Existing sections in article: ${existingSections.length > 0 ? existingSections.join(", ") : "None yet"}

**Your Task:**
Review each research idea and decide:
1. **"remove"** - If the idea is already covered in existing sections, or is too vague/generic
2. **"expand"** - If the idea is a small point/advice/comment that should become a full section (provide expandedPrompt)
3. **"keep"** - If the idea is a complete, useful section that's not already covered

**Guidelines:**
- Remove duplicates: If an idea matches an existing section title, remove it
- Remove small points: If an idea is just a bullet point, advice, or comment (not a full section), either expand it to a full section idea or remove it
- Expand wisely: Only expand if the point is substantial enough to be its own section. If it belongs to another section, remove it.
- Keep full sections: Keep ideas that represent complete sections with clear value

**For "expand" actions:**
- Create an expandedPrompt that explains how to turn this small point into a full section
- Example: "Fast turnaround" → "Write a section about turnaround time and speed to help convince [audience] that [service] delivers results quickly. Focus on specific timeframes, expedited options, and how speed benefits the customer."

Return ONLY valid JSON matching the schema.`;

    const userPrompt = `Review these ${allIdeas.length} research ideas:

${allIdeas.map((idea, idx) => `${idx + 1}. [${idea.type}] ${idea.text}\n   Rationale: ${idea.rationale}`).join("\n\n")}

Existing sections in article: ${existingSections.length > 0 ? existingSections.join(", ") : "None"}`;

    const result = await callStructured(
      "high",
      [
        { role: "system" as const, content: systemPrompt },
        { role: "user" as const, content: userPrompt },
      ],
      reviewSchema,
      { stepName: "reviewResearch", maxAttempts: 2 }
    );

    if (!result.ok || !result.data) {
      log(`Review failed, returning all ideas: ${result.error?.message}`);
      // Fallback: return all ideas as "keep"
      return NextResponse.json({
        success: true,
        filteredResearch: researchData,
        reviewSummary: {
          total: allIdeas.length,
          kept: allIdeas.length,
          expanded: 0,
          removed: 0
        }
      });
    }

    const review = result.data;
    
    // Apply the review actions
    const keptIdeas: typeof allIdeas = [];
    const expandedIdeas: typeof allIdeas = [];
    
    review.filteredIdeas.forEach((item: any, idx: number) => {
      const originalIdea = allIdeas[idx];
      if (!originalIdea) return;

      if (item.action === "keep") {
        keptIdeas.push(originalIdea);
      } else if (item.action === "expand" && item.expandedPrompt) {
        // Replace the idea with expanded version
        expandedIdeas.push({
          text: originalIdea.text,
          rationale: item.expandedPrompt,
          type: originalIdea.type
        });
      }
      // "remove" action - just skip it
    });

    log(`Review complete: ${keptIdeas.length} kept, ${expandedIdeas.length} expanded, ${allIdeas.length - keptIdeas.length - expandedIdeas.length} removed`);

    // Reconstruct filtered research data
    const filteredResearch = reconstructResearchData(
      researchData,
      keptIdeas,
      expandedIdeas
    );

    return NextResponse.json({
      success: true,
      filteredResearch,
      reviewSummary: {
        total: allIdeas.length,
        kept: keptIdeas.length,
        expanded: expandedIdeas.length,
        removed: allIdeas.length - keptIdeas.length - expandedIdeas.length
      }
    });
  } catch (error: any) {
    log(`Error:`, error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

// Extract section titles from HTML
function extractSectionTitles(html: string): string[] {
  if (!html) return [];
  
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    
    // Find all h1, h2, h3 headings
    const headings = doc.querySelectorAll("h1, h2, h3");
    const titles: string[] = [];
    
    headings.forEach((heading) => {
      const text = heading.textContent?.trim();
      if (text && text.length > 0) {
        titles.push(text);
      }
    });
    
    return titles;
  } catch (error) {
    log(`Error extracting sections:`, error);
    return [];
  }
}

// Reconstruct research data with filtered ideas
function reconstructResearchData(
  original: any,
  keptIdeas: Array<{ text: string; type: string; rationale: string }>,
  expandedIdeas: Array<{ text: string; type: string; rationale: string }>
): any {
  const filtered = {
    ...original,
    commonSections: [] as string[],
    contentSections: {} as any,
    contentPatterns: {} as any,
    insights: [] as string[],
    uniqueValueProps: [] as string[],
    qualitySignals: [] as string[],
  };

  // Reconstruct based on kept/expanded ideas
  keptIdeas.forEach((idea: any) => {
    if (idea.type === "section") {
      filtered.commonSections.push(idea.text);
    } else if (idea.type === "content_section") {
      // Try to preserve original contentSections data
      if (idea.originalData) {
        filtered.contentSections[idea.text] = idea.originalData;
      } else if (original.contentSections?.[idea.text]) {
        filtered.contentSections[idea.text] = original.contentSections[idea.text];
      } else {
        filtered.contentSections[idea.text] = {
          examples: [],
          commonApproach: idea.rationale,
          sources: idea.sources || []
        };
      }
    } else if (idea.type === "pattern") {
      // Extract category from rationale or use a default
      const category = idea.rationale.match(/"([^"]+)"/)?.[1] || "General";
      if (!filtered.contentPatterns[category]) {
        filtered.contentPatterns[category] = [];
      }
      filtered.contentPatterns[category].push(idea.text);
    } else if (idea.type === "insight") {
      filtered.insights.push(idea.text);
    } else if (idea.type === "value_prop") {
      filtered.uniqueValueProps.push(idea.text);
    } else if (idea.type === "quality") {
      filtered.qualitySignals.push(idea.text);
    }
  });

  // Add expanded ideas as new content sections
  expandedIdeas.forEach((idea: any) => {
    // Preserve original data if available, otherwise create new
    if (idea.originalData) {
      filtered.contentSections[idea.text] = {
        ...idea.originalData,
        commonApproach: idea.rationale, // Override with expanded prompt
        expanded: true
      };
    } else {
      filtered.contentSections[idea.text] = {
        examples: [],
        commonApproach: idea.rationale, // This is now the expanded prompt
        expanded: true, // Flag to indicate this was expanded
        sources: idea.sources || []
      };
    }
  });

  return filtered;
}
