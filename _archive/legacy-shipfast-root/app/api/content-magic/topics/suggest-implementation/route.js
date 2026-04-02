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
 * POST /api/content-magic/topics/suggest-implementation
 * Provides instructional guidance for implementing a topic (not actual content text)
 */
export async function POST(request) {
  const externalRequestId = request.headers.get("x-external-request-id") ?? null;
  const startTime = Date.now();
  const supabase = await createClient();
  try {
    const body = await request.json();
    const monkey = await initMonkey();
    monkey.loadUserContext(body?.user_context ?? {});
    const { topicId, topic = {}, article = {} } = body;
    const articleHtml = article.content_html || article.content || "";
    const articleText = stripHtml(articleHtml);
    const headings = extractHeadings(articleHtml);
    const headingsList = headings.map(h => `${'#'.repeat(h.level)} ${h.text}`).join('\n');

    const prompt = `You are a content implementation assistant. Provide clear, actionable instructions for covering this topic.

TOPIC: "${topic.label || topic.topic}"

${topic.exampleText && typeof topic.exampleText === 'string' ? `EXAMPLE FROM COMPETITORS:\n"${topic.exampleText.substring(0, 400)}..."` : ''}

${topic.strategy && typeof topic.strategy === 'string' ? `STRATEGY INSIGHT:\n"${topic.strategy.substring(0, 400)}..."` : ''}

CURRENT ARTICLE (first 4000 chars):
${articleText.substring(0, 4000)}${articleText.length > 4000 ? '...' : ''}

ARTICLE STRUCTURE:
${headingsList || 'No clear sections detected'}

TASK: Tell the user WHERE and HOW to implement this topic. Be instructional, not prescriptive.

DO NOT generate the actual content text. Provide guidance for what to cover and where to place it.

CRITICAL: Augment existing sections as much as possible. Only in rare occasions when the topic genuinely cannot fit under any existing heading should you recommend a new section. Prefer "insert" or "replace" into an existing section even when it requires some stretching—readers benefit from a tighter article structure.

Specify:

1. **WHERE to implement:**
   - PREFERRED: Cite an existing H2 or H3 heading (provide exact heading text)
   - OR cite a unique nearby sentence (20-40 words) from the article
   - RARELY: Recommend creating a new section ONLY when the topic cannot reasonably fit under any existing section (MUST specify both title AND which section to place it after)

2. **HOW to implement:**
   - "insert": Add new content to existing section (PREFERRED)
   - "replace": Replace or expand existing mention (PREFERRED)
   - "new_section": Create a dedicated new section (use RARELY—only when no existing section can accommodate the topic)

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
   - What specific aspects of the topic to cover
   - How to structure it
   - What information to include
   
   Focus on WHAT to cover, not exact wording.

RULES:
- Be specific about placement (cite exact headings or quotes)
- Keep instructions actionable and clear
- Don't write the content - guide the user to write it
- Match the article's apparent purpose and audience
- Default to augmenting an existing section; use new_section only when the topic truly cannot fit anywhere

OUTPUT STRICT JSON (no markdown, no code fences):

DEFAULT (prefer augmenting existing sections):
{
  "suggestion": {
    "topicId": "${topicId}",
    "where": {
      "location": "existing_section",
      "targetHeading": "Exact H2 or H3 heading text"
    },
    "how": "insert",
    "format": "text",
    "depth": "brief",
    "instructions": "Create an H3 titled 'Volume Discounts' under the Pricing section. Explain your discount tiers in 2-3 sentences and mention any minimum order quantities required."
  }
}

RARELY (new section only when topic cannot fit under existing headings):
{
  "suggestion": {
    "topicId": "${topicId}",
    "where": {
      "location": "new_section",
      "newSectionTitle": "Support Options",
      "afterHeading": "Pricing"
    },
    "how": "new_section",
    "format": "list",
    "depth": "explanatory",
    "instructions": "Create a new H2 section titled 'Support Options' after the 'Pricing' section. List 3-4 support channels with brief descriptions of response times and availability."
  }
}

IMPORTANT: If location is "new_section", you MUST provide the "afterHeading" field to specify where to place the new section.`;

    const response = await monkey.AI(prompt, {
      vendor: "openai",
      model: "gpt-4o",
      forceJson: true,
    });

    let suggestion = null;
    
    try {
      const parsed = JSON.parse(response.trim());
      suggestion = parsed.suggestion || parsed;
      
      // Ensure topicId is set
      if (suggestion && !suggestion.topicId) {
        suggestion.topicId = topicId;
      }
      
      // Validate required fields
      if (!suggestion || !suggestion.where || !suggestion.how || !suggestion.instructions) {
        throw new Error("Invalid suggestion format");
      }
    } catch (parseError) {
      // Fallback suggestion
      suggestion = {
        topicId,
        where: {
          location: "existing_section",
          targetHeading: headings.length > 0 ? headings[0].text : "Introduction"
        },
        how: "insert",
        format: "text",
        depth: "brief",
        instructions: `Add 2-3 sentences about "${topic.label}" to help readers understand this aspect. Consider what questions they might have and address them clearly.`
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
