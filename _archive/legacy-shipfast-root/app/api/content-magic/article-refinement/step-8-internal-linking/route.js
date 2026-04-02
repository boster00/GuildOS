// Step 8: Internal Linking
import { createClient } from "@/libs/supabase/server";
import { NextResponse } from "next/server";
import { REFINEMENT_PROMPTS } from "@/libs/content-magic/article-refinement/prompts";
import { callLLMAndParseJSON } from "@/libs/content-magic/article-refinement/utils.js";

export async function POST(request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { articleId, domain, supportingPageTitle, supportingPageUrl, internalCandidates } = await request.json();

    if (!articleId) {
      return NextResponse.json(
        { error: "articleId is required" },
        { status: 400 }
      );
    }

    // Fetch article
    const { data: article, error: articleError } = await supabase
      .from("content_magic_articles")
      .select("title, source_url, assets, content_html")
      .eq("id", articleId)
      .eq("user_id", user.id)
      .single();

    if (articleError || !article) {
      return NextResponse.json(
        { error: "Article not found" },
        { status: 404 }
      );
    }

    // Use provided values or defaults
    const siteDomain = domain || new URL(article.source_url || 'https://example.com').hostname;
    const articleUrl = article.source_url || `${siteDomain}/article/${articleId}`;
    const supportingTitle = supportingPageTitle || "Main Landing Page";
    const supportingUrl = supportingPageUrl || `${siteDomain}/`;
    const candidates = internalCandidates || [];

    // Build prompt
    const prompt = REFINEMENT_PROMPTS.internalLinking(
      siteDomain,
      article.title,
      articleUrl,
      supportingTitle,
      supportingUrl,
      JSON.stringify(candidates, null, 2),
      article.content_html || ''
    );

    // Call LLM
    const linksPlan = await callLLMAndParseJSON(prompt);

    // Update article assets (top-level, no refinement wrapper)
    const currentAssets = article.assets || {};
    const updatedAssets = {
      ...currentAssets,
      internalLinksPlan: linksPlan,
    };

    const { error: updateError } = await supabase
      .from("content_magic_articles")
      .update({ assets: updatedAssets })
      .eq("id", articleId)
      .eq("user_id", user.id);

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({ success: true, linksPlan }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}

