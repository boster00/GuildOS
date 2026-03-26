// Fit article content into a template structure
import { createClient } from "@/libs/supabase/server";
import { NextResponse } from "next/server";
import { initMonkey } from "@/libs/monkey";

export async function POST(request) {
  try {
    const supabase = await createClient();
    const { data: { user } = {} } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { mode, templateCode, contentCode, articleTitle } = await request.json();

    // Validation
    if (!mode || !templateCode || !contentCode) {
      return NextResponse.json(
        { error: "mode, templateCode, and contentCode are required" },
        { status: 400 }
      );
    }

    if (mode !== "raw_html" && mode !== "elementor") {
      return NextResponse.json(
        { error: "mode must be 'raw_html' or 'elementor'" },
        { status: 400 }
      );
    }

    // Initialize Monkey
    const monkey = await initMonkey();
    monkey.loadUserContext({ ...(body?.user_context ?? {}), userId: user?.id });

    let prompt;
    let outputCode;

    if (mode === "raw_html") {
      prompt = `You are an expert at merging HTML content into existing HTML templates.

TASK:
- Keep the layout, structure, classes, containers, grid system, and styling patterns from the TEMPLATE HTML
- Replace the article/content areas in the template with the structure and content from the CONTENT HTML
- Maintain all CSS classes, IDs, and structural elements from the template
- Map article headings, sections, and paragraphs into the appropriate content containers in the template
- Do NOT invent new design elements - only adapt the content to fit the template's existing structure

TEMPLATE HTML (example page layout to use as structure):
${templateCode.substring(0, 50000)}

CONTENT HTML (article content to fit into the template):
${contentCode.substring(0, 50000)}

INSTRUCTIONS:
1. Identify the main content areas in the template (typically in <main>, <article>, <div class="content">, etc.)
2. Extract the article structure from the CONTENT HTML (headings, paragraphs, lists, etc.)
3. Replace the template's content areas with the article content while preserving:
   - Template's CSS classes and IDs
   - Template's layout structure (divs, sections, containers)
   - Template's styling hooks and responsive patterns
4. Keep template's header, footer, navigation, sidebars, and other structural elements intact
5. Only modify the article/content sections

OUTPUT REQUIREMENTS:
- Return ONLY the transformed HTML code
- No explanations, no markdown code fences
- Valid HTML that maintains the template's structure with the new content`;
    } else {
      // Elementor mode
      prompt = `You are an expert at merging Elementor JSON content into existing Elementor templates.

TASK:
- Keep the layout structure, widget configurations, sections, columns, and styling from the TEMPLATE JSON
- Replace the content-rich widgets (heading, text-editor, etc.) in the template with content from the CONTENT JSON
- Maintain all widget IDs, element structure, and Elementor-specific settings from the template
- Map article content into appropriate text widgets and heading widgets
- Do NOT change widget types or structural elements - only update content within existing widgets

TEMPLATE ELEMENTOR JSON (exported page to use as layout):
${templateCode.substring(0, 50000)}

CONTENT ELEMENTOR JSON (article content to fit into the template):
${contentCode.substring(0, 50000)}

INSTRUCTIONS:
1. Identify content widgets in the template (heading, text-editor widgets)
2. Extract article content from the CONTENT JSON (headings, paragraphs, etc.)
3. Update the template's content widgets with the article content while preserving:
   - Widget structure and types
   - Elementor settings and configurations
   - Section and column layouts
   - Non-content widgets (images, buttons, etc.)
4. Keep template's sections, containers, and layout structure intact
5. Only modify content within text-editor and heading widgets

OUTPUT REQUIREMENTS:
- Return ONLY valid Elementor JSON
- No explanations, no markdown code fences
- Valid JSON that maintains the template's structure with the new content`;
    }

    // Call AI
    const response = await monkey.AI(prompt, {
      vendor: "openai",
      model: process.env.AI_MODEL_STANDARD || "gpt-4o",
      forceJson: mode === "elementor",
    });

    // Parse and clean response
    if (mode === "elementor") {
      // For Elementor, try to extract JSON
      let jsonString = response;
      if (typeof response === 'string') {
        // Try to extract JSON from markdown code fences
        const jsonMatch = jsonString.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
        if (jsonMatch) {
          jsonString = jsonMatch[1];
        } else {
          // Try direct JSON object match
          const directMatch = jsonString.match(/(\{[\s\S]*\})/);
          if (directMatch) {
            jsonString = directMatch[1];
          }
        }
      }

      try {
        const parsed = typeof jsonString === 'string' ? JSON.parse(jsonString) : jsonString;
        outputCode = JSON.stringify(parsed, null, 2);
      } catch (parseError) {
        // Fallback: return as-is if parsing fails
        outputCode = typeof jsonString === 'string' ? jsonString : JSON.stringify(jsonString, null, 2);
      }
    } else {
      // For HTML, clean up markdown code fences if present
      outputCode = response
        .replace(/^```html\s*/i, '')
        .replace(/^```\s*/m, '')
        .replace(/\s*```\s*$/g, '')
        .trim();
    }

    return NextResponse.json({
      success: true,
      outputCode,
    }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}

