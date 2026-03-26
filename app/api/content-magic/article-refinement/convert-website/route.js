// Convert article to website formats (HTML, Elementor)
import { createClient } from "@/libs/supabase/server";
import { NextResponse } from "next/server";
import { initMonkey } from "@/libs/monkey";

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

    const { articleId, format, articleTitle, articleContent } = await request.json();

    if (!articleId || !format) {
      return NextResponse.json(
        { error: "articleId and format are required" },
        { status: 400 }
      );
    }

    let convertedContent;

    if (format === "raw_html") {
      // Clean and format HTML
      // Remove TinyMCE-specific classes and attributes
      let html = articleContent || "";
      
      // Basic HTML cleaning
      html = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '') // Remove scripts
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '') // Remove styles
        .replace(/data-mce-[^=]*="[^"]*"/gi, '') // Remove TinyMCE data attributes
        .replace(/class="mce[^"]*"/gi, '') // Remove TinyMCE classes
        .replace(/\s+/g, ' ') // Normalize whitespace
        .trim();

      // Wrap in proper HTML structure if needed
      if (!html.includes('<html')) {
        convertedContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${articleTitle || "Article"}</title>
</head>
<body>
    <article>
        <h1>${articleTitle || "Article"}</h1>
        ${html}
    </article>
</body>
</html>`;
      } else {
        convertedContent = html;
      }

    } else if (format === "elementor") {
      // Convert to Elementor JSON format
      const prompt = `Convert this article into an Elementor-compatible JSON structure.

Article Title: "${articleTitle || "Article"}"

Article Content (HTML):
${(articleContent || "").substring(0, 5000)}

Create an Elementor page structure with:
- A heading widget for the title
- Text/HTML widgets for content sections
- Proper Elementor widget structure

Return JSON in this format:
{
  "version": "0.4",
  "title": "Article Title",
  "type": "wp-page",
  "elements": [
    {
      "id": "heading-widget-id",
      "elType": "widget",
      "widgetType": "heading",
      "settings": {
        "title": "Article Title"
      }
    },
    {
      "id": "text-widget-id",
      "elType": "widget",
      "widgetType": "text-editor",
      "settings": {
        "editor": "Article content HTML here"
      }
    }
  ]
}

Focus on creating a clean, importable Elementor structure.`;

      const monkey = await initMonkey();
      const response = await monkey.AI(prompt, {
        forceJson: true,
        vendor: "openai",
        model: process.env.AI_MODEL_STANDARD || "gpt-4o",
      });

      // Parse JSON
      if (typeof response === 'string') {
        const jsonMatch = response.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
        if (jsonMatch) {
          convertedContent = JSON.parse(jsonMatch[1]);
        } else {
          const directMatch = response.match(/(\{[\s\S]*\})/);
          if (directMatch) {
            convertedContent = JSON.parse(directMatch[1]);
          } else {
            convertedContent = JSON.parse(response);
          }
        }
      } else {
        convertedContent = response;
      }

      // Ensure it's a valid Elementor structure
      if (!convertedContent.elements) {
        convertedContent = {
          version: "0.4",
          title: articleTitle || "Article",
          type: "wp-page",
          elements: [
            {
              id: "heading-1",
              elType: "widget",
              widgetType: "heading",
              settings: {
                title: articleTitle || "Article",
              },
            },
            {
              id: "text-1",
              elType: "widget",
              widgetType: "text-editor",
              settings: {
                editor: articleContent || "",
              },
            },
          ],
        };
      }

      convertedContent = JSON.stringify(convertedContent, null, 2);
    } else {
      return NextResponse.json(
        { error: "Invalid format. Use 'raw_html' or 'elementor'" },
        { status: 400 }
      );
    }

    return NextResponse.json({ 
      convertedContent 
    }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}
*/

