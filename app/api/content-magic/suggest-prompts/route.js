import { NextResponse } from "next/server";
import { initMonkey } from "@/libs/monkey";
import { createClient } from "@/libs/supabase/server";
import { finishExternalRequest } from "@/libs/monkey/tools/external_requests";
import { extractOutlineFromHtml } from "@/libs/content-magic/article-refinement/utils.js";

export async function POST(request) {
  const externalRequestId = request.headers.get("x-external-request-id") ?? null;
  const startTime = Date.now();
  const supabase = await createClient();
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = await request.json();
    
    const { articleId, icp, outlineTopics, keywords } = body;

    // Extract outlineTopics from HTML if not provided
    let finalOutlineTopics = outlineTopics;
    if ((!finalOutlineTopics || finalOutlineTopics.length === 0) && articleId) {
      const { data: article, error: articleError } = await supabase
        .from("content_magic_articles")
        .select("content_html, assets")
        .eq("id", articleId)
        .eq("user_id", user.id)
        .single();

      if (articleError || !article) {
        return NextResponse.json(
          { error: "Article not found or could not extract outline" },
          { status: 404 }
        );
      }

      // Try to get from assets first
      if (article.assets?.outlineSections) {
        finalOutlineTopics = article.assets.outlineSections.map(s => ({
          key: s.key,
          title: s.title,
        }));
      } else if (article.content_html) {
        // Extract from HTML
        const sections = extractOutlineFromHtml(article.content_html);
        finalOutlineTopics = sections.map(s => ({
          key: s.key,
          title: s.title,
        }));
      }
    }

    if (!icp || !finalOutlineTopics || finalOutlineTopics.length === 0) {
      return NextResponse.json(
        { error: "ICP and outlineTopics are required" },
        { status: 400 }
      );
    }

    // Initialize Monkey
    const monkey = await initMonkey();
    monkey.loadUserContext({ ...(body?.user_context ?? {}), userId: user?.id });

    // Dynamically build ICP profile from all available fields
    const icpFields = Object.entries(icp)
      .filter(([key, value]) => {
        // Skip system fields and empty values
        return value && 
               typeof value === 'string' && 
               value.trim().length > 0 &&
               !['id', 'user_id', 'created_at', 'updated_at'].includes(key);
      })
      .map(([key, value]) => {
        // Convert snake_case to readable label
        const label = key
          .split('_')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');
        return { label, value };
      });

    const icpProfile = icpFields
      .map(field => `• ${field.label}: ${field.value}`)
      .join('\n');

    const topicsText = finalOutlineTopics.map((t) => `- KEY: ${t.key} | TITLE: ${t.title}`).join("\n");

    const prompt = `You are an expert content strategist specializing in audience-centric messaging. Your task is to create prompts that deeply reflect the target ICP's intent and mindset, and assign each prompt to the most relevant content section.

**CRITICAL: All prompts must be written FROM the ICP's perspective and language, addressing their specific intent and mindset.**

**Target ICP Profile:**
${icpProfile}


**Available Content Sections:**
${topicsText}

**Keywords to incorporate:**
${keywords || "No specific keywords provided"}

**Task:**
Generate 1 targeted prompt for each content section, that MUST:
1. Reflect the exact intent and mindset of the ICP as described above
2. Use language that resonates with how this ICP thinks and communicates
3. Address their specific goals, pain points, and perspectives
4. Be written as if speaking directly to this ICP's concerns
5. Naturally incorporate the provided keywords without forcing them
6. Be concise and actionable (under 20 words per prompt)
7. Cover different aspects or angles of the ICP's intent
8. Each prompt must be assigned to the MOST RELEVANT content section from the available sections

Each prompt should feel like it was written specifically for this ICP's context, not generic content. The prompts will be used to guide AI-generated content sections.

Return ONLY a JSON array of objects with this structure:
[
  {
    "prompt": "Full prompt text here...",
    "sectionKey": "section_key_that_matches_available_sections"
  },
  {
    "prompt": "Another full prompt text...",
    "sectionKey": "section_key_that_matches_available_sections"
  }
]`;
    const response = await monkey.AI(prompt, {
      vendor: "openai",
      model: "gpt-4o",
      forceJson: true,
    });

    let promptAssignments = [];
    try {
      if (typeof response === "string") {
        const jsonMatch = response.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          promptAssignments = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error("Could not extract JSON array from response");
        }
      } else if (Array.isArray(response)) {
        promptAssignments = response;
      } else {
        throw new Error("Response is not an array or string");
      }

      if (!Array.isArray(promptAssignments)) {
        throw new Error("Parsed response is not an array");
      }

      // Validate and ensure all items are objects with prompt and sectionKey
      // Also validate that sectionKey matches available sections
      const validSectionKeys = new Set(finalOutlineTopics.map(t => t.key));
      const validAssignments = promptAssignments.filter(
        (item) => 
          typeof item === 'object' && 
          typeof item.prompt === 'string' && 
          item.prompt.trim().length > 0 &&
          typeof item.sectionKey === 'string' &&
          item.sectionKey.trim().length > 0 &&
          validSectionKeys.has(item.sectionKey)
      );

      if (validAssignments.length === 0) {
        throw new Error("No valid prompt assignments found in response");
      }

      await finishExternalRequest(supabase, {
        externalRequestId,
        status: "success",
        responsePreview: JSON.stringify({ promptAssignments: validAssignments }),
        latencyMs: Date.now() - startTime,
      });

      return NextResponse.json({
        promptAssignments: validAssignments,
      });
    } catch (parseError) {
      await finishExternalRequest(supabase, {
        externalRequestId,
        status: "failed",
        errorMessage: parseError?.message ?? String(parseError),
        latencyMs: Date.now() - startTime,
      });
      return NextResponse.json(
        { error: "Failed to parse AI response", details: parseError.message },
        { status: 500 }
      );
    }
  } catch (error) {
    await finishExternalRequest(supabase, {
      externalRequestId,
      status: "failed",
      errorMessage: error?.message ?? String(error),
      latencyMs: Date.now() - startTime,
    });
    return NextResponse.json(
      { error: error.message || "Failed to generate prompts" },
      { status: 500 }
    );
  }
}