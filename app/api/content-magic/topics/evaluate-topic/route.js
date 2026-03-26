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
 * POST /api/content-magic/topics/evaluate-topic
 * Evaluates if a single topic is sufficiently covered (topic-scoped, non-nitpicky)
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
    const articleText = stripHtml(article.content_html || article.content || "");
    const articleTitle = article.title || "";

    const prompt = `You are a quality reviewer. Evaluate ONLY this one specific topic.

ARTICLE TITLE: ${articleTitle}

ARTICLE CONTENT (${articleText.length} characters):
${articleText.substring(0, 8000)}${articleText.length > 8000 ? '...(truncated)' : ''}

TOPIC TO EVALUATE: "${topic.label || topic.topic}"
${topic.exampleText && typeof topic.exampleText === 'string' ? `\nExample from competitors: "${topic.exampleText.substring(0, 200)}..."` : ''}

TASK: Evaluate if this specific topic is sufficiently covered in the article.

CRITICAL RULES:
- Focus ONLY on this one topic - ignore all other topics
- Do NOT evaluate other topics even if they're related
- Do NOT suggest covering additional topics
- Be non-nitpicky - focus on MAJOR issues only
- Give credit if the topic is addressed reasonably

Evaluation criteria:
1. Is this topic clearly addressed in the article?
2. Is the coverage complete enough for a reader to understand the key points?
3. Are there major gaps, contradictions, or confusion?

If the topic IS sufficiently covered:
- Set isSufficient: true
- Set feedback: null
- The user should mark this topic as Done

If there ARE major issues:
- Set isSufficient: false
- Provide brief, focused feedback (2-4 sentences maximum)
- Focus on what's MISSING or UNCLEAR, not minor style issues
- Do NOT suggest covering other topics
- Do NOT reopen scope beyond this single topic

IMPORTANT:
- "Sufficient" doesn't mean perfect - it means reasonably complete for the reader
- A brief mention is NOT sufficient if the topic warrants explanation
- Don't be overly critical - major issues only

OUTPUT STRICT JSON (no markdown, no code fences):
{
  "evaluation": {
    "topicId": "${topicId}",
    "isSufficient": true,
    "feedback": null
  }
}

OR if issues exist:

{
  "evaluation": {
    "topicId": "${topicId}",
    "isSufficient": false,
    "feedback": "The pricing structure is mentioned but not explained. Add 2-3 sentences clarifying how the tiers work and what each includes."
  }
}`;

    const response = await monkey.AI(prompt, {
      vendor: "openai",
      model: "gpt-4o",
      forceJson: true,
    });

    let evaluation = null;
    
    try {
      const parsed = JSON.parse(response.trim());
      evaluation = parsed.evaluation || parsed;
      
      // Ensure topicId is set
      if (evaluation && !evaluation.topicId) {
        evaluation.topicId = topicId;
      }
      
      // Ensure required fields
      if (evaluation && typeof evaluation.isSufficient !== 'boolean') {
        evaluation.isSufficient = false;
        evaluation.feedback = evaluation.feedback || "Unable to evaluate automatically. Please review manually.";
      }
    } catch (parseError) {
      // Fallback evaluation
      evaluation = {
        topicId,
        isSufficient: false,
        feedback: "Unable to evaluate automatically. Please review the article manually to determine if this topic is sufficiently covered."
      };
    }
    await finishExternalRequest(supabase, {
      externalRequestId,
      status: "success",
      responsePreview: JSON.stringify({ evaluation }),
      latencyMs: Date.now() - startTime,
    });

    return NextResponse.json({
      evaluation,
    });
  } catch (error) {
    await finishExternalRequest(supabase, {
      externalRequestId,
      status: "failed",
      errorMessage: error?.message ?? String(error),
      latencyMs: Date.now() - startTime,
    });
    return NextResponse.json(
      { error: error.message || "Failed to evaluate topic" },
      { status: 500 }
    );
  }
}
