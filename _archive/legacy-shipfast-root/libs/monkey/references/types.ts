/**
 * Type definitions for Monkey AI module
 */

export type MonkeyModel = "agent" | "high" | "mid";

// Article Types for Agentic Writing
export enum ArticleType {
  LANDING = "LANDING",                    // Landing page articles
}

// Agentic Article Writing Tasks (High-stake, multi-step)
export type AgenticTaskType =
  | "WRITE_ARTICLE_LANDING"        // Landing page article with HTML markup
  | "MARKETING_PAGE_GENERATE_AGENTIC"  // Marketing page generation with competitor validation
  | "ICP_SUGGEST"                  // Generate ideal customer profile suggestions
  | "KEYWORD_OUTCOME_SUGGEST"      // Generate outcome keywords based on ICP and offer
  | "PROMISE_SUGGEST"              // Generate peace of mind promises based on ICP and offer
  | "CAMPAIGN_ROADMAP_PLAN"        // Generate campaign roadmap plans with phase strategy
  | "SUMMARIZE_TALK_POINTS"        // Summarize talk points from campaign context and assets
  | "ORGANIZE_OUTLINE";            // Organize talk points into structured outline with sections

// Legacy/Utility
export type LegacyTaskType =
  | "TRIAGE";                       // Auto-detect task type

// All task types
export type MonkeyTaskType =
  | AgenticTaskType
  | LegacyTaskType;

export enum MonkeyErrorCode {
  PROVIDER_ERROR = "PROVIDER_ERROR",
  TIMEOUT = "TIMEOUT",
  PARSE_FAILED = "PARSE_FAILED",
  SCHEMA_INVALID = "SCHEMA_INVALID",
  REPAIR_EXHAUSTED = "REPAIR_EXHAUSTED",
  OUTPUT_TOO_LARGE = "OUTPUT_TOO_LARGE",
  HTML_UNSAFE = "HTML_UNSAFE",
  HTML_PARSE_FAILED = "HTML_PARSE_FAILED",
  BUDGET_EXCEEDED = "BUDGET_EXCEEDED",
}

export interface MonkeyError {
  code: MonkeyErrorCode;
  message: string;
  step?: string;
  details?: any;
}

export interface MonkeyTaskRequest {
  model: MonkeyModel;
  taskType: MonkeyTaskType;
  campaignContext?: any;
  userInput?: any & {
    articleType?: ArticleType; // For agentic article writing
    includeBuilderComments?: boolean;
    commentVerbosity?: "brief" | "standard" | "detailed";
    useAdvancedFormats?: boolean;
  };
  constraints?: {
    tone?: string;
    audience?: string;
    noFakeProof?: boolean;
    lengthTargets?: any;
    [key: string]: any;
  };
  outputFormat?: "markdown" | "html" | "json";
  // Part A: Feedback support
  feedback?: {
    items: Array<{ id: string; message: string; target?: any; priority?: number; type?: string }>;
    priorRun?: {
      runId?: string;
      artifacts?: Record<string, any>;
      output?: any;
    };
  };
}

export interface MonkeyTaskResponse {
  ok: boolean;
  runId: string;
  step?: number; // Step number for step-by-step execution
  stepName?: string; // Step identifier name
  message?: string; // Human-readable step message
  artifacts?: Record<string, any>;
  output?: {
    markdown?: string;
    html?: string;
    options?: any;
    patches?: any[];
  };
  errors?: MonkeyError[];
  meta?: {
    timings?: { total: number };
    nextStep?: number; // Next step number (undefined if final step)
    triage?: {
      inferredTaskType?: MonkeyTaskType;
      confidence?: number;
      reasoning?: string;
      fallbackUsed?: boolean;
      fallbackReason?: string;
    };
    [key: string]: any;
  };
}

// Patch operations for state updates
export type PatchOp = {
  op: "set" | "merge" | "append" | "remove";
  path: string;
  value?: any;
};
