// ARCHIVED: Original path was app/api/campaigns/[campaignId]/planned-satellites/auto-assign-weeks/route.js

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
    const { schedule } = await request.json();

    // Fetch campaign
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

    const plannedSatellites = satellites.plannedSatellites || [];
    const clusterSchedule = schedule || satellites.schedule || { cadence: "weekly" };

    // Assign weeks sequentially
    const updated = plannedSatellites.map((satellite, index) => ({
      ...satellite,
      weekNumber: index + 1,
    }));

    // Update campaign
    await supabase
      .from("campaigns")
      .update({ 
        satellites: {
          ...satellites,
          plannedSatellites: updated
        }
      })
      .eq("id", campaignId)
      .eq("user_id", user.id);

    return NextResponse.json({ plannedSatellites: updated });
  } catch (error) {
    console.error("Error assigning weeks:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}

