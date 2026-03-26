import { NextResponse } from "next/server";
import { initMonkey } from "@/libs/monkey";

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
 * POST /api/content-magic/prompts/suggest-priorities
 * Suggests priorities for all prompts (reader questions) based on article content and campaign context
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const monkey = await initMonkey();
    monkey.loadUserContext(body?.user_context ?? {});
    const { prompts = [], article = {}, campaignContext = {} } = body;
    if (prompts.length === 0) {
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

    const prompt = `You are an editorial assistant helping prioritize content prompts (reader questions) for a webpage.

ARTICLE TITLE: ${articleTitle}

ARTICLE CONTENT (${articleText.length} characters):
${articleText.substring(0, 6000)}${articleText.length > 6000 ? '...(truncated)' : ''}

ICP INTENT:
${icpContext}

OFFER:
${offerContext}

PROMPTS TO PRIORITIZE (Reader Questions):
${prompts.map((p, idx) => `${idx + 1}. "${p.text || p.prompt}"
   ${p.reason && typeof p.reason === 'string' ? `Reason: "${p.reason.substring(0, 150)}..."` : ''}
   ${p.intentType && typeof p.intentType === 'string' ? `Intent: ${p.intentType}` : ''}`).join('\n\n')}

TASK: Assign priority to each prompt (reader question) for THIS specific page.

Priority levels:
- **high**: Critical question readers need answered to make informed decisions
- **low**: Relevant context but not essential for this specific page
- **done**: Already sufficiently answered in the current article

For each prompt, provide:
1. **priority**: high | low | done
2. **reasoning**: ONE clear sentence (15-25 words) explaining the priority choice

RULES:
- Consider the article's current focus, ICP intent, and offer relevance
- Be SELECTIVE with "high" - not every question is critical
- Only mark as "done" if the question is ACTUALLY answered with reasonable depth in the article
- If a question is mentioned but not explained, it's NOT done
- Keep reasoning brief and specific (one sentence only)
- Prioritize questions that help readers make informed decisions
- Consider commercial intent questions highly

OUTPUT STRICT JSON (no markdown, no code fences):
{
  "suggestions": [
    {
      "promptId": "prompt-0",
      "priority": "high",
      "reasoning": "Directly addresses ICP's primary concern about pricing and value."
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
      
      // Map suggestions to prompt IDs
      suggestions = suggestions.map((sug, idx) => ({
        promptId: prompts[idx]?.id || sug.promptId || `prompt-${idx}`,
        priority: sug.priority || "low",
        reasoning: sug.reasoning || "No reasoning provided."
      }));
    } catch (parseError) {
      // Fallback: assign all as low priority
      suggestions = prompts.map((prompt) => ({
        promptId: prompt.id,
        priority: "low",
        reasoning: "Unable to evaluate priority automatically. Please review manually."
      }));
    }
    return NextResponse.json({ suggestions });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Failed to suggest priorities" },
      { status: 500 }
    );
  }
}
