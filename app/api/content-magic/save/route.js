// app/api/content-magic/save/route.js
import { createClient } from "@/libs/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request) {
  let articleId;
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body;
    try {
      body = await request.json();
    } catch (parseErr) {
      
      return NextResponse.json(
        { error: "Invalid JSON body", details: parseErr?.message },
        { status: 400 }
      );
    }

    const {
      articleId: id,
      title,
      contentHtml,
      icpId,
      offerId,
      sourceUrl,
      chatHistory,
    } = body;
    articleId = id;

    const contentLen = contentHtml != null ? String(contentHtml).length : 0;
    // Validation
    if (!articleId) {
      return NextResponse.json(
        { error: "Missing articleId" },
        { status: 400 }
      );
    }

    // Build updated context object - ICP and Offer only
    const context = {};
    if (icpId !== undefined) context.icpId = icpId || null;
    if (offerId !== undefined) context.offerId = offerId || null;

    // Build update object
    const updateData = {};
    if (title !== undefined) updateData.title = title;
    if (contentHtml !== undefined) updateData.content_html = contentHtml;
    if (sourceUrl !== undefined) updateData.source_url = sourceUrl || null;
    if (chatHistory !== undefined) updateData.chat_history = chatHistory;
    
    if (Object.keys(context).length > 0) {
      // Fetch current context and merge
      const { data: currentArticle, error: contextErr } = await supabase
        .from("content_magic_articles")
        .select("context")
        .eq("id", articleId)
        .eq("user_id", user.id)
        .single();

      if (contextErr) {
      }

      updateData.context = {
        ...(currentArticle?.context || {}),
        ...context,
      };
    }

    // Update article
    const updateKeys = Object.keys(updateData);
    

    const { data, error } = await supabase
      .from("content_magic_articles")
      .update(updateData)
      .eq("id", articleId)
      .eq("user_id", user.id)
      .select("id")
      .single();

    if (error) {
      return NextResponse.json(
        { error: "Failed to save article", details: error.message },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: "Article not found or unauthorized" },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { success: true, articleId: data.id },
      { status: 200 }
    );
  } catch (error) {
    const msg = error?.message ?? String(error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}