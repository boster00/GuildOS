// Step 6: Change Checklist
import { createClient } from "@/libs/supabase/server";
import { NextResponse } from "next/server";
import { REFINEMENT_PROMPTS } from "@/libs/content-magic/article-refinement/prompts";
import { callLLMAndParseJSON, extractOutlineFromHtml } from "@/libs/content-magic/article-refinement/utils.js";

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

    // Fetch article
    const { data: article, error: articleError } = await supabase
      .from("content_magic_articles")
      .select("title, assets, content_html")
      .eq("id", articleId)
      .eq("user_id", user.id)
      .single();

    if (articleError || !article) {
      return NextResponse.json(
        { error: "Article not found" },
        { status: 404 }
      );
    }

    // Validate article content
    const contentHtml = article.content_html || '';
    const wordCount = contentHtml.match(/\b\w+\b/g)?.length || 0;
    
    if (wordCount < 100) {
      return NextResponse.json(
        { error: "Article content is too brief to evaluate. Please add more content (at least 100 words) before generating a change checklist." },
        { status: 400 }
      );
    }

    // Get data from previous steps (top-level assets, no refinement wrapper)
    const outlineSections = extractOutlineFromHtml(article.content_html || '');
    const outlineJson = JSON.stringify(outlineSections, null, 2);
    const placementsJson = JSON.stringify(article.assets?.placementSuggestions?.placements || [], null, 2);
    const approvedCompetitorIdeas = (article.assets?.competitorIdeas?.ideas || []).filter(i => i.included !== false);
    const approvedCompetitorIdeasJson = JSON.stringify(approvedCompetitorIdeas, null, 2);

    // Build prompt
    const prompt = REFINEMENT_PROMPTS.changeChecklist(
      article.title,
      outlineJson,
      placementsJson,
      approvedCompetitorIdeasJson
    );

    // Call LLM
    const checklist = await callLLMAndParseJSON(prompt);

    // Add IDs if missing
    const items = (Array.isArray(checklist) ? checklist : []).map((item, index) => ({
      ...item,
      id: item.id || `change_${index + 1}`,
      accepted: item.accepted || false,
    }));

    // Update article assets (top-level, no refinement wrapper)
    const currentAssets = article.assets || {};
    const updatedAssets = {
      ...currentAssets,
      changeChecklist: {
        items,
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

    return NextResponse.json({ success: true, checklist: items }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}

