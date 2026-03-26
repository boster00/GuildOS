import { NextResponse } from "next/server";
import { createClient } from "@/libs/supabase/server";
import { initMonkey } from "@/libs/monkey";
import { finishExternalRequest } from "@/libs/monkey/tools/external_requests";

/**
 * Strip HTML tags for text analysis
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
 * Extract headings from HTML
 */
function extractHeadings(html) {
  if (!html) return [];
  
  const headingRegex = /<h([1-6])[^>]*>(.*?)<\/h\1>/gi;
  const headings = [];
  let match;
  
  while ((match = headingRegex.exec(html)) !== null) {
    const level = parseInt(match[1]);
    const text = stripHtml(match[2]);
    if (text) {
      headings.push({ level, text });
    }
  }
  
  return headings;
}

/**
 * POST /api/content-magic/prompts/suggest-implementation
 * Provides instructional guidance for implementing a prompt (answering a reader question)
 */
export async function POST(request) {
  const externalRequestId = request.headers.get("x-external-request-id") ?? null;
  const startTime = Date.now();
  const supabase = await createClient();
  try {
    const body = await request.json();
    const monkey = await initMonkey();
    monkey.loadUserContext(body?.user_context ?? {});
    const { promptId, prompt = {}, article = {} } = body;
    const articleHtml = article.content_html || article.content || "";
    const articleText = stripHtml(articleHtml);
    const headings = extractHeadings(articleHtml);
    const headingsList = headings.map(h => `${'#'.repeat(h.level)} ${h.text}`).join('\n');

    const aiPrompt = `You are a content implementation assistant. Provide clear, actionable instructions for answering this reader question.

PROMPT (READER QUESTION): "${prompt.text || prompt.prompt}"

${prompt.reason && typeof prompt.reason === 'string' ? `REASON: "${prompt.reason.substring(0, 400)}..."` : ''}

${prompt.intentType && typeof prompt.intentType === 'string' ? `INTENT TYPE: ${prompt.intentType}` : ''}

CURRENT ARTICLE (first 4000 chars):
${articleText.substring(0, 4000)}${articleText.length > 4000 ? '...' : ''}

ARTICLE STRUCTURE:
${headingsList || 'No clear sections detected'}

TASK: Tell the user WHERE and HOW to answer this reader question. Be instructional, not prescriptive.

DO NOT generate the actual answer text. Provide guidance for where to place the answer and how to structure it.

CRITICAL: Augment existing sections as much as possible. Only in rare occasions when the answer genuinely cannot fit under any existing heading should you recommend a new section. Prefer "insert" or "replace" into an existing section even when it requires some stretching—readers benefit from a tighter article structure.

Specify:

1. **WHERE to answer:**
   - PREFERRED: Cite an existing H2 or H3 heading (provide exact heading text)
   - OR cite a unique nearby sentence (20-40 words) from the article
   - RARELY: Recommend creating a new section ONLY when the answer cannot reasonably fit under any existing section (MUST specify both title AND which section to place it after)

2. **HOW to answer:**
   - "insert": Add new content to existing section (PREFERRED)
   - "replace": Replace or expand existing mention (PREFERRED)
   - "new_section": Create a dedicated new section (use RARELY—only when no existing section can accommodate the answer)

3. **FORMAT suggestion** (pick most fitting):
   
   Free form:
   - text: Header + paragraph/list, full width (default for general content)
   - paragraph_card: Header + text on one side, decorative card on other (visual emphasis)
   
   Organized form:
   - cards: Row of cards for features/products/stats (graphic, simple parallel points)
   - table: Comparison/pricing/specs table (comparing attributes)
   - list: Simple or compound list with headers (steps/protocol/timeline/FAQs - abstract points)
   
   Default to "text" if no clear fit.

4. **DEPTH:**
   - brief: 1-2 sentences, quick acknowledgement
   - explanatory: 2-3 paragraphs, clear explanation

5. **INSTRUCTIONS:**
   Write 2-4 clear sentences telling the user:
   - What specific aspects of the question to address
   - How to structure the answer
   - What information to include
   
   Focus on WHAT to cover, not exact wording.

RULES:
- Be specific about placement (cite exact headings or quotes)
- Keep instructions actionable and clear
- Don't write the answer - guide the user to write it
- Match the article's apparent purpose and audience
- FAQ format works well for direct questions
- Default to augmenting an existing section; use new_section only when the answer truly cannot fit anywhere

OUTPUT STRICT JSON (no markdown, no code fences):

DEFAULT (prefer augmenting existing sections):
{
  "suggestion": {
    "promptId": "${promptId}",
    "where": {
      "location": "existing_section",
      "targetHeading": "Exact H2 or H3 heading text"
    },
    "how": "insert",
    "format": "text",
    "depth": "explanatory",
    "instructions": "Add a Q&A subsection addressing this question. Include 2-3 sentences explaining the key points readers need to know."
  }
}

RARELY (new section only when answer cannot fit under existing headings):
{
  "suggestion": {
    "promptId": "${promptId}",
    "where": {
      "location": "new_section",
      "newSectionTitle": "Common Questions",
      "afterHeading": "Pricing"
    },
    "how": "new_section",
    "format": "list",
    "depth": "explanatory",
    "instructions": "Create a new H2 section titled 'Common Questions' after the 'Pricing' section. Answer this question in Q&A format with 2-3 paragraphs of clear explanation."
  }
}

IMPORTANT: If location is "new_section", you MUST provide the "afterHeading" field to specify where to place the new section.`;

    const response = await monkey.AI(aiPrompt, {
      vendor: "openai",
      model: "gpt-4o",
      forceJson: true,
    });

    let suggestion = null;
    
    try {
      const parsed = JSON.parse(response.trim());
      suggestion = parsed.suggestion || parsed;
      
      // Ensure promptId is set
      if (suggestion && !suggestion.promptId) {
        suggestion.promptId = promptId;
      }
      
      // Validate required fields
      if (!suggestion || !suggestion.where || !suggestion.how || !suggestion.instructions) {
        throw new Error("Invalid suggestion format");
      }
    } catch (parseError) {
      // Fallback suggestion
      suggestion = {
        promptId,
        where: {
          location: "existing_section",
          targetHeading: headings.length > 0 ? headings[0].text : "Introduction"
        },
        how: "insert",
        format: "text",
        depth: "brief",
        instructions: `Add 2-3 sentences answering "${prompt.text}" to help readers understand this question. Consider what information they need and address it clearly.`
      };
    }
    await finishExternalRequest(supabase, {
      externalRequestId,
      status: "success",
      responsePreview: JSON.stringify({ suggestion }),
      latencyMs: Date.now() - startTime,
    });

    return NextResponse.json({
      suggestion,
    });
  } catch (error) {
    await finishExternalRequest(supabase, {
      externalRequestId,
      status: "failed",
      errorMessage: error?.message ?? String(error),
      latencyMs: Date.now() - startTime,
    });
    return NextResponse.json(
      { error: error.message || "Failed to suggest implementation" },
      { status: 500 }
    );
  }
}
