// ARCHIVED: Original path was app/api/campaigns/[campaignId]/satellite-evaluations/create/route.js

import { NextResponse } from "next/server";
import { createClient } from "@/libs/supabase/server";

export async function POST(request, { params }) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { campaignId } = params;
    const { ideaIds, ideas } = await request.json();

    if (!ideaIds || !Array.isArray(ideaIds)) {
      return NextResponse.json(
        { error: "ideaIds array is required" },
        { status: 400 }
      );
    }

    if (!ideas || !Array.isArray(ideas)) {
      return NextResponse.json(
        { error: "ideas array is required" },
        { status: 400 }
      );
    }

    // Fetch campaign with satellites data
    const { data: campaign } = await supabase
      .from("campaigns")
      .select("satellites")
      .eq("id", campaignId)
      .eq("user_id", user.id)
      .single();

    // Filter to selected ideas
    const selectedIdeas = ideas.filter(idea => ideaIds.includes(idea.id));

    // Convert to evaluations
    const evaluations = selectedIdeas.map(idea => ({
      id: idea.id,
      campaignId,
      title: idea.title,
      seedKeyword: idea.seedKeyword,
      strategyType: idea.strategyType,
      searchVolume: null,
      difficulty: null,
      competitorUrls: [],
      priority: "medium",
      addedToPlan: false,
    }));

    // Get existing satellites data or initialize
    const satellites = campaign?.satellites || {
      evaluations: [],
      plannedSatellites: [],
      schedule: { cadence: "weekly", startDate: null }
    };

    // Merge with existing evaluations
    const existing = satellites.evaluations || [];
    const merged = [...existing, ...evaluations];

    // Update campaign with new satellites data
    const { error: updateError } = await supabase
      .from("campaigns")
      .update({ 
        satellites: {
          ...satellites,
          evaluations: merged
        }
      })
      .eq("id", campaignId)
      .eq("user_id", user.id);

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({ evaluations });
  } catch (error) {
    console.error("Error creating evaluations:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}

