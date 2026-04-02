import { NextResponse } from "next/server";
import { createClient } from "@/libs/supabase/server";
import { initMonkey } from "@/libs/monkey";
import { calculateKeywordRequirements } from "@/libs/content-magic/utils/calculateSeoScore";
import { AI_MODELS } from "@/config/ai-models";

function stripCodeFences(text = "") {
  return text.replace(/```(?:json)?/gi, "").replace(/```/g, "").trim();
}

/**
 * Strip HTML tags from text for plain text search
 * @param {string} html - HTML content
 * @returns {string} Plain text content
 */
function stripHtml(html) {
  if (!html) return '';
  // Remove HTML tags
  const text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '') // Remove script tags and content
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '') // Remove style tags and content
    .replace(/<[^>]+>/g, ' ') // Remove all other HTML tags
    .replace(/&nbsp;/g, ' ') // Replace &nbsp; with space
    .replace(/&[a-z]+;/gi, ' ') // Replace HTML entities with space
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
  return text;
}

/**
 * Verify keyword suggestions by checking if 'from' strings can be found in article
 * @param {string} articleHtml - Full article HTML
 * @param {Array} keywordSuggestions - Array of keyword suggestions with from/to pairs
 * @returns {Object} { verified: Array, failed: Array }
 */
function verifyKeywordSuggestions(articleHtml, keywordSuggestions) {
  // Strip HTML for text-only search
  const articleText = stripHtml(articleHtml);
  let workingText = articleText;
  
  const results = {
    verified: [],
    failed: []
  };
  
  keywordSuggestions.forEach(sugg => {
    const keyword = sugg.keyword;
    const keywordId = sugg.keywordId;
    
    if (!sugg.suggestions || !Array.isArray(sugg.suggestions)) {
      return;
    }
    
    sugg.suggestions.forEach((s, idx) => {
      if (!s.from || !s.to) {
        results.failed.push({
          keywordId,
          keyword,
          suggestionIndex: idx,
          from: s.from || '',
          to: s.to || '',
          reason: "missing from or to string"
        });
        return;
      }
      
      // Try to find 'from' string in working text
      const found = workingText.includes(s.from);
      
      if (!found) {
        // Diagnose failure
        const inOriginal = articleText.includes(s.from);
        const reason = inOriginal 
          ? "overlaps with previous suggestion or was already replaced"
          : "from string not found in article";
          
        results.failed.push({
          keywordId,
          keyword,
          suggestionIndex: idx,
          from: s.from,
          to: s.to,
          reason
        });
      } else {
        // CRITICAL CHECK: Verify keyword doesn't already exist in immediate context
        // Check 15 words before and after the "from" string location
        const fromIndex = workingText.indexOf(s.from);
        if (fromIndex !== -1) {
          // Extract context around the "from" string (15 words before and after)
          const contextStart = Math.max(0, fromIndex - 200); // ~15 words before
          const contextEnd = Math.min(workingText.length, fromIndex + s.from.length + 200); // ~15 words after
          const context = workingText.substring(contextStart, contextEnd);
          
          // Check if keyword already appears in this context (case-insensitive, whole word match)
          const keywordLower = keyword.toLowerCase();
          const contextLower = context.toLowerCase();
          const escapedKeyword = keywordLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const keywordRegex = new RegExp(`\\b${escapedKeyword}\\b`, 'gi');
          
          if (keywordRegex.test(contextLower)) {
            // Keyword already exists in immediate context - mark as failed
            results.failed.push({
              keywordId,
              keyword,
              suggestionIndex: idx,
              from: s.from,
              to: s.to,
              reason: "keyword already exists in immediate context (within 15 words before or after the 'from' string)"
            });
            return; // Don't verify this suggestion
          }
        }
        
        // Mark as verified and update working text
        results.verified.push({
          keywordId,
          keyword,
          from: s.from,
          to: s.to
        });
        
        // Apply change to working text for next iteration
        workingText = workingText.replace(s.from, s.to);
      }
    });
  });
  
  return results;
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { topics = [], prompts = [], keywords = [], internal_links = [], article = {}, campaignContext = {} } = body || {};

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    

    const monkey = await initMonkey();
    monkey.loadUserContext({ ...(body?.user_context ?? {}), userId: user.id });

    // Build separate prompts for each asset type
    const allSuggestions = [];

    // 1. Topics prompt (base)
    if (topics.length > 0) {
      const topicsPrompt = `
You are an expert conversion copy strategist. Evaluate the provided topics against the existing article and return structured implementation suggestions.

ARTICLE:
Title: ${article?.title || "Untitled"}
Content:
${article?.content || ""}

TOPICS (with ids):
${topics
  .map(
    (t) =>
      `- id: ${t.id || ""}\n  label: ${t.label || t.topic || ""}\n  notes: ${t.notes || t.reason || ""}`
  )
  .join("\n")}

CAMPAIGN CONTEXT:
${JSON.stringify(campaignContext, null, 2)}

REQUIRED ACTIONS FOR EACH TOPIC (in order of preference):
1. none: already clearly covered; no change needed.
2. skip_misaligned: misaligned with ICP profile, journey stage, or page intent; do not implement.
3. augment_existing_section: expand or refine an existing section (specify heading and change summary).
4. create_new_section: add a new section (provide title, placement, outline).

ACTION SELECTION PRIORITY (STRICTLY FOLLOW THIS ORDER):
1. FIRST: Check if the topic is already covered in the article. If yes → "none".
2. SECOND: Check if it aligns with the ICP profile, journey stage, or page intent. If NO → "skip_misaligned".
3. THIRD: If not covered but aligned, check if it can be added to an existing section. If yes → "augment_existing_section".
4. LAST: Only if none of the above apply and it's truly necessary, consider "create_new_section".

CRITICAL EMPHASIS:
- Always prefer "none" (already covered) over any other action if the content is sufficiently addressed.
- If misaligned with ICP/page intent, choose "skip_misaligned" before considering implementation.
- Only use "augment_existing_section" or "create_new_section" when the item is both necessary AND aligned with the page's purpose.
- Be conservative: default to "none" or "skip_misaligned" unless there's a clear, compelling need to modify the article.

OUTPUT STRICT JSON:
{
  "suggestions": [
    {
      "topicId": "string",          // REQUIRED - matches input topic id
      "action": "none" | "augment_existing_section" | "create_new_section" | "skip_misaligned",
      "reasoning": "short reasoning",
      "targetSectionHeading": "string | null",
      "suggestedChangeSummary": "string | null",
      "exampleEdits": "string | null",
      "newSectionTitle": "string | null",
      "suggestedPlacementAfterHeading": "string | null",
      "newSectionOutline": "string | null"
    }
  ]
}

Rules:
- ACTION PRIORITY: none > skip_misaligned > augment_existing_section > create_new_section
- Always check coverage first (none), then alignment (skip_misaligned), then augmentation (augment), and only create new sections as a last resort.
- For augment/create, give concise placement + change summary (no full rewrites).
`;

      const topicsRaw = await monkey.AI(topicsPrompt, {
        vendor: "openai",
        model: "gpt-4o",
      });

      try {
        const topicsParsed = JSON.parse(stripCodeFences(topicsRaw));
        if (Array.isArray(topicsParsed?.suggestions)) {
          allSuggestions.push(...topicsParsed.suggestions);
        }
      } catch (err) {
      }
    }

    // 2. Prompts prompt
    if (prompts.length > 0) {
      const promptsPrompt = `
You are an expert SEO and content optimization strategist. Evaluate the provided search prompts against the existing article and return structured implementation suggestions focused on improving how well the article vectorizes to answer these prompts.

ARTICLE:
Title: ${article?.title || "Untitled"}
Content:
${article?.content || ""}

PROMPTS (with ids):
${prompts
  .map(
    (p) =>
      `- id: ${p.id || ""}\n  text: ${p.label || p.prompt || p.text || ""}\n  reason: ${p.reason || ""}`
  )
  .join("\n")}

CAMPAIGN CONTEXT:
${JSON.stringify(campaignContext, null, 2)}

REQUIRED ACTIONS FOR EACH PROMPT (in order of preference):
1. improve_existing_mentions: The prompt is already mentioned/covered, but the text can be streamlined to better vectorize for AI engines. Focus on small wording tweaks and rearranging existing content.
2. skip_misaligned: misaligned with ICP profile, journey stage, or page intent; do not implement.
3. augment_existing_section: The prompt needs substantial content added to an existing section (specify heading and change summary).
4. create_new_section: The prompt requires a new dedicated section (provide title, placement, outline).

ACTION SELECTION PRIORITY (STRICTLY FOLLOW THIS ORDER):
1. FIRST: Check if the prompt is mentioned/covered in the article. If yes → "improve_existing_mentions" (NOT "none"). Focus on how to streamline the text to better vectorize.
2. SECOND: Check if it aligns with the ICP profile, journey stage, or page intent. If NO → "skip_misaligned".
3. THIRD: If not mentioned but aligned, check if it can be added to an existing section with moderate changes. If yes → "augment_existing_section".
4. LAST: Only if it requires substantial new content, consider "create_new_section".

CRITICAL EMPHASIS FOR "improve_existing_mentions":
- The goal is to make the article vectorize better so AI engines favor this article for answering the prompt.
- Recommendations should be SMALL wording tweaks and rearranging existing content.
- Focus on: clearer phrasing, better keyword placement, improved semantic connections, more direct answers to the prompt.
- If BIG operations are needed (major rewrites, new content blocks), recommend "augment_existing_section" or "create_new_section" instead.
- Provide specific, actionable wording suggestions that improve vectorization without changing the core meaning.

OUTPUT STRICT JSON:
{
  "suggestions": [
    {
      "promptId": "string",          // REQUIRED - matches input prompt id
      "action": "improve_existing_mentions" | "augment_existing_section" | "create_new_section" | "skip_misaligned",
      "reasoning": "short reasoning",
      "targetSectionHeading": "string | null",  // For improve_existing_mentions or augment: which section to modify
      "suggestedChangeSummary": "string | null",  // For improve_existing_mentions: specific wording tweaks. For augment: what to add.
      "exampleEdits": "string | null",  // For improve_existing_mentions: example of improved wording. For augment: example text.
      "newSectionTitle": "string | null",  // For create_new_section only
      "suggestedPlacementAfterHeading": "string | null",  // For create_new_section only
      "newSectionOutline": "string | null"  // For create_new_section only
    }
  ]
}

Rules:
- ACTION PRIORITY: improve_existing_mentions > skip_misaligned > augment_existing_section > create_new_section
- For "improve_existing_mentions", provide specific wording tweaks that improve vectorization.
- If major changes needed, use "augment_existing_section" or "create_new_section" instead.
`;

      const promptsRaw = await monkey.AI(promptsPrompt, {
        vendor: "openai",
        model: "gpt-4o",
      });

      try {
        const promptsParsed = JSON.parse(stripCodeFences(promptsRaw));
        if (Array.isArray(promptsParsed?.suggestions)) {
          allSuggestions.push(...promptsParsed.suggestions);
        }
      } catch (err) {
      }
    }

    // 3. Keywords prompt - NEW APPROACH: batch processing with location strings
    if (keywords.length > 0) {
      // Get competitor pages from body if available, otherwise use empty array
      const competitorPages = body.competitorPages || [];
      
      // Calculate keyword requirements using helper function
      const keywordRequirements = calculateKeywordRequirements(
        keywords,
        competitorPages,
        article?.content || ""
      );
      
      // Filter keywords that need additions (requiredAdditions > 0)
      const keywordsNeedingAdditions = keywordRequirements.filter(kw => kw.requiredAdditions > 0);
      
      if (keywordsNeedingAdditions.length > 0) {
        // Prefer HTML content if available, otherwise use plain text
        // The content may be HTML or plain text - check if it contains HTML tags
        const articleContent = article?.content || "";
        const hasHtmlTags = /<[a-z][\s\S]*>/i.test(articleContent);
        const isHtmlContent = hasHtmlTags || !!article?.content_html;
        const contentToUse = article?.content_html || articleContent;
        
        // Build prompt for keywords needing additions - NEW FROM/TO FORMAT
        const keywordsPrompt = `
You are an expert SEO strategist. Your task is to suggest keyword placements using a "from" and "to" format for direct find-and-replace implementation.

ARTICLE:
Title: ${article?.title || "Untitled"}
${isHtmlContent ? 'Content (HTML):' : 'Content:'}
${contentToUse}

KEYWORDS NEEDING ADDITIONS:
${keywordsNeedingAdditions
  .map(
    (kw) =>
      `- keyword: "${kw.keyword}"\n  required_additions: ${kw.requiredAdditions}\n  current_occurrences: ${kw.currentOccurrences}\n  recommended_range: ${kw.recommendedRange.lower}-${kw.recommendedRange.upper}`
  )
  .join("\n")}

CAMPAIGN CONTEXT:
${JSON.stringify(campaignContext, null, 2)}

TASK:
For each keyword, provide up to "required_additions" suggestions (maximum 3). Each suggestion must have:
- "from": Plain text string that exists in the article (no HTML tags in the string itself)
- "to": The same text with the keyword naturally inserted or replaced

CRITICAL UX REQUIREMENTS:
1. **Maintain reading flow** - keyword insertions should feel natural and not disrupt the reading experience
2. **Spread suggestions apart** - For the SAME keyword, suggestions must be in DIFFERENT sections or at least 2-3 paragraphs apart
3. **Avoid keyword stuffing appearance** - Don't cluster keywords together
4. **Prefer replacement over insertion** - Look for existing phrases that can be replaced with the keyword
5. **Headers (h1–h4)** - When suggesting adding the keyword to text inside a header (h1, h2, h3, or h4), keep the resulting header short; avoid long headers—they break the design and layout.

**IMPLEMENTATION PRIORITY (STRICTLY FOLLOW):**
1. **FIRST - REPLACEMENT/REPHRASING**: Find existing words/phrases that can be REPLACED with the keyword
   Example: from: "testing services" → to: "ELISA services"
2. **SECOND - MINIMAL INSERTION**: Insert keyword into existing sentence with minimal changes
   Example: from: "comprehensive solutions" → to: "comprehensive ELISA services solutions"
3. **LAST - NEW SENTENCE**: Only if above don't work (least preferred)

CRITICAL TECHNICAL REQUIREMENTS:
1. **from/to strings are PLAIN TEXT** - Strip any HTML tags from both strings
2. **from string must be unique** - Must appear exactly ONCE in the article
3. **from string must NOT cross HTML boundaries** - Stay within a single HTML element
4. **from string must NOT contain the keyword** - Verify keyword doesn't already appear there
5. **CRITICAL: Check immediate context** - Before suggesting a "from" string, check the text IMMEDIATELY BEFORE and AFTER it in the article. The keyword must NOT already appear in the immediate surrounding context (within 10-15 words before or after the "from" string). This prevents adding keywords where they already exist.
6. **Include enough context** - 2-5 words before/after to make "from" unique
7. **Spacing for same keyword** - Minimum 2-3 paragraphs apart, preferably different sections

CRITICAL VERIFICATION BEFORE SUGGESTING:
For each "from" string you're about to suggest:
1. Read the article text around that location (at least 20-30 words before and after)
2. Check if the keyword already appears anywhere in that context
3. If the keyword is already present, DO NOT suggest that location - find a different location where the keyword is truly missing
4. Only suggest locations where the keyword is genuinely absent from the surrounding text

SPACING RULE FOR SAME KEYWORD:
When suggesting multiple placements for the SAME keyword:
- REQUIRED: Different major sections (introduction, body, conclusion), OR
- REQUIRED: At least 2-3 paragraphs apart if in same section
- AVOID: Same paragraph, adjacent paragraphs, or clustering

Example - CORRECT spacing for "ELISA services" with 3 suggestions:
- Suggestion 1: Introduction section
- Suggestion 2: Middle body section (several paragraphs later)
- Suggestion 3: Conclusion section

Example - WRONG spacing:
- All 3 suggestions in same section close together (creates keyword stuffing appearance)

OUTPUT FORMAT (JSON only, no markdown code blocks):
{
  "keyword 1": [
    {"from": "plain text from article", "to": "plain text with keyword"},
    {"from": "different section plain text", "to": "different section with keyword"}
  ],
  "keyword 2": [
    {"from": "...", "to": "..."}
  ]
}

EXAMPLES:

✅ BEST (Replacement):
Article: "We provide comprehensive testing solutions for researchers."
Keyword: "ELISA services"
{"from": "testing solutions", "to": "ELISA services"}
Result: "We provide comprehensive ELISA services for researchers."

✅ GOOD (Minimal insertion):
Article: "Our laboratory offers quality solutions."
Keyword: "ELISA services"
{"from": "quality solutions", "to": "quality ELISA services solutions"}
Result: "Our laboratory offers quality ELISA services solutions."

✅ CORRECT (Well-spaced for same keyword):
Keyword "ELISA services" needs 3 placements:
[
  {"from": "testing solutions in introduction", "to": "ELISA services in introduction"},
  {"from": "laboratory analysis in middle section", "to": "ELISA services laboratory analysis in middle section"},
  {"from": "research tools in conclusion", "to": "ELISA services research tools in conclusion"}
]

❌ WRONG - Contains HTML tags:
{"from": "<p>testing solutions</p>", "to": "<p>ELISA services</p>"}

❌ WRONG - Keyword already in "from":
{"from": "ELISA services are available", "to": "ELISA services are widely available"}

❌ WRONG - Keyword already exists in immediate context:
Article: "State-of-the-art technology and expert staff ensure precise and reliable custom peptide synthesis services."
Keyword: "custom peptide synthesis"
{"from": "State-of-the-art technology and expert staff ensure precise and reliable", "to": "State-of-the-art technology and expert staff ensure precise and reliable custom peptide synthesis"}
This is WRONG because "custom peptide synthesis" already appears immediately after the "from" string. You must check the text that comes AFTER your "from" string to ensure the keyword isn't already there.

❌ WRONG - Too close together:
All 3 suggestions for same keyword in adjacent paragraphs of same section

❌ WRONG - Crosses HTML boundaries:
{"from": "text</p><p>more text", "to": "..."}

VERIFICATION CHECKLIST:
Before suggesting each from/to pair:
✓ Is "from" plain text (no HTML tags)?
✓ Is "to" plain text (no HTML tags)?
✓ Does "from" appear exactly once in article?
✓ Does "from" NOT contain the keyword?
✓ **CRITICAL: Does the keyword already appear in the immediate context (10-15 words before or after the "from" string)?** If yes, find a different location.
✓ If multiple suggestions for same keyword, are they 2-3+ paragraphs apart?
✓ Does "to" read naturally?

Return ONLY valid JSON, no explanations, no markdown.
`;

        // Initial AI call for keyword suggestions (using advanced model for better quality)
        const keywordsRaw = await monkey.AI(keywordsPrompt, {
          vendor: "openai",
          model: AI_MODELS.ADVANCED || "gpt-4o", // Fallback to gpt-4o if ADVANCED not configured
          forceJson: true,
        });

        try {
          const keywordsParsed = JSON.parse(stripCodeFences(keywordsRaw));
          
          // Transform to internal format: {"keyword": [{"from": "...", "to": "..."}]}
          // to [{keywordId, keyword, suggestions: [{from, to}]}]
          const keywordSuggestions = keywordsNeedingAdditions.map(kw => {
            const rawSuggestions = keywordsParsed[kw.keyword] || [];
            
            // Validate and filter suggestions
            const validSuggestions = rawSuggestions.filter(sugg => {
              if (!sugg || typeof sugg !== 'object') return false;
              if (!sugg.from || !sugg.to) return false;
              if (typeof sugg.from !== 'string' || typeof sugg.to !== 'string') return false;
              return true;
            });
            
            // Limit to required additions or 3, whichever is smaller
            const maxSuggestions = Math.min(kw.requiredAdditions, 3);
            const limitedSuggestions = validSuggestions.slice(0, maxSuggestions);
            
            return {
              keywordId: kw.keywordId,
              keyword: kw.keyword,
              suggestions: limitedSuggestions,
            };
          });
          
          // Verify all suggestions
          let verificationResults = verifyKeywordSuggestions(contentToUse, keywordSuggestions);
          // Format final suggestions grouped by keyword (no retry - mark failures as "try later")
          const finalSuggestions = keywordsNeedingAdditions.map(kw => {
            // Get verified suggestions for this keyword
            const verifiedForKeyword = verificationResults.verified.filter(v => v.keywordId === kw.keywordId);
            
            // Get failed suggestions for this keyword
            const failedForKeyword = verificationResults.failed.filter(f => f.keywordId === kw.keywordId);
            
            const implementations = verifiedForKeyword.map(v => ({
              from: v.from,
              to: v.to,
              verified: true,
            }));
            
            // Determine status
            let status = 'failed';
            if (implementations.length === kw.requiredAdditions) {
              status = 'ready';
            } else if (implementations.length > 0) {
              status = 'partial';
            }
            
            return {
              keywordId: kw.keywordId,
              keyword: kw.keyword,
              action: implementations.length > 0 ? "implement_locally" : "none",
              implementations,
              status,
              missingSuggestions: Math.max(0, kw.requiredAdditions - implementations.length),
              requiredAdditions: kw.requiredAdditions,
              currentOccurrences: kw.currentOccurrences,
              recommendedRange: kw.recommendedRange,
              tryLater: failedForKeyword.length > 0, // Mark as "try later" if any suggestions failed
              tryLaterMessage: failedForKeyword.length > 0 ? "Try again after implementing all suggested keyword placements" : null,
            };
          });
          
          
          
          allSuggestions.push(...finalSuggestions);
        } catch (err) {
          // Fallback: return empty suggestions for keywords
          const fallbackSuggestions = keywordsNeedingAdditions.map(kw => ({
            keywordId: kw.keywordId,
            keyword: kw.keyword,
            action: "none",
            implementations: [],
            status: "failed",
            missingSuggestions: kw.requiredAdditions,
            requiredAdditions: kw.requiredAdditions,
            currentOccurrences: kw.currentOccurrences,
            recommendedRange: kw.recommendedRange,
            error: err.message,
          }));
          allSuggestions.push(...fallbackSuggestions);
        }
      }
      
      // For keywords that don't need additions (requiredAdditions === 0), mark as "none"
      const keywordsNotNeedingAdditions = keywordRequirements.filter(kw => kw.requiredAdditions === 0);
      const noActionSuggestions = keywordsNotNeedingAdditions.map(kw => ({
        keywordId: kw.keywordId,
        keyword: kw.keyword,
        action: "none",
        implementations: [],
        status: "ready",
        missingSuggestions: 0,
        requiredAdditions: 0,
        currentOccurrences: kw.currentOccurrences,
        recommendedRange: kw.recommendedRange,
      }));
      
      allSuggestions.push(...noActionSuggestions);
    }

    // 4. Internal Links prompt
    if (internal_links.length > 0) {
      const internalLinksPrompt = `
You are an expert SEO and internal linking strategist. Evaluate the provided internal link opportunities against the existing article and return structured implementation suggestions.

ARTICLE:
Title: ${article?.title || "Untitled"}
Content:
${article?.content || ""}

INTERNAL LINKS (with ids):
${internal_links
  .map(
    (l) =>
      `- id: ${l.id || ""}\n  targetUrl: ${l.targetUrl || ""}\n  targetTitle: ${l.targetTitle || ""}\n  keyword: ${l.keyword || ""}\n  direction: ${l.direction || "to"}\n  notes: ${l.notes || ""}`
  )
  .join("\n")}

CAMPAIGN CONTEXT:
${JSON.stringify(campaignContext, null, 2)}

REQUIRED ACTIONS FOR EACH INTERNAL LINK (in order of preference):
1. none: Link already exists in the article; no change needed.
2. augment_existing_section: Add the link to an existing section where it fits naturally (specify heading and anchor text suggestion).
3. create_new_section: The link requires a new section to be created (provide title, placement, outline).
4. skip_misaligned: The link is misaligned with ICP profile, journey stage, or page intent; do not implement.

ACTION SELECTION PRIORITY (STRICTLY FOLLOW THIS ORDER):
1. FIRST: Check if the link already exists in the article. If yes → "none".
2. SECOND: Check if it aligns with the ICP profile, journey stage, or page intent. If NO → "skip_misaligned".
3. THIRD: If not present but aligned, check if it can be added to an existing section. If yes → "augment_existing_section".
4. LAST: Only if it requires substantial new content, consider "create_new_section".

CRITICAL EMPHASIS:
- Always prefer "none" (already exists) over any other action if the link is present.
- If misaligned with ICP/page intent, choose "skip_misaligned" before considering implementation.
- For "augment_existing_section", provide specific anchor text suggestions that are natural and contextual.
- Be conservative: default to "none" or "skip_misaligned" unless there's a clear, compelling need to add the link.

OUTPUT STRICT JSON:
{
  "suggestions": [
    {
      "internalLinkId": "string",          // REQUIRED - matches input internal link id
      "action": "none" | "augment_existing_section" | "create_new_section" | "skip_misaligned",
      "reasoning": "short reasoning",
      "targetSectionHeading": "string | null",  // For augment: which section to add link
      "suggestedChangeSummary": "string | null",  // For augment: where/how to add the link with suggested anchor text
      "exampleEdits": "string | null",  // For augment: example HTML snippet with the link
      "newSectionTitle": "string | null",  // For create_new_section only
      "suggestedPlacementAfterHeading": "string | null",  // For create_new_section only
      "newSectionOutline": "string | null"  // For create_new_section only
    }
  ]
}

Rules:
- ACTION PRIORITY: none > skip_misaligned > augment_existing_section > create_new_section
- For augment, provide natural anchor text suggestions that fit the context.
- If link already exists, mark as "none".
`;

      const internalLinksRaw = await monkey.AI(internalLinksPrompt, {
        vendor: "openai",
        model: "gpt-4o",
      });

      try {
        const internalLinksParsed = JSON.parse(stripCodeFences(internalLinksRaw));
        if (Array.isArray(internalLinksParsed?.suggestions)) {
          allSuggestions.push(...internalLinksParsed.suggestions);
        }
      } catch (err) {
      }
    }
    

    return NextResponse.json({ suggestions: allSuggestions });
  } catch (error) {
    return NextResponse.json({ error: "Failed to generate implementation suggestions" }, { status: 500 });
  }
}