import { NextResponse } from "next/server";
import { createClient } from "@/libs/supabase/server";
import { initMonkey } from "@/libs/monkey";

function stripCodeFences(text = "") {
  return text.replace(/```(?:html)?/gi, "").replace(/```/g, "").trim();
}

export async function POST(request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      htmlContent = "",
      critics = [],
      articleTitle = "",
    } = body;

    if (!htmlContent || htmlContent.trim().length < 100) {
      return NextResponse.json(
        { error: "HTML content is required (minimum 100 characters)" },
        { status: 400 }
      );
    }

    if (!critics || critics.length === 0) {
      return NextResponse.json(
        { error: "Critics feedback is required" },
        { status: 400 }
      );
    }

    const monkey = await initMonkey();
    monkey.loadUserContext({ ...(body?.user_context ?? {}), userId: user?.id });

    // Format critics feedback
    const criticsText = critics
      .map((critic, idx) => {
        return `${idx + 1}. ${critic.title || "Untitled"}
${critic.guidance || critic.rationale || ""}
${critic.prompt ? `Action: ${critic.prompt}` : ""}`;
      })
      .join("\n\n");

    // Build comprehensive prompt to apply critics
    const applyPrompt = `You are a content editor applying feedback to improve HTML content while strictly retaining the HTML structure and standards from the source.

Your task: Apply the provided feedback to improve the HTML content while EXACTLY maintaining the HTML structure, tags, classes, attributes, and formatting standards from the source.

ARTICLE TITLE: ${articleTitle || "Untitled"}

CURRENT HTML CONTENT:
${htmlContent.substring(0, 15000)}

FEEDBACK TO APPLY:
${criticsText}

CRITICAL INSTRUCTIONS:
1. Review the source HTML content carefully to understand its structure, tags, classes, and formatting standards
2. RETAIN the exact HTML structure, tags, CSS classes, attributes, and formatting from the source HTML
3. Apply ONLY content improvements based on the feedback (text changes, content additions/modifications)
4. Do NOT change HTML tags, CSS classes, attributes, or structure unless the feedback explicitly requires structural changes
5. Preserve all HTML formatting standards, indentation patterns, and code style from the source
6. Maintain the same HTML tag hierarchy and nesting structure
7. Keep all CSS classes and data attributes exactly as they appear in the source
8. Only modify text content and content organization based on the feedback
9. Ensure all improvements align with the feedback provided while respecting the source HTML standards

OUTPUT REQUIREMENTS:
- Return valid HTML markup that matches the source HTML structure and standards
- Do NOT include markdown code blocks (no \`\`\`html)
- Do NOT include any explanatory text before or after the HTML
- Preserve ALL HTML tags, CSS classes, attributes, and structure from the source
- Apply content improvements based on the feedback provided
- Retain the HTML formatting standards and code style from the source
- Ensure the output is clean, valid HTML that follows the same standards as the source

Return the improved HTML code directly, maintaining the exact HTML standards from the source.`;

    const aiRaw = await monkey.AI(applyPrompt, {
      vendor: "openai",
      model: "gpt-4o",
      temperature: 0.3,
    });

    if (!aiRaw) {
      return NextResponse.json(
        { error: "Failed to generate improved HTML from AI" },
        { status: 500 }
      );
    }

    // Clean up the response - remove code fences and extra whitespace
    let improvedHtml = typeof aiRaw === "string" ? aiRaw : JSON.stringify(aiRaw);
    improvedHtml = stripCodeFences(improvedHtml);

    return NextResponse.json({
      html: improvedHtml,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
