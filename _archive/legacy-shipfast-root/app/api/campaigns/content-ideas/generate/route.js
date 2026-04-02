import { createClient } from "@/libs/supabase/server";
import { NextResponse } from "next/server";
import AI_MODELS from "@/config/ai-models";
import { initMonkey } from "@/libs/monkey";

export async function POST(request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { fullPrompt } = body;

    if (!fullPrompt || !fullPrompt.trim()) {
      return NextResponse.json(
        { error: "Full prompt is required" },
        { status: 400 }
      );
    }

    // Initialize monkey
    const monkey = await initMonkey();
    monkey.loadUserContext({ ...(body?.user_context ?? {}), userId: user?.id });

    const messages = [
      { role: "user", content: fullPrompt }
    ];
    // Build request body
    const model = AI_MODELS.STANDARD;
    
    // Newer models (o-series, GPT-5) use max_completion_tokens instead of max_tokens
    const isNewerModel = model.includes('o1') || model.includes('o3') || model.includes('gpt-5');
    const maxTokens = 2000;

    // Call OpenAI API through monkey
    const aiResponse = await monkey.AI(messages, {
      model,
      temperature: 0.7,
      max_tokens: isNewerModel ? null : maxTokens,
      max_completion_tokens: isNewerModel ? maxTokens : null,
    });
    

    // Extract JSON array from response
    let ideas = [];
    
    // Strategy 1: Try parsing the entire response as JSON first
    try {
      const directParse = JSON.parse(aiResponse.trim());
      if (Array.isArray(directParse)) {
        ideas = directParse;
      }
    } catch (e) {
    }
    
    // Strategy 2: Extract JSON array from markdown code blocks
    if (ideas.length === 0) {
      const jsonBlockMatch = aiResponse.match(/```(?:json)?\s*(\[[\s\S]*?\])\s*```/);
      if (jsonBlockMatch) {
        try {
          const jsonText = jsonBlockMatch[1].trim();
          const extracted = JSON.parse(jsonText);
          if (Array.isArray(extracted)) {
            ideas = extracted;
          }
        } catch (e) {
        }
      }
    }
    
    // Strategy 3: Find JSON array in the response (last resort)
    if (ideas.length === 0) {
      const arrayMatch = aiResponse.match(/\[[\s\S]*?\]/);
      if (arrayMatch) {
        try {
          const jsonText = arrayMatch[0].trim();
          const extracted = JSON.parse(jsonText);
          if (Array.isArray(extracted)) {
            ideas = extracted;
          }
        } catch (e) {
        }
      }
    }

    // Validate and enrich ideas
    if (ideas.length === 0) {
      return NextResponse.json(
        { error: "Failed to parse AI response. Please try again." },
        { status: 500 }
      );
    }

    // Enrich ideas with IDs and ensure they have required fields
    const enrichedIdeas = ideas.map((idea, index) => ({
      id: `idea-${Date.now()}-${index}`,
      title: idea.title || `Untitled Idea ${index + 1}`,
      keyword: idea.keyword || "",
      strategy: idea.strategy || "",
      whyItMatters: idea.whyItMatters || "",
      linkableFrom: idea.linkableFrom || "",
      creativeBrief: idea.creativeBrief || null,
    }));
    return NextResponse.json({ ideas: enrichedIdeas }, { status: 200 });

  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}

