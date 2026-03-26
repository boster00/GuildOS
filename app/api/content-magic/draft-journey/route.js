import { NextResponse } from "next/server";
import { createClient } from "@/libs/supabase/server";
import { initMonkey } from "@/libs/monkey";

export async function POST(request) {
  try {
    const body = await request.json();
    const { articleId, icpId } = body;

    if (!articleId) {
      return NextResponse.json(
        { error: "articleId is required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const monkey = await initMonkey();
    monkey.loadUserContext({ ...(body?.user_context ?? {}), userId: (await supabase.auth.getUser()).data?.user?.id });

    // Fetch article details
    const { data: article, error: articleError } = await supabase
      .from("content_magic_articles")
      .select("*")
      .eq("id", articleId)
      .single();

    if (articleError || !article) {
      return NextResponse.json(
        { error: "Article not found" },
        { status: 404 }
      );
    }

    // Fetch ICP details if provided
    let icpContext = "";
    if (icpId) {
      const { data: icp, error: icpError } = await supabase
        .from("icps")
        .select("*")
        .eq("id", icpId)
        .single();

      if (!icpError && icp) {
        icpContext = `\n## Target Audience (ICP):\n`;
        Object.entries(icp).forEach(([key, value]) => {
          if (!value || key === 'id' || key === 'user_id' || key === 'created_at' || key === 'updated_at') {
            return;
          }
          const label = key
            .split('_')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
          icpContext += `- ${label}: ${value}\n`;
        });
      }
    }

    // Build article context
    const articleContext = `
## Article Information:
- Title: ${article.title || "Untitled"}
- Type: ${article.type || "Not specified"}
`;

    // AI prompt to generate journey & mindset draft
    const prompt = `You are a content strategist analyzing an article to determine the reader's decision journey stage and mindset.

${icpContext}
${articleContext}

## Decision Journey Stages:
1. **Awareness** - Realize the problem exists
2. **Research** - Research solutions (how tos)
3. **Decision** - Compare options and make a choice
4. **Post-purchase** - Already bought, needs support and optimization

## Your Task:
Based on the ICP profile and article context, recommend:
1. Which decision journey stage this article should target
2. A brief explanation of why this stage fits
3. The reader's likely mindset (tone and urgency keywords). Some examples: 
   - "The user does not realize the problem yet and relate to identity based call-outs such as 'As a busy professional...'"
   - "The user is researching solutions and needs to understand the benefits of different approaches"
    - "the user is very familiar with the options, has a 'mental checklist' and needs to see the specific details to make a purchase decision"
    - "the user is in a hurry and wants transactional information to quickly get started, like phone numbers, setup guides, and pricing details"

Return JSON in this format:
{
  "journey_stage": "awareness" | "research" | "decision" | "post_purchase",
  "explanation": "Brief reasoning for why this stage is appropriate",
  "mindset_draft": "The user does not realize the problem yet and relate to identity based call-outs such as 'As a busy professional...'"
}

Guidelines:
- Consider the ICP's pain points and goals
- Match the article type and keywords to the appropriate journey stage
- Be specific about the mindset - include both emotional tone and urgency level. Be sure the mention the subject related keyword so user knows it is a specific recommendation not some generic fluff. 
- Keep explanation concise (2-3 sentences)`;

    const response = await monkey.AI(prompt, {
      vendor: "openai",
      model: "gpt-4o",
      forceJson: true,
    });
    let draft = {
      journey_stage: "awareness",
      explanation: "Unable to determine journey stage",
      mindset_draft: ""
    };

    try {
      draft = JSON.parse(response);
    } catch (e) {
    }

    return NextResponse.json(draft, { status: 200 });

  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}