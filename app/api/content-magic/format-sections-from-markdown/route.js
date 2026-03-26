/**
 * API route for formatting markdown content into HTML templates (Step 4)
 */

import { NextResponse } from "next/server";
import { createClient } from "@/libs/supabase/server";
import { initMonkey } from "@/libs/monkey";
import { getTemplate } from "@/libs/monkey/tools/renderers/templates";
import { getOpenAIApiKey } from "@/libs/monkey/tools/runtime/providers/openai";

export async function POST(request) {
  try {
    const body = await request.json();
    const { articleId, sections } = body;

    // Authenticate user
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized", details: authError?.message },
        { status: 401 }
      );
    }

    // Get user API keys
    let userApiKeys = [];
    try {
      const { data: apiKeys } = await supabase
        .from('user_api_keys')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true);
      
      if (apiKeys && apiKeys.length > 0) {
        userApiKeys = apiKeys.map((key) => ({
          vendor: key.vendor || key.provider || 'openai',
          key: key.api_key_encrypted || key.key || '',
        }));
      }
    } catch (err) {

    }

    // Get API key for OpenAI
    const apiKey = getOpenAIApiKey(userApiKeys);

    if (!sections || !Array.isArray(sections) || sections.length === 0) {
      return NextResponse.json(
        { error: "sections array is required" },
        { status: 400 }
      );
    }

    // Initialize monkey for AI calls
    const monkey = await initMonkey();
    monkey.loadUserContext({ ...(body?.user_context ?? {}), userId: user?.id });

    const formattedSections = [];
    const isDev = process.env.NODE_ENV !== "production";

    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];
      const { sectionId, sectionTitle, formatId, variant, markdown } = section;

      if (!markdown || !formatId) {

        continue;
      }

      // Get HTML template for this format with variant if present
      // Debug logging to verify variant is being passed
      if (isDev) {

      }
      const template = getTemplate(formatId, "default", variant);
      
      // Additional debug: log first 200 chars of template to verify correct variant
      if (isDev) {
        
      }

      // Create prompt for AI to fit markdown into template
      const systemPrompt = `You are an expert at fitting markdown content into HTML templates.

Your task:
1. Take the provided markdown content
2. Convert it to appropriate HTML elements (headings, paragraphs, lists, etc.)
3. Replace placeholder text in the template with actual content from markdown
4. Maintain all CSS classes and HTML structure from the template exactly
5. Preserve semantic HTML structure
6. Return ONLY the final HTML, no explanations or markdown code blocks

CRITICAL RULES FOR CONTENT REPLACEMENT:
- The template contains actual HTML structure with placeholder text (e.g., "Section Heading", "Card Title", "Your Main Heading")
- Replace the placeholder text with actual content from markdown while keeping the HTML structure and CSS classes exactly as shown
- For headings: Replace placeholder heading text with the actual heading from markdown (convert # to h1, ## to h2, etc.)
- For paragraphs: Replace placeholder paragraph text with actual paragraph content from markdown
- For lists: Replace placeholder list items with actual list items from markdown, maintaining the list structure
- For twoColumn format: Intelligently split the markdown content into two balanced columns
  * Extract the main heading (first # or ##) and replace the heading in the template
  * Split remaining content roughly in half - first half goes to left column, second half to right column
  * Replace placeholder text in left/right columns with actual content
  * If a column doesn't have a title, remove the entire h3 element for that column
  * If a column doesn't have bullets, remove the entire ul element for that column
- For cardGrid: Create multiple card elements (duplicate the card structure) - one card per item in markdown
- For stepsTimeline: Create multiple step elements (duplicate the step structure) - one step per numbered/bulleted item
- For faqAccordion: Create multiple FAQ items (duplicate the FAQ item structure) - one item per Q&A pair
- For quoteBlock: Create multiple quote elements (duplicate the quote structure) - one per quote in markdown
- For checklistBlock: Create multiple checklist items (duplicate the checklist item structure) - one per item in markdown
- For statsStrip: Create multiple stat elements (duplicate the stat structure) - one per stat in markdown
- For table: Create multiple table rows (duplicate the tr structure) - one per row in markdown
- For formBlock: Create multiple form fields (duplicate the field structure) - one per field needed
- If markdown doesn't have content for a section, remove that entire HTML element (don't leave empty elements with placeholder text)

CONVERSION RULES:
- Convert markdown headings (#, ##, ###) to appropriate HTML heading tags (h1, h2, h3, etc.)
- Convert markdown paragraphs to <p> tags with proper classes
- Convert markdown lists (-, *, 1.) to <ul> or <ol> tags with <li> items
- Convert markdown bold (**text**) to <strong> or <b>
- Convert markdown italic (*text*) to <em> or <i>
- Maintain proper HTML structure and nesting
- Preserve all CSS classes and structure from the template exactly
- Do NOT add any wrapper elements beyond what's in the template
- Do NOT include HTML doctype, html, head, or body tags`;

      const userPrompt = `MARKDOWN CONTENT:
${markdown}

HTML TEMPLATE:
${template}

TASK: 
1. Analyze the markdown content structure
2. Identify which parts of the markdown correspond to each placeholder text in the template
3. Replace placeholder text (like "Section Heading", "Card Title", etc.) with actual content from markdown
4. For formats that need multiple items (cards, steps, FAQs, etc.), duplicate the example structure for each item
5. For twoColumn format: Split content into left and right columns intelligently (first half in left, second half in right)
6. Ensure all template structure and CSS classes are preserved exactly - only replace the text content, not the HTML structure

Return ONLY the final HTML with all placeholder text replaced with actual content, no explanations, no markdown code blocks, no additional text.`;

      // Store prompts for logging (dev mode only)
      const inputPrompt = {
        system: systemPrompt,
        user: userPrompt,
        totalSize: systemPrompt.length + userPrompt.length,
      };

      try {
        // Call AI to format content
        const formatResult = await monkey.AI(
          `${systemPrompt}\n\n${userPrompt}`,
          {
            vendor: "openai",
            model: "gpt-4o",
            temperature: 0.3,
            apiKey: apiKey,
          }
        );

        let html = typeof formatResult === "string" ? formatResult : JSON.stringify(formatResult);

        // Clean up response - remove markdown code blocks if present
        html = html
          .replace(/^```html\s*/i, '')
          .replace(/^```\s*/i, '')
          .replace(/\s*```$/i, '')
          .trim();

        // Add "default-template" class to each section element
        
        
        let sectionCount = 0;
        html = html.replace(
          /<section(\s+class=["']([^"']*)["'])?/gi,
          (match, classAttr, existingClasses) => {
            sectionCount++;

            if (classAttr) {
              // Section has existing class attribute - append default-template
              const classes = existingClasses ? existingClasses.trim() : '';
              const updatedClasses = classes ? `${classes} default-template` : 'default-template';
              const result = `<section class="${updatedClasses}"`;

              return result;
            } else {
              // Section has no class attribute - add it
              const result = '<section class="default-template"';

              return result;
            }
          }
        );
        
        

        // Validate HTML was generated
        if (!html || html.length < 50) {
          
        }

        formattedSections.push({
          sectionId: sectionId,
          sectionTitle: sectionTitle,
          formatId: formatId,
          variant: variant, // Include variant if present
          html: html,
          markdown: markdown, // Keep original markdown for reference
          // Include prompts in dev mode only
          ...(isDev && {
            logs: {
              inputPrompt: inputPrompt,
              outputResponse: {
                html: html,
                htmlLength: html.length,
              },
            },
          }),
        });

      } catch (err) {

        // Continue with other sections even if one fails
        formattedSections.push({
          sectionId: sectionId,
          sectionTitle: sectionTitle,
          formatId: formatId,
          variant: variant,
          html: `<section><p>Error formatting section: ${err.message}</p></section>`,
          markdown: markdown,
          error: err.message,
        });
      }
    }

    // Combine all sections into full HTML
    const fullHtml = formattedSections.map((section, idx) => 
      `<!-- Section ${idx + 1}: ${section.sectionTitle} -->\n${section.html}`
    ).join("\n\n");

    // Combine all prompts for dev mode (if any section has logs)
    const allPrompts = formattedSections
      .filter(s => s.logs?.inputPrompt)
      .map(s => ({
        sectionId: s.sectionId,
        sectionTitle: s.sectionTitle,
        ...s.logs.inputPrompt,
      }));

    return NextResponse.json({
      success: true,
      formattedSections: formattedSections,
      html: fullHtml,
      // Include combined prompts in dev mode
      ...(isDev && allPrompts.length > 0 && {
        _devPrompts: allPrompts,
      }),
    });

  } catch (error) {

    return NextResponse.json(
      { 
        error: error.message || "Failed to format sections from markdown",
        details: error.stack 
      },
      { status: 500 }
    );
  }
}
