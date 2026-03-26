// ARCHIVED: Original path was libs/content-magic/types.ts

export type RuleStatus = "pass" | "fail" | "warn" | "manual_needed" | "skipped";
export type RuleImpact = "low" | "medium" | "high";

export interface AuditContext {
  url?: string;
  html?: string;
  text?: string;
  pageType?: string;
  icp?: any;
  meta: {
    title?: string;
    description?: string;
    canonical?: string;
    schema?: any[];
  };
  fetchHtml?: (url: string) => Promise<string>;
  callLLM?: (input: any) => Promise<any>;
  relatedPages?: Array<{ url: string; text?: string }>;
}

export interface AuditRuleResult {
  status: RuleStatus;
  evidence?: string;
  data?: any;
  impact?: RuleImpact;
  suggestedFix?: string;
  highlights?: Array<{
    start: number;
    end: number;
    intent?: "error" | "info" | "suggestion";
    message?: string;
  }>;
}

export interface AuditRule {
  key: string;
  version: number;
  meta: {
    label: string;
    category: "ux" | "ai_friendly" | "seo_technical" | "content" | "site_config";
    description?: string;
    pageTypes?: string[];
    severity?: RuleImpact;
    auto?: boolean;
    requiresUserInput?: boolean;
  };
  ui: {
    sidebarSummary: (result?: AuditRuleResult) => string;
    detailFields: (result?: AuditRuleResult) => Array<{ label: string; value: string }>;
  };
  analyze: (ctx: AuditContext) => Promise<AuditRuleResult>;
  mutateContext?: (ctx: AuditContext, result: AuditRuleResult) => AuditContext;
  dependsOn?: string[];
}

// ============================================
// Universal Enrichment Opportunities (UEOs)
// ============================================

export type UeoCategory = 'quick_win' | 'ai_assisted' | 'food_for_thought';

export type UeoOutputType = 'content' | 'prompt' | 'mixed';

export interface UeoItem {
  id: string;
  name: string;          // e.g. "Decision guide", "Compare us vs big CROs"
  description: string;   // short explanation of what it is and why it helps
  category: UeoCategory;
  outputType: UeoOutputType; // whether AI typically outputs content, a prompt, or a blend
  // optional metadata for future expansion:
  tags?: string[];
  exampleUse?: string;   // short example of where it might live in the page
}

export interface UeoSuggestion {
  ueoId: string;
  suggestionType: 'content_snippet' | 'prompt_template';
  title?: string;             // heading/title suggestion, if relevant
  summary: string;            // 1–2 sentence explanation of what this suggestion is
  body: string;               // the actual content or prompt text
  notes?: string;             // optional implementation notes for the user
}