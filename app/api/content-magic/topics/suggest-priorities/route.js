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
 * POST /api/content-magic/topics/suggest-priorities
 * Suggests priorities for all topics based on article content and campaign context
 */
export async function POST(request) {
  const externalRequestId = request.headers.get("x-external-request-id") ?? null;
  const startTime = Date.now();
  const supabase = await createClient();
  try {
    const body = await request.json();
    const monkey = await initMonkey();
    monkey.loadUserContext(body?.user_context ?? {});
    const { topics = [], article = {}, campaignContext = {} } = body;
    if (topics.length === 0) {
      return NextResponse.json({ suggestions: [] });
    }

    const articleText = stripHtml(article.content_html || article.content || "");
    const articleTitle = article.title || "";

    // Build ICP context
    let icpContext = "No ICP information available";
    if (campaignContext.icp?.profile) {
      const profile = campaignContext.icp.profile;
      icpContext = typeof profile === 'string' ? profile : JSON.stringify(profile, null, 2).substring(0, 500);
    }

    // Build offer context
    let offerContext = "No offer information available";
    if (campaignContext.offer) {
      offerContext = typeof campaignContext.offer === 'string' 
        ? campaignContext.offer 
        : JSON.stringify(campaignContext.offer, null, 2).substring(0, 300);
    }

    const prompt = `You are an editorial assistant helping prioritize content topics for a webpage.

ARTICLE TITLE: ${articleTitle}

ARTICLE CONTENT (${articleText.length} characters):
${articleText.substring(0, 6000)}${articleText.length > 6000 ? '...(truncated)' : ''}

ICP INTENT:
${icpContext}

OFFER:
${offerContext}

TOPICS TO PRIORITIZE:
${topics.map((t, idx) => `${idx + 1}. "${t.label || t.topic}"
   ${t.exampleText && typeof t.exampleText === 'string' ? `Example from competitors: "${t.exampleText.substring(0, 150)}..."` : ''}
   ${t.strategy && typeof t.strategy === 'string' ? `Strategy insight: "${t.strategy.substring(0, 150)}..."` : ''}`).join('\n\n')}

TASK: Assign priority to each topic for THIS specific page.

Priority levels:
- **high**: Critical for this page's value proposition or reader's key decision factors
- **low**: Relevant context but not essential for this specific page
- **done**: Already sufficiently covered in the current article

For each topic, provide:
1. **priority**: high | low | done
2. **reasoning**: ONE clear sentence (15-25 words) explaining the priority choice

RULES:
- Consider the article's current focus, ICP intent, and offer relevance
- Be SELECTIVE with "high" - not everything is critical
- Only mark as "done" if the topic is ACTUALLY covered with reasonable depth in the article
- If a topic is mentioned but not explained, it's NOT done
- Keep reasoning brief and specific (one sentence only)
- Prioritize topics that help readers make informed decisions
- Consider the reader's journey and information needs

OUTPUT STRICT JSON (no markdown, no code fences):
{
  "suggestions": [
    {
      "topicId": "topic-0",
      "priority": "high",
      "reasoning": "Directly addresses ICP's primary concern about implementation complexity."
    }
  ]
}`;

    const response = await monkey.AI(prompt, {
      vendor: "openai",
      model: "gpt-4o",
      forceJson: true,
    });

    let suggestions = [];
    
    try {
      const parsed = JSON.parse(response.trim());
      suggestions = parsed.suggestions || [];
      
      // Map suggestions to topic IDs
      suggestions = suggestions.map((sug, idx) => ({
        topicId: topics[idx]?.id || sug.topicId || `topic-${idx}`,
        priority: sug.priority || "low",
        reasoning: sug.reasoning || "No reasoning provided."
      }));
    } catch (parseError) {
      // Fallback: assign all as low priority
      suggestions = topics.map((topic) => ({
        topicId: topic.id,
        priority: "low",
        reasoning: "Unable to evaluate priority automatically. Please review manually."
      }));
    }
    await finishExternalRequest(supabase, {
      externalRequestId,
      status: "success",
      responsePreview: JSON.stringify({ suggestions }),
      latencyMs: Date.now() - startTime,
    });

    return NextResponse.json({
      suggestions,
    });
  } catch (error) {
    await finishExternalRequest(supabase, {
      externalRequestId,
      status: "failed",
      errorMessage: error?.message ?? String(error),
      latencyMs: Date.now() - startTime,
    });
    return NextResponse.json(
      { error: error.message || "Failed to suggest priorities" },
      { status: 500 }
    );
  }
}
