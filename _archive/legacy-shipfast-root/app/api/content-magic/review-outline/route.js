import { NextResponse } from "next/server";
import { createClient } from "@/libs/supabase/server";
import { initMonkey } from "@/libs/monkey";

function stripCodeFences(text = "") {
  return text.replace(/```(?:json)?/gi, "").replace(/```/g, "").trim();
}

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
      articleContent = "",
      articleTitle = "",
      campaignContext = {},
      assets = {},
    } = body;

    if (!articleContent || articleContent.trim().length < 100) {
      return NextResponse.json(
        { error: "Article content is required (minimum 100 characters)" },
        { status: 400 }
      );
    }

    const monkey = await initMonkey();
    monkey.loadUserContext({ ...(body?.user_context ?? {}), userId: user?.id });

    // Extract section structure from HTML content
    // Parse HTML to identify sections (headings and their content)
    const sectionMatches = articleContent.match(/<h[1-6][^>]*>([^<]+)<\/h[1-6]>/gi) || [];
    const sections = sectionMatches.map((match, idx) => {
      const textMatch = match.match(/<h[1-6][^>]*>([^<]+)<\/h[1-6]>/i);
      return textMatch ? textMatch[1].trim() : `Section ${idx + 1}`;
    });

    const sectionsText = sections.length > 0
      ? sections.map((s, idx) => `${idx + 1}. "${s}"`).join("\n")
      : "No clear sections identified (content may not have headings)";

    // Format competitor content if available
    const competitorContent = (assets.topics || [])
      .flatMap((topic) =>
        (topic.competitorExamples || []).map((ex) => ({
          snippet: ex.snippet || ex.exampleText || "",
          source: ex.source || ex.sourceUrl || "",
          strategy: ex.strategyInsight || topic.strategy || "",
        }))
      )
      .filter((ex) => ex.snippet && ex.snippet.trim().length > 0);

    const competitorText =
      competitorContent.length > 0
        ? competitorContent
            .map(
              (ex, idx) =>
                `[Competitor ${idx + 1} - ${ex.source || "Unknown"}]\n${ex.snippet.substring(0, 1000)}`
            )
            .join("\n\n---\n\n")
        : "No competitor content available.";

    // Build comprehensive evaluation prompt
    const evaluationPrompt = `You are a strategic content architect evaluating draft content.

Your role: Identify structural issues, gaps, and optimization opportunities at the SECTION level in the actual draft content.

Constraints:
- NO copy-level recommendations
- NO tone/style suggestions
- Focus on: section existence, scope, ordering, deduplication
- Provide actionable, strategic guidance only
- Evaluate the ACTUAL content structure, not a planned outline

ARTICLE TO EVALUATE:
Title: ${articleTitle || "Untitled"}

Content Structure (sections identified):
${sectionsText}

Full Article Content:
${articleContent.substring(0, 15000)}

CAMPAIGN CONTEXT:
ICP: ${campaignContext.icp?.name || campaignContext.icp?.description || "Not specified"}
Offer: ${campaignContext.offer?.name || "Not specified"}
Outcome: ${campaignContext.outcome || "Not specified"}

COMPETITOR CONTENT (for reference):
${competitorText.substring(0, 8000)}

TASK: Run four internal evaluation passes on the ACTUAL DRAFT CONTENT and generate strategic suggestions:

PASS 1: Section Role Deduplication
- Analyze the actual content structure
- Identify redundant/overlapping sections in the draft
- Check for sections answering the same question
- Flag sections that are too thin to justify existence

PASS 2: Coverage & Gap Detection
- Compare actual draft content against competitor patterns
- Only propose competitor-inspired sections if they materially reduce buyer uncertainty for this ICP and offer
- Avoid adding "trust" sections (testimonials, guarantees, case studies) unless proof assets exist in inputs
- Identify missing decision stages in the current content
- Flag underrepresented topics in the draft
- If competitor reference appears incomplete or insufficient, mark confidence low and avoid recommending new sections purely from competitor comparison

PASS 3: ICP Mental Model Alignment
- Check if section ordering in draft matches evaluation flow
- Validate placement of proof/pricing/process sections in actual content
- Identify sections too early/late for ICP sophistication

PASS 4: Strategic Coherence Check
- Flag bloated sections in the draft
- Identify "by habit" sections (testimonials, guarantees) that may not add value
- Check if FAQs duplicate content already covered

OUTPUT: Return a JSON object with a "suggestions" array. Return 3-7 suggestions maximum, prioritized by impact. Avoid minor tweaks. Include at least 2 high-severity suggestions if available.

{
  "suggestions": [
    {
      "id": "sug_{action}_{index}",
      "title": "Action-oriented title (e.g., 'Merge overlapping sections')",
      "status": "pending",
      "severity": "high" | "medium" | "low",
      "confidence": "high" | "medium" | "low",
      "triggerTopic": "topic/prompt that triggered this suggestion (or null if not applicable)",
      "action": "improve_existing_mentions" | "merge_sections" | "add_missing_section" | "refocus_section_intent" | "remove_section" | "move_to_faq" | "reorder_sections",
      "rationale": "Strategic reasoning (1-2 sentences explaining why this matters at structure level)",
      "targetSectionTitle": "Section name exactly as it appears in the draft content",
      "targetSectionKey": "section_key_from_outline (or null if not available)",
      "additionalSections": [
        { "title": "Section Title", "key": "section_key_or_null" }
      ],
      "guidance": "High-level description of what should change (no copy advice)",
      "prompt": "Ready-to-use prompt for AI assistant. Must be complete and self-contained. Must only instruct structural edits (merge, remove, move, reorder, change scope, add missing section). Do not propose specific phrasing, sentences, or adjectives. Reference the target section by name (as it appears in the actual content) and include clear instructions for structural modifications. Example format: 'Merge the sections [Section A] and [Section B] in the article. The current [Section A] covers [brief structural description]. The current [Section B] covers [brief structural description]. Combine them into a single section that [structural outcome]. Remove duplicate content and reorganize the remaining content to [structural goal].'"
    }
  ]
}

ACTION TYPES:
- improve_existing_mentions: Enhance existing section coverage (structural expansion, not copy edits)
- merge_sections: Combine overlapping sections (use additionalSections array with title/key objects)
- add_missing_section: Add new section based on gaps (structural addition, not copy)
- refocus_section_intent: Change section scope/emphasis (structural refocus, not rewording)
- remove_section: Remove low-value section
- move_to_faq: Convert section content to FAQ (structural reorganization)
- reorder_sections: Change section ordering (use additionalSections array with title/key objects)

SECTION IDENTIFICATION:
- Use targetSectionTitle exactly as it appears in the draft content (from the sections list above)
- If section keys are not provided in sectionsText, set targetSectionKey to null
- For additionalSections, provide objects with both "title" (exact section name) and "key" (or null if unavailable)

CRITICAL REQUIREMENTS:
1. Return a JSON object with "suggestions" array (not just an array)
2. Return 3-7 suggestions maximum, prioritized by impact
3. Include at least 2 high-severity suggestions if available
4. Each prompt must be ready-to-use and complete
5. Prompts must reference target section by name (exactly as in draft)
6. Prompts must only instruct structural edits (merge, remove, move, reorder, change scope, add missing section)
7. Prompts must NOT propose specific phrasing, sentences, or adjectives
8. Prompts may include brief structural descriptions of current state, but not rewritten lines
9. Focus on structural/strategic changes, NOT copy-level edits
10. Return ONLY valid JSON, no markdown code blocks, no additional text

Return the JSON object with suggestions array.`;

    const aiRaw = await monkey.AI(evaluationPrompt, {
      vendor: "openai",
      model: "gpt-4o",
      forceJson: true,
    });

    let parsed = { suggestions: [] };
    try {
      const cleaned = stripCodeFences(aiRaw);
      parsed = JSON.parse(cleaned);
    } catch (parseError) {
      return NextResponse.json(
        { error: "Failed to parse AI response", details: parseError.message },
        { status: 500 }
      );
    }

    // Validate and ensure each suggestion has required fields
    const validatedSuggestions = (parsed.suggestions || [])
      .map((s, idx) => {
        // Normalize additionalSections: handle both old format (array of strings) and new format (array of objects)
        let normalizedAdditionalSections = [];
        if (Array.isArray(s.additionalSections)) {
          normalizedAdditionalSections = s.additionalSections.map((item) => {
            if (typeof item === "string") {
              // Legacy format: convert string to object
              return { title: item, key: null };
            }
            // New format: ensure it has title and key
            return {
              title: item.title || item,
              key: item.key || null,
            };
          });
        }

        return {
          id: s.id || `sug_${s.action || "unknown"}_${idx}`,
          title: s.title || "Untitled suggestion",
          status: s.status || "pending",
          severity: s.severity || "medium",
          confidence: s.confidence || "medium",
          triggerTopic: s.triggerTopic || null,
          action: s.action || "improve_existing_mentions",
          rationale: s.rationale || "",
          targetSectionTitle: s.targetSectionTitle || "",
          targetSectionKey: s.targetSectionKey || null,
          additionalSections: normalizedAdditionalSections,
          guidance: s.guidance || "",
          prompt: s.prompt || "",
        };
      })
      // Sort by severity (high > medium > low) and confidence (high > medium > low)
      .sort((a, b) => {
        const severityOrder = { high: 3, medium: 2, low: 1 };
        const confidenceOrder = { high: 3, medium: 2, low: 1 };
        const severityDiff =
          severityOrder[b.severity] - severityOrder[a.severity];
        if (severityDiff !== 0) return severityDiff;
        return confidenceOrder[b.confidence] - confidenceOrder[a.confidence];
      })
      // Limit to 3-7 suggestions, prioritizing high-severity
      .slice(0, 7);

    return NextResponse.json({
      suggestions: validatedSuggestions,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
