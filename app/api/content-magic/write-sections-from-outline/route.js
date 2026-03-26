/**
 * API route for writing sections from outline (PageBrief + SectionSpecs)
 */

import { NextResponse } from "next/server";
import { createClient } from "@/libs/supabase/server";
import { callStructured } from "@/libs/monkey/tools/runtime/callStructured";
import { getOpenAIApiKey } from "@/libs/monkey/tools/runtime/providers/openai";
import { TEMPLATE_GUIDANCE } from "@/libs/monkey/tools/renderers/templates";

/**
 * Migrate old formatId to new canonical format with variant
 * @param {string} oldFormatId - The old format ID to migrate
 * @returns {{ formatId: string, variant?: string }} - New canonical format with optional variant
 */
function migrateFormatId(oldFormatId) {
  const migrationMap = {
    textBlock: { formatId: "contentSection", variant: "single" },
    twoColumn: { formatId: "contentSection", variant: "twoColumn" },
    labelValue: { formatId: "keyValueList", variant: "labelValue" },
    checklistBlock: { formatId: "keyValueList", variant: "checklist" },
    statsStrip: { formatId: "keyValueList", variant: "stats" },
    formBlock: { formatId: "conversionBlock", variant: "form" },
    ctaBanner: { formatId: "conversionBlock", variant: "cta" },
  };

  if (migrationMap[oldFormatId]) {
    return migrationMap[oldFormatId];
  }

  // If it's already a canonical format, return as-is
  return { formatId: oldFormatId };
}

/**
 * Get tier description for display in prompts
 */
function getTierDescription(tier) {
  const descriptions = {
    1: "What Customer Wants to Know - Establish relevance immediately",
    2: "What We Want Them to Know - Build credibility and differentiation",
    3: "Everything Else - Reduce friction and provide completeness",
  };
  return descriptions[tier] || "Not specified";
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { articleId, sections, talkPoints, campaignContext, strategicContext } = body;

    // Authenticate user
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized", details: authError?.message },
        { status: 401 }
      );
    }

    // Get user API keys
    let userApiKeys = [];
    try {
      const { data: apiKeys } = await supabase
        .from('user_api_keys')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true);
      
      if (apiKeys && apiKeys.length > 0) {
        userApiKeys = apiKeys.map((key) => ({
          vendor: key.vendor || key.provider || 'openai',
          key: key.api_key_encrypted || key.key || '',
        }));
      }
    } catch (err) {
    }

    // Get API key for OpenAI
    const apiKey = getOpenAIApiKey(userApiKeys);

    // Get main keyword from campaign context assets or article
    let mainKeyword = null;
    if (campaignContext?.assets?.main_keyword) {
      mainKeyword = campaignContext.assets.main_keyword;
    } else {
      // Try to get from article if available
      try {
        const { data: article } = await supabase
          .from("articles")
          .select("assets")
          .eq("id", articleId)
          .single();
        if (article?.assets?.main_keyword) {
          mainKeyword = article.assets.main_keyword;
        }
      } catch (err) {
        // Ignore if article fetch fails
      }
    }

    // Write each section
    const writtenSections = [];
    let previousSectionsContext = "";
    let heroUsed = false;

    for (let i = 0; i < sections.length; i++) {
      const sectionSpec = sections[i];
      
      // Get talk points for this section
      // Priority: 1) selectedTalkPoints (explicit mapping), 2) talkPointIds (ID-based lookup), 3) global talkPoints (fallback)
      let sectionTalkPoints = [];
      
      if (sectionSpec.selectedTalkPoints && Array.isArray(sectionSpec.selectedTalkPoints) && sectionSpec.selectedTalkPoints.length > 0) {
        // Use explicitly provided selected talk points (from buildSectionsForWriter)
        sectionTalkPoints = sectionSpec.selectedTalkPoints;
        
      } else if (sectionSpec.talkPointIds && Array.isArray(sectionSpec.talkPointIds) && sectionSpec.talkPointIds.length > 0) {
        // Fallback to ID-based lookup (backward compatibility)
        sectionTalkPoints = (talkPoints || []).filter(tp => {
          const tpId = tp.id || tp.name || tp.topic;
          return sectionSpec.talkPointIds.includes(tpId) || 
                 sectionSpec.talkPointIds.includes(tp.name) || 
                 sectionSpec.talkPointIds.includes(tp.topic);
        });
        
        
        // Warn if ID mismatch
        if (sectionTalkPoints.length < sectionSpec.talkPointIds.length) {
          const missingIds = sectionSpec.talkPointIds.filter(id => {
            const tp = (talkPoints || []).find(tp => {
              const tpId = tp.id || tp.name || tp.topic;
              return tpId === id || tp.name === id || tp.topic === id;
            });
            return !tp;
          });
        }
      } else {
        // No mapping - use global talkPoints as fallback
        sectionTalkPoints = talkPoints || [];
        
      }

      // Find topics relevant to this section for competitor examples
      const relevantTopics = (campaignContext.assets?.topics || []).filter(topic => {
        const topicLabel = (topic.label || '').toLowerCase();
        const sectionTitle = (sectionSpec.sectionTitle || '').toLowerCase();
        
        // Match if topic label appears in section title or vice versa
        if (topicLabel.includes(sectionTitle) || sectionTitle.includes(topicLabel)) {
          return true;
        }
        
        // Match if any talk point topic matches
        return sectionTalkPoints.some(tp => {
          const tpTopic = (tp.topic || '').toLowerCase();
          return topicLabel.includes(tpTopic) || tpTopic.includes(topicLabel);
        });
      });

      const competitorExamplesSection = relevantTopics.length > 0
        ? `\nCOMPETITOR STRATEGY & EXAMPLES (Learn from these):\n${relevantTopics.map(topic => {
            const examples = topic.competitorExamples || [];
            if (examples.length === 0 && !topic.strategy) return '';
            
            let topicSection = `Topic: ${topic.label}`;
            
            // Include overall strategy commentary if available
            if (topic.strategy) {
              topicSection += `\nOverall Strategy: ${topic.strategy}`;
            }
            
            // Include specific implementation examples
            if (examples.length > 0) {
              topicSection += `\n${examples.map((ex, i) => {
                const tacticsText = ex.keyTactics && ex.keyTactics.length > 0
                  ? `\n  Key Tactics: ${ex.keyTactics.join(", ")}`
                  : '';
                return `  Example ${i + 1}:
  Text: "${ex.snippet}"
  Source: ${ex.source}
  Strategy: ${ex.strategyInsight}
  How to Adapt: ${ex.writingInstruction}
  Best Used: ${ex.context}${tacticsText}`;
              }).join('\n\n')}`;
            }
            
            return topicSection;
          }).filter(t => t).join('\n\n')}`
        : '';

      // Build prompt for writing this section
      const tierInfo = sectionSpec.tier 
        ? `\nTIER: ${sectionSpec.tier} - ${sectionSpec.tierRationale || getTierDescription(sectionSpec.tier)}\nThis section is ${sectionSpec.tier === 1 ? 'critical for establishing immediate relevance' : sectionSpec.tier === 2 ? 'important for building credibility and differentiation' : 'supportive for completeness and friction reduction'}.`
        : '';
      
      const strategicContextSection = strategicContext
        ? `\nSTRATEGIC CONTEXT (Page-Level Strategy):
ICP Mental State: ${strategicContext.icpMentalState || "Not specified"}
Decision Factors: ${(strategicContext.decisionFactors || []).join(", ") || "Not specified"}
Risk Factors: ${(strategicContext.riskFactors || []).join(", ") || "Not specified"}
Competitive Context: ${strategicContext.competitiveContext || "Not specified"}

What They Want to See: ${(strategicContext.whatTheyWantToSee || []).join("; ")}
What We Want Them to See: ${(strategicContext.whatWeWantThemToSee || []).join("; ")}`
        : '';

      // Migrate old formatId if needed
      const requestedFormat = sectionSpec.formatId ? migrateFormatId(sectionSpec.formatId) : null;
      
      const formatGuidance = Object.entries(TEMPLATE_GUIDANCE)
        .map(([id, guidance]) => {
          let guidanceText = `- ${id}: ${guidance}`;
          // Add variant information
          if (id === "hero") {
            guidanceText += ` Variants: 'default' (two-column with image), 'fullWidth' (centered single column), 'twoColumnWithForm' (form on right instead of image).`;
          } else if (id === "contentSection") {
            guidanceText += ` Variants: 'single' (standard paragraphs) or 'twoColumn' (side-by-side comparison).`;
          } else if (id === "keyValueList") {
            guidanceText += ` Variants: 'labelValue' (facts/specs), 'checklist' (requirements), 'stats' (metrics, ONLY if real numbers exist).`;
          } else if (id === "conversionBlock") {
            guidanceText += ` Variants: 'form' (data capture) or 'cta' (call-to-action).`;
          }
          return guidanceText;
        })
        .join("\n");

      // Add hero section H1 title guidance if this is a hero section
      const heroTitleGuidance = (requestedFormat?.formatId === "hero" || sectionSpec.formatId === "hero")
        ? `\n\nCRITICAL: HERO SECTION H1 TITLE REQUIREMENTS:
- The H1 (main heading) MUST include the main keyword: "${mainKeyword || "main keyword not available"}"
- Priority order: 1) Include main keyword (relevance), 2) State what it is (clarity), 3) Add value phrase if space allows
- Relevance is more important than credibility - state what it is first
- Value is secondary to clarity - don't sacrifice clarity for value statements
- Example structure: "[Main Keyword] [What It Is] [Value Phrase if space allows]"
- Avoid generic titles like "Fast & Easy Workflow" that don't include the main keyword
- The main keyword should appear naturally in the H1, not forced`
        : "";

      const systemPrompt = `You are a landing page content writer. Write structured content for a specific section using cognitive prioritization principles.

SECTION: ${sectionSpec.sectionTitle}${tierInfo}
REQUESTED FORMAT: ${requestedFormat ? `${requestedFormat.formatId}${requestedFormat.variant ? ` (variant: ${requestedFormat.variant})` : ""}` : "not specified"}${heroTitleGuidance}
FORMAT SELECTION RULES:
- Choose the best format for this section using the guidance below.
- If a variant is specified, use that variant. Otherwise, choose the most appropriate variant based on content intent.
- Only one hero is allowed for the entire page. Hero used already: ${heroUsed ? "YES" : "NO"}.
- If hero is already used, DO NOT choose hero again. Pick another suitable format.
- Prefer formats that maximize scannability and fit the section intent.
- For keyValueList with 'stats' variant: ONLY use if you have real numeric metrics (auto-disqualify if not).
- For quoteBlock: ONLY use if you have real quotes/testimonials (auto-disqualify if not).

FORMAT GUIDANCE:
${formatGuidance}
CONSTRAINTS: ${(sectionSpec.constraints || []).join(", ")}${strategicContextSection}

STRATEGIC WRITING GUIDANCE:
${sectionSpec.instructionalPrompt}

TALK POINTS TO COVER:
${sectionTalkPoints.length > 0 
  ? `${sectionTalkPoints.map(tp => `- ${tp.name}: ${tp.details}`).join("\n")}

CRITICAL: You MUST use ONLY the talk points listed above for this section. Do NOT introduce other talk points that are not in this list. Each talk point should be addressed in your content.`
  : `No specific talk points assigned to this section. You may draw from general context, but focus on the section's purpose: ${sectionSpec.sectionTitle}`}
${competitorExamplesSection}
${previousSectionsContext ? `\nPREVIOUS SECTIONS (Avoid Repetition):\n${previousSectionsContext}` : ""}

OUTPUT REQUIREMENTS:
- Choose the best format for this section and write high-quality content in MARKDOWN format
- Use standard markdown syntax: headings (#, ##), paragraphs, lists (-, *), bold (**text**), italic (*text*)
- Focus on creating excellent content - formatting into HTML structure will happen in a separate step
- Use ONLY the proof facts provided (no invented claims)
- Follow the constraints strictly
- Address the objection specified
- Make the key claim believable
- Achieve the objective stated
- Follow tone rules from strategic context
- Reference competitor examples where relevant - adapt their strategies while customizing for your specific offer/ICP
- Use competitor insights as inspiration, not templates - maintain a unique voice and perspective

CRITICAL: Return JSON with this EXACT structure:
{
  "formatId": "chosen_format_id_from_guidance",
  "variant": "variant_if_applicable" (optional, only for contentSection, keyValueList, or conversionBlock),
  "markdown": "Your markdown content here. Use # for main heading, ## for subheadings, regular paragraphs, and - or * for lists."
}

VARIANT RULES:
- hero: Use "variant": "default" (two-column with image), "fullWidth" (centered), or "twoColumnWithForm" (form on right)
- contentSection: Use "variant": "single" for standard paragraphs, "twoColumn" for side-by-side comparison
- keyValueList: Use "variant": "labelValue" for facts/specs, "checklist" for requirements, "stats" ONLY if real numbers exist
- conversionBlock: Use "variant": "form" for data capture, "cta" for call-to-action
- Other formats: Omit variant field

The markdown should be comprehensive and well-structured, containing all the content for this section.`;

      const userPrompt = `Write the "${sectionSpec.sectionTitle}" section.

ICP: ${campaignContext?.icp?.name || ""}
${campaignContext?.icp?.description ? `Description: ${campaignContext.icp.description}` : ""}

Offer: ${campaignContext?.offer?.name || ""}
${campaignContext?.offer?.description ? `Description: ${campaignContext.offer.description}` : ""}

CRITICAL: Return JSON in this EXACT format:
{
  "formatId": "chosen_format_id_from_guidance",
  "variant": "variant_if_applicable" (optional, only for contentSection, keyValueList, or conversionBlock),
  "markdown": "Your markdown content here"
}

Write comprehensive, high-quality content in markdown format. Include headings, paragraphs, lists, and any other content elements that communicate the key points effectively.`;

      // Store prompts for logging
      const inputPrompt = {
        system: systemPrompt,
        user: userPrompt,
        totalSize: systemPrompt.length + userPrompt.length,
      };

      // Call AI to write the section content in markdown
      const writeResult = await callStructured(
        "high",
        [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        {
          type: "object",
          properties: {
            formatId: { type: "string" },
            variant: { type: "string" },
            markdown: { type: "string" },
          },
          required: ["markdown", "formatId"],
        },
        { 
          stepName: `writeSection_${sectionSpec.sectionId}`, 
          maxAttempts: 2,
          apiKey: apiKey,
          userApiKeys: userApiKeys,
        }
      );

      if (!writeResult.ok || !writeResult.data) {
        throw new Error(`Failed to write section "${sectionSpec.sectionTitle}": ${writeResult.error?.message || "Unknown error"}`);
      }

      const markdown = writeResult.data.markdown || "";
      let chosenFormat = writeResult.data.formatId || sectionSpec.formatId;
      let variant = writeResult.data.variant;

      // Migrate old formatId if needed
      if (chosenFormat) {
        const migrated = migrateFormatId(chosenFormat);
        chosenFormat = migrated.formatId;
        // Use provided variant or migrated variant, but migrated takes precedence if no variant provided
        if (!variant && migrated.variant) {
          variant = migrated.variant;
        }
      } else {
        chosenFormat = "contentSection"; // Default fallback
        variant = "single";
      }

      // Enforce single hero rule
      if (chosenFormat === "hero") {
        if (heroUsed) {
          // fallback if hero already used
          chosenFormat = "contentSection";
          variant = "single";
        } else {
          heroUsed = true;
        }
      }

      // Validate variants
      if (chosenFormat === "keyValueList" && variant === "stats") {
        // Check if markdown contains numeric content (basic validation)
        const hasNumbers = /\d+/.test(markdown);
        if (!hasNumbers) {
          variant = "labelValue";
        }
      }

      if (chosenFormat === "quoteBlock") {
        // Check if markdown contains quote-like content (basic validation)
        const hasQuotes = /["'"]|quote|testimonial|says|said/i.test(markdown);
        if (!hasQuotes) {
          chosenFormat = "contentSection";
          variant = "single";
        }
      }
      
      // Validation: Check markdown content
      const validation = {
        warnings: [],
      };

      if (!markdown || markdown.trim().length < 50) {
        validation.warnings.push(`Markdown content is suspiciously short (${markdown.length} chars)`);
      }

      

      // Store response for logging
      const outputResponse = {
        markdown: markdown,
        rawResponse: JSON.stringify(writeResult.data, null, 2),
        errors: writeResult.error ? [writeResult.error] : [],
        failedAttempts: writeResult.failedAttempts || [],
        validation: validation,
      };

      // Store markdown content (HTML formatting happens in Step 4)
      writtenSections.push({
        sectionId: sectionSpec.sectionId,
        sectionTitle: sectionSpec.sectionTitle,
        formatId: chosenFormat,
        variant: variant, // Include variant if present
        markdown: markdown,
        logs: {
          inputPrompt: inputPrompt,
          outputResponse: outputResponse,
        },
      });

      // Add to previous sections context for next iteration (use markdown)
      previousSectionsContext += `\n\nSection ${i + 1}: ${sectionSpec.sectionTitle}\n${markdown}`;
    }

    // Return markdown sections (HTML formatting happens in Step 4)
    return NextResponse.json({
      success: true,
      writtenSections: writtenSections,
    });

  } catch (error) {
    return NextResponse.json(
      { 
        error: error.message || "Failed to write sections from outline",
        details: error.stack 
      },
      { status: 500 }
    );
  }
}
