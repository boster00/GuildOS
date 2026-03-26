import { NextResponse } from "next/server";
import { importHtmlToCanonicalMdCj } from "@/libs/content-magic/importers/html-to-canonical-md-cj";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkHtml from "remark-html";
import remarkGfm from "remark-gfm";
import { initMonkey } from "@/libs/monkey";

/**
 * Convert processed HTML (with CJSlug placeholders) to HTML for editor
 * For CJ method, we just return the HTML as-is since it's already HTML with placeholders
 */
async function convertCjHtmlToEditorHtml(html) {
  // The CJ method produces HTML with |CJSlug| placeholders
  // For now, return as-is. In the future, we might want to convert
  // the placeholders to actual HTML elements or keep them as-is
  return html;
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { html, useAIForPlainText } = body;

    if (!html || typeof html !== "string") {
      return NextResponse.json(
        { error: "Content is required" },
        { status: 400 }
      );
    }

    let contentHtml;

    // If this is plain text and user requested AI processing
    if (useAIForPlainText) {
      try {
        const monkey = await initMonkey();
        monkey.loadUserContext(body?.user_context ?? {});

        const prompt = `You are an expert at converting plain text content into clean, structured HTML.

Task: Convert the following plain text into semantic HTML suitable for a content editor.

Requirements:
1. Preserve all content - do not summarize or remove information
2. Structure the content using proper HTML headings (h1, h2, h3, h4) where appropriate
3. Convert paragraphs (separated by blank lines) into <p> tags
4. Convert numbered lists into <ol><li> tags
5. Convert bullet lists into <ul><li> tags
6. Preserve links if present in format [text](url) as <a> tags
7. Use semantic HTML only - no inline styles or classes
8. Ensure valid, well-formed HTML

Plain text content:
${html}

Return ONLY the clean HTML, no explanations or markdown code fences:`;

        const aiResponse = await monkey.AI(prompt, {
          vendor: "openai",
          model: "gpt-4o",
          forceJson: false,
        });

        // Clean up response (remove markdown code fences if present)
        let cleanedHtml = aiResponse.trim();
        cleanedHtml = cleanedHtml.replace(/^```html\s*/i, '');
        cleanedHtml = cleanedHtml.replace(/^```\s*/m, '');
        cleanedHtml = cleanedHtml.replace(/\s*```\s*$/g, '');

        // Now process the AI-generated HTML through the CJ test method converter
        const importResult = await importHtmlToCanonicalMdCj(cleanedHtml, {
          useLLMFallback: false,
          confidenceThreshold: 0.7,
        });

        // Convert to HTML for editor (with placeholders)
        contentHtml = await convertCjHtmlToEditorHtml(importResult.markdown);
      } catch (aiError) {
        // Fallback to simple paragraph conversion
        contentHtml = `<p>${html.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>')}</p>`;
      }
    } else {
      // Normal HTML processing path using CJ test method
      const importResult = await importHtmlToCanonicalMdCj(html, {
        useLLMFallback: false,
        confidenceThreshold: 0.7,
      });

      // Convert to HTML for editor (with placeholders)
      contentHtml = await convertCjHtmlToEditorHtml(importResult.markdown);
    }

    return NextResponse.json({
      content_html: contentHtml,
      usedAI: useAIForPlainText || false,
      method: "cj-test", // Indicate this used CJ test method
    }, { status: 200 });

  } catch (error) {
    
    return NextResponse.json(
      { error: error.message || "Failed to import content" },
      { status: 500 }
    );
  }
}
