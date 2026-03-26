// ARCHIVED: Original path was libs/monkey/pipelines/writeArticleLandingPipeline.ts

/**
 * Marketing Page Generation Pipeline
 * Main entry point for agentic marketing page generation
 * All steps are inlined in this file
 */

import { MonkeyTaskRequest, MonkeyTaskResponse, MonkeyError } from "../references/types";
import { MarketingPageRequest, MarketingPageResponse, CompetitorCandidate, CompetitorValidationResult, CompetitorCoverage, ICPModel, ClaimBank, ChosenSection, SectionContent, IntentModel } from "../references/marketingTypes";
import { MarketingPageType, SectionType, getPageTypeConfig, getSectionTemplate } from "../references/pageTypes/registry";
import { fetchSerpCompetitors } from "../tools/dataForSeo";
import { fetchCompetitorPage, FetchedPage } from "../tools/competitorFetch";
import { segmentCompetitorContent, ContentBlock } from "../tools/competitorSegment";
import { validateCompetitor, quickHeuristicFilter } from "../actions/competitorValidate";
import { mapCompetitorPageToSections, CompetitorSectionMapping } from "../actions/competitorMapToSections";
import { callStructured } from "../tools/runtime/callStructured";
import { ChatMessage } from "../tools/runtime/providers/openai";
import { icpModelSchema, claimBankSchema, chosenSectionSchema, sectionContentSchema, intentModelSchema } from "../references/marketingPageSchemas";
import { renderFullPage } from "../tools/renderers";
import { processPlaceholderImages } from "../tools/renderers/processPlaceholderImages";
import { getUserPlaceholderTheme } from "../../../components/ui/placeholder-images/getUserTheme";
import { log, logAgenticPipelineStart, logAgenticStep, shouldLogFull } from "../ui/logger";
import { registerPipeline } from "./registry";
import { createRun, getRun, updateRun, deleteRun } from "./agentRunStore";

// ============================================
// UI Card Emission System
// ============================================

export interface UICard {
  title: string;
  message: string;
  status: "running" | "done" | "warning" | "error";
  bullets?: string[];
  nextAction?: string;
  timestamp: number;
}

const uiCards: Map<string, UICard[]> = new Map();

function emitStepCard(runId: string, card: Omit<UICard, "timestamp">): void {
  if (!uiCards.has(runId)) {
    uiCards.set(runId, []);
  }
  const cards = uiCards.get(runId)!;
  cards.push({
    ...card,
    timestamp: Date.now(),
  });
  log(`[UI Card] ${card.status.toUpperCase()}: ${card.title} - ${card.message}`);
}

function getUICards(runId: string): UICard[] {
  return uiCards.get(runId) || [];
}

function clearUICards(runId: string): void {
  uiCards.delete(runId);
}

// ============================================
// STEP 1: INTERPRET INTENT, NEEDS, USPs
// ============================================

interface InterpretIntentResult {
  intentModel: IntentModel;
  failedAttempts?: Array<{
    attempt: number;
    reason: string;
    error?: any;
    timestamp: number;
  }>;
  finalAttempt?: number;
}

async function interpretIntent(
  model: "agent" | "high" | "mid",
  pageType: MarketingPageType,
  campaignContext: any,
  userInput?: any
): Promise<InterpretIntentResult> {
  // ============================================
  // SIMPLIFIED LOGGING: INPUT
  // ============================================
  console.log(`[step1] ========== INPUT ==========`);
  console.log(`[step1] Model: ${model}`);
  console.log(`[step1] PageType: ${pageType}`);
  console.log(`[step1] CampaignContext:`, JSON.stringify(campaignContext, null, 2));
  console.log(`[step1] UserInput:`, JSON.stringify(userInput || {}, null, 2));
  console.log(`[step1] ============================`);

  const offer = campaignContext?.offer || {};
  const icp = campaignContext?.icp || {};
  const pageConfig = getPageTypeConfig(pageType);

  // Determine page goal from page type
  const pageGoalMap: Record<MarketingPageType, IntentModel["pageGoal"]> = {
    [MarketingPageType.QUOTE_CONSULTATION_SERVICE]: "quote_request",
    [MarketingPageType.DEMO_TRIAL_SAAS]: "demo",
    [MarketingPageType.LEAD_MAGNET_DOWNLOAD]: "download",
    [MarketingPageType.DISCOUNT_PROMOTION]: "purchase",
    [MarketingPageType.WEBINAR_EVENT_REGISTRATION]: "register",
    [MarketingPageType.HOMEPAGE]: "browse",
    [MarketingPageType.BASE_UNIVERSAL]: "quote_request",
    [MarketingPageType.COMPARISON_ALTERNATIVES]: "purchase",
    [MarketingPageType.PROOF_HEAVY_CASE_STUDY]: "quote_request",
    [MarketingPageType.USE_CASE_ROLE_BASED]: "demo",
    [MarketingPageType.RESOURCE_LIBRARY]: "browse",
    [MarketingPageType.PRODUCT_CATEGORY]: "browse",
    [MarketingPageType.THANK_YOU_CONFIRMATION]: "browse",
    [MarketingPageType.CAREERS_JOB_LISTING]: "apply",
    [MarketingPageType.PARTNERSHIP_AFFILIATE]: "register",
  };

  const pageGoal = pageGoalMap[pageType] || "quote_request";
  const primaryCTA = {
    label: offer.primaryCTA || pageConfig.primary_goals_supported[0] === "quote" ? "Get Quote" : "Get Started",
    action: pageGoal === "quote_request" ? "request-quote" : pageGoal === "demo" ? "book-demo" : "get-started",
  };

  // Build system prompt for IntentModel
  const systemPrompt = `You are an intent interpreter. Analyze campaign context and extract structured intent model including:
- pageGoal: the primary conversion goal (string enum)
- primaryCTA: the main call-to-action (MUST be an object with "label" and "action" properties, both strings)
- icpModel: structured ICP information (object with arrays: roles, pains, decisionCriteria, objections, languageTokens)
- uspAngles: unique selling points array (each item MUST be an object with "usp" string, optional "bestPresentation" and "notes" strings)
- claimBank: object with:
  - allowedFacts: array of objects, each MUST have "category" (string), "fact" (string), "source" (string)
  - bannedPatterns: array of strings
  - uspAngles: array of objects, each MUST have "angle" (string), optional "recommendedSection" and "recommendedFormat" (strings)
- competitorQueryHints: object with "seedQueries" (array of strings) and "keywords" (array of strings)

CRITICAL STRUCTURE RULES:
- primaryCTA MUST be an object: {"label": "Get Quote", "action": "request-quote"} NOT a string
- claimBank.allowedFacts MUST be array of objects: [{"category": "transactional", "fact": "...", "source": "..."}] NOT array of strings
- claimBank.uspAngles MUST be array of objects: [{"angle": "...", "recommendedSection": "...", "recommendedFormat": "..."}] NOT array of strings
- uspAngles (top-level) MUST be array of objects: [{"usp": "...", "bestPresentation": "...", "notes": "..."}] NOT array of strings

CRITICAL CONTENT RULES:
- Extract ONLY facts provided in campaignContext (no invented stats/clients/guarantees)
- Identify banned patterns (generic claims like "industry-leading", "thousands of customers")
- Recommend best presentation formats for each USP (comparison_table, cards, label_value_table, etc.)
- Generate competitor search queries: MUST use the EXACT offer name/description from campaignContext.offer.name or campaignContext.offer.description
- competitorQueryHints.seedQueries should be search queries that would find competitors offering the SAME service/product
- Use the actual offer name/description, NOT generic terms or inferred descriptions
- Example: If offer.name is "IHC/IF service", use "IHC/IF service" or "IHC IF service providers", NOT "validated antibodies supplier"`;

  const userPrompt = `PAGE TYPE: ${pageType}
PAGE GOAL: ${pageGoal}

CAMPAIGN CONTEXT:
${JSON.stringify(campaignContext, null, 2)}

USER INPUT:
${JSON.stringify(userInput || {}, null, 2)}

TASK: Extract and structure the IntentModel. 

IMPORTANT FOR COMPETITOR QUERIES:
- Use the EXACT offer name: "${offer.name || offer.description || 'the service'}"
- competitorQueryHints.seedQueries should be search queries that would find competitors offering "${offer.name || offer.description || 'the service'}"
- DO NOT infer or generalize - use the actual offer name/description from campaignContext.offer
- Example queries: "${offer.name || 'service'} providers", "${offer.name || 'service'} companies", "${offer.name || 'service'} services"`;

  // ============================================
  // SIMPLIFIED LOGGING: PROMPT
  // ============================================
  console.log(`[step1] ========== PROMPT ==========`);
  console.log(`[step1] System Prompt:\n${systemPrompt}`);
  console.log(`[step1] User Prompt:\n${userPrompt}`);
  console.log(`[step1] ============================`);

  const result = await callStructured(
    model,
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    intentModelSchema,
    { stepName: "step1_interpretIntent", maxAttempts: 2 }
  );

      // Track failed attempts for frontend display
      const stepFailedAttempts = result.failedAttempts || [];
      const finalAttempt = result.finalAttempt;

      if (!result.ok || !result.data) {
    // Fallback: build from campaignContext directly
    log(`[step1] LLM interpretation failed, using fallback extraction`);
    
    const icpModel: ICPModel = {
      roles: icp?.target_roles || [],
      pains: icp?.pain_points || [],
      decisionCriteria: icp?.decision_criteria || [],
      objections: icp?.objections || [],
      languageTokens: icp?.language_tokens || [],
    };

    const allowedFacts: ClaimBank["allowedFacts"] = [];
    if (offer.transactional_facts) {
      Object.entries(offer.transactional_facts).forEach(([key, value]) => {
        if (value) {
          allowedFacts.push({
            category: "transactional",
            fact: String(value),
            source: `offer.transactional_facts.${key}`,
          });
        }
      });
    }
    if (offer.guarantees) {
      offer.guarantees.forEach((guarantee: string) => {
        allowedFacts.push({
          category: "guarantee",
          fact: guarantee,
          source: "offer.guarantees",
        });
      });
    }
    if (offer.key_features) {
      offer.key_features.forEach((feature: string) => {
        allowedFacts.push({
          category: "feature",
          fact: feature,
          source: "offer.key_features",
        });
      });
    }

    const uspAngles = (offer.unique_selling_points || []).map((usp: string) => ({
      usp,
      bestPresentation: "card_grid" as const,
    }));

    const claimBank: ClaimBank = {
      allowedFacts,
      bannedPatterns: [
        "decades of experience",
        "thousands of satisfied customers",
        "industry-leading",
        "world-class",
        "trusted globally",
      ],
      uspAngles,
    };

    const intentModel: IntentModel = {
      pageGoal,
      primaryCTA,
      icpModel,
      uspAngles,
      claimBank,
      competitorQueryHints: {
        seedQueries: [
          offer.name || "service",
          `${icp?.target_roles?.[0] || "business"} ${offer.name || "solution"}`,
        ].filter(Boolean),
        keywords: [
          ...(icp?.target_roles || []),
          ...(offer.key_features?.slice(0, 3) || []),
        ],
      },
    };

    return { 
      intentModel,
      failedAttempts: stepFailedAttempts,
      finalAttempt: finalAttempt,
    };
  }

  const intentModel = result.data as IntentModel;

  // ============================================
  // SIMPLIFIED LOGGING: OUTPUT
  // ============================================
  console.log(`[step1] ========== OUTPUT ==========`);
  console.log(`[step1] Result:`, JSON.stringify(intentModel, null, 2));
  console.log(`[step1] Failed Attempts:`, stepFailedAttempts);
  console.log(`[step1] Final Attempt:`, finalAttempt);
  console.log(`[step1] ============================`);

  return { 
    intentModel,
    failedAttempts: stepFailedAttempts,
    finalAttempt: finalAttempt,
  };
}

// ============================================
// Step 1 (OLD): Collect Competitor Candidates
// ============================================

interface CompetitorCandidatesResult {
  candidates: CompetitorCandidate[];
  source: "user_provided" | "serp" | "ai_suggestion" | "mixed";
}

/**
 * AI fallback: Use AI to suggest competitor pages when DataForSEO fails
 */
async function suggestCompetitorsWithAI(
  model: "agent" | "high" | "mid",
  primaryKeyword: string,
  intentModel: IntentModel,
  pageType: MarketingPageType,
  campaignContext: any
): Promise<CompetitorCandidate[]> {
  log(`[collectCompetitors] Using AI fallback to suggest competitors for: ${primaryKeyword}`);
  
  const prompt = `You are a marketing research assistant. Based on the following information, suggest 8-12 competitor website URLs that would be relevant for benchmarking.

Primary Keyword: ${primaryKeyword}
Page Type: ${pageType}
Target Audience: ${campaignContext.icp?.name || "Unknown"}
Offer: ${campaignContext.offer?.name || "Unknown"}

ICP Details:
- Roles: ${intentModel.icpModel.roles.join(", ")}
- Top Pains: ${intentModel.icpModel.pains.slice(0, 3).join(", ")}
- Decision Criteria: ${intentModel.icpModel.decisionCriteria.slice(0, 3).join(", ")}

Return a JSON array of competitor suggestions. Each suggestion should be a well-known company/website that serves the same target audience and offers similar solutions. Format:
[
  {
    "url": "https://example.com/page",
    "title": "Company Name - Page Title",
    "reason": "Brief explanation of why this is a relevant competitor"
  }
]

Guidelines:
- Focus on direct competitors (companies offering similar solutions to the same audience)
- Include landing pages, product pages, or service pages (not blog posts or articles)
- Prefer well-known companies that would rank highly in search
- URLs should be specific pages, not just homepages
- Return 8-12 suggestions
- Only include URLs you're confident about (real companies/websites)`;

  try {
    const result = await callStructured(
      model,
      [
        { role: "system", content: "You are a marketing research assistant that suggests relevant competitor websites." },
        { role: "user", content: prompt },
      ],
      {
        type: "object",
        additionalProperties: true,
        properties: {
          competitors: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: true,
              properties: {
                url: { type: "string" },
                title: { type: "string" },
                reason: { type: "string" },
              },
              required: ["url"],
            },
          },
        },
        required: ["competitors"],
      },
      { stepName: "suggestCompetitorsAI", maxAttempts: 2 }
    );

    const aiSuggestions = (result.data as any)?.competitors || [];
    log(`[collectCompetitors] AI suggested ${aiSuggestions.length} competitor URLs`);

    return aiSuggestions.map((suggestion: any) => ({
      url: suggestion.url,
      title: suggestion.title || "",
      source: "ai_suggestion" as const,
    }));
  } catch (error: any) {
    log(`[collectCompetitors] AI fallback failed: ${error.message}`);
    return [];
  }
}

async function collectCompetitorCandidates(
  userInput: any,
  primaryKeyword?: string,
  intentModel?: IntentModel,
  pageType?: MarketingPageType,
  campaignContext?: any,
  model?: "agent" | "high" | "mid"
): Promise<CompetitorCandidatesResult> {
  const candidates: CompetitorCandidate[] = [];
  let source: "user_provided" | "serp" | "ai_suggestion" | "mixed" = "user_provided";

  // User-provided URLs
  if (userInput?.competitorUrls && Array.isArray(userInput.competitorUrls)) {
    userInput.competitorUrls.forEach((url: string) => {
      if (url && typeof url === "string" && url.startsWith("http")) {
        candidates.push({ url, source: "user_provided" });
      }
    });
  }

  const maxCompetitors = userInput?.maxCompetitors || 8;
  const needMore = candidates.length < maxCompetitors;

  // SERP results if keyword provided and not enough user URLs
  if (primaryKeyword && needMore) {
    try {
      log(`[collectCompetitors] Attempting to fetch SERP competitors for: ${primaryKeyword}`);
      const defaultLocationCode = process.env.DATAFORSEO_DEFAULT_LOCATION 
        ? parseInt(process.env.DATAFORSEO_DEFAULT_LOCATION, 10) || 2840 
        : 2840;
      const serpResult = await fetchSerpCompetitors(primaryKeyword, defaultLocationCode, "en");
      
      if (serpResult.isToolVerified && serpResult.items.length > 0) {
        const remaining = maxCompetitors - candidates.length;
        serpResult.items.slice(0, remaining).forEach((item) => {
          candidates.push({
            url: item.url,
            title: item.title,
            source: "serp",
          });
        });
        source = candidates.some((c) => c.source === "user_provided") ? "mixed" : "serp";
        log(`[collectCompetitors] SERP fetch successful: added ${serpResult.items.slice(0, remaining).length} candidates`);
      } else {
        log(`[collectCompetitors] SERP fetch failed or returned no results: ${serpResult.notes || "Unknown error"}`);
      }
    } catch (error: any) {
      log(`[collectCompetitors] SERP fetch error: ${error.message}`);
    }
  }

  // AI fallback if still need more candidates and we have the required context
  const stillNeedMore = candidates.length < maxCompetitors;
  if (stillNeedMore && primaryKeyword && intentModel && pageType && campaignContext && model) {
    log(`[collectCompetitors] SERP failed or insufficient results (${candidates.length}/${maxCompetitors}), using AI fallback...`);
    try {
      const aiCandidates = await suggestCompetitorsWithAI(
        model,
        primaryKeyword,
        intentModel,
        pageType,
        campaignContext
      );
      
      if (aiCandidates.length > 0) {
        const remaining = maxCompetitors - candidates.length;
        aiCandidates.slice(0, remaining).forEach((candidate) => {
          candidates.push(candidate);
        });
        source = candidates.some((c) => c.source === "user_provided" || c.source === "serp") ? "mixed" : "ai_suggestion";
        log(`[collectCompetitors] AI fallback added ${Math.min(aiCandidates.length, remaining)} candidates`);
      }
    } catch (error: any) {
      log(`[collectCompetitors] AI fallback error: ${error.message}`);
    }
  }

  log(`[collectCompetitors] Final: Collected ${candidates.length} competitor candidates (${source})`);

  return {
    candidates,
    source,
  };
}

// ============================================
// Step 2: Validate Competitor Candidates
// ============================================

interface CompetitorValidationStepResult {
  validated: CompetitorValidationResult[];
  rejected: Array<{ url: string; reason: string }>;
  quality: "HIGH" | "MEDIUM" | "LOW";
}

async function validateCompetitorCandidates(
  model: "agent" | "high" | "mid",
  candidates: Array<{ url: string; title?: string }>,
  pageType: MarketingPageType,
  campaignContext: any
): Promise<CompetitorValidationStepResult> {
  const validated: CompetitorValidationResult[] = [];
  const rejected: Array<{ url: string; reason: string }> = [];
  const MAX_VALIDATED = 3; // Stop after 3 validated competitors

  log(`[step2] Validating competitor candidates (will stop after ${MAX_VALIDATED} validated)...`);

  for (let i = 0; i < candidates.length; i++) {
    // Stop if we already have enough validated competitors
    if (validated.length >= MAX_VALIDATED) {
      log(`[step2] ✅ Reached ${MAX_VALIDATED} validated competitors. Stopping validation.`);
      break;
    }

    const candidate = candidates[i];
    log(`[step2] [${i + 1}/${candidates.length}] Evaluating: ${candidate.url}${candidate.title ? ` (${candidate.title})` : ''}`);
    
    try {
      // Fetch page
      log(`[step2] [${i + 1}/${candidates.length}] Fetching page...`);
      const page = await fetchCompetitorPage(candidate.url);
      if (!page) {
        const reason = "Failed to fetch page (no content or fetch error)";
        log(`[step2] [${i + 1}/${candidates.length}] ❌ REJECTED: ${reason}`);
        rejected.push({ url: candidate.url, reason });
        continue;
      }
      log(`[step2] [${i + 1}/${candidates.length}] ✓ Fetched: title="${page.title || 'N/A'}", h1="${page.h1 || 'N/A'}", textLength=${page.extractedText.length}`);

      // Quick heuristic filter
      log(`[step2] [${i + 1}/${candidates.length}] Running heuristic filter...`);
      const heuristicResult = quickHeuristicFilter(page);
      if (!heuristicResult.passed) {
        const reason = `Failed heuristic filter: ${heuristicResult.reason || "likely blog/directory or insufficient content"}`;
        log(`[step2] [${i + 1}/${candidates.length}] ❌ REJECTED: ${reason}`);
        log(`[step2] [${i + 1}/${candidates.length}]   Details: textLength=${page.extractedText.length}, title="${page.title || 'N/A'}", h1="${page.h1 || 'N/A'}"`);
        rejected.push({ url: candidate.url, reason });
        continue;
      }
      log(`[step2] [${i + 1}/${candidates.length}] ✓ Heuristic filter passed`);

      // LLM validation
      log(`[step2] [${i + 1}/${candidates.length}] Running LLM validation...`);
      const validation = await validateCompetitor(model, page, pageType, campaignContext);
      if (!validation) {
        const reason = "LLM validation failed (no response or parse error)";
        log(`[step2] [${i + 1}/${candidates.length}] ❌ REJECTED: ${reason}`);
        rejected.push({ url: candidate.url, reason });
        continue;
      }

      log(`[step2] [${i + 1}/${candidates.length}] LLM Validation Result:`);
      log(`[step2] [${i + 1}/${candidates.length}]   - isRelevantCompetitorPage: ${validation.isRelevantCompetitorPage}`);
      log(`[step2] [${i + 1}/${candidates.length}]   - confidence: ${validation.confidence.toFixed(2)}`);
      log(`[step2] [${i + 1}/${candidates.length}]   - pageArchetype: ${validation.pageArchetype}`);
      if (validation.matchedSignals && validation.matchedSignals.length > 0) {
        log(`[step2] [${i + 1}/${candidates.length}]   - matchedSignals: ${validation.matchedSignals.join(", ")}`);
      }
      if (validation.rejectReasons && validation.rejectReasons.length > 0) {
        log(`[step2] [${i + 1}/${candidates.length}]   - rejectReasons: ${validation.rejectReasons.join("; ")}`);
      }

      // Check confidence threshold
      if (validation.isRelevantCompetitorPage && validation.confidence >= 0.65) {
        validated.push(validation);
        log(`[step2] [${i + 1}/${candidates.length}] ✅ VALIDATED: ${candidate.url} (${validation.pageArchetype}, confidence: ${validation.confidence.toFixed(2)}) [${validated.length}/${MAX_VALIDATED}]`);
        
        // Stop if we've reached the limit
        if (validated.length >= MAX_VALIDATED) {
          log(`[step2] ✅ Reached ${MAX_VALIDATED} validated competitors. Stopping validation.`);
          break;
        }
      } else {
        const reasonParts = [];
        if (!validation.isRelevantCompetitorPage) {
          reasonParts.push("not marked as relevant");
        }
        if (validation.confidence < 0.65) {
          reasonParts.push(`low confidence (${validation.confidence.toFixed(2)} < 0.65)`);
        }
        if (validation.rejectReasons && validation.rejectReasons.length > 0) {
          reasonParts.push(`reasons: ${validation.rejectReasons.join(", ")}`);
        }
        const reason = reasonParts.join("; ");
        log(`[step2] [${i + 1}/${candidates.length}] ❌ REJECTED: ${reason}`);
        rejected.push({
          url: candidate.url,
          reason: reason || `Low confidence (${validation.confidence.toFixed(2)}) or not relevant`,
        });
      }
    } catch (error: any) {
      const reason = `Error: ${error.message}`;
      log(`[step2] [${i + 1}/${candidates.length}] ❌ REJECTED: ${reason}`);
      log(`[step2] [${i + 1}/${candidates.length}]   Error stack: ${error.stack?.substring(0, 200) || 'N/A'}`);
      rejected.push({ url: candidate.url, reason });
    }
  }

  // Determine quality
  let quality: "HIGH" | "MEDIUM" | "LOW" = "LOW";
  if (validated.length >= 5) {
    quality = "HIGH";
  } else if (validated.length >= 3) {
    quality = "MEDIUM";
  }

  log(`[step2] Validation complete: ${validated.length} validated, ${rejected.length} rejected (quality: ${quality})`);
  
  // Summary of rejected pages
  if (rejected.length > 0) {
    log(`[step2] Rejected pages summary:`);
    rejected.forEach((r, idx) => {
      log(`[step2]   ${idx + 1}. ${r.url}`);
      log(`[step2]      Reason: ${r.reason}`);
    });
  }
  
  // Summary of validated pages
  if (validated.length > 0) {
    log(`[step2] Validated pages summary:`);
    validated.forEach((v, idx) => {
      log(`[step2]   ${idx + 1}. ${v.url} (${v.pageArchetype}, confidence: ${v.confidence.toFixed(2)})`);
    });
  }

  return {
    validated,
    rejected,
    quality,
  };
}

// ============================================
// Step 3: Benchmark Competitors
// ============================================

interface CompetitorBenchmarkResult {
  coverage: CompetitorCoverage;
  mappedBlocks: Array<{
    url: string;
    sections: CompetitorSectionMapping[];
  }>;
}

async function benchmarkCompetitors(
  model: "agent" | "high" | "mid",
  validated: CompetitorValidationResult[],
  pageType: MarketingPageType
): Promise<CompetitorBenchmarkResult> {
  // Limit to first 3 validated competitors for comparison
  const competitorsToBenchmark = validated.slice(0, 3);
  log(`[step3] Benchmarking ${competitorsToBenchmark.length} of ${validated.length} validated competitors (limited to first 3)...`);

  // Get available section types for this page type
  const pageConfig = getPageTypeConfig(pageType);
  const availableSectionTypes: SectionType[] = [
    ...pageConfig.recommended_sections,
    ...pageConfig.optional_sections,
  ];

  // Also include universal base sections
  const baseConfig = getPageTypeConfig(MarketingPageType.BASE_UNIVERSAL);
  availableSectionTypes.push(...baseConfig.recommended_sections);
  availableSectionTypes.push(...baseConfig.optional_sections);

  // Deduplicate
  const uniqueSectionTypes = [...new Set(availableSectionTypes)];

  const mappedBlocks: CompetitorBenchmarkResult["mappedBlocks"] = [];
  const coverageBySectionType: Record<SectionType, {
    count: number;
    exampleRefs: Array<{ url: string; blockId: string; heading: string; competitorExample?: string }>;
  }> = {} as any;

  const archetypeCounts: Record<string, number> = {};

  // Process each validated competitor (limited to first 3)
  for (const competitor of competitorsToBenchmark) {
    // Count archetype
    archetypeCounts[competitor.pageArchetype] = (archetypeCounts[competitor.pageArchetype] || 0) + 1;

    // Segment content
    const blocks = segmentCompetitorContent({
      url: competitor.url,
      title: competitor.headings?.[0] || "",
      headings: competitor.headings || [],
      extractedText: competitor.extractedText || "",
      h1: competitor.headings?.[0],
      metaDescription: undefined,
    });

    // Map full page to ALL section types present
    const fullPageText = competitor.extractedText || "";
    const headings = competitor.headings || [];
    log(`[step3] Processing competitor ${competitor.url}: ${blocks.length} blocks, full text length: ${fullPageText.length} chars, headings: ${headings.length}`);
    const sectionMappings = await mapCompetitorPageToSections(
      model,
      fullPageText,
      blocks,
      uniqueSectionTypes,
      competitor.url,
      headings // Pass headings for headers-only mode
    );

    mappedBlocks.push({
      url: competitor.url,
      sections: sectionMappings,
    });

    // Build coverage - track all sections found on this competitor page
    sectionMappings.forEach((sectionMapping) => {
      const sectionType = sectionMapping.sectionType;
      if (!coverageBySectionType[sectionType]) {
        coverageBySectionType[sectionType] = {
          count: 0,
          exampleRefs: [],
        };
      }
      // Increment count (each competitor that has this section)
      coverageBySectionType[sectionType].count++;
      
      // Add example refs (up to 3 per section type)
      if (coverageBySectionType[sectionType].exampleRefs.length < 3) {
        // Use the first evidence block as the example
        const evidenceBlock = sectionMapping.evidenceBlocks?.[0] || blocks[0];
        coverageBySectionType[sectionType].exampleRefs.push({
          url: competitor.url,
          blockId: evidenceBlock?.blockId || "block-1",
          heading: evidenceBlock?.heading || competitor.headings?.[0] || "",
          competitorExample: sectionMapping.competitorExample,
        });
      }
    });
  }

  // Determine quality based on total validated (not just benchmarked)
  // Since we only benchmark first 3, quality is based on total validated count
  const quality = validated.length >= 5 ? "HIGH" : validated.length >= 3 ? "MEDIUM" : "LOW";

  const coverage: CompetitorCoverage = {
    coverageBySectionType,
    commonOrderingPatterns: [], // Could be enhanced with ordering analysis
    archetypeCounts,
    quality,
  };

  log(`[step3] Benchmark complete: ${Object.keys(coverageBySectionType).length} section types covered`);

  return {
    coverage,
    mappedBlocks,
  };
}

// ============================================
// Step 4: Interpret Offer and ICP
// ============================================

interface OfferICPInterpretResult {
  icpModel: ICPModel;
  claimBank: ClaimBank;
}

async function interpretOfferICP(
  model: "agent" | "high" | "mid",
  campaignContext: any
): Promise<OfferICPInterpretResult> {
  log(`[step4] Interpreting offer and ICP...`);

  // Extract facts from campaignContext
  const offer = campaignContext?.offer || {};
  const icp = campaignContext?.icp || {};

  // Build ICP Model
  const icpSystemPrompt = `You are an ICP analyst. Extract and structure ICP information into a model that can guide content generation.

Output JSON with:
- roles: array of target roles/titles
- pains: array of pain points this ICP faces
- decisionCriteria: array of factors they consider when making decisions
- objections: array of common objections they might have
- languageTokens: array of terms/phrases they use (industry jargon, preferred terminology)`;

  const icpUserPrompt = `ICP DATA:
${JSON.stringify(icp, null, 2)}

TASK: Extract and structure the ICP model.`;

  const icpResult = await callStructured(
    model,
    [
      { role: "system", content: icpSystemPrompt },
      { role: "user", content: icpUserPrompt },
    ],
    icpModelSchema,
    { stepName: "step4_icpModel", maxAttempts: 2 }
  );

  const icpModel: ICPModel = icpResult.ok && icpResult.data
    ? (icpResult.data as ICPModel)
    : {
        roles: icp?.target_roles || [],
        pains: icp?.pain_points || [],
        decisionCriteria: icp?.decision_criteria || [],
        objections: icp?.objections || [],
        languageTokens: icp?.language_tokens || [],
      };

  // Build Claim Bank
  const allowedFacts: ClaimBank["allowedFacts"] = [];
  const bannedPatterns: string[] = [
    "decades of experience",
    "thousands of satisfied customers",
    "industry-leading",
    "world-class",
    "trusted globally",
  ];

  // Extract transactional facts
  if (offer.transactional_facts) {
    Object.entries(offer.transactional_facts).forEach(([key, value]) => {
      if (value) {
        allowedFacts.push({
          category: "transactional",
          fact: String(value),
          source: `offer.transactional_facts.${key}`,
        });
      }
    });
  }

  // Extract peace of mind facts
  if (offer.guarantees) {
    offer.guarantees.forEach((guarantee: string) => {
      allowedFacts.push({
        category: "guarantee",
        fact: guarantee,
        source: "offer.guarantees",
      });
    });
  }

  // Extract key features/benefits
  if (offer.key_features) {
    offer.key_features.forEach((feature: string) => {
      allowedFacts.push({
        category: "feature",
        fact: feature,
        source: "offer.key_features",
      });
    });
  }

  // Extract unique selling points
  const uspAngles: ClaimBank["uspAngles"] = [];
  if (offer.unique_selling_points) {
    offer.unique_selling_points.forEach((usp: string) => {
      uspAngles.push({
        angle: usp,
      });
    });
  }

  const claimBank: ClaimBank = {
    allowedFacts,
    bannedPatterns,
    uspAngles,
  };

  log(`[step4] Interpreted: ${icpModel.roles.length} roles, ${allowedFacts.length} allowed facts, ${uspAngles.length} USP angles`);

  return {
    icpModel,
    claimBank,
  };
}

// ============================================
// Step 5: Choose Sections
// ============================================

interface ChooseSectionsResult {
  chosenSections: ChosenSection[];
}

async function chooseSections(
  model: "agent" | "high" | "mid",
  pageType: MarketingPageType,
  coverage: CompetitorCoverage,
  icpModel: ICPModel,
  claimBank: ClaimBank,
  primaryCTA: string
): Promise<ChooseSectionsResult> {
  log(`[step5] Choosing sections for page type: ${pageType}...`);

  const pageConfig = getPageTypeConfig(pageType);
  const baseConfig = getPageTypeConfig(MarketingPageType.BASE_UNIVERSAL);

  // Build section descriptions
  const allSections = [
    ...new Set([
      ...pageConfig.recommended_sections,
      ...pageConfig.optional_sections,
      ...baseConfig.recommended_sections,
      ...baseConfig.optional_sections,
    ]),
  ];

  const sectionDescriptions = allSections.map((st) => {
    const template = getSectionTemplate(st);
    return `${st}: ${template.purpose} (formats: ${template.recommended_formats.slice(0, 3).join(", ")})`;
  }).join("\n");

  const systemPrompt = `Choose which sections to include on this landing page. Look at the available sections, competitor patterns, and ICP/offer needs.`;

  // Build competitor coverage summary with actual URLs
  const competitorCoverageText = Object.entries(coverage.coverageBySectionType)
    .map(([st, data]) => {
      const maxCompetitors = coverage.quality === "HIGH" ? 5 : coverage.quality === "MEDIUM" ? 4 : 3;
      const coveragePercent = ((data.count / maxCompetitors) * 100).toFixed(0);
      const competitorUrls = data.exampleRefs
        .slice(0, 3)
        .map(ref => {
          try {
            const domain = new URL(ref.url).hostname.replace('www.', '');
            return domain;
          } catch {
            return ref.url.substring(0, 30);
          }
        })
        .join(", ");
      return `${st}: found in ${data.count} competitor${data.count !== 1 ? 's' : ''} (${coveragePercent}%) - ${competitorUrls}`;
    })
    .join("\n");

  const userPrompt = `Page type: ${pageType}

Recommended sections (consider these, but choose based on competitor patterns and ICP needs):
${pageConfig.recommended_sections.map((s) => `- ${s}`).join("\n")}

Optional sections:
${pageConfig.optional_sections.map((s) => `- ${s}`).join("\n")}

Competitor patterns found:
${competitorCoverageText || "No competitor data available"}

ICP needs:
- Roles: ${icpModel.roles.join(", ")}
- Key pains: ${icpModel.pains.slice(0, 3).join(", ")}

Available sections:
${sectionDescriptions}

Choose sections to include based on:
1. Competitor patterns (sections found in competitor pages)
2. ICP needs and pains
3. Offer requirements (what needs to be communicated)
4. Recommended sections are suggestions, not requirements

For each section, provide:
- sectionType: one of the section types above
- format: one of the recommended formats
- rationale.registryReason: why this section is included
- rationale.icpOfferReason: how it addresses ICP/offer needs (if applicable)`;

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];

  const result = await callStructured(
    model,
    messages,
    {
      type: "object",
      additionalProperties: true,
      properties: {
        chosenSections: {
          type: "array",
          items: chosenSectionSchema,
        },
      },
      required: ["chosenSections"],
    },
    { stepName: "step5_chooseSections", maxAttempts: 2 }
  );

  if (!result.ok || !result.data) {
    // Fallback: use minimal essential sections only (just hero)
    log(`[step5] Failed to choose sections, using minimal fallback (hero only)`);
    const fallbackSections: ChosenSection[] = [
      {
        sectionType: "HERO",
        format: "hero_block_two_column",
        rationale: {
          registryReason: "Essential fallback section",
        },
      },
    ];
    return { chosenSections: fallbackSections };
  }

  const chosenSections = (result.data as any).chosenSections as ChosenSection[];

  // Only ensure HERO is included (truly essential)
  // All other recommended sections are suggestions, not requirements
  const chosenSet = new Set(chosenSections.map((s) => s.sectionType));
  
  if (!chosenSet.has("HERO")) {
    const template = getSectionTemplate("HERO");
    chosenSections.unshift({
      sectionType: "HERO",
      format: template?.recommended_formats[0] || "hero_block_two_column",
      rationale: {
        registryReason: "Essential section (added automatically)",
      },
    });
    log(`[step5] Added HERO as essential section`);
  }

  // Programmatically populate competitorEvidenceRefs from coverage data
  chosenSections.forEach((chosen) => {
    const coverageData = coverage.coverageBySectionType[chosen.sectionType];
    if (coverageData && coverageData.exampleRefs.length > 0) {
      // Add competitor evidence refs from actual coverage data
      if (!chosen.rationale) {
        chosen.rationale = { registryReason: chosen.rationale?.registryReason || "" };
      }
      chosen.rationale.competitorEvidenceRefs = coverageData.exampleRefs.map(ref => ({
        url: ref.url,
        blockId: ref.blockId,
        competitorExample: ref.competitorExample,
      }));
    }
  });

  log(`[step5] Chose ${chosenSections.length} sections`);

  return { chosenSections };
}

// ============================================
// Step 6: Write Sections
// ============================================

interface WriteSectionsResult {
  sections: SectionContent[];
}

async function writeSections(
  model: "agent" | "high" | "mid",
  chosenSections: ChosenSection[],
  icpModel: ICPModel,
  claimBank: ClaimBank,
  primaryCTA: string,
  includeComments: boolean
): Promise<WriteSectionsResult> {
  log(`[step6] Writing ${chosenSections.length} sections...`);

  const sections: SectionContent[] = [];

  for (const chosen of chosenSections) {
    try {
      const template = getSectionTemplate(chosen.sectionType);
      if (!template) {
        log(`[writeSections] WARNING: No template found for section type: ${chosen.sectionType}`);
        sections.push({
          sectionType: chosen.sectionType,
          format: chosen.format,
          content: { heading: chosen.sectionType, items: [] },
        });
        continue;
      }

      const systemPrompt = `You are a landing page section writer. Write structured, scannable content for a specific section.

CRITICAL RULES:
- NO long paragraphs (>80-120 words max per paragraph)
- Prefer bullets, cards, steps, tables, lists
- Use only facts from claimBank (do not invent stats/clients/guarantees)
- Avoid banned patterns: ${claimBank.bannedPatterns.join(", ")}
- Match ICP language and address their pains/objections
- Keep content focused and outcome-oriented
- Output JSON with format-specific content structure`;

      // Extract competitor examples for this section
      const competitorExamples = chosen.rationale?.competitorEvidenceRefs
        ?.filter(ref => ref.competitorExample)
        .map(ref => `- ${ref.competitorExample}`)
        .join("\n") || "";

      const userPrompt = `SECTION TYPE: ${chosen.sectionType}
FORMAT: ${chosen.format}
PURPOSE: ${template.purpose}

ICP MODEL:
- Roles: ${icpModel.roles.join(", ")}
- Pains: ${icpModel.pains.slice(0, 5).join(", ")}
- Objections: ${icpModel.objections.slice(0, 3).join(", ")}
- Language: ${icpModel.languageTokens.slice(0, 5).join(", ")}

ALLOWED FACTS (use only these):
${claimBank.allowedFacts.map((f) => `- [${f.category}] ${f.fact}`).join("\n")}

BANNED PATTERNS (avoid these):
${claimBank.bannedPatterns.join(", ")}

PRIMARY CTA: ${primaryCTA}

${competitorExamples ? `COMPETITOR EXAMPLES (for inspiration, do not copy):
${competitorExamples}

Note: Use these as inspiration for format/structure, but write original content that matches your ICP and USPs.\n` : ""}BEST PRACTICES:
${template.best_practices.slice(0, 5).join("\n")}

ANTI-PATTERNS (avoid):
${template.anti_patterns.slice(0, 3).join("\n")}

TASK: Write section content in JSON format matching the chosen format. Content must be structured (cards, lists, tables, etc.) - NO long paragraphs.`;

      const messages: ChatMessage[] = [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ];

      const result = await callStructured(
        model,
        messages,
        sectionContentSchema,
        { stepName: `step6_writeSection_${chosen.sectionType}`, maxAttempts: 2 }
      );

      if (!result.ok || !result.data) {
        if (shouldLogFull()) log(`[step6] Failed to write section ${chosen.sectionType}: ${result.error?.message}`);
        // Create minimal fallback
        sections.push({
          sectionType: chosen.sectionType,
          format: chosen.format,
          content: { heading: template?.name || chosen.sectionType, items: [] },
        });
        continue;
      }

      const sectionContent = result.data as SectionContent;
      
      // Add notes if requested
      if (includeComments) {
        sectionContent.notes = {
          whyThisSection: template.builder_comments,
          competitorEvidence: chosen.rationale.competitorEvidenceRefs?.map((ref) => ref.url) || [],
        };
      }

      sections.push(sectionContent);
    } catch (error: any) {
      if (shouldLogFull()) log(`[step6] Error writing section ${chosen.sectionType}: ${error.message}`);
    }
  }

  log(`[step6] Wrote ${sections.length} sections`);

  return { sections };
}

// ============================================
// Step 7: Review Pitfalls
// ============================================

interface PitfallsReviewResult {
  revisedSections: SectionContent[];
  qaReport: {
    issuesFound: string[];
    improvements: string[];
    structureVariety: number;
  };
}

async function reviewPitfalls(
  model: "agent" | "high" | "mid",
  sections: SectionContent[],
  claimBank: ClaimBank
): Promise<PitfallsReviewResult> {
  log(`[step7] Reviewing ${sections.length} sections for pitfalls...`);

  const issuesFound: string[] = [];
  const improvements: string[] = [];
  const revisedSections: SectionContent[] = [];

  // Count format variety
  const formatCounts: Record<string, number> = {};
  sections.forEach((s) => {
    formatCounts[s.format] = (formatCounts[s.format] || 0) + 1;
  });
  const structureVariety = Object.keys(formatCounts).length;

  if (structureVariety < 3) {
    issuesFound.push(`Low format variety: only ${structureVariety} different formats used`);
  }

  // Review each section
  for (const section of sections) {
    const sectionStr = JSON.stringify(section.content, null, 2);
    
    // Check for long paragraphs
    const longParagraphs = sectionStr.match(/"[^"]{200,}"/g);
    if (longParagraphs) {
      issuesFound.push(`Section ${section.sectionType} has long paragraphs (>200 chars)`);
    }

    // Check for banned patterns
    const hasBannedPattern = claimBank.bannedPatterns.some((pattern) =>
      sectionStr.toLowerCase().includes(pattern.toLowerCase())
    );
    if (hasBannedPattern) {
      issuesFound.push(`Section ${section.sectionType} contains banned pattern`);
    }

    // Check for unverified claims (numbers not in claimBank)
    const numberMatches = sectionStr.match(/\d+[,\d]*(?:years?|months?|clients?|customers?|companies?)/gi);
    if (numberMatches) {
      const unverified = numberMatches.filter((match) => {
        return !claimBank.allowedFacts.some((fact) =>
          fact.fact.toLowerCase().includes(match.toLowerCase())
        );
      });
      if (unverified.length > 0) {
        issuesFound.push(`Section ${section.sectionType} may contain unverified claims: ${unverified.join(", ")}`);
      }
    }

    // If issues found, attempt repair
    if (longParagraphs || hasBannedPattern) {
      const repairPrompt = `REVIEW THIS SECTION AND FIX PITFALLS:

SECTION:
${JSON.stringify(section, null, 2)}

ISSUES TO FIX:
${longParagraphs ? "- Break long paragraphs into bullets/cards/lists\n" : ""}
${hasBannedPattern ? "- Remove banned patterns and generic claims\n" : ""}
- Ensure content is structured (no long paragraphs)
- Use only facts from claimBank
- Improve scannability

TASK: Return the revised section JSON with the same structure but fixed content.`;

      const repairResult = await callStructured(
        model,
        [
          {
            role: "system",
            content: "You are a content reviewer. Fix AI pitfalls: reduce verbosity, remove fluff, improve structure. Output JSON only.",
          },
          { role: "user", content: repairPrompt },
        ],
        sectionContentSchema,
        { stepName: `step7_repair_${section.sectionType}`, maxAttempts: 1 }
      );

      if (repairResult.ok && repairResult.data) {
        revisedSections.push(repairResult.data as SectionContent);
        improvements.push(`Repaired section ${section.sectionType}`);
      } else {
        revisedSections.push(section); // Keep original if repair fails
      }
    } else {
      revisedSections.push(section);
    }
  }

  log(`[step7] Review complete: ${issuesFound.length} issues found, ${improvements.length} improvements made`);

  return {
    revisedSections,
    qaReport: {
      issuesFound,
      improvements,
      structureVariety,
    },
  };
}

// ============================================
// Step 8: Render HTML
// ============================================

interface RenderHtmlResult {
  html: string;
}

function renderHtml(sections: SectionContent[]): RenderHtmlResult {
  log(`[step8] Rendering ${sections.length} sections to HTML...`);

  const html = renderFullPage(sections);

  log(`[step8] HTML rendered (${html.length} chars)`);

  return { html };
}

// ============================================
// Main Pipeline Function
// ============================================

export async function writeArticleLandingPipeline(
  request: MonkeyTaskRequest,
  options?: any
): Promise<MonkeyTaskResponse> {
  // Check for step continuation (via runId and stepIndex in userInput)
  const userInput = request.userInput as any;
  const existingRunId = userInput?.runId;
  const requestedStepIndex = userInput?.stepIndex;
  
  let runId: string;
  let runState: any = null;
  let stepIndex = 0;

  if (existingRunId && requestedStepIndex) {
    // Continue existing run from specific step
    runId = existingRunId;
    runState = getRun(runId);
    if (!runState) {
      return {
        ok: false,
        runId,
        artifacts: {},
        errors: [{
          code: "PROVIDER_ERROR" as any,
          message: `Run ${runId} not found. It may have expired.`,
        }],
      };
    }
    stepIndex = requestedStepIndex;
    log(`[writeArticleLandingPipeline] Continuing run ${runId} from step ${stepIndex}`);
  } else {
    // Start new run - use the runId returned from createRun
    runId = createRun(request);
    runState = getRun(runId);
    stepIndex = 0; // Start from beginning
    log(`[writeArticleLandingPipeline] Starting new run ${runId}`);
  }

  const startTime = Date.now();
  const agentTrace: MarketingPageResponse["meta"]["agentTrace"] = [];

  logAgenticPipelineStart("Generate Marketing Page (Agentic)");

  try {
    // Validate request and extract pageType
    console.log("[writeArticleLandingPipeline] Extracting pageType from request", {
      userInputPageType: (request.userInput as any)?.pageType,
      campaignContextPageType: request.campaignContext?.pageType,
      hasCampaignContext: !!request.campaignContext,
      hasUserInput: !!request.userInput,
    });

    let pageType = (request.userInput as any)?.pageType || request.campaignContext?.pageType;
    
    // If pageType is missing, try to infer it from campaign context or use default
    if (!pageType) {
      console.log("[writeArticleLandingPipeline] pageType not provided, attempting to infer...");
      
      // Try to infer from campaign context
      const campaignContext = request.campaignContext || {};
      const offer = campaignContext.offer || {};
      
      // Infer based on offer type or campaign goal
      if (offer.type === "service" || offer.type === "consultation") {
        pageType = MarketingPageType.QUOTE_CONSULTATION_SERVICE;
      } else if (offer.type === "saas" || offer.type === "software") {
        pageType = MarketingPageType.DEMO_TRIAL_SAAS;
      } else if (offer.type === "download" || offer.type === "resource") {
        pageType = MarketingPageType.LEAD_MAGNET_DOWNLOAD;
      } else {
        // Default to universal base page type
        pageType = MarketingPageType.BASE_UNIVERSAL;
      }
      
      console.log("[writeArticleLandingPipeline] Inferred pageType:", pageType);
    }
    
    // Validate pageType
    if (!pageType || !Object.values(MarketingPageType).includes(pageType as MarketingPageType)) {
      console.error("[writeArticleLandingPipeline] Invalid pageType:", pageType);
      return {
        ok: false,
        runId,
        artifacts: {},
        errors: [{
          code: "PROVIDER_ERROR" as any,
          message: `Invalid pageType: ${pageType}. Must be one of: ${Object.values(MarketingPageType).join(", ")}`,
        }],
      };
    }
    
    console.log("[writeArticleLandingPipeline] Using pageType:", pageType);

    const marketingRequest: MarketingPageRequest = {
      model: request.model || "high",
      taskType: "MARKETING_PAGE_GENERATE_AGENTIC",
      pageType: pageType as MarketingPageType,
      campaignContext: request.campaignContext,
      userInput: request.userInput as any,
      constraints: request.constraints,
    };

    const includeComments = marketingRequest.userInput?.includeComments || false;

    // Declare variables that need to be accessible across steps
    let intentModel: IntentModel | undefined;
    let validatedCompetitors: CompetitorValidationResult[] = [];
    let competitorQuality: "HIGH" | "MEDIUM" | "LOW" = "LOW";

    // ============================================
    // STEP 1: INTERPRET INTENT, NEEDS, USPs
    // ============================================
    if (stepIndex <= 1) {
      emitStepCard(runId, {
        title: "Step 1: Interpreting Intent",
        message: "Analyzing your offer, ICP needs, and USPs...",
        status: "running",
      });

      const step1Start = Date.now();
      const intentResult = await interpretIntent(
        marketingRequest.model,
        marketingRequest.pageType,
        marketingRequest.campaignContext,
        marketingRequest.userInput
      );
      
      // Track failed attempts for frontend display
      const step1FailedAttempts = intentResult.failedAttempts || [];
      
      // Update run state (ensure runState is current)
      const currentRunState = getRun(runId) || runState;
      updateRun(runId, { stepIndex: 1, artifacts: { ...currentRunState?.artifacts, intentModel: intentResult.intentModel } });

      intentModel = intentResult.intentModel;
      const bullets = [
        `Primary goal: ${intentModel.pageGoal}`,
        `Top pains: ${intentModel.icpModel.pains.slice(0, 3).join(", ")}`,
        `Decision criteria: ${intentModel.icpModel.decisionCriteria.slice(0, 2).join(", ")}`,
        `Primary CTA: ${intentModel.primaryCTA.label}`,
      ];

      emitStepCard(runId, {
        title: "Step 1: Intent Interpreted",
        message: `Extracted ${intentModel.icpModel.roles.length} roles, ${intentModel.claimBank.allowedFacts.length} allowed facts, ${intentModel.uspAngles.length} USP angles`,
        status: "done",
        bullets,
      });

      agentTrace.push({
        step: "step1_interpretIntent",
        started: step1Start,
        ended: Date.now(),
        summary: `Interpreted intent: ${intentModel.pageGoal}, ${intentModel.icpModel.roles.length} roles`,
      });

      // Return after Step 1 for step-by-step debugging
      const step1Response = {
        ok: true,
        runId,
        step: 1,
        stepName: "interpretIntent",
        message: `Step 1 Complete: Interpreted intent with ${intentModel.icpModel.roles.length} roles, ${intentModel.claimBank.allowedFacts.length} allowed facts, ${intentModel.uspAngles.length} USP angles`,
        artifacts: {
          intentModel,
        },
        meta: {
          agentTrace,
          uiCards: getUICards(runId),
          nextStep: 2,
          failedAttempts: intentResult.failedAttempts || [],
          finalAttempt: intentResult.finalAttempt,
        },
      };
      return step1Response;
    }

    // Get intentModel from run state if not already set (should exist from Step 1)
    if (!intentModel) {
      runState = getRun(runId) || runState;
      intentModel = runState?.artifacts?.intentModel;
      if (!intentModel) {
        return {
          ok: false,
          runId,
          errors: [{ code: "PROVIDER_ERROR" as any, message: "Intent model not found. Please start from Step 1." }],
        };
      }
    }

    // ============================================
    // STEP 2: COLLECT COMPETITOR PAGES + VALIDATE
    // ============================================
    // COMMENTED OUT FOR STEP-BY-STEP DEBUGGING
    /*
    if (stepIndex <= 2) {
      emitStepCard(runId, {
        title: "Step 2: Collecting Competitors",
        message: "Collecting competitor pages and validating relevance...",
        status: "running",
      });

      const step2Start = Date.now();
      
      // Collect candidates (with AI fallback if DataForSEO fails)
      // Use the offer name as primary keyword if available, otherwise use first seed query
      const offerName = marketingRequest.campaignContext?.offer?.name || marketingRequest.campaignContext?.offer?.description;
      const primaryKeyword = offerName || intentModel.competitorQueryHints.seedQueries[0];
      
      log(`[step2] Using primary keyword for competitor search: "${primaryKeyword}" (from ${offerName ? 'offer.name' : 'seedQueries[0]'})`);
      log(`[step2] Available seed queries:`, intentModel.competitorQueryHints.seedQueries);
      
      const candidatesResult = await collectCompetitorCandidates(
        marketingRequest.userInput,
        primaryKeyword,
        intentModel,
        marketingRequest.pageType,
        marketingRequest.campaignContext,
        marketingRequest.model
      );
      
      // Validate competitors
      const validationResult = await validateCompetitorCandidates(
        marketingRequest.model,
        candidatesResult.candidates,
        marketingRequest.pageType,
        marketingRequest.campaignContext
      );

      // Update run state (ensure we have current state)
      const currentRunState2 = getRun(runId) || runState;
      updateRun(runId, { 
        stepIndex: 2, 
        artifacts: { 
          ...currentRunState2?.artifacts, 
          intentModel,
          competitors: validationResult.validated,
          competitorQuality: validationResult.quality,
        } 
      });

      const archetypeCounts = validationResult.validated.reduce((acc, c) => {
        acc[c.pageArchetype] = (acc[c.pageArchetype] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const bullets = [
        `Validated ${validationResult.validated.length} competitor pages`,
        `Skipped ${validationResult.rejected.length} irrelevant pages`,
        `Archetypes: ${Object.entries(archetypeCounts).map(([k, v]) => `${k} (${v})`).join(", ")}`,
      ];

      if (validationResult.quality === "LOW") {
        bullets.push("⚠️ Low competitor coverage - proceeding with registry + ICP/USP only");
      }

      emitStepCard(runId, {
        title: "Step 2: Competitors Validated",
        message: `Validated ${validationResult.validated.length} competitor pages (skipped ${validationResult.rejected.length})`,
        status: validationResult.quality === "LOW" ? "warning" : "done",
        bullets,
      });

      agentTrace.push({
        step: "step2_validateCompetitors",
        started: step2Start,
        ended: Date.now(),
        summary: `${validationResult.validated.length} validated, ${validationResult.rejected.length} rejected (quality: ${validationResult.quality})`,
        warnings: validationResult.quality === "LOW" ? ["Low competitor coverage - relying more on registry"] : undefined,
      });

      // Store validated competitors for Step 3
      validatedCompetitors = validationResult.validated;
      competitorQuality = validationResult.quality;
      
      // Continue to next step (no return - pipeline continues)
      runState = getRun(runId) || runState;
    }
    */

    // Get competitors from run state if not already set (should exist from Step 2)
    /*
    if (validatedCompetitors.length === 0) {
      runState = getRun(runId) || runState;
      validatedCompetitors = runState?.artifacts?.competitors || [];
      competitorQuality = runState?.artifacts?.competitorQuality || "LOW";
    }
    
    if (!intentModel) {
      runState = getRun(runId) || runState;
      intentModel = runState?.artifacts?.intentModel;
      if (!intentModel) {
        return {
          ok: false,
          runId,
          errors: [{ code: "PROVIDER_ERROR" as any, message: "Intent model not found. Please start from Step 1." }],
        };
      }
    }

    // ============================================
    // STEP 3: WALL OF CONTENT IDEAS SELECTION
    // ============================================
    // COMMENTED OUT FOR STEP-BY-STEP DEBUGGING
    /*
    if (stepIndex <= 3) {
      emitStepCard(runId, {
        title: "Step 3: Selecting Page Sections",
        message: "Selecting page sections using competitor patterns + your offer/ICP...",
        status: "running",
      });

      const step3Start = Date.now();

      // Benchmark competitors (only if quality != LOW)
      let coverage: CompetitorCoverage;
      if (competitorQuality !== "LOW" && validatedCompetitors.length > 0) {
        const benchmarkResult = await benchmarkCompetitors(
          marketingRequest.model,
          validatedCompetitors,
          marketingRequest.pageType
        );
        coverage = benchmarkResult.coverage;
      } else {
        // Create empty coverage for LOW quality
        coverage = {
          coverageBySectionType: {} as any,
          commonOrderingPatterns: [],
          archetypeCounts: {},
          quality: "LOW",
        };
      }

      // Choose sections using sticky scoring
      const sectionsResult = await chooseSections(
        marketingRequest.model,
        marketingRequest.pageType,
        coverage,
        intentModel.icpModel,
        intentModel.claimBank,
        intentModel.primaryCTA.label
      );

      // Update run state (ensure we have current state)
      const currentRunState3 = getRun(runId) || runState;
      updateRun(runId, {
        stepIndex: 3,
        artifacts: {
          ...currentRunState3?.artifacts,
          intentModel,
          competitors: validatedCompetitors,
          competitorQuality,
          coverage,
          chosenSections: sectionsResult.chosenSections,
        },
      });

      const sectionTitles = sectionsResult.chosenSections.map((cs) => {
        const template = getSectionTemplate(cs.sectionType);
        return template?.name || cs.sectionType || "Unknown Section";
      });

      const bullets = [
        `Selected ${sectionsResult.chosenSections.length} sections`,
        `Sections: ${sectionTitles.slice(0, 4).join(", ")}${sectionTitles.length > 4 ? "..." : ""}`,
        `Process + deliverables reduce procurement friction`,
        competitorQuality === "LOW" ? "Using registry + ICP/USP only (low competitor coverage)" : "Using competitor patterns + registry",
      ];

      if (includeComments) {
        bullets.push("This run will include 'why we included this' notes per section");
      }

      emitStepCard(runId, {
        title: "Step 3: Sections Selected",
        message: `Selected ${sectionsResult.chosenSections.length} sections based on competitor patterns and your offer/ICP`,
        status: "done",
        bullets,
      });

      agentTrace.push({
        step: "step3_chooseSections",
        started: step3Start,
        ended: Date.now(),
        summary: `Chose ${sectionsResult.chosenSections.length} sections`,
      });

      // Always return after each step with interim results
      runState = getRun(runId) || runState;
      
      // Build detailed message for Step 3
      const sectionsDetails = sectionsResult.chosenSections.map((cs, idx) => {
        const template = getSectionTemplate(cs.sectionType);
        const sectionName = template?.name || cs.sectionType || "Unknown Section";
        const rationale = cs.rationale?.registryReason || cs.rationale?.icpOfferReason || "Selected based on scoring";
        
        // Extract unique competitor URLs that included this section
        let competitorInfo = "";
        if (cs.rationale?.competitorEvidenceRefs && cs.rationale.competitorEvidenceRefs.length > 0) {
          const uniqueUrls = [...new Set(cs.rationale.competitorEvidenceRefs.map(ref => ref.url))];
          const competitorCount = uniqueUrls.length;
          const competitorList = uniqueUrls.slice(0, 3).map(url => {
            // Try to find the competitor in validatedCompetitors to get a better name
            const competitor = validatedCompetitors.find(c => c.url === url);
            if (competitor) {
              // Extract domain name for readability
              try {
                const domain = new URL(url).hostname.replace('www.', '');
                return `  • ${domain} (${competitor.pageArchetype})`;
              } catch {
                return `  • ${url.substring(0, 50)}...`;
              }
            }
            try {
              const domain = new URL(url).hostname.replace('www.', '');
              return `  • ${domain}`;
            } catch {
              return `  • ${url.substring(0, 50)}...`;
            }
          }).join("\n");
          
          competitorInfo = `\n   Found in ${competitorCount} competitor${competitorCount > 1 ? 's' : ''}:\n${competitorList}`;
          if (uniqueUrls.length > 3) {
            competitorInfo += `\n   ... and ${uniqueUrls.length - 3} more`;
          }
        }
        
        const icpReason = cs.rationale?.icpOfferReason ? `\n   ICP/Offer reason: ${cs.rationale.icpOfferReason}` : "";
        return `${idx + 1}. ${sectionName} (${cs.format})${competitorInfo}\n   Why: ${rationale}${icpReason}`;
      }).join("\n\n");
      
      const step3Message = `Step 3 Complete: Selected ${sectionsResult.chosenSections.length} sections based on competitor patterns and your offer/ICP

Selected Sections:
${sectionsDetails}

${competitorQuality === "LOW" ? "Note: Using registry + ICP/USP only (low competitor coverage)" : "Note: Using competitor patterns + registry"}`;
      
      return {
        ok: true,
        runId,
        step: 3,
        stepName: "chooseSections",
        message: step3Message,
        artifacts: {
          intentModel,
          competitors: validatedCompetitors,
          coverage,
          chosenSections: sectionsResult.chosenSections,
        },
        meta: { 
          uiCards: getUICards(runId), 
          nextStep: 4,
          agentTrace,
        },
      };
    }
    */

    // Get chosen sections and intentModel from run state (refresh from store to ensure we have latest)
    /*
    runState = getRun(runId) || runState;
    const chosenSections = runState?.artifacts?.chosenSections || [];
    intentModel = runState?.artifacts?.intentModel;
    
    if (!intentModel) {
      return {
        ok: false,
        runId,
        errors: [{ code: "PROVIDER_ERROR" as any, message: "Intent model not found. Please start from Step 1." }],
      };
    }
    
    if (chosenSections.length === 0) {
      log(`[writeArticleLandingPipeline] WARNING: No chosen sections found in run state. Run state:`, runState);
      log(`[writeArticleLandingPipeline] RunId: ${runId}, StepIndex: ${stepIndex}`);
    } else {
      log(`[writeArticleLandingPipeline] Found ${chosenSections.length} chosen sections for Step 4`);
    }

    // ============================================
    // STEP 4: WRITE SECTIONS + RENDER HTML
    // ============================================
    if (stepIndex <= 4) {
      emitStepCard(runId, {
        title: "Step 4: Writing Sections",
        message: `Writing ${chosenSections.length} sections and rendering HTML...`,
        status: "running",
      });

      const step4Start = Date.now();

      // Write each section
      const writeResult = await writeSections(
        marketingRequest.model,
        chosenSections,
        intentModel.icpModel,
        intentModel.claimBank,
        intentModel.primaryCTA.label,
        includeComments
      );

      // Emit per-section progress
      for (const section of writeResult.sections) {
        const template = getSectionTemplate(section.sectionType);
        const sectionName = template?.name || section.sectionType || "Unknown Section";
        emitStepCard(runId, {
          title: `Writing: ${sectionName}`,
          message: `Completed: ${sectionName}`,
          status: "done",
          bullets: [`Format: ${section.format}`, `Content structure ready`],
        });
      }

      // Review pitfalls
      emitStepCard(runId, {
        title: "Polishing Content",
        message: "Polishing for readability + conversion...",
        status: "running",
      });

      const pitfallsResult = await reviewPitfalls(
        marketingRequest.model,
        writeResult.sections,
        intentModel.claimBank
      );

      emitStepCard(runId, {
        title: "Polish Complete",
        message: `Polish complete: reduced fluff, increased structure variety`,
        status: "done",
        bullets: [
          `Found ${pitfallsResult.qaReport.issuesFound.length} issues`,
          `Made ${pitfallsResult.qaReport.improvements.length} improvements`,
          `Format variety: ${pitfallsResult.qaReport.structureVariety} different formats`,
        ],
      });

      // Render HTML
      emitStepCard(runId, {
        title: "Rendering HTML",
        message: "Rendering final HTML...",
        status: "running",
      });

      const htmlResult = renderHtml(pitfallsResult.revisedSections);

      // Process placeholder images based on user theme preference
      let processedHtml = htmlResult.html;
      try {
        const userPlaceholderTheme = await getUserPlaceholderTheme();
        processedHtml = await processPlaceholderImages(htmlResult.html, userPlaceholderTheme);
        log(`[writeArticleLandingPipeline] Processed placeholder images with theme: ${userPlaceholderTheme}`);
      } catch (error) {
        log(`[writeArticleLandingPipeline] Failed to process placeholder images, using default: ${error}`);
        // Fallback to default theme
        processedHtml = await processPlaceholderImages(htmlResult.html, "professional");
      }

      emitStepCard(runId, {
        title: "HTML Ready",
        message: `HTML ready. Preview available.`,
        status: "done",
        bullets: [`${processedHtml.length} characters`, `${pitfallsResult.revisedSections.length} sections rendered`],
      });

      agentTrace.push({
        step: "step4_writeAndRender",
        started: step4Start,
        ended: Date.now(),
        summary: `Wrote ${writeResult.sections.length} sections, rendered ${processedHtml.length} chars`,
        warnings: pitfallsResult.qaReport.issuesFound.length > 0 ? pitfallsResult.qaReport.issuesFound.slice(0, 3) : undefined,
      });

      const totalTime = Date.now() - startTime;

      // Get final artifacts from run state or current execution
      const finalSections = pitfallsResult.revisedSections;
      const finalHtml = processedHtml;
      const finalChosenSections = chosenSections;
      const finalCoverage = runState?.artifacts?.coverage || {
        coverageBySectionType: {} as any,
        commonOrderingPatterns: [],
        archetypeCounts: {},
        quality: competitorQuality as "HIGH" | "MEDIUM" | "LOW",
      };

      // Build response
      const response: MarketingPageResponse = {
        ok: true,
        runId,
        pageType: marketingRequest.pageType,
        sections: finalSections,
        html: finalHtml,
        meta: {
          chosenSections: finalChosenSections,
          rationale: includeComments
            ? finalChosenSections.map((cs) => ({
                sectionType: cs.sectionType,
                rationale: cs.rationale,
              }))
            : undefined,
          competitorSummary: finalCoverage,
          agentTrace,
        },
      };

      log(`[writeArticleLandingPipeline] Completed in ${totalTime}ms`);
      log(`[writeArticleLandingPipeline] Response summary:`, {
        sectionsCount: response.sections.length,
        htmlLength: response.html.length,
        chosenSectionsCount: response.meta.chosenSections.length,
      });

      // Build final response with message
      const step4Message = `Step 4 Complete: Generated ${response.sections.length} sections and rendered ${response.html.length} characters of HTML`;
      
      const finalResponse = {
        ok: true,
        runId,
        step: 4,
        stepName: "writeAndRender",
        message: step4Message,
        artifacts: {
          pageType: response.pageType,
          sections: response.sections,
          chosenSections: response.meta.chosenSections,
          competitorSummary: response.meta.competitorSummary,
          qaReport: pitfallsResult.qaReport,
        },
        output: {
          html: response.html,
          markdown: response.html, // For compatibility
        },
        meta: {
          timings: { total: totalTime },
          agentTrace: response.meta.agentTrace,
          uiCards: getUICards(runId),
          nextStep: undefined, // Final step, no next step
        },
      };

      log(`[writeArticleLandingPipeline] Returning response with ${finalResponse.output.html.length} chars of HTML (placeholder images processed)`);
      
      // Clean up run state after final step
      deleteRun(runId);
      clearUICards(runId);
      
      return finalResponse;
    }
    */
  } catch (error: any) {
    log(`[writeArticleLandingPipeline] Error: ${error.message}`);
    return {
      ok: false,
      runId,
      artifacts: {},
      errors: [{
        code: "PROVIDER_ERROR" as any,
        message: error.message || "Unknown error in marketing page generation",
        step: "writeArticleLandingPipeline",
        details: { stack: error.stack },
      }],
    };
  }
}

// Register as both WRITE_ARTICLE_LANDING and MARKETING_PAGE_GENERATE_AGENTIC
registerPipeline(
  "WRITE_ARTICLE_LANDING",
  "Write Landing Page Article",
  "Transactional, conversion-optimized landing pages with hybrid section structure. Use for landing pages, sales pages, conversion pages, or promotional articles.",
  writeArticleLandingPipeline
);

// Also register the new task type
registerPipeline(
  "MARKETING_PAGE_GENERATE_AGENTIC",
  "Generate Marketing Page (Agentic)",
  "Full agentic marketing page generation with competitor validation, section selection, and structured HTML rendering.",
  writeArticleLandingPipeline
);
