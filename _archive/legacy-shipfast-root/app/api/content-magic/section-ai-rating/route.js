import { NextResponse } from "next/server";
import { createClient } from "@/libs/supabase/server";
import { initMonkey } from "@/libs/monkey";

export async function POST(request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const {
      sectionId,
      sectionHeading,
      sectionContent,
      articleTitle,
      articleBody,
      icpName,
      icpDescription,
      offerName,
      offerDescription,
      mainKeyword,
      originalVision,
    } = await request.json();

    if (!sectionHeading || !sectionContent) {
      return NextResponse.json(
        { error: "sectionHeading and sectionContent are required" },
        { status: 400 }
      );
    }

    const monkey = await initMonkey();
    monkey.loadUserContext({ ...(body?.user_context ?? {}), userId: user?.id });

    // Build prompt for AI rating
    const prompt = `You are an expert content strategist reviewing a section of an article. Evaluate the section and provide recommendations.

**Article Context:**
- Title: ${articleTitle || "Untitled"}
- Main Keyword: ${mainKeyword || "Not specified"}
- Original Vision: ${Array.isArray(originalVision) ? originalVision.join('\n') : originalVision || "Not specified"}

**ICP Context:**
- Name: ${icpName || "Not specified"}
- Description: ${icpDescription || "Not specified"}
- Offer: ${offerName || "Not specified"} - ${offerDescription || "Not specified"}

**Section to Review:**
- Heading: ${sectionHeading}
- Content: ${sectionContent.substring(0, 2000)}${sectionContent.length > 2000 ? "..." : ""}

**Full Article (for context):**
${articleBody ? articleBody.substring(0, 5000) + (articleBody.length > 5000 ? "..." : "") : "Not available"}

**Your Task:**
Evaluate this section and provide recommendations for:
1. **Keep/Remove**: Does this section make sense for the ICP and search intent?
2. **Move**: Should it stay, move up, or move down in the article flow?
3. **Length**: Should it be shortened, kept as is, or expanded?
4. **Format**: Should it stay as is, or be converted to bullets/table/cards/FAQ?

**Output Format:**
Return a JSON object:
{
  "keep": "keep" | "remove",
  "move": "stay" | "move_up" | "move_down",
  "length": "shorten" | "keep" | "expand",
  "format": "keep" | "bullets" | "table" | "cards" | "faq",
  "reason": "Brief explanation (1-2 sentences) of your recommendations"
}

**Guidelines:**
- Consider if the section supports the main keyword and original vision
- Evaluate if it's appropriate for the ICP's needs and search intent
- Assess if the format matches how the ICP would scan/consume this content
- Consider the logical flow and positioning within the article
- Be specific and actionable in your recommendations`;

    const response = await monkey.AI(prompt, {
      vendor: "openai",
      model: "gpt-4o",
      forceJson: true,
    });

    let parsed;
    try {
      parsed = typeof response === 'string' ? JSON.parse(response) : response;
    } catch (e) {
      // Fallback default rating
      parsed = {
        keep: "keep",
        move: "stay",
        length: "keep",
        format: "keep",
        reason: "Section appears appropriate. Review manually for best results.",
      };
    }

    return NextResponse.json(parsed);
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Failed to get AI rating" },
      { status: 500 }
    );
  }
}

