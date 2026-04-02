/**
 * Monkey AI Module - Main Entry Point
 * Dynamic pipeline registry - pipelines are auto-discovered and registered
 */

import { MonkeyTaskRequest, MonkeyTaskResponse } from "./references/types";
import { executePipeline, getRegisteredPipelines } from "./pipelines/registry";
import { log } from "./ui/logger";
import { initMonkey } from "../monkey.js";

// Import pipelines to trigger their auto-registration
// These imports must come AFTER registry is imported to avoid circular dependency
import "./pipelines/triagePipeline";
import "./pipelines/writeArticleLandingPipeline";
import "./pipelines/icpSuggestPipeline";
import "./pipelines/keywordOutcomeSuggestPipeline";
import "./pipelines/promiseSuggestPipeline";
import "./pipelines/campaignRoadmapPlanPipeline";
import "./pipelines/summarizeTalkPointsPipeline";
import "./pipelines/organizeOutlinePipeline";

/**
 * Run a monkey task
 */
export async function runTask(
  request: MonkeyTaskRequest,
  options?: {
    apiKey?: string;
    userApiKeys?: Array<{ vendor: string; key: string }>;
  }
): Promise<MonkeyTaskResponse> {
  try {
    // Determine effective model based on task type
    // All registered pipelines default to agent mode unless specified
    let effectiveModel = request.model || "agent";
    
    const effectiveRequest = { ...request, model: effectiveModel };
    
    log(`[runTask] Starting task: ${effectiveRequest.taskType} with model: ${effectiveModel}`);
    const startTime = Date.now();
    const availablePipelines = getRegisteredPipelines();
    
    // Use dynamic pipeline registry to execute the task
    const response = await executePipeline(effectiveRequest.taskType, effectiveRequest, options);
    
    const duration = Date.now() - startTime;
    log(`[runTask] Task completed in ${duration}ms`);
    // Add timing to meta
    if (response.meta) {
      response.meta.timings = { total: duration };
    } else {
      response.meta = { timings: { total: duration } };
    }
    return response;
  } catch (error: any) {
    log(`[runTask] Task failed: ${error.message}`);
    return {
      ok: false,
      runId: `run-${Date.now()}`,
      artifacts: {},
      errors: [{
        code: "PROVIDER_ERROR" as any,
        message: error.message || "Unknown error",
        details: process.env.NODE_ENV === "development" ? error.stack : undefined,
      }],
    };
  }
}

// Export types
export * from "./references/types";
export * from "./tools/patch";
export * from "./tools/htmlCheck";

// Export centralized UI components
export { default as MonkeyResultsPanel } from "./ui/MonkeyResultsPanel";
export { default as QuestionnaireForm } from "./ui/QuestionnaireForm";
export { default as ResearchInsightsPanel } from "./ui/ResearchInsightsPanel";
export { default as SectionInsertionModal } from "./ui/SectionInsertionModal";
export { useMonkeyResults, createResultsConfig } from "./ui/monkeyResultsController";
export type { ResultsPlacement, StateBinding, ResultsUIConfig } from "./ui/types";

// Export monkey instance for backward compatibility
export { initMonkey };
