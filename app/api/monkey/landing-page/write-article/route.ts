/**
 * API endpoint for Writing Full Article
 * Skips competitor benchmark to test agent mode capabilities
 * 
 * Process:
 * 1. Use Step 1 output + clarification answers to create full article
 * 2. Generate all sections based on page type and best practices
 * 3. Convert to HTML markup
 * 4. Output final HTML
 * 
 * Supports both response mode (legacy) and agent mode (Agents SDK)
 */

import { NextResponse } from "next/server";
import { createClient } from "@/libs/supabase/server";
import { writeSection } from "@/libs/monkey/actions/writeSection";
import { reviewArticle } from "@/libs/monkey/actions/reviewArticle";
import { reviewArticleSections } from "@/libs/monkey/actions/reviewArticleSections";
import { renderSection, renderFullPage } from "@/libs/monkey/tools/renderers";
import { getPageTypeConfig, getSectionTemplate, MarketingPageType } from "@/libs/monkey/references/pageTypes/registry";
import { log } from "@/libs/monkey/ui/logger";
import { SectionContent } from "@/libs/monkey/references/marketingTypes";
import { runAgent, createSessionId, writeArticleAgent, AGENTS_CONFIG } from "@/libs/agents";

/**
 * Clean HTML by removing markdown code block wrappers
 * Removes ```html, ```, and any leading/trailing whitespace
 */
function cleanHtmlFromMarkdown(html: string): string {
  if (!html || typeof html !== 'string') {
    return html;
  }
  
  return html
    .replace(/^```html\s*/i, '') // Remove opening ```html
    .replace(/^```\s*/i, '')      // Remove opening ```
    .replace(/\s*```$/i, '')      // Remove closing ```
    .trim();                       // Remove leading/trailing whitespace
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { 
      model = "high", 
      step1Output,
      clarificationAnswers = {},
      pageType = "BASE_UNIVERSAL",
      useAgentMode = false, // Toggle between response mode and agent mode
      theme = "minimalist", // Theme: "default" or "minimalist" (default: minimalist)
      agentMode = "structured", // Agent mode: "structured" or "open"
    } = body;

    if (!step1Output) {
      return NextResponse.json(
        { error: "step1Output is required" },
        { status: 400 }
      );
    }

    // Authenticate user
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { icp, offer, offerTypeAnalysis, talkPoints, hookPoints} = step1Output;

    // Route to deep research mode if requested
    if (agentMode === "deep_research") {
      log(`[write-article API] Using deep research mode (triage + research + specialized)`);
      
      // Import agents
      const { triageAgent, researchAgent, landingPageAgent, comparisonGuideAgent } = await import("@/libs/agents");
      
      // Build user prompt
      const userPrompt = clarificationAnswers?.userPrompt || 
        `Create content for ${offer?.name || "this topic"} targeting ${icp?.name || "the target audience"}`;
      
      // Step 1: Triage - determine page type
      log(`[write-article API] Step 1: Triaging page type...`);
      const triageResult = await runAgent({
        agent: triageAgent,
        input: userPrompt,
        sessionId: createSessionId(),
        userId: user.id,
        agentType: "triage",
        stream: false,
      }) as any;
      
      let pageType = "landing_page"; // default
      try {
        const triageOutput = JSON.parse(triageResult.finalOutput);
        pageType = triageOutput.pageType || "landing_page";
        log(`[write-article API] Triage result: ${pageType} (confidence: ${triageOutput.confidence})`);
      } catch (e) {
        log(`[write-article API] Failed to parse triage output, defaulting to landing_page`);
      }
      
      // Step 2: Research - analyze competitors
      log(`[write-article API] Step 2: Researching competitors...`);
      const researchQuery = `${offer?.name || ""} ${icp?.name || ""} ${pageType === "comparison" ? "comparison guide" : ""}`.trim();
      const researchResult = await runAgent({
        agent: researchAgent,
        input: `Find and analyze competitor pages for: ${researchQuery}`,
        sessionId: createSessionId(),
        userId: user.id,
        agentType: "research",
        stream: false,
      }) as any;
      
      let research: any = {};
      try {
        // Try to parse the output directly
        let outputToParse = researchResult.finalOutput;
        
        // If it's not a string, try to stringify and parse
        if (typeof outputToParse !== 'string') {
          outputToParse = JSON.stringify(outputToParse);
        }
        
        // Try to extract JSON from markdown code blocks if present
        const jsonMatch = outputToParse.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
        if (jsonMatch) {
          outputToParse = jsonMatch[1];
        }
        
        research = JSON.parse(outputToParse);
        log(`[write-article API] Research complete: ${research.competitorUrls?.length || 0} competitors analyzed`);
      } catch (e) {
        log(`[write-article API] [Deep Research] Failed to parse research output: ${e.message}`);
        log(`[write-article API] [Deep Research] Raw output (first 500 chars): ${String(researchResult.finalOutput).substring(0, 500)}`);
      }
      
      // Step 3: Generate with specialized agent
      log(`[write-article API] Step 3: Generating content with ${pageType} agent...`);
      const specializedAgent = pageType === "landing_page" ? landingPageAgent : comparisonGuideAgent;
      
      const contentContext = `
User Request: ${userPrompt}

Target Audience (ICP):
- Name: ${icp?.name || "Not specified"}
- Description: ${icp?.description || "Not specified"}
- Roles: ${icp?.roles?.join(", ") || "Not specified"}
- Pain Points: ${icp?.top_pains?.join(", ") || "Not specified"}

Offer:
- Name: ${offer?.name || "Not specified"}
- Description: ${offer?.description || "Not specified"}

Theme: ${theme === "minimalist" ? "Minimalist (clean, professional, black/white)" : "Default (colorful, engaging)"}

Additional Context from User:
${Object.entries(clarificationAnswers || {}).filter(([key]) => key !== 'userPrompt').map(([key, value]) => `- ${key}: ${value}`).join("\n")}

Competitive Research Insights:
${JSON.stringify(research, null, 2)}

Generate a complete ${pageType === "landing_page" ? "landing page" : "comparison guide"} (HTML body content only) using the competitive insights above.
`;
      
      const contentResult = await runAgent({
        agent: specializedAgent,
        input: contentContext,
        sessionId: createSessionId(),
        userId: user.id,
        agentType: `${pageType}_generation`,
        stream: false,
      }) as any;
      
      // Extract HTML and wrap with full page structure
      let bodySections = "";
      if (typeof contentResult.finalOutput === "string") {
        bodySections = contentResult.finalOutput;
      }
      
      // Wrap with full HTML structure including Tailwind CDN
      const tailwindConfig = theme === "minimalist"
        ? `
        tailwind.config = {
          theme: {
            extend: {
              colors: {
                primary: '#000000',
                secondary: '#ffffff',
              }
            }
          }
        }
      `
        : `
        tailwind.config = {
          theme: {
            extend: {
              colors: {
                primary: '#3b82f6',
                secondary: '#2563eb',
              }
            }
          }
        }
      `;
      
      const fullHtml = `<!DOCTYPE html>
<html lang="en" data-theme="${theme}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${offer?.name || "Page"}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    ${tailwindConfig}
  </script>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }
  </style>
</head>
<body class="${theme === 'minimalist' ? 'bg-white text-black' : 'bg-gray-50 text-gray-900'}">
${bodySections}
</body>
</html>`;

      // Clean HTML from markdown code blocks
      const cleanedHtml = cleanHtmlFromMarkdown(fullHtml);
      log(`[write-article API] ✅ Deep research mode complete: HTML length: ${cleanedHtml.length}`);

      return NextResponse.json({
        success: true,
        mode: "deep_research",
        pageType,
        research,
        article: {
          html: cleanedHtml,
          sections: [],
          metadata: {
            pageType,
            theme,
            competitorsAnalyzed: research.competitorUrls?.length || 0,
            htmlLength: cleanedHtml.length,
          },
        },
      });
    }

    // Route to open agent mode if requested
    if (agentMode === "open") {
      log(`[write-article API] Using open agent mode (experimental with research)`);
      
      // Import agents
      const { openArticleAgent, researchAgent } = await import("@/libs/agents");
      
      // Build user prompt
      const userPrompt = clarificationAnswers?.userPrompt || 
        `Create content for ${offer?.name || "this topic"} targeting ${icp?.name || "the target audience"}`;
      
      // Step 1: Research - analyze competitors (NEW)
      log(`[write-article API] Step 1: Researching competitors for open agent...`);
      const researchQuery = `${offer?.name || ""} ${icp?.name || ""}`.trim();
      const researchResult = await runAgent({
        agent: researchAgent,
        input: `Find and analyze competitor pages for: ${researchQuery}`,
        sessionId: createSessionId(),
        userId: user.id,
        agentType: "research",
        stream: false,
      }) as any;
      
      let research: any = {};
      try {
        // Try to parse the output directly
        let outputToParse = researchResult.finalOutput;
        
        // If it's not a string, try to stringify and parse
        if (typeof outputToParse !== 'string') {
          outputToParse = JSON.stringify(outputToParse);
        }
        
        // Try to extract JSON from markdown code blocks if present
        const jsonMatch = outputToParse.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
        if (jsonMatch) {
          outputToParse = jsonMatch[1];
        }
        
        research = JSON.parse(outputToParse);
        log(`[write-article API] Research complete: ${research.competitorUrls?.length || 0} competitors analyzed`);
      } catch (e) {
        log(`[write-article API] [Open Agent] Failed to parse research output: ${e.message}`);
        log(`[write-article API] [Open Agent] Raw output (first 500 chars): ${String(researchResult.finalOutput).substring(0, 500)}`);
      }
      
      // Step 2: Generate with open agent (ENHANCED with research)
      log(`[write-article API] Step 2: Generating content with open agent...`);
      const sessionId = createSessionId();
      
      // Build context for agent
      const agentContext = `
User Request: ${userPrompt}

Target Audience (ICP):
- Name: ${icp?.name || "Not specified"}
- Description: ${icp?.description || "Not specified"}
- Roles: ${icp?.roles?.join(", ") || "Not specified"}
- Pain Points: ${icp?.top_pains?.join(", ") || "Not specified"}

Offer:
- Name: ${offer?.name || "Not specified"}
- Description: ${offer?.description || "Not specified"}

Theme: ${theme === "minimalist" ? "Minimalist (clean, professional, black/white)" : "Default (colorful, engaging)"}

Additional Context from User:
${Object.entries(clarificationAnswers || {}).filter(([key]) => key !== 'userPrompt').map(([key, value]) => `- ${key}: ${value}`).join("\n")}

Competitive Research Insights (for inspiration, not rigid constraints):
${JSON.stringify(research, null, 2)}

IMPORTANT: Use the competitive insights above to inform your section selection and content, but DO NOT follow them rigidly. 
Use your judgment to create the best page for this specific use case. Feel free to include sections competitors don't have if they make sense.

Generate a complete page (HTML body content only) that effectively communicates the value of this offer to the target audience.
`;

      // Run agent
      const result = await runAgent({
        agent: openArticleAgent,
        input: agentContext,
        sessionId,
        userId: user.id,
        agentType: "open_article",
        stream: false,
      }) as any;

      // Extract HTML from agent output and wrap with full page structure
      let bodySections = "";
      
      if (typeof result.finalOutput === "string") {
        bodySections = result.finalOutput;
      }
      
      // Wrap with full HTML structure including Tailwind CDN
      const tailwindConfig = theme === "minimalist"
        ? `
        tailwind.config = {
          theme: {
            extend: {
              colors: {
                primary: '#000000',
                secondary: '#ffffff',
              }
            }
          }
        }
      `
        : `
        tailwind.config = {
          theme: {
            extend: {
              colors: {
                primary: '#3b82f6',
                secondary: '#2563eb',
              }
            }
          }
        }
      `;
      
      const fullHtml = `<!DOCTYPE html>
<html lang="en" data-theme="${theme}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${offer?.name || "Landing Page"}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    ${tailwindConfig}
  </script>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }
  </style>
</head>
<body class="${theme === 'minimalist' ? 'bg-white text-black' : 'bg-gray-50 text-gray-900'}">
${bodySections}
</body>
</html>`;

      // Clean HTML from markdown code blocks
      const cleanedHtmlOpen = cleanHtmlFromMarkdown(fullHtml);
      log(`[write-article API] ✅ Open agent complete: HTML length: ${cleanedHtmlOpen.length}`);

      return NextResponse.json({
        success: true,
        mode: "open_agent",
        sessionId: result.sessionId,
        research, // Include research insights
        article: {
          html: cleanedHtmlOpen,
          sections: [],
          metadata: {
            agentMode: "open",
            theme,
            competitorsAnalyzed: research.competitorUrls?.length || 0,
            htmlLength: cleanedHtmlOpen.length,
          },
        },
      });
    }

    log(`[write-article API] Starting article writing (mode: ${useAgentMode ? "agent" : "response"})`);
    log(`[write-article API] ICP: ${icp?.name}, Offer: ${offer?.name || "none"}`);

    // Get page type configuration
    const pageConfig = getPageTypeConfig(pageType as MarketingPageType);
    const recommendedSections = pageConfig?.recommended_sections || [];
    const optionalSections = pageConfig?.optional_sections || [];

    // Convert string section types to objects with type property
    const sectionsToWrite = [
      ...recommendedSections.map(s => ({ type: s })),
      ...optionalSections.slice(0, 3).map(s => ({ type: s }))
    ];

    log(`[write-article API] Sections to write: ${sectionsToWrite.length} (${sectionsToWrite.map(s => s.type).join(", ")})`);

    log(`[write-article API] Agent mode requested: ${useAgentMode}, Feature flag enabled: ${AGENTS_CONFIG.useAgentsSDK.writeArticle}`);
    
    if (useAgentMode && AGENTS_CONFIG.useAgentsSDK.writeArticle) {
      // Agent Mode: Use Agents SDK
      log(`[write-article API] Using Agents SDK for article writing`);
      log(`[write-article API] Sections to write: ${sectionsToWrite.length}`);
      
      try {
        const sessionId = createSessionId();
        
        // Prepare context for agent
        const agentContext = {
          icp,
          offer,
          talkPoints: talkPoints || { uniqueSellingPoints: [], transactionalFacts: [] },
          hookPoints: hookPoints || {},
          offerType: offerTypeAnalysis?.offerType || "transactional",
        };

        const agentInput = `Write a complete landing page article based on the following context:

**Step 1 Output:**
- ICP: ${icp?.name || "N/A"} - ${icp?.description || ""}
- Offer: ${offer?.name || "N/A"} - ${offer?.description || ""}
- Offer Type: ${offerTypeAnalysis?.offerType || "transactional"}

**Clarification Answers:**
${JSON.stringify(clarificationAnswers, null, 2)}

**Page Type:** ${pageType}
**Required Sections (write ALL of these):**
${sectionsToWrite.map((s, idx) => `${idx + 1}. ${s.type}`).join("\n")}

**CRITICAL INSTRUCTIONS:**
1. You MUST use the write_section tool for EACH of the ${sectionsToWrite.length} sections listed above
2. For each section, call write_section with:
   - sectionType: the section type (e.g., "HERO_VALUE_PROP")
   - format: "html"
   - context: ${JSON.stringify(agentContext, null, 2)}
3. After writing all sections, collect all the section results
4. Use the render_full_page tool with all sections to create the final HTML
5. Return a JSON object with: { "html": "...", "sections": [...] }

Start by writing the first section: ${sectionsToWrite[0]?.type || "HERO_VALUE_PROP"}`;

        const agentResult = await runAgent({
          agent: writeArticleAgent,
          input: agentInput,
          sessionId,
          userId: user.id,
          campaignId: body.campaignId,
          stream: false,
          useMemorySession: AGENTS_CONFIG.defaultSessionType === "memory",
        }) as { finalOutput: any; sessionId: string; metadata?: any };

        // Parse agent output (should contain sections and HTML)
        let articleData;
        let actualSectionsCount = 0;
        
        try {
          articleData = typeof agentResult.finalOutput === "string" 
            ? JSON.parse(agentResult.finalOutput) 
            : agentResult.finalOutput;
          
          // Try to extract sections from tool calls if not in final output
          if (agentResult.metadata?.toolCalls) {
            const sectionToolCalls = agentResult.metadata.toolCalls.filter(
              (tc: any) => tc.name === "write_section" && tc.result
            );
            actualSectionsCount = sectionToolCalls.length;
            
            if (!articleData.sections && sectionToolCalls.length > 0) {
              articleData.sections = sectionToolCalls.map((tc: any) => ({
                type: tc.result?.sectionType || "unknown",
                html: tc.result?.html || "",
              }));
            }
          }
          
          // If still no HTML, try to get it from render_full_page tool result
          if (!articleData.html && agentResult.metadata?.toolCalls) {
            const renderCall = agentResult.metadata.toolCalls.find(
              (tc: any) => tc.name === "render_full_page" && tc.result
            );
            if (renderCall?.result?.html) {
              articleData.html = renderCall.result.html;
              actualSectionsCount = renderCall.result.sectionsCount || actualSectionsCount;
            }
          }
          
          log(`[write-article API] Agent output parsed: html=${!!articleData.html}, sections=${articleData.sections?.length || 0}, toolCalls=${agentResult.metadata?.toolCalls?.length || 0}`);
        } catch (parseError) {
          log(`[write-article API] ⚠️ Failed to parse agent output: ${parseError}`);
          articleData = { html: agentResult.finalOutput || "", sections: [] };
        }

        // Clean HTML from markdown code blocks
        const agentHtml = cleanHtmlFromMarkdown(articleData.html || articleData.content || "");
        
        return NextResponse.json({
          success: true,
          mode: "agent",
          sessionId: agentResult.sessionId,
          article: {
            html: agentHtml,
            sections: articleData.sections || [],
            metadata: {
              pageType,
              sectionsCount: actualSectionsCount || sectionsToWrite.length,
              expectedSections: sectionsToWrite.length,
              toolCalls: agentResult.metadata?.toolCalls?.length || 0,
              ...agentResult.metadata,
            },
          },
        });
      } catch (agentError: any) {
        log(`[write-article API] ❌ Agent mode failed: ${agentError.message}`);
        // Fall back to response mode
        log(`[write-article API] Falling back to response mode`);
      }
    }

    // Response Mode: Legacy approach
    log(`[write-article API] Using response mode for article writing`);
    log(`[write-article API] Will write ${sectionsToWrite.length} sections: ${sectionsToWrite.map(s => s.type).join(", ")}`);

    const writtenSections: Array<{
      sectionType: string;
      content: SectionContent;
      html: string;
    }> = [];
    
    const sectionLogs: Array<{
      sectionType: string;
      step: string;
      data: any;
    }> = [];

    // Track used formats to ensure variety
    const usedFormats = new Set<string>();
    const formatCategories = {
      card: ["card_grid", "card_grid_icon", "card_grid_numbered"],
      icon: ["icon_list", "icon_list_gradient"],
      table: ["comparison_table", "pricing_table", "table"],
      narrative: ["text_block", "text_block_prose", "narrative_block"],
      visual: ["stats_strip", "quote_block", "checklist_block", "two_column_split"],
    };

    // Track used talk points to avoid repetition
    const usedTalkPoints = new Set<string>();
    const totalSections = sectionsToWrite.length;

    // Write each section
    for (let i = 0; i < sectionsToWrite.length; i++) {
      const sectionConfig = sectionsToWrite[i];
      try {
        log(`[write-article API] ========================================`);
        log(`[write-article API] Writing section ${i + 1}/${totalSections}: ${sectionConfig.type}`);
        
        sectionLogs.push({
          sectionType: sectionConfig.type,
          step: "start",
          data: { index: i + 1, total: totalSections },
        });

        // Get section template to find recommended formats
        const sectionTemplate = getSectionTemplate(sectionConfig.type);
        const recommendedFormats = sectionTemplate?.recommended_formats || ["text_block"];

        // Smart format selection: rotate through formats, avoid repetition
        let selectedFormat = "text_block";
        let formatCategory = "narrative";

        // First, try to find a format that hasn't been used yet
        for (const fmt of recommendedFormats) {
          if (!usedFormats.has(fmt)) {
            selectedFormat = fmt;
            // Determine category
            for (const [cat, formats] of Object.entries(formatCategories)) {
              if (formats.some(f => fmt.includes(f))) {
                formatCategory = cat;
                break;
              }
            }
            break;
          }
        }

        // If all formats have been used, prefer non-card/icon formats
        if (usedFormats.has(selectedFormat)) {
          const nonRepetitiveFormats = recommendedFormats.filter(f => 
            !f.includes("card") && !f.includes("icon") && !usedFormats.has(f)
          );
          if (nonRepetitiveFormats.length > 0) {
            selectedFormat = nonRepetitiveFormats[0];
          } else {
            // Last resort: pick the first recommended format
            selectedFormat = recommendedFormats[0];
          }
        }

        usedFormats.add(selectedFormat);
        log(`[write-article API]   Format selected: ${selectedFormat} (category: ${formatCategory})`);
        
        sectionLogs.push({
          sectionType: sectionConfig.type,
          step: "format_selected",
          data: { format: selectedFormat, category: formatCategory },
        });

        // Build ENHANCED context of previously written sections
        const previousSectionsContext = writtenSections.map((s, idx) => {
          const contentPreview = typeof s.content.content === 'string' 
            ? s.content.content.substring(0, 150) 
            : JSON.stringify(s.content.content).substring(0, 150);
          
          const template = getSectionTemplate(s.sectionType as any);
          
          return `${idx + 1}. ${s.sectionType} (format: ${s.content.format || 'unknown'})
   Purpose: ${template?.purpose || 'N/A'}
   Content preview: ${contentPreview}...
   Key points covered: ${s.content.notes?.whyThisSection || 'N/A'}`;
        }).join("\n\n");

        log(`[write-article API]   Calling writeSection...`);
        const writeInput = {
          sectionType: sectionConfig.type,
          format: selectedFormat,
          icp,
          offer,
          talkPoints: talkPoints || { uniqueSellingPoints: [], transactionalFacts: [] },
          hookPoints: hookPoints || {},
          offerType: offerTypeAnalysis?.offerType || "transactional",
          previousSections: previousSectionsContext,
          usedTalkPoints,
          theme, // Pass theme to writeSection
        };
        
        sectionLogs.push({
          sectionType: sectionConfig.type,
          step: "writeSection_input",
          data: {
            format: selectedFormat,
            icpName: icp?.name,
            offerName: offer?.name,
            talkPointsCount: {
              usps: talkPoints?.uniqueSellingPoints?.length || 0,
              facts: talkPoints?.transactionalFacts?.length || 0,
            },
            previousSectionsCount: writtenSections.length,
          },
        });
        
        const sectionContent = await writeSection(model, writeInput);
        
        log(`[write-article API]   writeSection completed`);
        sectionLogs.push({
          sectionType: sectionConfig.type,
          step: "writeSection_output",
          data: {
            format: sectionContent.format,
            contentType: typeof sectionContent.content,
            contentKeys: sectionContent.content && typeof sectionContent.content === 'object' ? Object.keys(sectionContent.content) : [],
            hasNotes: !!sectionContent.notes,
          },
        });

        // Normalize content - handle cases where AI returns HTML string directly or nested structure
        let html: string;
        const content = sectionContent.content;
        
        log(`[write-article API]   Content type: ${typeof content}, format: ${selectedFormat}`);
        log(`[write-article API]   Content keys: ${content && typeof content === 'object' ? Object.keys(content).join(', ') : 'N/A'}`);
        
        // If content is a string (HTML), use it directly
        if (typeof content === "string") {
          html = content;
          log(`[write-article API]   → Using direct HTML string (${html.length} chars)`);
        } 
        // If content has an "html" property, use that
        else if (content && typeof content === "object" && "html" in content && typeof content.html === "string") {
          html = content.html;
          log(`[write-article API]   → Extracted HTML from content.html (${html.length} chars)`);
        }
        // Otherwise, render using the renderer (structured data like cards, etc.)
        else {
          log(`[write-article API]   → Calling renderSection with format: ${sectionContent.format}`);
          html = renderSection(sectionContent);
          log(`[write-article API]   → Rendered from structured content (${html.length} chars)`);
          log(`[write-article API]   → HTML preview: ${html.substring(0, 200)}...`);
        }

        if (!html || html.trim().length === 0) {
          log(`[write-article API] ⚠️ WARNING: Section ${sectionConfig.type} has empty HTML!`);
          sectionLogs.push({
            sectionType: sectionConfig.type,
            step: "warning_empty_html",
            data: { htmlLength: html?.length || 0 },
          });
        }

        writtenSections.push({
          sectionType: sectionConfig.type,
          content: sectionContent,
          html,
        });

        log(`[write-article API] ✅ Section ${sectionConfig.type} written and rendered (${html.length} chars)`);
        sectionLogs.push({
          sectionType: sectionConfig.type,
          step: "complete",
          data: {
            htmlLength: html.length,
            htmlPreview: html.substring(0, 200),
          },
        });
      } catch (sectionError: any) {
        log(`[write-article API] ⚠️ Failed to write section ${sectionConfig.type}: ${sectionError.message}`);
        sectionLogs.push({
          sectionType: sectionConfig.type,
          step: "error",
          data: {
            error: sectionError.message,
            stack: sectionError.stack?.substring(0, 500),
          },
        });
        // Continue with other sections
      }
    }

    // Render full page HTML - use the already-rendered HTML from each section
    const htmlSections = writtenSections.map((s, index) => {
      const html = typeof s.html === 'string' ? s.html : String(s.html || '');
      if (!html || html === '[object Object]') {
        log(`[write-article API] ⚠️ Section ${s.sectionType} has invalid HTML, attempting to re-render`);
        // Try to re-render if html is invalid
        try {
          const reRendered = renderSection(s.content as SectionContent);
          return `<!-- Section ${index + 1}: ${s.sectionType} -->\n${reRendered}`;
        } catch (e) {
          log(`[write-article API] ❌ Failed to re-render section ${s.sectionType}`);
          return `<!-- Section ${index + 1}: ${s.sectionType} - RENDER FAILED -->`;
        }
      }
      return `<!-- Section ${index + 1}: ${s.sectionType} -->\n${html}`;
    });

    // Use renderFullPage with theme support
    let fullPageHtml = renderFullPage(writtenSections.map(s => s.content as SectionContent), { theme });
    
    // Clean HTML from markdown code blocks
    fullPageHtml = cleanHtmlFromMarkdown(fullPageHtml);

    log(`[write-article API] ✅ Response mode complete: ${writtenSections.length} sections, HTML length: ${fullPageHtml?.length || 0}`);
    log(`[write-article API] HTML preview (first 500 chars): ${fullPageHtml.substring(0, 500)}`);

    // Step 1: Review sections for duplicates, empty content, and goal achievement
    log(`[write-article API] Starting sections review (duplicates, empty, goals)...`);
    let sectionsReview;
    try {
      sectionsReview = await reviewArticleSections(model, {
        sections: writtenSections.map(s => ({
          sectionType: s.sectionType,
          html: s.html,
          content: s.content,
        })),
        icp,
        offer,
        clarificationAnswers,
        pageGoals: `Create a compelling landing page for ${offer.name} targeting ${icp.name}. The page should clearly communicate value, address pain points, and drive conversions.`,
      });
      
      log(`[write-article API] ✅ Sections review complete`);
      log(`   Goals Achieved: ${sectionsReview.goalsAchieved ? "YES" : "NO"}`);
      log(`   Issues Found: ${sectionsReview.issues.length}`);
      
      // Log issues by severity
      const criticalIssues = sectionsReview.issues.filter(i => i.severity === "critical");
      const highIssues = sectionsReview.issues.filter(i => i.severity === "high");
      
      if (criticalIssues.length > 0) {
        log(`[write-article API] ⚠️ CRITICAL ISSUES (${criticalIssues.length}):`);
        criticalIssues.forEach(issue => {
          log(`   - Section ${issue.sectionIndex} (${issue.sectionType}): ${issue.issueType}`);
          log(`     ${issue.description}`);
          log(`     → ${issue.suggestion}`);
        });
      }
      
      if (highIssues.length > 0) {
        log(`[write-article API] ⚠️ HIGH PRIORITY ISSUES (${highIssues.length}):`);
        highIssues.forEach(issue => {
          log(`   - Section ${issue.sectionIndex} (${issue.sectionType}): ${issue.issueType}`);
          if (issue.duplicateWith !== undefined) {
            log(`     Duplicates section ${issue.duplicateWith}`);
          }
          log(`     ${issue.description}`);
        });
      }
      
      log(`[write-article API] Goals Analysis: ${sectionsReview.goalsAnalysis}`);
      
    } catch (reviewError: any) {
      log(`[write-article API] ⚠️ Sections review failed: ${reviewError.message}`);
      sectionsReview = null;
    }

    // Step 2: Review the complete article for quality issues
    log(`[write-article API] Starting article quality review...`);
    let articleReview;
    try {
      articleReview = await reviewArticle(model, {
        sections: writtenSections.map(s => ({
          sectionType: s.sectionType,
          format: s.content.format || "unknown",
          content: s.content.content,
          html: s.html,
        })),
        icp,
        offer,
        fullHtml: fullPageHtml, // Already cleaned above
      });
      
      log(`[write-article API] ✅ Quality review complete: ${articleReview.overallQuality}, ${articleReview.issues.length} issues found`);
      
      // Log critical and major issues
      const criticalIssues = articleReview.issues.filter(i => i.severity === "critical");
      const majorIssues = articleReview.issues.filter(i => i.severity === "major");
      
      if (criticalIssues.length > 0) {
        log(`[write-article API] ⚠️ CRITICAL QUALITY ISSUES (${criticalIssues.length}):`);
        criticalIssues.forEach(issue => {
          log(`   - [${issue.category}] ${issue.description}`);
          log(`     Affected: ${issue.affectedSections.join(", ")}`);
          log(`     Suggestion: ${issue.suggestion}`);
        });
      }
      
      if (majorIssues.length > 0) {
        log(`[write-article API] ⚠️ MAJOR QUALITY ISSUES (${majorIssues.length}):`);
        majorIssues.forEach(issue => {
          log(`   - [${issue.category}] ${issue.description}`);
        });
      }
    } catch (reviewError: any) {
      log(`[write-article API] ⚠️ Quality review failed: ${reviewError.message}`);
      articleReview = null;
    }

    return NextResponse.json({
      success: true,
      mode: "response",
      article: {
        html: fullPageHtml,
        sections: writtenSections.map(s => ({
          type: s.sectionType,
          html: s.html,
        })),
        metadata: {
          pageType,
          sectionsCount: writtenSections.length,
        },
        sectionsReview, // Include sections review (duplicates, empty, goals)
        qualityReview: articleReview, // Include quality review
      },
      sectionLogs, // Include detailed section generation logs
    });
  } catch (error: any) {
    log(`[write-article API] ❌ Error: ${error.message}`);
    log(`[write-article API] Stack: ${error.stack}`);
    return NextResponse.json(
      { 
        success: false,
        error: error.message || "Failed to write article" 
      },
      { status: 500 }
    );
  }
}
