import { createClient } from "@/libs/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { campaignId, idea } = await request.json();

    if (!campaignId || !idea) {
      return NextResponse.json(
        { error: "campaignId and idea are required" },
        { status: 400 }
      );
    }

    // Validate that idea has required fields
    if (!idea.title) {
      return NextResponse.json(
        { error: "idea.title is required" },
        { status: 400 }
      );
    }

    // Validate and extract main keyword
    const mainKeyword = idea.keyword || idea.main_keyword || null;
    if (!mainKeyword || !mainKeyword.trim()) {
      // Don't fail, but log a warning - keyword might be determined later
    }

    // Fetch campaign to get ICP ID and phase
    const { data: campaign, error: campaignError } = await supabase
      .from("campaigns")
      .select("icp_id, campaign_phase")
      .eq("id", campaignId)
      .eq("user_id", user.id)
      .single();

    if (campaignError || !campaign) {
      return NextResponse.json(
        { error: "Campaign not found" },
        { status: 404 }
      );
    }

    const campaignPhase = campaign?.campaign_phase || null;
    

    // Format creative brief as text (key: value,\n key: value format)
    const formatCreativeBrief = (ideaObj) => {
      const lines = [];
      Object.entries(ideaObj).forEach(([key, value]) => {
        if (value !== null && value !== undefined && key !== 'id') {
          if (typeof value === 'object' && !Array.isArray(value)) {
            // Handle nested objects (like creativeBrief)
            Object.entries(value).forEach(([nestedKey, nestedValue]) => {
              if (nestedValue !== null && nestedValue !== undefined) {
                if (typeof nestedValue === 'object' && !Array.isArray(nestedValue)) {
                  // Handle deeply nested objects (like internalLinks)
                  Object.entries(nestedValue).forEach(([deepKey, deepValue]) => {
                    if (deepValue !== null && deepValue !== undefined) {
                      lines.push(`${nestedKey}.${deepKey}: ${deepValue}`);
                    }
                  });
                } else {
                  lines.push(`${nestedKey}: ${nestedValue}`);
                }
              }
            });
          } else if (Array.isArray(value)) {
            lines.push(`${key}: ${value.join(', ')}`);
          } else {
            lines.push(`${key}: ${value}`);
          }
        }
      });
      return lines.join(',\n');
    };

    // Build creative brief text from the idea object
    const creativeBriefText = formatCreativeBrief(idea);

    // Build content_html with creative brief
    const creativeBriefDisplay = creativeBriefText.replace(/,\n/g, '<br>');
    const contentHtml = `<h1>${idea.title}</h1>
<p>Follow the steps on the right to finish this article (or just wing it). The creative brief has been entered as follows:</p>
<div style="background: #f5f5f5; padding: 1rem; border-radius: 0.5rem; margin-top: 1rem;">
${creativeBriefDisplay}
</div>`;

    // Prepare assets object
    const assets = {
      creative_brief: creativeBriefText,
    };
    
    // Only add main_keyword if it exists and is not empty
    if (mainKeyword && mainKeyword.trim()) {
      assets.main_keyword = mainKeyword.trim();
    } else {
    }

    // Log the data being inserted for debugging
    // Create article in database
    const { data, error } = await supabase
      .from("content_magic_articles")
      .insert({
        user_id: user.id,
        campaign_id: campaignId,
        campaign_phase: 4, // Expand phase
        title: idea.title,
        content_html: contentHtml,
        type: "satellite",
        status: "draft",
        assets: assets,
        context: {
          type: "satellite",
          icpId: campaign.icp_id || null,
          createdAt: new Date().toISOString(),
        },
      })
      .select("id")
      .single();

    if (error) {
      return NextResponse.json(
        { error: "Failed to create article", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        articleId: data.id,
        message: "Article created successfully",
      },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}

