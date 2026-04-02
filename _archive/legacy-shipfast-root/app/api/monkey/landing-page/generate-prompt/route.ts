import { NextResponse } from "next/server";
import { createClient } from "@/libs/supabase/server";

const log = (...args: any[]) => {
  if (process.env.NODE_ENV === "development") {
  }
};

// Helper to generate instructional content prompt with competitor examples
function generateContentPrompt(
  category: string,
  insight: string,
  icp: any,
  offer: any,
  researchData?: any
): string {
  const offerName = offer?.name || "our service";
  const icpName = icp?.name || "customers";

  // Extract the topic from the insight
  let topic = insight?.trim() || "";

  // For section names or direct ideas, use them as the topic
  if (category === "Common Section" || category === "Content Idea") {
    topic = insight;
  } else {
    // Extract topic from insight text
    topic = insight
      .replace(/^\d+%\s+of\s+competitors?\s+/i, "")
      .replace(/^most\s+providers?\s+/i, "")
      .replace(/^many\s+services?\s+/i, "")
      .replace(/\s+emphasize|highlight|focus on/i, "")
      .trim();
  }

  // Collect competitor examples from research data
  type Example = { content: string; url?: string };
  let competitorExamples: Example[] = [];
  const competitorUrls: string[] = researchData?.competitorUrls || [];

  // 1) Prefer contentSections examples (full sections)
  if (researchData?.contentSections) {
    const sectionKey = Object.keys(researchData.contentSections).find(
      (key) =>
        key.toLowerCase().includes(topic.toLowerCase()) ||
        topic.toLowerCase().includes(key.toLowerCase())
    );

    if (sectionKey && researchData.contentSections[sectionKey]?.examples) {
      competitorExamples = researchData.contentSections[sectionKey].examples
        .slice(0, 2)
        .map((ex: any) => ({
          content: ex.content || ex.text || "",
          url: ex.url,
        }))
        .filter((ex) => ex.content.length > 0);
    }
  }

  // 2) Fallback: take top 2 examples from any contentSections if none matched
  if (competitorExamples.length === 0 && researchData?.contentSections) {
    const allExamples = Object.values(researchData.contentSections)
      .flatMap((sec: any) => sec?.examples || [])
      .filter((ex: any) => (ex?.content || ex?.text)?.length > 0)
      .slice(0, 2)
      .map((ex: any) => ({
        content: ex.content || ex.text || "",
        url: ex.url,
      }));
    if (allExamples.length > 0) {
      competitorExamples = allExamples;
    }
  }

  // 3) Backward compatibility: use contentPatterns as examples if nothing else
  if (competitorExamples.length === 0 && researchData?.contentPatterns) {
    const patternKey = Object.keys(researchData.contentPatterns).find(
      (key) =>
        key.toLowerCase().includes(topic.toLowerCase()) ||
        topic.toLowerCase().includes(key.toLowerCase())
    );

    if (patternKey && Array.isArray(researchData.contentPatterns[patternKey])) {
      competitorExamples = researchData.contentPatterns[patternKey]
        .slice(0, 2)
        .map((p: string) => ({ content: `Competitors mention: ${p}` }));
    }
  }

  // Build the instructional prompt
  let prompt = `Write a section about ${topic} to help convince ${icpName} that ${offerName} excels in this area.\n`;

  if (competitorExamples.length > 0) {
    prompt += `Use these competitor examples as inspiration (do not copy):\n`;
    competitorExamples.forEach((ex, idx) => {
      prompt += `Example ${idx + 1}: ${ex.content}${ex.url ? ` (Source: ${ex.url})` : ""}\n`;
    });
  } else if (competitorUrls.length > 0) {
    prompt += `Review competitor pages (${competitorUrls.join(
      ", "
    )}) and synthesize how they address ${topic}. Use that as inspiration but write original content.\n`;
  } else {
    prompt += `Focus on specific benefits, features, or capabilities that make ${offerName} stand out.\n`;
  }

  prompt += `\nKeep it concise and specific.`;

  return prompt;
}

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
    const { category, idea, sources, icp, offer, researchData } = body;

    if (!category || !idea) {
      return NextResponse.json(
        { error: "Missing required fields: category, idea" },
        { status: 400 }
      );
    }

    log(`Generating prompt for: ${category} - ${idea}`);

    // Generate content prompt from research insight with competitor examples
    const contentPrompt = generateContentPrompt(category, idea, icp, offer, researchData);

    // Determine section title
    let sectionTitle = idea;
    if (category === "Common Section") {
      sectionTitle = idea;
    } else if (category && category !== "Content Idea") {
      sectionTitle = category;
    }

    return NextResponse.json({
      success: true,
      prompt: {
        title: sectionTitle,
        contentPrompt: contentPrompt,
        category,
        idea,
        sources,
      },
    });
  } catch (error: any) {
    log(`Error:`, error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
