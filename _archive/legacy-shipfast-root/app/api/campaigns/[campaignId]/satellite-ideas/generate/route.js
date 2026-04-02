import { NextResponse } from "next/server";
import { createClient } from "@/libs/supabase/server";
import { initMonkey } from "@/libs/monkey";

export async function POST(request, { params }) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { campaignId } = params;
    const body = await request.json().catch(() => ({}));
    const { strategies } = body;

    if (!strategies || !Array.isArray(strategies) || strategies.length === 0) {
      return NextResponse.json(
        { error: "strategies array is required" },
        { status: 400 }
      );
    }

    // Fetch campaign with ICP and Offer using unified tool
    const { fetchCampaignWithDetails } = await import("@/libs/monkey/tools/fetchCampaignWithDetails");
    const campaign = await fetchCampaignWithDetails(campaignId, user.id, true);

    if (!campaign) {
      return NextResponse.json(
        { error: "Campaign not found" },
        { status: 404 }
      );
    }

    // Fetch Phase 3 article
    const { data: phase3Article } = await supabase
      .from("content_magic_articles")
      .select("title, content_html")
      .eq("campaign_id", campaignId)
      .eq("campaign_phase", 3)
      .single();

    // Build context for AI
    const icp = campaign.icp;
    const offer = campaign.offer;
    const pillarTitle = phase3Article?.title || "Phase 3 Pillar";
    const pillarOutline = phase3Article?.content_html || "";

    const monkey = await initMonkey();
    monkey.loadUserContext({ ...(body?.user_context ?? {}), userId: user?.id });

    const prompt = `You are a content strategist helping to plan satellite articles around a pillar page.

## Campaign Context:
- ICP: ${icp?.name || "Unknown"} - ${icp?.description || "No description"}
- Offer: ${offer?.name || "Unknown"} - ${offer?.description || "No description"}
- Outcome: ${campaign.outcome || "Not specified"}
- Peace of Mind: ${campaign.peace_of_mind || "Not specified"}

## Pillar Page:
- Title: ${pillarTitle}
- Outline/Content: ${pillarOutline.substring(0, 2000)}${pillarOutline.length > 2000 ? "..." : ""}

## Task:
Generate 10-15 satellite topic ideas that will support and expand on this pillar page. Focus on:
1. Deep dives on important concepts from the pillar (TOFU → mid funnel)
2. Usage scenarios and case studies showing how customers use the solution
3. Troubleshooting content addressing common mistakes
4. Micro-decision content (A vs B comparisons)
5. Checklists and templates for practical implementation

## Strategy Types to Use:
${strategies.map(s => `- ${s}`).join("\n")}

## Output Format:
Return a JSON array of topic ideas. Each idea should have:
- title: Working title for the article
- seedKeyword: Main keyword this article should target
- strategyType: One of: ${strategies.join(", ")}
- whyItMatters: One sentence explaining why this topic matters for the ICP

Return ONLY valid JSON array, no markdown, no explanation. Example:
[
  {
    "title": "How to [specific action] for [ICP context]",
    "seedKeyword": "keyword phrase",
    "strategyType": "deep_dive",
    "whyItMatters": "This helps [ICP] understand [specific benefit]"
  }
]`;

    const response = await monkey.AI(prompt, {
      model: "gpt-4o-mini",
      temperature: 0.7,
    });

    // Parse AI response
    let ideas = [];
    try {
      // Try to extract JSON from response
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        ideas = JSON.parse(jsonMatch[0]);
      } else {
        ideas = JSON.parse(response);
      }
    } catch (e) {
      return NextResponse.json(
        { error: "Failed to parse AI response", details: e.message },
        { status: 500 }
      );
    }

    // Add IDs and campaignId, set selected to true by default
    const enrichedIdeas = ideas.map(idea => ({
      id: crypto.randomUUID(),
      campaignId,
      title: idea.title || "Untitled",
      seedKeyword: idea.seedKeyword || "",
      strategyType: idea.strategyType || strategies[0],
      whyItMatters: idea.whyItMatters || "",
      selected: true,
    }));

    return NextResponse.json({ ideas: enrichedIdeas });
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}

