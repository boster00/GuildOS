import { createClient } from "@/libs/supabase/server";
import { NextResponse } from "next/server";
import AI_MODELS from "@/config/ai-models";
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

    const body = await request.json();
    const {
      ueoId,
      ueoName,
      ueoDescription,
      ueoCategory,
      ueoOutputType,
      article,
      campaignContext,
    } = body;

    // Validation
    if (!ueoId || !ueoName || !article) {
      return NextResponse.json(
        { error: "Missing required fields: ueoId, ueoName, article" },
        { status: 400 }
      );
    }

    // Fetch ICP data if ICP ID is provided
    let icpData = null;
    if (campaignContext?.icp?.id) {
      const { data: icp } = await supabase
        .from("icps")
        .select("*")
        .eq("id", campaignContext.icp.id)
        .eq("user_id", user.id)
        .single();
      
      icpData = icp;
    }

    // Build context string for AI
    let contextString = "";

    if (icpData) {
      contextString += `\n\n## Target Audience (ICP):\n`;
      contextString += `- Name: ${icpData.name || "Not specified"}\n`;
      contextString += `- Description: ${icpData.description || "Not specified"}\n`;
    }


    if (article?.title) {
      contextString += `\n## Article Title: ${article.title}\n`;
    }

    if (campaignContext?.pageType) {
      contextString += `\n## Page Type: ${campaignContext.pageType}\n`;
    }

    // Extract text content from HTML (simple extraction)
    let articleText = article.content || "";
    // Remove HTML tags for text analysis (simple regex, not perfect but sufficient)
    const textOnly = articleText.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    const articlePreview = textOnly.substring(0, 2000); // Limit to first 2000 chars

    // Build the prompt
    const systemPrompt = `You are an expert content strategist helping improve a landing page for better UX, SEO, and AI visibility.

${contextString}

## Current Article Content:
${articlePreview ? articlePreview + (textOnly.length > 2000 ? "..." : "") : "No content yet"}

## Universal Enrichment Opportunity (UEO):
- Name: ${ueoName}
- Description: ${ueoDescription}
- Category: ${ueoCategory}
- Output type hint: ${ueoOutputType}

## Your Task:
Generate exactly ONE enrichment implementation for this UEO on this page.

**IMPORTANT CONSTRAINTS:**
1. You MUST NOT recommend auto-editing the page. The user will manually review and apply your suggestion.
2. You must respect the page's phase and context (${campaignContext?.pageType || "general"} page).
3. Keep suggestions SHORT and SCANNABLE:
   - For content snippets: 50-150 words or a tight table/bullet block
   - For prompt templates: 1-2 paragraphs of instructions, not a giant meta-prompt
4. Be conservative: do NOT rewrite the entire page. Focus on adding one clear, self-contained block or edit operation.

## Decision: Content Snippet vs Prompt Template

Decide if this should be:
- **"content_snippet"**: Ready-to-paste HTML content that can be directly inserted into the editor
  - Use for: Decision guides, Pros & cons lists, Comparison tables, FAQs, Key facts panels, Location clarifiers, etc.
  - **CRITICAL**: The body must be valid HTML that can be copy-pasted directly into an HTML editor. Use proper HTML tags like:
    - \`<h2>\`, \`<h3>\` for headings
    - \`<ul>\`, \`<ol>\`, \`<li>\` for lists
    - \`<table>\`, \`<tr>\`, \`<td>\` for tables
    - \`<p>\` for paragraphs
    - \`<strong>\`, \`<em>\` for emphasis
    - \`<a href="...">\` for links
  - Do NOT use markdown syntax. Use HTML only.
  
- **"prompt_template"**: Instructions the user can paste into an AI assistant to modify a selected section
  - Use for: Rewriting headings, restructuring content, tablizing sections, etc.

## Output Format:
Return ONLY a JSON object with these exact keys:
{
  "ueoId": "${ueoId}",
  "suggestionType": "content_snippet" or "prompt_template",
  "title": "Optional heading/title suggestion (if relevant)",
  "summary": "1-2 sentence explanation of what this suggestion is and why it helps",
  "body": "For content_snippet: Valid HTML code ready to paste into editor. For prompt_template: Instructions text.",
  "notes": "Optional implementation notes for the user (e.g., where to place it, what to adapt)"
}

**CRITICAL:** Output ONLY valid JSON. No markdown code blocks, no explanatory text outside the JSON.`;

    // Initialize monkey
    const monkey = await initMonkey();
    monkey.loadUserContext({ ...(body?.user_context ?? {}), userId: user?.id });

    const model = AI_MODELS.STANDARD; // Use standard model for UEO suggestions
    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Generate a ${ueoName} enrichment for this page.` }
    ];

    // Handle token limits for different model types
    const isNewerModel = model.includes('o1') || model.includes('o3') || model.includes('gpt-5');
    const maxTokens = 1500;

    // Call OpenAI API through monkey
    const aiResponse = await monkey.AI(messages, {
      model,
      temperature: 0.7,
      max_tokens: isNewerModel ? null : maxTokens,
      max_completion_tokens: isNewerModel ? maxTokens : null,
    });

    // Extract JSON from response
    let parsedSuggestion = null;

    // Strategy 1: Try parsing the entire response as JSON
    try {
      const directParse = JSON.parse(aiResponse.trim());
      if (directParse && typeof directParse === 'object' && directParse.ueoId) {
        parsedSuggestion = directParse;
      }
    } catch (e) {
      // Not direct JSON, continue with other strategies
    }

    // Strategy 2: Extract JSON from markdown code blocks
    if (!parsedSuggestion) {
      const jsonBlockMatch = aiResponse.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
      if (jsonBlockMatch) {
        try {
          const jsonText = jsonBlockMatch[1].trim();
          const extracted = JSON.parse(jsonText);
          if (extracted && typeof extracted === 'object' && extracted.ueoId) {
            parsedSuggestion = extracted;
          }
        } catch (e) {
          // Failed to parse
        }
      }
    }

    // Strategy 3: Find JSON object containing ueoId
    if (!parsedSuggestion) {
      const ueoIdJsonMatch = aiResponse.match(/\{[\s\S]*?"ueoId"[\s\S]*?\}/);
      if (ueoIdJsonMatch) {
        try {
          // Find complete JSON object by matching braces
          let jsonStart = ueoIdJsonMatch.index;
          let braceCount = 0;
          let jsonEnd = jsonStart;
          
          for (let i = jsonStart; i < aiResponse.length; i++) {
            if (aiResponse[i] === '{') braceCount++;
            if (aiResponse[i] === '}') {
              braceCount--;
              if (braceCount === 0) {
                jsonEnd = i + 1;
                break;
              }
            }
          }
          
          const jsonText = aiResponse.substring(jsonStart, jsonEnd).trim();
          const extracted = JSON.parse(jsonText);
          if (extracted && typeof extracted === 'object' && extracted.ueoId) {
            parsedSuggestion = extracted;
          }
        } catch (e) {
          // Failed to parse
        }
      }
    }

    // Validate and normalize the parsed response
    if (!parsedSuggestion || !parsedSuggestion.ueoId) {
      throw new Error("Failed to parse AI response as valid UEO suggestion");
    }

    // Ensure all required fields
    const finalSuggestion = {
      ueoId: parsedSuggestion.ueoId || ueoId,
      suggestionType: parsedSuggestion.suggestionType || (ueoOutputType === 'prompt' ? 'prompt_template' : 'content_snippet'),
      title: parsedSuggestion.title || undefined,
      summary: parsedSuggestion.summary || `A ${ueoName} enrichment for this page.`,
      body: parsedSuggestion.body || "",
      notes: parsedSuggestion.notes || undefined,
    };

    return NextResponse.json(finalSuggestion, { status: 200 });

  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}

