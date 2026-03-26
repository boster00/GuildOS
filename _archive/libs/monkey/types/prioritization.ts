// ARCHIVED: Original path was libs/monkey/types/prioritization.ts

/**
 * 3-Tier Cognitive Prioritization Model
 * 
 * This model organizes content based on user decision-making patterns:
 * - Tier 1: Establishes relevance and intent confirmation
 * - Tier 2: Builds credibility and differentiation
 * - Tier 3: Reduces friction and provides completeness
 */

export type ContentTier = 1 | 2 | 3;

export interface TierClassification {
  tier: ContentTier;
  rationale: string;
}

export interface BriefStrategicContext {
  primaryIntent: string;
  secondaryIntents: string[];
  immediateQuestions: string[];
  decisionCriteria: string[];
}

export interface DetailedStrategicContext extends BriefStrategicContext {
  icpMentalState: string;
  expectedQuestions: string[];
  whatTheyWantToSee: string[];
  whatWeWantThemToSee: string[];
  decisionFactors: string[];
  riskFactors: string[];
  competitiveContext: string;
}

export const TIER_DESCRIPTIONS = {
  1: {
    label: "What Customer Wants to Know",
    purpose: "Establish relevance and intent confirmation",
    questions: ["Am I in the right place?", "Does this do what I need?", "What's my next step?"],
    placement: "Must appear first",
  },
  2: {
    label: "What We Want Them to Know",
    purpose: "Build credibility and differentiation",
    questions: ["Why this vs alternatives?", "Can I trust this?", "Is it worth it?"],
    placement: "After Tier 1, before supporting content",
  },
  3: {
    label: "Everything Else",
    purpose: "Reduce friction and provide completeness",
    questions: ["What if I have concerns?", "How does this work in my case?", "Where can I learn more?"],
    placement: "Later sections, often collapsible",
  },
} as const;
