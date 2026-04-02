// Get and save article refinement state
import { createClient } from "@/libs/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const articleId = searchParams.get("articleId");

    if (!articleId) {
      return NextResponse.json(
        { error: "articleId is required" },
        { status: 400 }
      );
    }

    // Fetch article
    const { data: article, error } = await supabase
      .from("content_magic_articles")
      .select("assets, title, content_html, context")
      .eq("id", articleId)
      .eq("user_id", user.id)
      .single();

    if (error || !article) {
      return NextResponse.json(
        { error: "Article not found" },
        { status: 404 }
      );
    }

    // Extract state from assets (top-level, no refinement wrapper)
    const refinementState = {
      keywordStrategy: article.assets?.keywordStrategy,
      qaTargets: article.assets?.qaTargets,
      competitorIdeas: article.assets?.competitorIdeas,
      placementSuggestions: article.assets?.placementSuggestions,
      changeChecklist: article.assets?.changeChecklist,
      internalLinksPlan: article.assets?.internalLinksPlan,
      finalReview: article.assets?.finalReview,
      implementationResult: article.assets?.implementationResult,
      outline: article.assets?.outline,
      outlineSections: article.assets?.outlineSections,
    };

    return NextResponse.json({ refinementState, article }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { articleId, refinementState } = await request.json();

    if (!articleId || !refinementState) {
      return NextResponse.json(
        { error: "articleId and refinementState are required" },
        { status: 400 }
      );
    }

    // Fetch current article to merge assets
    const { data: article, error: fetchError } = await supabase
      .from("content_magic_articles")
      .select("assets")
      .eq("id", articleId)
      .eq("user_id", user.id)
      .single();

    if (fetchError || !article) {
      return NextResponse.json(
        { error: "Article not found" },
        { status: 404 }
      );
    }

    // Merge state into assets (top-level, no refinement wrapper)
    const updatedAssets = {
      ...(article.assets || {}),
      // Remove refinement wrapper if it exists (cleanup old data)
      ...(article.assets?.refinement && { refinement: undefined }),
      // Add all properties at top level
      ...refinementState,
    };

    // Update article
    const { data: updatedArticle, error: updateError } = await supabase
      .from("content_magic_articles")
      .update({ assets: updatedAssets })
      .eq("id", articleId)
      .eq("user_id", user.id)
      .select()
      .single();

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json(
      { success: true, article: updatedArticle },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}

