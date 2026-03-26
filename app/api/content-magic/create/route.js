// app/api/content-magic/create/route.js
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

    const {
      startMode = "new",
      sourceUrl,
      icpId,
      mainTopic,
      webpageMarkdown,
      offerId,
    } = await request.json();

    // Validation - only mainTopic (title) is required
    if (!mainTopic || !mainTopic.trim()) {
      return NextResponse.json(
        { error: "Missing required field: mainTopic (article title)" },
        { status: 400 }
      );
    }

    let contentHtml = "";

    // Determine content based on start mode
    if (startMode === "url" && webpageMarkdown) {
      contentHtml = webpageMarkdown;
    } else {
      contentHtml = `<h1>${mainTopic}</h1>\n<p>Start writing your content here...</p>`;
    }

    // Build context object - only ICP and Offer (no pageType, offerName, startMode)
    const context = {
      icpId: icpId || null,
      offerId: offerId || null,
      createdAt: new Date().toISOString(),
    };

    // Create article in database
    const { data, error } = await supabase
      .from("content_magic_articles")
      .insert({
        user_id: user.id,
        title: mainTopic,
        content_html: contentHtml,
        source_url: sourceUrl || null,
        type: "other",
        context: context,
        status: "draft",
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