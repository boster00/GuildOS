// ARCHIVED: Original path was app/api/campaigns/[campaignId]/cluster-schedule/route.js

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
    const { cadence, startDate } = await request.json();

    if (!cadence || !["weekly", "biweekly"].includes(cadence)) {
      return NextResponse.json(
        { error: "cadence must be 'weekly' or 'biweekly'" },
        { status: 400 }
      );
    }

    // Fetch existing satellites data
    const { data: campaign } = await supabase
      .from("campaigns")
      .select("satellites")
      .eq("id", campaignId)
      .eq("user_id", user.id)
      .single();

    const satellites = campaign?.satellites || {
      evaluations: [],
      plannedSatellites: [],
      schedule: { cadence: "weekly", startDate: null }
    };

    // Update campaign with schedule
    const { error } = await supabase
      .from("campaigns")
      .update({ 
        satellites: {
          ...satellites,
          schedule: {
            cadence,
            startDate: startDate || null,
          }
        }
      })
      .eq("id", campaignId)
      .eq("user_id", user.id);

    if (error) {
      throw error;
    }

    return NextResponse.json({ 
      success: true,
      schedule: { cadence, startDate: startDate || null }
    });
  } catch (error) {
    console.error("Error updating schedule:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}

