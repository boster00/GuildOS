import { NextResponse } from "next/server";
import { createClient } from "@/libs/supabase/server";
import { initMonkey } from "@/libs/monkey";

export async function POST(request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const {
      articleId,
      articleTitle,
      articleBody,
      mainKeyword,
      originalVision,
      topics,
      keywords,
      prompts,
      internalLinks,
      sectionReviewDecisions,
    } = await request.json();

    if (!articleBody) {
      return NextResponse.json(
        { error: "articleBody is required" },
        { status: 400 }
      );
    }

    const monkey = await initMonkey();
    monkey.loadUserContext({ ...(body?.user_context ?? {}), userId: user?.id });

    // Build prompt for generating change candidates
    const prompt = `You are an expert content strategist. Analyze an article and determine how to implement topics, prompts, and keywords.

**Article Context:**
- Title: ${articleTitle || "Untitled"}
- Main Keyword: ${mainKeyword || "Not specified"}
- Original Vision: ${Array.isArray(originalVision) ? originalVision.join('\n') : originalVision || "Not specified"}

**Article Content:**
${articleBody.substring(0, 10000)}${articleBody.length > 10000 ? "..." : ""}

**Topics to Implement:** ${topics.length > 0 ? topics.join(', ') : 'None'}
**Keywords to Implement:** ${keywords.length > 0 ? keywords.join(', ') : 'None'}
**Prompts to Implement:** ${prompts.length > 0 ? prompts.join(', ') : 'None'}

**Section Review Decisions:** ${sectionReviewDecisions ? JSON.stringify(sectionReviewDecisions) : 'None'}

**Your Task:**
For each topic, prompt, and keyword, determine:
1. **Change Mode:**
   - "already_covered": The article already addresses this well; no change needed
   - "sprinkle": Minor tweak needed (add 1-2 sentences, adjust wording)
   - "extend": Noticeable expansion needed (extra paragraph/sub-bullets)
   - "new_section": Missing intent; consider adding a new sub-section

2. **Instructions**: Short, concrete text describing how to implement the change
3. **Location Snippet**: Exact existing text snippet where change should happen (for sprinkle/extend), or suggested location for new_section

**Output Format:**
Return a JSON object with a "candidates" array. Each candidate should have:
{
  "id": "unique-id",
  "type": "topic" | "prompt" | "keyword",
  "label": "the topic/prompt/keyword text",
  "mode": "already_covered" | "sprinkle" | "extend" | "new_section",
  "instructions": "how to include this",
  "locationSnippet": "exact text or section heading as anchor"
}

**Guidelines:**
- For topics: Focus on whether they're covered, need expansion, or need new sections
- For prompts: Map to existing sections (FAQ, troubleshooting) or propose new Q&A sections
- For keywords: Suggest small wording tweaks or 1-2 sentence additions, not global rewrites
- Don't suggest adding to sections marked as "remove" in sectionReviewDecisions
- Be specific about location snippets - quote actual text from the article when possible
- Keep instructions actionable and concise`;

    const response = await monkey.AI(prompt, {
      vendor: "openai",
      model: "gpt-4o",
      forceJson: true,
    });

    let parsed;
    try {
      parsed = typeof response === 'string' ? JSON.parse(response) : response;
    } catch (e) {
      // Fallback: create basic candidates
      parsed = { candidates: [] };
      
      // Add topics
      (topics || []).forEach((topic, idx) => {
        parsed.candidates.push({
          id: `topic-${idx}`,
          type: 'topic',
          label: topic,
          mode: 'pending',
          instructions: 'Review and decide how to implement this topic',
          locationSnippet: '',
        });
      });

      // Add prompts
      (prompts || []).forEach((prompt, idx) => {
        parsed.candidates.push({
          id: `prompt-${idx}`,
          type: 'prompt',
          label: prompt,
          mode: 'pending',
          instructions: 'Review and decide how to implement this prompt',
          locationSnippet: '',
        });
      });

      // Add keywords
      (keywords || []).forEach((keyword, idx) => {
        parsed.candidates.push({
          id: `keyword-${idx}`,
          type: 'keyword',
          label: keyword,
          mode: 'sprinkle',
          instructions: 'Gently adjust wording to include this keyword where natural',
          locationSnippet: '',
        });
      });
    }

    // Ensure all candidates have required fields
    parsed.candidates = (parsed.candidates || []).map((c, idx) => ({
      ...c,
      id: c.id || `${c.type}-${idx}`,
      status: c.status || 'pending',
      aiMode: c.mode,
    }));

    return NextResponse.json(parsed);
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Failed to generate change candidates" },
      { status: 500 }
    );
  }
}

