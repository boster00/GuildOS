// Step 1: Summarize Author Insights
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

/* MVP - Disabled - Original code preserved below
export async function POST_ORIGINAL(request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { articleId, authorInsights } = await request.json();

    if (!articleId || !authorInsights) {
      return NextResponse.json(
        { error: "articleId and authorInsights are required" },
        { status: 400 }
      );
    }

    // Fetch article and ICP from context
    const { data: article, error: articleError } = await supabase
      .from("content_magic_articles")
      .select("title, context, assets")
      .eq("id", articleId)
      .eq("user_id", user.id)
      .single();

    if (articleError || !article) {
      return NextResponse.json(
        { error: "Article not found" },
        { status: 404 }
      );
    }

    // Fetch ICP from context.icpId if available
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

    // Get primary keyword from assets or title
    const primaryKeyword = article.assets?.primaryKeyword || 
                          article.title;

    // Build prompt
    const prompt = REFINEMENT_PROMPTS.summarizeInsights(
      icpName,
      offerName,
      article.title,
      primaryKeyword,
      authorInsights
    );

    // Call LLM
    const brief = await callLLMAndParseJSON(prompt);

    // Update article assets (top-level, no refinement wrapper)
    const currentAssets = article.assets || {};
    const updatedAssets = {
      ...currentAssets,
      authorInsights: {
        raw: authorInsights,
        structured: brief,
      },
      refinementBrief: brief,
    };

    const { error: updateError } = await supabase
      .from("content_magic_articles")
      .update({ assets: updatedAssets })
      .eq("id", articleId)
      .eq("user_id", user.id);

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({ success: true, brief }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}
*/

