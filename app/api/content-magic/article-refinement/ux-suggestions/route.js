// Generate UX optimization suggestions
import { createClient } from "@/libs/supabase/server";
import { NextResponse } from "next/server";
import monkey from "@/libs/monkey";

export async function POST(request) {
  try {
    const supabase = await createClient();
    const { data: { user } = {} } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { articleId, articleTitle, articleContent } = await request.json();

    if (!articleId) {
      return NextResponse.json(
        { error: "articleId is required" },
        { status: 400 }
      );
    }

    // For now, return placeholder suggestions
    // User will provide a list later, so we'll use a basic structure
    const prompt = `Analyze this article and suggest UX improvements including images, visual elements, and engagement opportunities.

Article Title: "${articleTitle || 'Article'}"
Article Content Preview:
${(articleContent || "").substring(0, 2000)}

Generate suggestions for:
1. Images (hero images, section images, infographics)
2. Visual elements (charts, graphs, diagrams)
3. Interactive elements (call-to-action buttons, forms)
4. Content structure improvements (break up long paragraphs, add subheadings)
5. Engagement elements (quotes, testimonials, related content)

Return JSON array:
[
  {
    "type": "Image",
    "description": "Add a hero image at the top of the article",
    "location": "Top of article",
    "priority": "high",
    "examples": ["Stock photo of topic", "Custom illustration", "Infographic"]
  }
]`;

    const response = await monkey.AI(prompt, {
      forceJson: true,
      vendor: "openai",
      model: process.env.AI_MODEL_STANDARD || "gpt-4o",
    });

    // Parse JSON
    let suggestions;
    if (typeof response === 'string') {
      const jsonMatch = response.match(/```(?:json)?\s*(\[[\s\S]*\])\s*```/);
      if (jsonMatch) {
        suggestions = JSON.parse(jsonMatch[1]);
      } else {
        const directMatch = response.match(/(\[[\s\S]*\])/);
        if (directMatch) {
          suggestions = JSON.parse(directMatch[1]);
        } else {
          suggestions = JSON.parse(response);
        }
      }
    } else {
      suggestions = Array.isArray(response) ? response : [response];
    }

    // Ensure it's an array
    if (!Array.isArray(suggestions)) {
      suggestions = [suggestions];
    }

    return NextResponse.json({ 
      success: true, 
      suggestions 
    }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}

