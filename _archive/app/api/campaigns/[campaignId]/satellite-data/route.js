// ARCHIVED: Original path was app/api/campaigns/[campaignId]/satellite-data/route.js

import { NextResponse } from "next/server";
import { createClient } from "@/libs/supabase/server";

export async function GET(request, { params }) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { campaignId } = params;

    // Fetch campaign with satellite data
    const { data: campaign } = await supabase
      .from("campaigns")
      .select("satellites")
      .eq("id", campaignId)
      .eq("user_id", user.id)
      .single();

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

    return NextResponse.json({
      evaluations: satellites.evaluations || [],
      plannedSatellites: satellites.plannedSatellites || [],
      schedule: satellites.schedule || { cadence: "weekly", startDate: null },
    });
  } catch (error) {
    console.error("Error fetching satellite data:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}

