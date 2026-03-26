/**
 * Summarize Talk Points Pipeline
 * Summarizes talk points from campaign context, assets, and user prompts
 */

import { MonkeyTaskRequest, MonkeyTaskResponse } from "../references/types";
import { callStructured } from "../tools/runtime/callStructured";
import { log } from "../ui/logger";
import { registerPipeline } from "./registry";

interface BriefStrategicContext {
  primaryIntent: string;           // What user came to do
  secondaryIntents: string[];      // Other possible intents
  immediateQuestions: string[];    // Questions user has right now
  decisionCriteria: string[];      // What will convince them
}

interface TalkPoint {
  name: string;
  details: string; // Contains rationale and example
  topic: string; // Free-text section/topic name
}

interface SummarizeTalkPointsResult {
  strategicContext: BriefStrategicContext;
  talkPoints: TalkPoint[];
}

// Schema factory for talk points and strategic context
function createTalkPointsSchema(targetCount: number) {
  return {
    type: "object",
    properties: {
      strategicContext: {
        type: "object",
        properties: {
          primaryIntent: { type: "string" },
          secondaryIntents: { type: "array", items: { type: "string" } },
          immediateQuestions: { type: "array", items: { type: "string" } },
          decisionCriteria: { type: "array", items: { type: "string" } },
        },
        required: ["primaryIntent", "immediateQuestions", "decisionCriteria"],
      },
      talkPoints: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            details: { type: "string" },
            topic: { type: "string" },
            // Accept capitalized variations (will be normalized)
            Name: { type: "string" },
            Details: { type: "string" },
            Topic: { type: "string" },
          },
          required: ["name", "details", "topic"],
          additionalProperties: true,
        },
        minItems: Math.max(5, Math.floor(targetCount * 0.5)), // At least 50% of target
        maxItems: Math.min(25, Math.ceil(targetCount * 1.2)), // Up to 20% over target
      },
    },
    required: ["strategicContext", "talkPoints"],
    additionalProperties: true,
  };
}

/**
 * Summarize talk points from campaign context, assets, and user prompts
 */
export async function summarizeTalkPointsPipeline(
  request: MonkeyTaskRequest,
  options?: {
    apiKey?: string;
    userApiKeys?: Array<{ vendor: string; key: string }>;
  }
): Promise<MonkeyTaskResponse> {
  const runId = `summarize-talk-points-${Date.now()}`;
  
  log("[summarizeTalkPointsPipeline] Starting talk points summarization");

  try {
    // Extract campaign context and assets
    const campaignContext = request.campaignContext || {};
    const icp = campaignContext.icp;
    const offer = campaignContext.offer;
    const assets = campaignContext.assets || {};
    const userPrompt = request.userInput?.query || "";
    
    // Get previous talk points and feedback if provided
    const previousTalkPoints = request.constraints?.previousTalkPoints || [];
    const feedback = request.constraints?.feedback || "";
    const targetTalkPointsCount = request.constraints?.targetTalkPointsCount || 10;

    if (!icp || !offer || !offer.name) {
      return {
        ok: false,
        runId,
        artifacts: {},
        errors: [{
          code: "INVALID_INPUT" as any,
          message: "ICP and Offer data are required for talk points summarization. Please provide campaignContext.icp and campaignContext.offer with name and description.",
          step: "validation",
        }],
      };
    }

    log(`[summarizeTalkPointsPipeline] Summarizing talk points for ICP: ${icp.name}, Offer: ${offer.name}`);

    // Resolve model tier
    const modelTier = request.model || "high";
    log(`[summarizeTalkPointsPipeline] Using model tier: ${modelTier}`);

    // Build the prompt
    const systemPrompt = `You are an expert content strategist specializing in extracting and organizing key talking points for landing pages.

Your task has TWO parts:
1. Identify and extract TALK POINTS
2. Generate BRIEF STRATEGIC CONTEXT (audience intent) FROM the talk points

PART 1: IDENTIFY TALK POINTS

TALK POINTS are key messages that:
- Address the ICP's pain points and needs
- Highlight the offer's unique value proposition
- Include transactional facts (pricing, timelines, guarantees, etc.)
- Support the campaign's goals and outcomes

CRITICAL: Do NOT assign tiers to talk points. Tier classification will be done later when organizing sections.

USING COMPETITOR EXAMPLES:
When competitor examples are provided with topics, leverage them to inform your talk points:
- Study the strategy insights to understand what makes examples effective
- Use the writing instructions to guide how content should be structured
- Reference competitor approaches in your rationale when they demonstrate proven patterns
- Adapt competitor strategies to fit the specific ICP and offer (don't just copy)
- Note when a competitor example demonstrates a particularly effective technique
- Cite competitor insights in your details to preserve their strategic value

For each talk point, provide:
1. **name**: Clear, concise title (e.g., "24-Hour Turnaround Time", "Enterprise-Grade Security")
2. **details**: A string containing both:
   - Rationale: Why this point matters to the ICP (reference competitor insights when relevant)
   - Example: How to present this point (sample text or phrasing, can adapt from competitor examples)
   Format: "Rationale: [why it matters]. Example: [example text or phrasing]."
3. **topic**: The ACTUAL SECTION HEADER to be used in the final content (e.g., "Fast, Reliable Turnaround", "Our Technology Platform", "Transparent Pricing")

CRITICAL FOR SECTION HEADERS (topic field):
- Use actual headers that will appear in the final page (not generic labels like "Service Details")
- Get inspiration from competitor content headings and strategies
- Make headers specific, benefit-oriented, and audience-relevant
- Headers should work as standalone H2/H3 elements in the final content
- Examples of good headers: "1-2 Week Turnaround Guaranteed", "Leica Auto-Stainer Technology", "Comprehensive Service Customization"
- Examples of bad headers: "Service Details", "Why Choose Us", "Introduction"

SECTION GROUPING (CRITICAL):
- **Multiple talk points MUST share the same topic/section header when they serve the same parent concept**
- Think hierarchically: section header is ONE LEVEL ABOVE talk points in semantic taxonomy
- Group 2-4 related talk points under each section (NOT 1:1 mapping)
- If every talk point has a unique section, you're being too granular
- Sections represent high-level themes/benefits; talk points are specific details within those themes
- Example: "Rapid Conjugation Process" and "Minimal Hands-On Time" both belong under "Fast & Easy Workflow"
- Example: "BSA Compatible Chemistry" and "No Purification Required" both belong under "Streamlined Process"
- Aim for 4-6 distinct section headers total, with multiple talk points per section

Guidelines:
- Extract approximately ${targetTalkPointsCount} talk points (target: ${targetTalkPointsCount}, range: ${Math.max(5, Math.floor(targetTalkPointsCount * 0.5))}-${Math.min(25, Math.ceil(targetTalkPointsCount * 1.2))})
- Aim to generate close to the target count of ${targetTalkPointsCount} talk points
- **Group related talk points under 4-6 SHARED section headers**
- **Identify logical section groupings FIRST, then assign talk points to the most appropriate section**
- Prioritize points that directly address ICP needs and offer benefits
- Include both unique selling points and transactional facts
- Organize points into logical sections with SPECIFIC headers
- Make names specific and actionable
- Provide clear rationale and practical examples in details
- Reference competitor strategies when they illuminate effective approaches
- Section headers should be inspired by how competitors frame their content

PART 2: GENERATE STRATEGIC CONTEXT FROM TALK POINTS

After identifying the talk points (Part 1), analyze them to generate a BRIEF STRATEGIC CONTEXT that summarizes the audience intent. The strategic context should capture:
- **primaryIntent**: What is the user's primary goal when they land on this page? (one clear sentence, inferred from the talk points)
- **secondaryIntents**: What other goals might they have? (2-3 items, inferred from the talk points)
- **immediateQuestions**: What questions do they need answered RIGHT NOW to confirm relevance? (3-5 questions, inferred from the talk points)
- **decisionCriteria**: What factors will convince them to take action? (3-5 criteria, inferred from the talk points)

CRITICAL: Generate the strategic context FROM the talk points - it should summarize the audience intent as reflected in the talk points you identified.

CRITICAL: You MUST return JSON with this EXACT structure:
{
  "strategicContext": {
    "primaryIntent": "User's main goal",
    "secondaryIntents": ["Secondary goal 1", "Secondary goal 2"],
    "immediateQuestions": ["Question 1", "Question 2", "Question 3"],
    "decisionCriteria": ["Criterion 1", "Criterion 2", "Criterion 3"]
  },
  "talkPoints": [
    {
      "name": "Rapid Conjugation Process",
      "details": "Rationale: Speed is critical for researchers. Example: Complete in under 1 hour.",
      "topic": "Fast & Easy Workflow"
    },
    {
      "name": "Minimal Hands-On Time",
      "details": "Rationale: Researchers need efficiency. Example: Just 2 simple steps required.",
      "topic": "Fast & Easy Workflow"
    },
    {
      "name": "BSA Compatible Chemistry",
      "details": "Rationale: Maintains assay quality. Example: No purification needed.",
      "topic": "Streamlined Process"
    }
  ]
}

NOTE: Notice how multiple talk points share the same "topic" value. This is REQUIRED - group related concepts under shared parent sections.

Property names must be lowercase: "name", "details", "topic"
Root must have "strategicContext" and "talkPoints"
Respond with valid JSON only. No markdown, no code blocks.`;

    // Build context information
    // Include phase and goal if available
    const phaseInfo = campaignContext.phaseStrategy
      ? `Phase ${campaignContext.phase || ''}: ${campaignContext.phaseStrategy.name}\nGoal: ${campaignContext.phaseStrategy.goal}`
      : "";
    
    const icpInfo = icp.name ? `ICP: ${icp.name}${icp.description ? `\nDescription: ${icp.description}` : ""}` : "ICP: Not specified";
    const offerInfo = `Offer: ${offer.name}${offer.description ? `\nDescription: ${offer.description}` : ""}`;
    
    // Include transactional facts from offer (important for talk points)
    const transactionalFactsInfo = offer.transactional_facts
      ? `\nTransactional Facts:\n${offer.transactional_facts}`
      : "";
    
    // Handle simplified topics format (with benchmark) and legacy format
    const topicsInfo = assets.topics && assets.topics.length > 0
      ? `\n\nTopics:\n${assets.topics.map((t: any, idx: number) => {
          const label = t.label || t.topic || t.text || "Untitled Topic";
          const strategyText = t.strategy || t.notes ? `\n  Strategy: ${t.strategy || t.notes}` : '';
          
          // Handle simplified format (benchmark object) first
          let examplesText = '';
          if (t.benchmark && (t.benchmark.snippet || t.benchmark.source)) {
            // New simplified format
            examplesText = `\n  Benchmark: "${t.benchmark.snippet || ''}"${t.benchmark.source ? `\n  Source: ${t.benchmark.source}` : ''}`;
          } else if (t.competitorExamples && t.competitorExamples.length > 0) {
            // Legacy competitorExamples array format
            examplesText = `\n  Competitor Examples:\n${t.competitorExamples.map((ex: any, i: number) => {
              const tacticsText = ex.keyTactics && ex.keyTactics.length > 0
                ? `\n     Key Tactics: ${ex.keyTactics.join(", ")}`
                : '';
              return `  ${i + 1}. "${ex.snippet || ex.exampleText || ''}" (${ex.source || ex.sourceUrl || ''})
     Why it works: ${ex.strategyInsight || ex.notes || ex.strategy || ''}
     How to adapt: ${ex.writingInstruction || ''}
     Context: ${ex.context || ''}${tacticsText}`;
            }).join('\n\n  ')}`;
          } else if (t.exampleText || t.sourceUrl) {
            // Legacy flat format
            examplesText = `\n  Example: ${t.exampleText || ''}${t.sourceUrl ? `\n  Source: ${t.sourceUrl}` : ''}`;
          }
          
          return `${idx + 1}. ${label}${strategyText}${examplesText}`;
        }).join("\n\n")}`
      : "";
    
    // Handle simplified keywords format (string array) and legacy object format
    const keywordsInfo = assets.keywords && assets.keywords.length > 0
      ? `\n\nKeywords:\n${assets.keywords.map((k: any, idx: number) => {
          // Handle simplified format (string) first, then legacy formats
          const keyword = typeof k === 'string' 
            ? k 
            : (k.keyword_text || k.keyword || k.label || String(k));
          return `${idx + 1}. ${keyword}`;
        }).join("\n")}`
      : "";
    
    // Handle simplified prompts format (string array) and legacy object format
    const promptsInfo = assets.prompts && assets.prompts.length > 0
      ? `\n\nPrompts:\n${assets.prompts.map((p: any, idx: number) => {
          // Handle simplified format (string) first
          const text = typeof p === 'string' 
            ? p 
            : (p.text || p.prompt || String(p));
          // Only include reason/target if present in legacy format (simplified format omits these)
          const reason = (typeof p === 'object' && p.reason) ? `\n  Reason: ${p.reason}` : "";
          const target = (typeof p === 'object' && p.target) ? `\n  Target section: ${p.target}` : "";
          return `${idx + 1}. ${text}${reason}${target}`;
        }).join("\n\n")}`
      : "";
    
    // Handle brief (simplified original_vision) and legacy original_vision string
    let originalVisionInfo = "";
    if (assets.brief && typeof assets.brief === 'object') {
      // New simplified brief format
      const brief = assets.brief;
      const briefParts = [];
      if (brief.page_goal) briefParts.push(`Page Goal: ${brief.page_goal}`);
      if (brief.audience) briefParts.push(`Audience: ${brief.audience}`);
      if (brief.positioning) briefParts.push(`Positioning: ${brief.positioning}`);
      if (brief.must_include && brief.must_include.length > 0) {
        briefParts.push(`Must Include:\n${brief.must_include.map((item: string) => `  - ${item}`).join('\n')}`);
      }
      if (brief.must_avoid && brief.must_avoid.length > 0) {
        briefParts.push(`Must Avoid:\n${brief.must_avoid.map((item: string) => `  - ${item}`).join('\n')}`);
      }
      if (brief.success_criteria && brief.success_criteria.length > 0) {
        briefParts.push(`Success Criteria:\n${brief.success_criteria.map((item: string) => `  - ${item}`).join('\n')}`);
      }
      if (briefParts.length > 0) {
        originalVisionInfo = `\n\nCreative Brief:\n${briefParts.join('\n\n')}`;
      }
    } else if (assets.original_vision) {
      // Legacy original_vision string format
      originalVisionInfo = `\n\nOriginal Vision / Customer Pain Points:\n${assets.original_vision}`;
    }
    
    // Include main keyword
    const mainKeywordInfo = assets.main_keyword
      ? `\n\nMain Keyword: ${assets.main_keyword}`
      : "";
    
    // Include campaign context fields
    const outcomeInfo = campaignContext.outcome ? `\nOutcome: ${campaignContext.outcome}` : "";
    const promiseInfo = campaignContext.promise || campaignContext.peaceOfMind 
      ? `\nPeace of Mind Promise: ${campaignContext.promise || campaignContext.peaceOfMind}` 
      : "";
    
    // Include previous talk points and feedback if provided
    const previousContext = previousTalkPoints.length > 0
      ? `\n\nPrevious Talk Points (for reference):\n${previousTalkPoints.map((tp: any, idx: number) => 
          `${idx + 1}. ${tp.name || 'Unnamed'}: ${tp.details || ''} (Topic: ${tp.topic || ''})`
        ).join("\n")}`
      : "";
    
    const feedbackContext = feedback
      ? `\n\nUser Feedback: ${feedback}`
      : "";

    const userPromptText = userPrompt
      ? `\n\nUser Prompt: ${userPrompt}`
      : "";

    const userPromptFull = `${phaseInfo ? `${phaseInfo}\n\n` : ""}${icpInfo}
${offerInfo}${transactionalFactsInfo}${outcomeInfo}${promiseInfo}${topicsInfo}${keywordsInfo}${promptsInfo}${originalVisionInfo}${mainKeywordInfo}${previousContext}${feedbackContext}${userPromptText}

TASK: 
1. Generate brief strategic context analyzing the ICP's mental state and intent
2. Identify key talking points and classify them by cognitive priority tier

Extract talk points that:
- Address the ICP's pain points and needs
- Highlight the offer's unique value proposition
- Include transactional facts (pricing, timelines, guarantees, processes)
- Support the campaign's goals and outcomes
- Are organized into logical sections/topics

For each talk point, provide name, details (rationale + example), and topic/section header.

CRITICAL: Do NOT assign tiers to talk points. Tiers will be assigned to sections in the next step.

CRITICAL: Return JSON with this EXACT structure:
{
  "strategicContext": {
    "primaryIntent": "What user primarily wants to do",
    "secondaryIntents": ["Secondary intent 1", "Secondary intent 2"],
    "immediateQuestions": ["Question they need answered NOW", "Another immediate question", "..."],
    "decisionCriteria": ["What will convince them", "Another factor", "..."]
  },
  "talkPoints": [
    {
      "name": "Rapid Conjugation Process",
      "details": "Rationale: Speed is critical for researchers. Example: Complete in under 1 hour.",
      "topic": "Fast & Easy Workflow"
    },
    {
      "name": "Minimal Hands-On Time",
      "details": "Rationale: Researchers need efficiency. Example: Just 2 simple steps required.",
      "topic": "Fast & Easy Workflow"
    },
    {
      "name": "Transparent Pricing",
      "details": "Rationale: Clear pricing helps budget justification. Example: $199 per kit, sufficient for 10 conjugations.",
      "topic": "Transparent Pricing and Value"
    }
  ]
}

CRITICAL: Multiple talk points MUST share the same "topic" when they serve the same parent concept. Aim for 2-4 talk points per section, not 1:1 mapping.

IMPORTANT: 
- Must include BOTH "strategicContext" and "talkPoints"
- Property names: "name", "details", "topic" (all lowercase)
- Do NOT include tier or tierRationale in talk points
- Return ONLY valid JSON, no markdown, no additional text`;

    // Log prompt size for evaluation
    const systemPromptSize = systemPrompt.length;
    const userPromptSize = userPromptFull.length;
    const totalPromptSize = systemPromptSize + userPromptSize;
    log(`[summarizeTalkPointsPipeline] Prompt size - System: ${systemPromptSize} chars, User: ${userPromptSize} chars, Total: ${totalPromptSize} chars`);
    
    // Use high model for large prompts (typically 4000-12000 chars with full context)
    // High model (gpt-4o) has 128k context window, which is appropriate for this task
    const effectiveModelTier = totalPromptSize > 5000 ? "high" : (modelTier || "high");
    if (effectiveModelTier !== modelTier) {
      log(`[summarizeTalkPointsPipeline] Using ${effectiveModelTier} model due to large prompt size (${totalPromptSize} chars)`);
    }

    // Call AI with structured output
    const result = await callStructured(
      effectiveModelTier,
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPromptFull },
      ],
      createTalkPointsSchema(targetTalkPointsCount),
      { 
        stepName: "summarizeTalkPoints", 
        maxAttempts: 2,
      }
    );

    if (!result.ok || !result.data) {
      const errorMessage = result.error 
        ? (typeof result.error === 'string' ? result.error : result.error.message)
        : "Failed to summarize talk points";
      
      return {
        ok: false,
        runId,
        artifacts: {},
        errors: [{
          code: "PROVIDER_ERROR" as any,
          message: errorMessage,
          step: "talkPointsSummarization",
          details: result.error && typeof result.error !== 'string' ? result.error.details : undefined,
        }],
      };
    }

    // Normalize response - handle property name variations
    const rawData = result.data as any;
    let talkPointsResult: SummarizeTalkPointsResult;
    
    // Extract strategic context
    const strategicContext: BriefStrategicContext = {
      primaryIntent: rawData.strategicContext?.primaryIntent || rawData.strategic_context?.primary_intent || "Not specified",
      secondaryIntents: rawData.strategicContext?.secondaryIntents || rawData.strategic_context?.secondary_intents || [],
      immediateQuestions: rawData.strategicContext?.immediateQuestions || rawData.strategic_context?.immediate_questions || [],
      decisionCriteria: rawData.strategicContext?.decisionCriteria || rawData.strategic_context?.decision_criteria || [],
    };
    
    // Extract talk points - handle various property name formats
    let talkPointsArray = rawData.talkPoints || rawData.talk_points || rawData.talkPointsList;
    
    // If response is directly an array, wrap it
    if (!talkPointsArray && Array.isArray(rawData)) {
      talkPointsArray = rawData;
    }
    
    // Normalize individual talk point properties
    if (talkPointsArray && Array.isArray(talkPointsArray)) {
      const normalizedTalkPoints = talkPointsArray.map((tp: any) => {
        const normalized: TalkPoint = {
          name: tp.name || tp.Name || tp.talk_point_name || "",
          details: tp.details || tp.Details || tp.talk_point_details || "",
          topic: tp.topic || tp.Topic || tp.section || tp.Section || "",
        };
        return normalized;
      });
      
      talkPointsResult = {
        strategicContext,
        talkPoints: normalizedTalkPoints,
      };
    } else {
      // Fallback if no valid talk points array found
      talkPointsResult = {
        strategicContext,
        talkPoints: [],
      };
    }

    log(`[summarizeTalkPointsPipeline] Generated ${talkPointsResult.talkPoints.length} talk points and strategic context`);

    // Include prompt in dev mode for debugging
    const isDev = process.env.NODE_ENV !== "production";
    const response: MonkeyTaskResponse = {
      ok: true,
      runId,
      artifacts: {
        strategicContext: talkPointsResult.strategicContext,
        talkPoints: talkPointsResult.talkPoints,
        icpName: icp.name,
        offerName: offer.name,
        generatedAt: new Date().toISOString(),
      },
      meta: {
        modelTier: effectiveModelTier,
        talkPointsCount: talkPointsResult.talkPoints.length,
        // Include prompt in dev mode only
        ...(isDev && {
          _devPrompt: {
            system: systemPrompt,
            user: userPromptFull,
            totalSize: totalPromptSize,
          },
        }),
      },
    };

    return response;

  } catch (error: any) {
    log(`[summarizeTalkPointsPipeline] Error: ${error.message}`);
    
    return {
      ok: false,
      runId,
      artifacts: {},
      errors: [{
        code: "PROVIDER_ERROR" as any,
        message: error.message || "Unknown error in talk points summarization pipeline",
        step: "execution",
        details: { stack: error.stack },
      }],
    };
  }
}

// Auto-register this pipeline
registerPipeline(
  "SUMMARIZE_TALK_POINTS",
  "Summarize Talk Points",
  "Summarize key talking points from campaign context, assets, and user prompts. Returns structured talk points with name, details (rationale + example), and suggested topic/section.",
  summarizeTalkPointsPipeline
);
