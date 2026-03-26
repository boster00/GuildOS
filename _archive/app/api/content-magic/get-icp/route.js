// ARCHIVED: Original path was app/api/content-magic/get-icp/route.js

// app/api/content-magic/get-icp/route.js
import { createClient } from "@/libs/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request) {
  console.log("[app/api/content-magic/get-icp/route.js] POST");
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Extract icpId from request body
    const { icpId } = await request.json();

    if (!icpId) {
      return NextResponse.json(
        { error: "ICP ID is required" },
        { status: 400 }
      );
    }

    // Fetch the ICP entry
    const { data: icp, error } = await supabase
      .from("icps")
      .select("*")
      .eq("id", icpId)
      .eq("user_id", user.id)
      .single();

    if (error || !icp) {
      return NextResponse.json(
        { error: "ICP not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(icp, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}