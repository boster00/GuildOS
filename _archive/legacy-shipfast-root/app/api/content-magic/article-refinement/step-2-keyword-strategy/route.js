// Step 2: Secondary Keyword Strategy
import { createClient } from "@/libs/supabase/server";
import { NextResponse } from "next/server";
import { REFINEMENT_PROMPTS } from "@/libs/content-magic/article-refinement/prompts";
import { callLLMAndParseJSON } from "@/libs/content-magic/article-refinement/utils.js";

// MVP: Article refinement features are not available
export async function POST(request) {
  return NextResponse.json(
    { error: "Article refinement features are not available in MVP. Use ChatGPT, Cursor, or human writers." },
    { status: 404 }
  );
}

/* MVP - Disabled
export async function POST_ORIGINAL(request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { articleId, candidateKeywords, targetWordCount } = await request.json();

    if (!articleId) {
      return NextResponse.json(
        { error: "articleId is required" },
        { status: 400 }
      );
    }

    // Fetch article and ICP
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

    // Fetch ICP
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

    // Get primary keyword and estimate word count
    const primaryKeyword = article.assets?.primaryKeyword || 
                          article.title;
    
    const wordCount = targetWordCount || 
                     (article.content_html?.match(/\b\w+\b/g)?.length || 1000);

    // Use provided candidate keywords or get from assets
    const keywords = candidateKeywords || article.assets?.candidateKeywords || [];

    if (keywords.length === 0) {
      return NextResponse.json(
        { error: "No candidate keywords provided" },
        { status: 400 }
      );
    }

    // Build prompt
    const prompt = REFINEMENT_PROMPTS.keywordStrategy(
      icpName,
      offerName,
      article.title,
      primaryKeyword,
      wordCount,
      keywords
    );

    // Call LLM
    const strategy = await callLLMAndParseJSON(prompt);

    // Update article assets (top-level, no refinement wrapper)
    const currentAssets = article.assets || {};
    const updatedAssets = {
      ...currentAssets,
      keywordStrategy: {
        primaryKeyword,
        candidateKeywords: keywords,
        selectedSecondaryKeywords: strategy.selectedKeywords || [],
      },
    };

    const { error: updateError } = await supabase
      .from("content_magic_articles")
      .update({ assets: updatedAssets })
      .eq("id", articleId)
      .eq("user_id", user.id);

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({ success: true, strategy }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}
*/

