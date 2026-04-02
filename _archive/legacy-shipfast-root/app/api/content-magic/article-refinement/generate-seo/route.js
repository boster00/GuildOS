// Generate SEO Title, Meta Description, and URL
import { createClient } from "@/libs/supabase/server";
import { NextResponse } from "next/server";
import monkey from "@/libs/monkey";

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
    const { data: { user } = {} } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { articleId, articleTitle, articleContent, primaryKeyword } = await request.json();

    if (!articleId) {
      return NextResponse.json(
        { error: "articleId is required" },
        { status: 400 }
      );
    }

    // Fetch article and ICP from context
    const { data: article } = await supabase
      .from("content_magic_articles")
      .select("context, title")
      .eq("id", articleId)
      .eq("user_id", user.id)
      .single();

    let icpName = "target audience";
    const icpId = article?.context?.icpId;
    if (icpId) {
      const { data: icp } = await supabase
        .from("icps")
        .select("name")
        .eq("id", icpId)
        .eq("user_id", user.id)
        .single();
      if (icp?.name) {
        icpName = icp.name;
      }
    }

    const prompt = `Generate optimized SEO metadata for this article.

Article Title: "${articleTitle || article?.title || 'Article'}"
Primary Keyword: "${primaryKeyword || articleTitle || 'article topic'}"
Target Audience: ${icpName}

Article Content Preview:
${(articleContent || "").substring(0, 1000)}

Generate:
1. SEO Title (50-60 characters, include primary keyword, compelling and click-worthy)
2. Meta Description (150-160 characters, include primary keyword, compelling summary with CTA)
3. URL Slug (lowercase, hyphens, SEO-friendly, include primary keyword)

Return JSON:
{
  "title": "SEO-optimized title here",
  "metaDescription": "Meta description here",
  "urlSlug": "url-slug-here"
}`;

    const response = await monkey.AI(prompt, {
      forceJson: true,
      vendor: "openai",
      model: process.env.AI_MODEL_STANDARD || "gpt-4o",
    });

    // Parse JSON
    let seoMetadata;
    if (typeof response === 'string') {
      const jsonMatch = response.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
      if (jsonMatch) {
        seoMetadata = JSON.parse(jsonMatch[1]);
      } else {
        const directMatch = response.match(/(\{[\s\S]*\})/);
        if (directMatch) {
          seoMetadata = JSON.parse(directMatch[1]);
        } else {
          seoMetadata = JSON.parse(response);
        }
      }
    } else {
      seoMetadata = response;
    }

    // Ensure all fields exist
    seoMetadata = {
      title: seoMetadata.title || articleTitle || "",
      metaDescription: seoMetadata.metaDescription || seoMetadata.meta_description || "",
      urlSlug: seoMetadata.urlSlug || seoMetadata.url_slug || "",
    };

    return NextResponse.json({ 
      success: true, 
      seoMetadata 
    }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}
*/

