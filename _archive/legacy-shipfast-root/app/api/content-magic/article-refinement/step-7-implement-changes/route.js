// Step 7: AI-Assisted Implementation
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

    // Validate article content
    const contentHtml = article.content_html || '';
    const wordCount = contentHtml.match(/\b\w+\b/g)?.length || 0;
    
    if (wordCount < 100) {
      return NextResponse.json(
        { error: "Article content is too brief to evaluate. Please add more content (at least 100 words)." },
        { status: 400 }
      );
    }

    // Get approved changes (top-level assets, no refinement wrapper)
    const approvedItems = (article.assets?.changeChecklist?.items || []).filter(item => item.accepted);
    if (approvedItems.length === 0) {
      return NextResponse.json(
        { error: "No approved changes to implement" },
        { status: 400 }
      );
    }

    // Get keywords (top-level assets, no refinement wrapper)
    const primaryKeyword = article.assets?.keywordStrategy?.primaryKeyword || article.title;
    const selectedKeywords = (article.assets?.keywordStrategy?.selectedSecondaryKeywords || [])
      .map(k => k.keyword);

    // Build prompt
    const prompt = REFINEMENT_PROMPTS.implementChanges(
      icpName,
      offerName,
      article.title,
      primaryKeyword,
      selectedKeywords,
      article.content_html || '',
      JSON.stringify(approvedItems, null, 2)
    );

    // Call LLM
    const result = await callLLMAndParseJSON(prompt);

    // Update article content and assets (top-level, no refinement wrapper)
    const currentAssets = article.assets || {};
    const updatedAssets = {
      ...currentAssets,
      implementationResult: {
        updatedArticle: result.updatedArticle || article.content_html,
        changelog: result.changelog || [],
      },
    };

    // Optionally update content_html immediately, or let user review first
    const { error: updateError } = await supabase
      .from("content_magic_articles")
      .update({ 
        assets: updatedAssets,
        // Uncomment to auto-apply: content_html: result.updatedArticle
      })
      .eq("id", articleId)
      .eq("user_id", user.id);

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({ 
      success: true, 
      updatedArticle: result.updatedArticle,
      changelog: result.changelog 
    }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}
*/

