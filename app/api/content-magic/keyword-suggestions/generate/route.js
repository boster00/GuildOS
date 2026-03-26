import { NextResponse } from "next/server";
import { initMonkey } from "@/libs/monkey";
import { createClient } from "@/libs/supabase/server";
import { finishExternalRequest } from "@/libs/monkey/tools/external_requests";
import { AI_MODELS } from "@/config/ai-models";

/**
 * Strip HTML tags from text
 */
function stripHtml(html) {
  if (!html) return '';
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extract article structure: sections and blocks
 */
function extractArticleStructure(html) {
  const sections = [];
  const blocks = [];
  
  // Parse HTML
  const tempDiv = typeof document !== 'undefined' 
    ? document.createElement('div') 
    : { innerHTML: html };
  
  if (typeof document !== 'undefined') {
    tempDiv.innerHTML = html;
    
    let currentSection = { title: "Introduction", blocks: [] };
    let blockIndex = 0;
    
    // Find all block-level elements
    const elements = tempDiv.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li');
    
    elements.forEach((el, idx) => {
      const tagName = el.tagName.toLowerCase();
      const text = (el.textContent || '').trim();
      const blockId = el.getAttribute('data-block-id') || `block-${idx}`;
      
      // Ensure block has ID
      el.setAttribute('data-block-id', blockId);
      
      if (tagName.match(/^h[1-6]$/)) {
        // Heading - start new section
        if (currentSection.blocks.length > 0) {
          sections.push(currentSection);
        }
        currentSection = {
          title: text,
          blocks: [],
          startBlock: blockIndex,
        };
      } else {
        // Regular block
        const block = {
          id: blockId,
          type: tagName,
          text: text,
          sectionTitle: currentSection.title,
          index: blockIndex,
        };
        blocks.push(block);
        currentSection.blocks.push(block);
        blockIndex++;
      }
    });
    
    // Add last section
    if (currentSection.blocks.length > 0) {
      sections.push(currentSection);
    }
  }
  
  return { sections, blocks };
}

/**
 * Generate keyword placement suggestions with structure awareness
 */
export async function POST(request) {
  const externalRequestId = request.headers.get("x-external-request-id") ?? null;
  const startTime = Date.now();
  const supabase = await createClient();
  try {
    const body = await request.json();
    const { articleHtml, structure, keywords, spacingMode = "natural" } = body;
    
    if (!articleHtml || !keywords || keywords.length === 0) {
      return NextResponse.json(
        { error: "articleHtml and keywords are required" },
        { status: 400 }
      );
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const monkey = await initMonkey();
    monkey.loadUserContext({ ...(body?.user_context ?? {}), userId: user.id });

    // Extract structure if not provided
    const articleStructure = structure || extractArticleStructure(articleHtml);
    
    // Build structure description for AI
    const structureDesc = articleStructure.sections
      ? articleStructure.sections.map((sec, idx) => 
          `Section ${idx + 1}: "${sec.title}" (${sec.blocks.length} blocks)`
        ).join('\n')
      : "Structure information not available";
    
    // Build keywords list for combined query
    const keywordsList = keywords.map((kw, idx) => {
      const keywordText = kw.keyword_text || kw.keyword;
      const requiredAdditions = kw.requiredAdditions || 3;
      return `${idx + 1}. "${keywordText}" (need ${Math.min(requiredAdditions, 3)} placements, keywordId: "${kw.id}")`;
    }).join('\n');
    
    // SINGLE COMBINED PROMPT for all keywords - based on proven batch implementation
    const prompt = `You are a professional content editor helping naturally integrate ${keywords.length} keywords into an article.

ARTICLE STRUCTURE:
${structureDesc}

FULL ARTICLE HTML:
${articleHtml}

KEYWORDS TO PLACE:
${keywordsList}

TASK: Generate natural placements for ALL keywords above in ONE response.

CRITICAL REQUIREMENTS:
1. Work with PLAIN TEXT only - never include HTML tags in "from" or "to"
2. "from" = plain text snippet from article (extract from HTML, ignore tags)
3. "to" = same plain text with keyword naturally integrated
4. Each "from" must appear EXACTLY ONCE in article text
5. Prefer REPLACEMENT over insertion (sounds more natural)
6. Keep changes minimal - only add keyword where it fits
7. When the "from" text is inside a header (h1, h2, h3, or h4), keep the "to" header short; long headers break the design.

SPACING RULES (mode: ${spacingMode}):
- SAME keyword: NO same-sentence, avoid same paragraph, prefer different sections
- DIFFERENT keywords: CAN be in same section/paragraph
- If 3+ placements for same keyword: spread across different sections (beginning/middle/end)

VERIFICATION CHECKLIST (must check EACH suggestion):
✓ Is "from" plain text without HTML tags?
✓ Is "to" plain text without HTML tags?
✓ Does "from" appear in article (case-sensitive)?
✓ Does "from" NOT already contain the keyword?
✓ **CRITICAL**: Check 10-15 words BEFORE and AFTER "from" location - keyword must NOT already exist there
✓ Does "to" read naturally with proper grammar?
✓ For same keyword: Are placements 2-3+ paragraphs apart in different sections?

OUTPUT FORMAT (JSON only, no markdown):
{
  "keyword text 1": [
    {
      "from": "plain text from article (50-150 chars)",
      "to": "plain text with keyword integrated"
    }
  ],
  "keyword text 2": [
    {
      "from": "plain text from article (50-150 chars)",
      "to": "plain text with keyword integrated"
    }
  ]
}

EXAMPLES:

✅ CORRECT Replacement:
Article HTML: "<p>We provide comprehensive testing solutions for researchers.</p>"
Keyword: "ELISA services"
Output: {
  "ELISA services": [
    {"from": "testing solutions", "to": "ELISA services"}
  ]
}

✅ CORRECT Well-spaced (same keyword, 3 placements):
{
  "ELISA services": [
    {"from": "testing solutions in introduction", "to": "ELISA services in introduction"},
    {"from": "laboratory analysis in middle section", "to": "ELISA services laboratory analysis"},
    {"from": "research tools in conclusion", "to": "ELISA services research tools"}
  ]
}

❌ WRONG - Contains HTML:
{"from": "<p>testing solutions</p>", "to": "<p>ELISA services</p>"}

❌ WRONG - Crosses HTML boundaries:
{"from": "text</p><p>more text", "to": "..."}

❌ WRONG - Keyword already in "from":
{"from": "ELISA services available", "to": "ELISA services widely available"}

❌ WRONG - Keyword already in context:
Article: "...reliable custom peptide synthesis services..."
Keyword: "custom peptide synthesis"
{"from": "reliable", "to": "reliable custom peptide synthesis"}
(WRONG: keyword already appears right after "reliable")

❌ WRONG - Too close (same keyword):
All 3 suggestions in adjacent paragraphs of same section

Process ALL ${keywords.length} keywords. Return ONLY valid JSON, no explanations, no markdown.`;

    try {
      const response = await monkey.AI(prompt, {
        vendor: "openai",
        model: AI_MODELS.ADVANCED,
        forceJson: true,
      });
      
      let parsedResponse = {};
      try {
        parsedResponse = JSON.parse(response);
        if (typeof parsedResponse !== 'object' || Array.isArray(parsedResponse)) {
          parsedResponse = {};
        }
      } catch (e) {
      }
      
      
      
      // Transform to format expected by frontend
      // Input: { "keyword": [{ from, to }] }
      // Output: { "keyword": [{ id, fromText, toText, keywordText }] }
      const suggestions = {};
      
      keywords.forEach(kw => {
        const keywordText = kw.keyword_text || kw.keyword;
        const rawSuggestions = parsedResponse[keywordText] || [];
        
        if (Array.isArray(rawSuggestions) && rawSuggestions.length > 0) {
          suggestions[keywordText] = rawSuggestions.map((sug, idx) => ({
            id: `${kw.id}-${idx}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            fromText: sug.from || "",
            toText: sug.to || "",
            keywordText: keywordText
          }));
        } else {
          // No suggestions for this keyword
          suggestions[keywordText] = [];
        }
      });
      
      await finishExternalRequest(supabase, {
        externalRequestId,
        status: "success",
        responsePreview: JSON.stringify({ suggestions }),
        latencyMs: Date.now() - startTime,
      });

      return NextResponse.json({
        suggestions,
        structure: articleStructure,
      });
    } catch (error) {
      await finishExternalRequest(supabase, {
        externalRequestId,
        status: "failed",
        errorMessage: error?.message ?? String(error),
        latencyMs: Date.now() - startTime,
      });
      return NextResponse.json(
        { error: error.message || "Failed to generate suggestions from AI" },
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
      { error: error.message || "Failed to generate suggestions" },
      { status: 500 }
    );
  }
}
