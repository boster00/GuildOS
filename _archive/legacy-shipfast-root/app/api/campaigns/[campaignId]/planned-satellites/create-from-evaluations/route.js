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
    const { evaluationIds } = body;

    if (!evaluationIds || !Array.isArray(evaluationIds)) {
      return NextResponse.json(
        { error: "evaluationIds array is required" },
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

    const satellites = campaign.satellites || {
      evaluations: [],
      plannedSatellites: [],
      schedule: { cadence: "weekly", startDate: null }
    };

    const evaluations = (satellites.evaluations || []).filter(
      e => evaluationIds.includes(e.id)
    );

    if (evaluations.length === 0) {
      return NextResponse.json(
        { error: "No evaluations found" },
        { status: 404 }
      );
    }

    // Fetch Phase 3 article for pillar context
    const { data: phase3Article } = await supabase
      .from("content_magic_articles")
      .select("title, content_html")
      .eq("campaign_id", campaignId)
      .eq("campaign_phase", 3)
      .single();

    const monkey = await initMonkey();
    monkey.loadUserContext({ ...(body?.user_context ?? {}), userId: user?.id });
    const plannedSatellites = [];

    // Generate brief for each evaluation
    for (const evaluation of evaluations) {
      const prompt = `You are a content strategist creating a creative brief for a satellite article.

## Campaign Context:
- ICP: ${campaign.icp?.name || "Unknown"} - ${campaign.icp?.description || ""}
- Offer: ${campaign.offer?.name || "Unknown"} - ${campaign.offer?.description || ""}
- Outcome: ${campaign.outcome || "Not specified"}

## Pillar Page:
- Title: ${phase3Article?.title || "Phase 3 Pillar"}

## Satellite Topic:
- Title: ${evaluation.title}
- Primary Keyword: ${evaluation.seedKeyword}
- Strategy Type: ${evaluation.strategyType}
- Search Volume: ${evaluation.searchVolume || "unknown"}
- Difficulty: ${evaluation.difficulty || "unknown"}

## Task:
Create a creative brief for this satellite article. Generate:

1. angleNote: 1-2 sentences about the angle and how it speaks to the ICP
2. secondaryKeywords: 3-5 related keywords (array of strings)
3. pillarSectionLinks: 2-4 section IDs/labels from the pillar that this should link to (array of strings)
4. outlineBullets: 5-7 high-level section bullets for the article outline (array of strings)

Return ONLY valid JSON:
{
  "angleNote": "...",
  "secondaryKeywords": ["keyword1", "keyword2"],
  "pillarSectionLinks": ["Section 1", "Section 2"],
  "outlineBullets": ["Bullet 1", "Bullet 2"]
}`;

      const response = await monkey.AI(prompt, {
        model: "gpt-4o-mini",
        temperature: 0.7,
      });

      let brief = {};
      try {
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          brief = JSON.parse(jsonMatch[0]);
        } else {
          brief = JSON.parse(response);
        }
      } catch (e) {
        brief = {
          angleNote: "Content angle for this satellite article",
          secondaryKeywords: [],
          pillarSectionLinks: [],
          outlineBullets: ["Introduction", "Main Content", "Conclusion"],
        };
      }

      plannedSatellites.push({
        id: evaluation.id,
        campaignId,
        title: evaluation.title,
        primaryKeyword: evaluation.seedKeyword,
        strategyType: evaluation.strategyType,
        angleNote: brief.angleNote || "",
        secondaryKeywords: brief.secondaryKeywords || [],
        pillarSectionLinks: brief.pillarSectionLinks || [],
        outlineBullets: brief.outlineBullets || [],
        weekNumber: null,
        status: "brief_ready",
      });
    }

    // Save to database
    const { data: existingCampaign } = await supabase
      .from("campaigns")
      .select("satellites")
      .eq("id", campaignId)
      .eq("user_id", user.id)
      .single();

    const existingSatellites = existingCampaign?.satellites || {
      evaluations: [],
      plannedSatellites: [],
      schedule: { cadence: "weekly", startDate: null }
    };

    const existing = existingSatellites.plannedSatellites || [];
    const merged = [...existing, ...plannedSatellites];

    await supabase
      .from("campaigns")
      .update({ 
        satellites: {
          ...existingSatellites,
          plannedSatellites: merged
        }
      })
      .eq("id", campaignId)
      .eq("user_id", user.id);

    return NextResponse.json({ plannedSatellites });
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}

