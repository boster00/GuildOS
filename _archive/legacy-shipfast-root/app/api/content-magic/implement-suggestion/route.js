import { NextResponse } from "next/server";
import { createClient } from "@/libs/supabase/server";
import { initMonkey } from "@/libs/monkey";

function stripCodeFences(text = "") {
  return text.replace(/```(?:json|html)?/gi, "").replace(/```/g, "").trim();
}

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      suggestion,
      articleContent, // Client will send either full article or 2000 chars after section
      targetSectionHeading,
      exampleText,
      sourceUrl,
      campaignContext = {},
      itemType, // "topics" | "prompts" | "keywords" | "internal_links"
      locationString, // For keywords: the location string where to insert
    } = body || {};

    if (!suggestion || !articleContent) {
      return NextResponse.json(
        { error: "suggestion and articleContent are required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const monkey = await initMonkey();
    monkey.loadUserContext({ ...(body?.user_context ?? {}), userId: user.id });

    // FAST PATH: If suggestion already has from/to (pre-verified), return immediately
    if (itemType === "keywords" && suggestion.from && suggestion.to) {
      return NextResponse.json({
        success: true,
        implementation: {
          strikeThrough: suggestion.from,
          newString: suggestion.to,
        },
      });
    }

    // Build the prompt - use different prompts for keywords, topics, and prompts
    let prompt;
    if (itemType === "keywords") {
      // Extract keyword from suggestion - check multiple possible fields
      const keyword = suggestion.keyword || 
                      suggestion.keyword_text || 
                      (suggestion.suggestedChangeSummary && !locationString ? suggestion.suggestedChangeSummary : null) ||
                      "";
      
      // Keyword-specific prompt: use location string if provided, otherwise find location
      if (locationString && keyword) {
        // NEW FORMAT: Use location string directly
        prompt = `You are an expert SEO content editor. Your task is to add a keyword to existing content at a specific location with MINIMAL changes to the article.

KEYWORD TO ADD: ${keyword}

LOCATION STRING (this exact text exists in the article at the insertion point):
"${locationString}"

ARTICLE CONTENT (${articleContent.length} characters):
${articleContent}

TASK:
Find the location string "${locationString}" in the article content and add the keyword "${keyword}" at that location using one of these methods (in order of preference):

**PRIORITY 1 - REPLACEMENT/REPHRASING (PREFERRED):**
Look for words or phrases within the location string that can be REPLACED or REPHRASED with the keyword. For example:
- "testing services" → "ELISA services" (replace similar phrase)
- "protein analysis" → "peptide synthesis" (replace with semantically similar term)
- "laboratory work" → "custom antibodies" (if contextually appropriate)

**PRIORITY 2 - MINIMAL INSERTION (if replacement not feasible):**
If no suitable replacement exists, insert the keyword into the existing sentence with minimal rewriting (just adding the keyword without restructuring).

**PRIORITY 3 - SENTENCE MODIFICATION (last resort):**
Only if neither replacement nor simple insertion works, make minimal sentence modifications.

You MUST return a JSON object with exactly these 2 keys:

1. "strikeThrough" (string): The exact location string "${locationString}" (or a unique string that includes this location). This string must match exactly what appears in the article at that location. Include enough surrounding context to make it unique if the location string appears multiple times.

2. "newString" (string): The text with the keyword added using the preferred method (replacement > insertion > modification). Keep it MINIMAL - ideally replacing an existing word/phrase with the keyword, or inserting it with minimal changes. Do NOT rewrite entire sentences or add lengthy context unless absolutely necessary.

CRITICAL RULES:
- "strikeThrough" must match or include the location string "${locationString}" and appear exactly once in the article
- **FIRST TRY REPLACEMENT**: Look for existing words/phrases in the location string that can be replaced with the keyword (e.g., "testing solutions" → "ELISA services")
- **THEN TRY INSERTION**: If replacement isn't feasible, insert the keyword with minimal rewriting
- **AVOID SENTENCE REWRITES**: Do NOT rewrite entire sentences unless absolutely necessary
- "newString" should make the smallest possible change to incorporate the keyword
- Match the style and tone of existing content
- DO NOT add quotes, single quotes, or any punctuation around the keyword - use it as plain text that flows naturally with the sentence
- The keyword should appear in "newString" exactly as it would appear in natural writing, without any special formatting or quotation marks

OUTPUT STRICT JSON (no markdown code blocks, no extra text):
{
  "strikeThrough": "string",
  "newString": "string"
}

IMPORTANT: Return ONLY valid JSON, no explanations, no markdown code fences.`;
      } else {
        // LEGACY FORMAT: Find location (fallback for backward compatibility)
        prompt = `You are an expert SEO content editor. Your task is to naturally insert a keyword into existing content.

KEYWORD TO INSERT: ${keyword}

ARTICLE CONTENT (${articleContent.length} characters):
${articleContent}

TARGET SECTION: ${suggestion.targetSectionHeading || targetSectionHeading || "N/A"}

TASK:
Find the best place in the article content (after the target section, if specified) to naturally insert this keyword. The keyword should flow naturally with the existing text - make MINIMAL changes. Ideally, just insert the keyword into an existing sentence without rewriting.

You MUST return a JSON object with exactly these 2 keys:

1. "strikeThrough" (string): A unique string of text that exists in the article where the keyword should be inserted. This string must be unique enough to match only once. Include enough surrounding context (2-5 words before and after) to make it unique. This identifies the insertion point.

2. "newString" (string): The text with the keyword naturally inserted. Keep it MINIMAL - ideally just the original text with the keyword added naturally. Do NOT rewrite sentences or add lengthy context unless absolutely necessary.

CRITICAL RULES:
- Keep changes MINIMAL - only insert the keyword into existing text
- "strikeThrough" must be unique and appear exactly once in the article
- "newString" should be the same text with the keyword added, keeping it concise
- Do NOT include examples or lengthy context
- Match the style and tone of existing content
- DO NOT add quotes, single quotes, or any punctuation around the keyword - insert it as plain text that flows naturally with the sentence
- The keyword should appear in "newString" exactly as it would appear in natural writing, without any special formatting or quotation marks

OUTPUT STRICT JSON (no markdown code blocks, no extra text):
{
  "strikeThrough": "string",
  "newString": "string"
}

IMPORTANT: Return ONLY valid JSON, no explanations, no markdown code fences.`;
      }
    } else if (itemType === "topics" || itemType === "prompts") {
      // Topic/Prompt prompt: full content implementation
      prompt = `You are an expert content editor. Based on the provided suggestion, generate precise HTML changes to implement the suggestion.

ARTICLE CONTENT (${articleContent.length} characters):
${articleContent}

SUGGESTION:
Action: ${suggestion.action || "unknown"}
Suggested Change: ${suggestion.suggestedChangeSummary || suggestion.reasoning || ""}
Target Section: ${suggestion.targetSectionHeading || targetSectionHeading || "N/A"}
Example Text: ${exampleText || "N/A"}
${suggestion.exampleEdits ? `Example Edits: ${suggestion.exampleEdits}` : ""}

CAMPAIGN CONTEXT:
${JSON.stringify(campaignContext, null, 2)}

TASK:
Generate precise string-based changes to implement the suggestion. You MUST return a JSON object with exactly these 2 keys:

1. "strikeThrough" (string): A unique string of text that exists in the article content that should be struck through. This string must be unique enough to match only once after the target section heading. Include enough surrounding context (words before and after) to make it unique. If no replacement is needed, still provide a string that identifies the location where changes should be made - this string will be struck through but its content will be retained in the new string.

2. "newString" (string): The new text content to insert after the struck-through string. If you need to retain the original content from strikeThrough, include it in this newString. This should be plain text or HTML that will replace/append to the struck-through content.

CRITICAL RULES:
- "strikeThrough" must be a unique string that appears exactly once in the article content (after the target section heading, if specified)
- Include enough context in "strikeThrough" to make it unique (e.g., "This is the sentence that needs changing" instead of just "sentence")
- "newString" should contain the complete replacement text, including any original content that should be retained
- Even if no replacement is needed, provide a strikethrough string and include its content in the newString
- Both strings should match the style and formatting of the existing content

OUTPUT STRICT JSON (no markdown code blocks, no extra text):
{
  "strikeThrough": "string",
  "newString": "string"
}

IMPORTANT: Return ONLY valid JSON, no explanations, no markdown code fences.`;
    } else {
      // Default prompt for internal_links or unknown types
      prompt = `You are an expert content editor. Based on the provided suggestion, generate precise HTML changes to implement the suggestion.

ARTICLE CONTENT (${articleContent.length} characters):
${articleContent}

SUGGESTION:
Action: ${suggestion.action || "unknown"}
Suggested Change: ${suggestion.suggestedChangeSummary || suggestion.reasoning || ""}
Target Section: ${suggestion.targetSectionHeading || targetSectionHeading || "N/A"}
Example Text: ${exampleText || "N/A"}
${suggestion.exampleEdits ? `Example Edits: ${suggestion.exampleEdits}` : ""}

CAMPAIGN CONTEXT:
${JSON.stringify(campaignContext, null, 2)}

TASK:
Generate precise string-based changes to implement the suggestion. You MUST return a JSON object with exactly these 2 keys:

1. "strikeThrough" (string): A unique string of text that exists in the article content that should be struck through. This string must be unique enough to match only once after the target section heading. Include enough surrounding context (words before and after) to make it unique. If no replacement is needed, still provide a string that identifies the location where changes should be made - this string will be struck through but its content will be retained in the new string.

2. "newString" (string): The new text content to insert after the struck-through string. If you need to retain the original content from strikeThrough, include it in this newString. This should be plain text or HTML that will replace/append to the struck-through content.

CRITICAL RULES:
- "strikeThrough" must be a unique string that appears exactly once in the article content (after the target section heading, if specified)
- Include enough context in "strikeThrough" to make it unique (e.g., "This is the sentence that needs changing" instead of just "sentence")
- "newString" should contain the complete replacement text, including any original content that should be retained
- Even if no replacement is needed, provide a strikethrough string and include its content in the newString
- Both strings should match the style and formatting of the existing content

OUTPUT STRICT JSON (no markdown code blocks, no extra text):
{
  "strikeThrough": "string",
  "newString": "string"
}

IMPORTANT: Return ONLY valid JSON, no explanations, no markdown code fences.`;
    }

    // Retry up to 3 times to ensure both keys are included
    let result = null;
    let lastError = null;

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const aiRaw = await monkey.AI(prompt, {
          vendor: "openai",
          model: "gpt-4o",
          forceJson: true,
        });

        const cleaned = stripCodeFences(aiRaw);
        const parsed = JSON.parse(cleaned);

        // Validate both keys exist
        if (
          parsed.hasOwnProperty("strikeThrough") &&
          parsed.hasOwnProperty("newString")
        ) {
          result = parsed;
          break;
        } else {
          const missingKeys = [];
          if (!parsed.hasOwnProperty("strikeThrough")) missingKeys.push("strikeThrough");
          if (!parsed.hasOwnProperty("newString")) missingKeys.push("newString");
          
          lastError = `Missing required keys: ${missingKeys.join(", ")}`;
          if (attempt < 2) {
            // Add clarification for next attempt
            prompt += `\n\nRETRY NOTE: The previous response was missing required keys: ${missingKeys.join(", ")}. Please ensure ALL two keys (strikeThrough and newString) are present in your JSON response.`;
          }
        }
      } catch (parseError) {
        lastError = `JSON parse error: ${parseError.message}`;
        if (attempt < 2) {
          prompt += `\n\nRETRY NOTE: The previous response was not valid JSON. Please return ONLY valid JSON with both required keys (strikeThrough and newString).`;
        }
      }
    }

    if (!result) {
      return NextResponse.json(
        { error: `Failed to get valid response after 3 attempts. Last error: ${lastError}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      implementation: result,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Failed to implement suggestion" },
      { status: 500 }
    );
  }
}
