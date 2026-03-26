// ARCHIVED: Original path was app/api/content-magic/delete/route.js

// app/api/content-magic/delete/route.js
import { createClient } from "@/libs/supabase/server";
import { NextResponse } from "next/server";

export async function DELETE(request) {
  console.log("[app/api/content-magic/delete/route.js] DELETE");
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { articleId } = await request.json();

    // Validation
    if (!articleId) {
      return NextResponse.json(
        { error: "Missing articleId" },
        { status: 400 }
      );
    }

    // Verify article belongs to user
    const { data: article, error: fetchError } = await supabase
      .from("content_magic_articles")
      .select("id, user_id")
      .eq("id", articleId)
      .single();

    if (fetchError || !article) {
      return NextResponse.json(
        { error: "Article not found" },
        { status: 404 }
      );
    }

    if (article.user_id !== user.id) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      );
    }

    // Delete the article
    const { error: deleteError } = await supabase
      .from("content_magic_articles")
      .delete()
      .eq("id", articleId);

    if (deleteError) {
      return NextResponse.json(
        { error: "Failed to delete article" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}