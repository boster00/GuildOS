import { NextResponse } from 'next/server';
import { initMonkey } from '@/libs/monkey';
import { createClient } from '@/libs/supabase/server';

/**
 * AI Edit API Route
 * Server-side endpoint for AI-powered content editing
 * Accepts user instructions and HTML, returns edited HTML
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { prompt, html, templateHtml } = body;

    if (!prompt || !html) {
      return NextResponse.json(
        { error: 'Missing required fields: prompt and html' },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // If templateHtml is provided, the prompt likely already includes it
    // So we don't need to add it again as "HTML Section"
    const isTemplateConversion = !!templateHtml;

    
    

    // Initialize monkey with user context
    const monkey = await initMonkey();
    monkey.loadUserContext({ ...(body?.user_context ?? {}), userId: user.id });

    // Build AI prompt - includes user instruction and HTML section
    // For template conversion, the prompt already includes template HTML, so we just add the section to edit
    // For regular AI edit, we add the HTML section as before
    const aiPrompt = isTemplateConversion
      ? `${prompt}

HTML Section to Edit:
${html}

IMPORTANT: Return ONLY the raw HTML code. Do NOT wrap it in markdown code blocks (no \`\`\`html or \`\`\`). Do NOT add any explanations, comments, or formatting. Return the complete HTML section exactly as it should appear, maintaining all HTML structure, CSS classes, and attributes.`
      : `${prompt}

HTML Section:
${html}

IMPORTANT: Return ONLY the raw HTML code. Do NOT wrap it in markdown code blocks (no \`\`\`html or \`\`\`). Do NOT add any explanations, comments, or formatting. Return the complete HTML section exactly as it should appear, maintaining all HTML structure, CSS classes, and attributes.`;

    // Call AI to edit the content (high tier = AI_MODEL_ADVANCED; reasoning_effort: 'high' — API supports none/low/medium/high only)

    const editedHtml = await monkey.AI(aiPrompt, {
      model: "high",
      reasoning_effort: "high",
      max_completion_tokens: 8000,
    });

    
    

    // Extract HTML from response

    let finalHtml = editedHtml.trim();

    // First, strip markdown code blocks if present (```html ... ``` or ``` ... ```)
    const codeBlockRegex = /```(?:html)?\s*([\s\S]*?)```/;
    const codeBlockMatch = finalHtml.match(codeBlockRegex);
    if (codeBlockMatch && codeBlockMatch[1]) {

      finalHtml = codeBlockMatch[1].trim();

    } else {

    }
    
    // Helper function to extract complete HTML element (handles nested elements properly)
    const extractCompleteElement = (html, tagName) => {
      const openTagRegex = new RegExp(`<${tagName}[^>]*>`, 'i');
      const openMatch = html.match(openTagRegex);
      if (!openMatch) {

        return null;
      }
      
      const startIndex = openMatch.index;
      let depth = 0;
      let i = startIndex + openMatch[0].length; // Start after the opening tag
      
      // Find the matching closing tag by tracking depth
      while (i < html.length) {
        const remaining = html.substring(i);
        const openTagMatch = remaining.match(new RegExp(`<${tagName}[^>]*>`, 'i'));
        const closeTagMatch = remaining.match(new RegExp(`</${tagName}>`, 'i'));
        
        if (!closeTagMatch) {

          break; // No closing tag found
        }
        
        const openIndex = openTagMatch ? openTagMatch.index : Infinity;
        const closeIndex = closeTagMatch.index;
        
        if (openIndex < closeIndex) {
          // Found another opening tag before closing
          depth++;
          i += openIndex + openTagMatch[0].length;
        } else {
          // Found closing tag
          if (depth === 0) {
            // This is the matching closing tag
            const endIndex = i + closeIndex + closeTagMatch[0].length;
            const extracted = html.substring(startIndex, endIndex);

            return extracted;
          }
          depth--;
          i += closeIndex + closeTagMatch[0].length;
        }
      }

      return null;
    };
    
    // Try to extract section tag (most common case)
    const sectionElement = extractCompleteElement(finalHtml, 'section');
    if (sectionElement) {

      finalHtml = sectionElement;

    } else {

      // Try div, article, main, header, footer in order
      const blockTags = ['div', 'article', 'main', 'header', 'footer'];
      let extracted = null;
      for (const tag of blockTags) {
        extracted = extractCompleteElement(finalHtml, tag);
        if (extracted) {

          finalHtml = extracted;

          break;
        }
      }
      
      if (!extracted) {

        // Fallback: if it starts with < and ends with >, use it as-is
        if (finalHtml.startsWith('<') && finalHtml.endsWith('>')) {
          
        } else {

          
          
        }
      }
    }

    
    

    return NextResponse.json({
      success: true,
      html: finalHtml
    });

  } catch (error) {

    return NextResponse.json(
      { error: error.message || 'AI Edit failed' },
      { status: 500 }
    );
  }
}
