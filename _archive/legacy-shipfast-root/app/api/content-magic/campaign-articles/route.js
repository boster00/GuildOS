import { NextResponse } from "next/server";
import { createClient } from "@/libs/supabase/server";

export async function POST(request) {
  try {
    const body = await request.json();
    const { campaignId, excludeArticleId } = body;

    if (!campaignId) {
      return NextResponse.json(
        { error: "campaignId is required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    // Build query
    let query = supabase
      .from("content_magic_articles")
      .select("id, title, type, source_url, created_at, updated_at")
      .eq("campaign_id", campaignId)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    // Exclude current article if provided
    if (excludeArticleId) {
      query = query.neq("id", excludeArticleId);
    }

    const { data: articles, error } = await query;

    if (error) {
      return NextResponse.json(
        { error: "Failed to fetch articles" },
        { status: 500 }
      );
    }

    return NextResponse.json({ articles: articles || [] });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Failed to fetch campaign articles" },
      { status: 500 }
    );
  }
}

