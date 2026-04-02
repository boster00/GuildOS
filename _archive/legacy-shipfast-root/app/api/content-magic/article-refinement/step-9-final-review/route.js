// Step 9: Final Editorial Review
import { createClient } from "@/libs/supabase/server";
import { NextResponse } from "next/server";
import { REFINEMENT_PROMPTS } from "@/libs/content-magic/article-refinement/prompts";
import { parseFinalReview } from "@/libs/content-magic/article-refinement/utils";
import monkey from "@/libs/monkey";

export async function POST(request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { articleId } = await request.json();

    if (!articleId) {
      return NextResponse.json(
        { error: "articleId is required" },
        { status: 400 }
      );
    }

    // Fetch article and ICP from context
    const { data: article, error: articleError } = await supabase
      .from("content_magic_articles")
      .select("title, context, assets, content_html")
      .eq("id", articleId)
      .eq("user_id", user.id)
      .single();

    if (articleError || !article) {
      return NextResponse.json(
        { error: "Article not found" },
        { status: 404 }
      );
    }

    // Fetch ICP from context.icpId
    let icpName = "Unknown ICP";
    let offerName = "Unknown Offer";
    const icpId = article.context?.icpId;
    if (icpId) {
      const { data: icp } = await supabase
        .from("icps")
        .select("name, offer_names")
        .eq("id", icpId)
        .eq("user_id", user.id)
        .single();
      
      if (icp) {
        icpName = icp.name || icpName;
        offerName = icp.offer_names?.split(',')[0]?.trim() || offerName;
      }
    }

    // Get article content (use updated version if available) (top-level assets, no refinement wrapper)
    const articleContent = article.assets?.implementationResult?.updatedArticle || 
                          article.content_html || '';

    // Get keywords (top-level assets, no refinement wrapper)
    const primaryKeyword = article.assets?.keywordStrategy?.primaryKeyword || article.title;
    const selectedKeywords = (article.assets?.keywordStrategy?.selectedSecondaryKeywords || [])
      .map(k => k.keyword);

    // Build prompt
    const prompt = REFINEMENT_PROMPTS.finalReview(
      icpName,
      offerName,
      article.title,
      primaryKeyword,
      selectedKeywords,
      articleContent
    );

    // Call LLM (don't force JSON for this one, parse from text)
    const response = await monkey.AI(prompt, {
      forceJson: false,
      vendor: "openai",
      model: process.env.AI_MODEL_STANDARD || "gpt-4o",
    });

    // Parse the response
    const review = parseFinalReview(response);

    // Update article assets (top-level, no refinement wrapper)
    const currentAssets = article.assets || {};
    const updatedAssets = {
      ...currentAssets,
      finalReview: review,
    };

    const { error: updateError } = await supabase
      .from("content_magic_articles")
      .update({ assets: updatedAssets })
      .eq("id", articleId)
      .eq("user_id", user.id);

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({ success: true, review }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}

