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

    const { id } = params;

    // Fetch campaign to get planned satellite
    const { data: campaigns } = await supabase
      .from("campaigns")
      .select("id, satellites, icps (*), offers (*), outcome, peace_of_mind")
      .eq("user_id", user.id);

    let plannedSatellite = null;
    let campaign = null;

    for (const camp of campaigns || []) {
      const satellitesData = camp.satellites || {
        evaluations: [],
        plannedSatellites: [],
        schedule: { cadence: "weekly", startDate: null }
      };
      const satellites = satellitesData.plannedSatellites || [];
      const found = satellites.find(s => s.id === id);
      if (found) {
        plannedSatellite = found;
        campaign = camp;
        break;
      }
    }

    if (!plannedSatellite || !campaign) {
      return NextResponse.json(
        { error: "Planned satellite not found" },
        { status: 404 }
      );
    }

    const body = await request.json().catch(() => ({}));

    // Generate draft using existing article generation logic
    const monkey = await initMonkey();
    monkey.loadUserContext({ ...(body?.user_context ?? {}), userId: user?.id });

    const prompt = `You are a content writer creating a full article draft.

## Campaign Context:
- ICP: ${campaign.icps?.name || "Unknown"} - ${campaign.icps?.description || ""}
- Offer: ${campaign.offers?.name || "Unknown"} - ${campaign.offers?.description || ""}
- Outcome: ${campaign.outcome || "Not specified"}

## Article Brief:
- Title: ${plannedSatellite.title}
- Primary Keyword: ${plannedSatellite.primaryKeyword}
- Angle: ${plannedSatellite.angleNote}
- Secondary Keywords: ${plannedSatellite.secondaryKeywords?.join(", ") || "None"}
- Outline:
${plannedSatellite.outlineBullets?.map(b => `- ${b}`).join("\n") || "- No outline"}

## Task:
Write a complete, well-structured article (1500-2500 words) following the outline. Use HTML formatting with proper headings (h2, h3), paragraphs, lists, and emphasis. Make it engaging, informative, and optimized for the primary keyword while naturally incorporating secondary keywords.

Return the article as HTML content.`;

    const draftContent = await monkey.AI(prompt, {
      model: "gpt-4o-mini",
      temperature: 0.7,
    });

    // Create article in content_magic_articles
    const { data: article, error: articleError } = await supabase
      .from("content_magic_articles")
      .insert({
        user_id: user.id,
        campaign_id: campaign.id,
        title: plannedSatellite.title,
        content_html: draftContent,
        type: "satellite",
        campaign_phase: 4,
        context: {
          satelliteId: id,
          icpId: campaign.icps?.id || null,
          primaryKeyword: plannedSatellite.primaryKeyword,
          strategyType: plannedSatellite.strategyType,
          createdAt: new Date().toISOString(),
        },
        status: "draft",
      })
      .select("id")
      .single();

    if (articleError) {
      throw articleError;
    }

    // Update planned satellite status
    const satellitesData = campaign.satellites || {
      evaluations: [],
      plannedSatellites: [],
      schedule: { cadence: "weekly", startDate: null }
    };

    const updatedSatellites = (satellitesData.plannedSatellites || []).map(s =>
      s.id === id ? { ...s, status: "draft_generated", articleId: article.id } : s
    );

    await supabase
      .from("campaigns")
      .update({ 
        satellites: {
          ...satellitesData,
          plannedSatellites: updatedSatellites
        }
      })
      .eq("id", campaign.id)
      .eq("user_id", user.id);

    return NextResponse.json({
      success: true,
      articleId: article.id,
      message: "Draft generated successfully",
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}

