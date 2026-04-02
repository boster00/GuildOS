import { NextResponse } from "next/server";
import { initMonkey } from "@/libs/monkey";
import { createClient } from "@/libs/supabase/server";

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
    const { articleId, sectionKey, section, prompt, previousResponse, feedback } = body;

    if (!articleId || !sectionKey || !section || !prompt) {
      return NextResponse.json(
        { error: "articleId, sectionKey, section, and prompt are required" },
        { status: 400 }
      );
    }

    // Validate sectionKey format (support both legacy and new formats)
    // Legacy: section_0, section_1, etc.
    // New: section_meaningful_name
    const isValidKey = /^section_[\w_]+$/.test(sectionKey);
    if (!isValidKey) {
    }

    // Fetch article from database
    const { data: article, error: articleError } = await supabase
      .from("content_magic_articles")
      .select("*")
      .eq("id", articleId)
      .eq("user_id", user.id)
      .single();
    if (articleError || !article) {
      return NextResponse.json(
        { error: articleError?.message || "Article not found" },
        { status: 404 }
      );
    }

    // Get ICP ID from article context
    const icpId = article.context?.icpId;
    
    let icpProfile = "";
    if (icpId) {
      // Fetch ICP details
      const { data: icp, error: icpError } = await supabase
        .from("icps")
        .select("*")
        .eq("id", icpId)
        .eq("user_id", user.id)
        .single();

      if (!icpError && icp) {
        // Dynamically build ICP profile from all available fields
        const icpFields = Object.entries(icp)
          .filter(([key, value]) => {
            return value && 
                   typeof value === 'string' && 
                   value.trim().length > 0 &&
                   !['id', 'user_id', 'created_at', 'updated_at'].includes(key);
          })
          .map(([key, value]) => {
            const label = key
              .split('_')
              .map(word => word.charAt(0).toUpperCase() + word.slice(1))
              .join(' ');
            return `• ${label}: ${value}`;
          });
        
        icpProfile = icpFields.join('\n');
      }
    }


    // Initialize Monkey for AI calls
    const monkey = await initMonkey();
    monkey.loadUserContext({ ...(body?.user_context ?? {}), userId: user?.id });

    // Build enhanced prompt with context
    let promptWithContext = `${prompt}

${icpProfile ? `**ICP Profile Context:**\n${icpProfile}\n` : ''}


**Output Requirements:**
- Generate valid, semantic HTML markup
- Use appropriate HTML tags (p, ul, li, h3, h4, etc.)
- Ensure the HTML is properly formatted and indented
- Do NOT include HTML doctype, html, head, or body tags
- Do NOT include markdown - use HTML only
- Make the content engaging and professional
- Unless user otherwise specifies, write 100-200 words for paragraph format, and similar length for other formats`;

    // Add feedback context if provided
    if (previousResponse && feedback) {
      promptWithContext += `

**Previous Response (for reference):**
${previousResponse}

**Feedback on previous response:**
${feedback}

Please regenerate the content incorporating this feedback while maintaining the same purpose, format, and guidelines.`;
    }
    // Call AI to generate content
    const response = await monkey.AI(promptWithContext, {
      vendor: "openai",
      model: "gpt-4o",
      temperature: 0.7,
    });

    if (!response) {
      return NextResponse.json(
        { error: "Failed to generate content from AI" },
        { status: 500 }
      );
    }

    // Clean up the response - ensure it's HTML
    let generatedContent = typeof response === "string" ? response : JSON.stringify(response);

    // Remove markdown code block markers if present
    generatedContent = generatedContent
      .replace(/^```html\s*/i, '') // Remove opening ```html
      .replace(/^```\s*/i, '') // Remove opening ```
      .replace(/\s*```$/i, ''); // Remove closing ```

    // Ensure the generated content preserves section key if it's a heading
    // If the first element is a heading, add data-section-key attribute
    const headingMatch = generatedContent.match(/^<(h[1-6])([^>]*)>/i);
    if (headingMatch && !headingMatch[2].includes('data-section-key')) {
      const headingTag = headingMatch[1];
      const attrs = headingMatch[2] || '';
      const newAttrs = attrs.trim() 
        ? `${attrs.trim()} data-section-key="${sectionKey}"`
        : `data-section-key="${sectionKey}"`;
      generatedContent = generatedContent.replace(
        /^<(h[1-6])([^>]*)>/i,
        `<${headingTag} ${newAttrs}>`
      );
    }

    return NextResponse.json({ 
      content: generatedContent,
      sectionKey: sectionKey,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Failed to generate section content" },
      { status: 500 }
    );
  }
}