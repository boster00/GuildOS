/**
 * Types for Marketing Page Generation Pipeline
 */

import { MarketingPageType, SectionType } from "./pageTypes/registry";

export interface MarketingPageRequest {
  model: "agent" | "high" | "mid";
  taskType: "MARKETING_PAGE_GENERATE_AGENTIC";
  pageType: MarketingPageType;
  campaignContext?: any;
  userInput?: {
    competitorUrls?: string[];
    templateHtml?: string;
    includeComments?: boolean;
    maxCompetitors?: number;
    runMode?: "auto" | "interactive";
  };
  constraints?: {
    tone?: string;
    audience?: string;
    noFakeProof?: boolean;
    [key: string]: any;
  };
}

export interface CompetitorCandidate {
  url: string;
  title?: string;
  source: "user_provided" | "serp" | "ai_suggestion";
}

export interface CompetitorValidationResult {
  url: string;
  isRelevantCompetitorPage: boolean;
  confidence: number;
  matchedSignals: string[];
  rejectReasons: string[];
  pageArchetype: "service_landing" | "pricing" | "directory" | "blog" | "tool" | "unknown";
  extractedText?: string;
  headings?: string[];
  evidenceSnippet?: string;
}

export interface CompetitorBlock {
  blockId: string;
  heading: string;
  snippet: string;
  sectionType?: SectionType;
  confidence?: number;
}

export interface CompetitorCoverage {
  coverageBySectionType: Record<SectionType, {
    count: number;
    exampleRefs: Array<{ 
      url: string; 
      blockId: string; 
      heading: string;
      competitorExample?: string; // Summary of how competitor implemented this section
    }>;
  }>;
  commonOrderingPatterns: string[];
  archetypeCounts: Record<string, number>;
  quality: "HIGH" | "MEDIUM" | "LOW";
}

export interface ICPModel {
  roles: string[];
  pains: string[];
  decisionCriteria: string[];
  objections: string[];
  languageTokens: string[];
}

export interface IntentModel {
  pageGoal: "quote_request" | "demo" | "purchase" | "download" | "trial" | "book_call" | "register" | "subscribe" | "watch" | "browse" | "apply";
  primaryCTA: {
    label: string;
    action: string;
  };
  icpModel: ICPModel;
  uspAngles: Array<{
    usp: string;
    bestPresentation?: string;
    notes?: string;
  }>;
  claimBank: ClaimBank;
  competitorQueryHints: {
    seedQueries: string[];
    keywords: string[];
  };
}

export interface ClaimBank {
  allowedFacts: Array<{
    category: string;
    fact: string;
    source: string;
  }>;
  bannedPatterns: string[];
  uspAngles: Array<{
    angle: string;
    recommendedSection?: SectionType;
    recommendedFormat?: string;
  }>;
}

export interface ChosenSection {
  sectionType: SectionType;
  format: string;
  rationale: {
    registryReason: string;
    competitorEvidenceRefs?: Array<{ url: string; blockId: string; competitorExample?: string }>;
    icpOfferReason?: string;
    riskNotes?: string;
  };
}

export interface SectionContent {
  sectionType: SectionType;
  format: string;
  content: any; // Format-specific content structure
  notes?: {
    whyThisSection?: string;
    competitorEvidence?: string[];
    [key: string]: any;
  };
}

export interface PitfallsReviewResult {
  revisedSections: SectionContent[];
  qaReport: {
    issuesFound: string[];
    improvements: string[];
    structureVariety: number;
  };
}

export interface MarketingPageResponse {
  ok: boolean;
  runId: string;
  pageType: MarketingPageType;
  sections: SectionContent[];
  html: string;
  artifacts?: Record<string, any>;
  errors?: any[];
  meta: {
    chosenSections: ChosenSection[];
    rationale?: Array<{ sectionType: SectionType; rationale: ChosenSection["rationale"] }>;
    competitorSummary: CompetitorCoverage;
    agentTrace: Array<{
      step: string;
      started: number;
      ended: number;
      summary: string;
      warnings?: string[];
    }>;
  };
}
