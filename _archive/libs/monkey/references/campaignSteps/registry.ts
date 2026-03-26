// ARCHIVED: Original path was libs/monkey/references/campaignSteps/registry.ts

/**
 * Campaign Phase Strategies Registry
 * 
 * Defines the purpose, goals, and content strategies for each campaign phase.
 * Used to generate phase-specific prompts and guide content creation.
 */

export interface CampaignPhaseStrategy {
  phase: number | "Expand";
  name: string;
  purpose: string;
  goal: string;
  audience: string;
  contentApproach: string[];
  titleStrategy?: string;
}

export const CAMPAIGN_PHASE_STRATEGIES: Record<number | "Expand", CampaignPhaseStrategy> = {
  1: {
    phase: 1,
    name: "Help them buy",
    purpose: `Phase 1 Purpose (Landing Page - Bottom of Funnel):
AUDIENCE: Visitors seeking vendors + those with conversion intent
GOAL: Convert seekers into buyers, and enable instant action for ready buyers

PRIMARY OBJECTIVE (3-second test):
• Determine the most appropriate call-to-action for this offer (order, book meeting, contact, etc.)
• Make that action completable within seconds for ready buyers

SECONDARY OBJECTIVE (convince "on the fence"):
• Present general decision factors involved in choosing this type of offer/solution
• Highlight the specific USPs that differentiate this offer
• Help them confirm: "This is the right solution for me"

CONTENT APPROACH:
• Lead with clear value proposition aligned with the outcome they want
• Address both emotional (identity, pain points) and rational (decision factors) needs
• Include concrete transactional details (don't make them ask)
• Strong, friction-free call-to-action

Title strategy: Lead with the outcome/main keyword in the first few words. This is a transactional page—the core message is "what you're looking for is here." Keep it simple and direct. USPs, pain points, and identity callouts are optional—only add them if they meaningfully differentiate without cluttering the main message.`,
    goal: "Convert seekers into buyers, and enable instant action for ready buyers",
    audience: "Visitors seeking vendors + those with conversion intent",
    contentApproach: [
      "Lead with clear value proposition aligned with the outcome they want",
      "Address both emotional (identity, pain points) and rational (decision factors) needs",
      "Include concrete transactional details (don't make them ask)",
      "Strong, friction-free call-to-action",
    ],
    titleStrategy: "Lead with the outcome/main keyword in the first few words. This is a transactional page—the core message is \"what you're looking for is here.\" Keep it simple and direct.",
  },
  2: {
    phase: 2,
    name: "Help them decide",
    purpose: `Phase 2 Purpose (Decision Guide - Mid Funnel):
AUDIENCE: Actively seeking solutions, trying to figure out the right strategy and vendor
CRITICAL: This phase varies significantly based on customer familiarity with the solution space

YOUR TASK: Analyze the offer and determine which comparison approach fits:
• If customers are FAMILIAR with this type of solution → Focus on vendor comparison (who to choose)
• If customers are UNFAMILIAR with solutions → Focus on strategy/approach comparison (what to choose)

GOAL: Guide them through their evaluation process toward the landing page (Phase 1)

CONTENT APPROACH:
• Help them understand their options clearly
• Address key decision criteria they're evaluating
• Position this offer naturally without being overly promotional
• Show why this solution/vendor fits their specific needs

Title strategy: Should reflect the comparison type - adapt to whether this is a vendor selection or strategy selection decision`,
    goal: "Guide them through their evaluation process toward the landing page (Phase 1)",
    audience: "Actively seeking solutions, trying to figure out the right strategy and vendor",
    contentApproach: [
      "Help them understand their options clearly",
      "Address key decision criteria they're evaluating",
      "Position this offer naturally without being overly promotional",
      "Show why this solution/vendor fits their specific needs",
    ],
    titleStrategy: "Should reflect the comparison type - adapt to whether this is a vendor selection or strategy selection decision",
  },
  3: {
    phase: 3,
    name: "Help them understand",
    purpose: `Phase 3 Purpose (Outcome Guide - Top of Funnel):
AUDIENCE: Latent customers transitioning to active seekers
MINDSET: They resonate with the OUTCOME, not solution details yet

WHO ARE LATENT CUSTOMERS:
• Know they want the outcome/transformation
• Don't yet know the solution approaches or vendors
• Respond to identity-based callouts (who they are) and pain-point language
• Not ready for technical details or vendor comparisons

GOAL: Educate on HOW to achieve the outcome they desire (step-by-step guide)

CONTENT APPROACH:
• Focus on the outcome/transformation throughout
• Provide detailed step-by-step guidance for achieving it
• Use language that speaks to their identity and pain points
• Naturally introduce the solution as a tool for achieving the outcome (not the focus)
• Build authority through valuable, actionable information

Title strategy: Outcome-focused, educational, promises clear path to achieving what they want`,
    goal: "Educate on HOW to achieve the outcome they desire (step-by-step guide)",
    audience: "Latent customers transitioning to active seekers",
    contentApproach: [
      "Focus on the outcome/transformation throughout",
      "Provide detailed step-by-step guidance for achieving it",
      "Use language that speaks to their identity and pain points",
      "Naturally introduce the solution as a tool for achieving the outcome (not the focus)",
      "Build authority through valuable, actionable information",
    ],
    titleStrategy: "Outcome-focused, educational, promises clear path to achieving what they want",
  },
  Expand: {
    phase: "Expand",
    name: "Expand",
    purpose: `Expand Purpose (Content Cluster - Satellite Articles):
AUDIENCE: Search engine users and AI systems seeking related information
GOAL: Create content cluster to support the main pages (Phase 1, 2, 3)

PRIMARY OBJECTIVES:
• Draw in traffic for target keywords that bring visitors searching for related topics
• Support main pages in SEO (Search Engine Optimization) and GEO (Generative Engine Optimization)
• Keep new content coming to the site, which is favored by search engines and AIs

CONTENT CLUSTER STRATEGY:
• Create supporting articles that link back to and reinforce your pillar pages (Phase 3)
• Target long-tail and related search queries your ICP uses
• Cover topics that complement and expand on your main content
• Build topical authority around your core offering

CONTENT APPROACH:
• Deep dives on key concepts from your pillar page
• Usage scenarios and case studies showing real-world applications
• Troubleshooting guides and common mistakes
• Micro-decision content (A vs B comparisons)`,
    goal: "Create content cluster to support the main pages (Phase 1, 2, 3)",
    audience: "Search engine users and AI systems seeking related information",
    contentApproach: [
      "Create supporting articles that link back to and reinforce your pillar pages (Phase 3)",
      "Target long-tail and related search queries your ICP uses",
      "Cover topics that complement and expand on your main content",
      "Build topical authority around your core offering",
    ],
  },
};

/**
 * Get strategy for a campaign phase
 */
export function getCampaignPhaseStrategy(phase: number | "Expand" | null | undefined): CampaignPhaseStrategy | null {
  if (!phase) return null;
  return CAMPAIGN_PHASE_STRATEGIES[phase] || null;
}

/**
 * Generate a phase-specific prompt for outline generation
 */
export function generatePhasePrompt(
  phase: number | "Expand" | null | undefined,
  offerName?: string,
  icpName?: string,
  articleTitle?: string
): string {
  const strategy = getCampaignPhaseStrategy(phase);
  
  if (!strategy) {
    return articleTitle 
      ? `Create an outline for ${articleTitle}`
      : "Create an outline for this article";
  }

  const phaseName = typeof phase === "number" ? `Phase ${phase}: ${strategy.name}` : strategy.name;
  
  if (offerName && icpName) {
    return `Create content for ${offerName} targeting ${icpName} following ${phaseName} strategy. ${strategy.goal}`;
  } else if (articleTitle) {
    return `Create an outline for ${articleTitle} following ${phaseName} strategy. ${strategy.goal}`;
  } else {
    return `Create content following ${phaseName} strategy. ${strategy.goal}`;
  }
}
