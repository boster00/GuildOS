// Step 3: Q&A Targeting
import { createClient } from "@/libs/supabase/server";
import { NextResponse } from "next/server";
import { REFINEMENT_PROMPTS } from "@/libs/content-magic/article-refinement/prompts";
import { callLLMAndParseJSON, extractOutlineFromHtml } from "@/libs/content-magic/article-refinement/utils.js";

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

    const { articleId } = await request.json();

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

    // Get primary keyword and selected keywords (top-level assets, no refinement wrapper)
    const primaryKeyword = article.assets?.keywordStrategy?.primaryKeyword || 
                          article.assets?.primaryKeyword || 
                          article.title;
    
    const selectedKeywords = article.assets?.keywordStrategy?.selectedSecondaryKeywords || [];

    // Extract outline from HTML
    const outlineSections = extractOutlineFromHtml(article.content_html || '');
    const outlineJson = JSON.stringify(outlineSections, null, 2);

    // Build prompt
    const prompt = REFINEMENT_PROMPTS.qaTargeting(
      icpName,
      offerName,
      article.title,
      primaryKeyword,
      selectedKeywords,
      outlineJson
    );

    // Call LLM
    const qaTargets = await callLLMAndParseJSON(prompt);

    // Update article assets (top-level, no refinement wrapper)
    const currentAssets = article.assets || {};
    const updatedAssets = {
      ...currentAssets,
      qaTargets: {
        questions: Array.isArray(qaTargets) ? qaTargets : [],
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

    return NextResponse.json({ success: true, qaTargets }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}
*/

