// ARCHIVED: Original path was libs/monkey/pipelines/triagePipeline.ts

/**
 * Triage pipeline - determines task type and then runs the appropriate pipeline
 */

import { MonkeyTaskRequest, MonkeyTaskResponse } from "../references/types";
import { triageTaskType } from "../actions/triageTaskType";
// Removed writeArticlePipeline import - using runTask instead
import { runTask } from "../index";
import { log } from "../ui/logger";
import { registerPipeline } from "./registry";

/**
 * Triage pipeline: determines which task type to run, then executes it
 */
export async function triagePipeline(
  request: MonkeyTaskRequest,
  options?: {
    apiKey?: string;
    userApiKeys?: Array<{ vendor: string; key: string }>;
  }
): Promise<MonkeyTaskResponse> {
  log("[triagePipeline] Starting triage");
  
  const userPrompt = request.campaignContext?.user_prompt || request.userInput?.query || "";
  
  if (!userPrompt) {
    return {
      ok: false,
      runId: `triage-${Date.now()}`,
      artifacts: {},
      errors: [{
        code: "PROVIDER_ERROR" as any,
        message: "user_prompt is required for triage",
        step: "triage",
      }],
    };
  }

  // Step 1: Triage to determine task type
  const triageResult = await triageTaskType(
    userPrompt,
    request.campaignContext,
    options
  );

  log(`[triagePipeline] Triage result: ${triageResult.inferredTaskType} (confidence: ${triageResult.confidence}%)`);

  // Step 2: Run the inferred pipeline or fallback if triage fails
  // If confidence is too low, fallback to WRITE_ARTICLE_LANDING
  if (triageResult.confidence < 50) {
    log(`[triagePipeline] Low confidence (${triageResult.confidence}%), falling back to WRITE_ARTICLE_LANDING`);
    
    const fallbackRequest: MonkeyTaskRequest = {
      model: "high",
      taskType: "WRITE_ARTICLE_LANDING", // Default fallback
      campaignContext: request.campaignContext,
      userInput: {
        ...request.userInput,
        query: userPrompt,
      },
      constraints: request.constraints,
    };
    
    // Use landing page pipeline as fallback
    const fallbackResponse = await runTask(fallbackRequest, options);
    
    return {
      ...fallbackResponse,
      artifacts: {
        ...fallbackResponse.artifacts,
        triageResult,
        triageFallback: true,
      },
      meta: {
        ...fallbackResponse.meta,
        triage: {
          inferredTaskType: triageResult.inferredTaskType,
          confidence: triageResult.confidence,
          reasoning: triageResult.reasoning,
          fallbackUsed: true,
          fallbackReason: "Low triage confidence",
        },
      },
    };
  }

  const inferredRequest: MonkeyTaskRequest = {
    ...request,
    taskType: triageResult.inferredTaskType,
    userInput: {
      ...request.userInput,
      query: userPrompt,
    },
  };

  // Use runTask recursively to handle all task types (including all new pipelines)
  // This way, all pipelines work automatically without needing to update triage
  log(`[triagePipeline] Routing to pipeline for task type: ${triageResult.inferredTaskType}`);
  const pipelineResponse = await runTask(inferredRequest, options);

  // Merge triage artifact with pipeline response
  return {
    ...pipelineResponse,
    artifacts: {
      ...pipelineResponse.artifacts,
      triageResult,
    },
    meta: {
      ...pipelineResponse.meta,
      triage: {
        inferredTaskType: triageResult.inferredTaskType,
        confidence: triageResult.confidence,
        reasoning: triageResult.reasoning,
      },
    },
  };
}

// Auto-register this pipeline
registerPipeline(
  "TRIAGE",
  "Triage Pipeline",
  "Auto-detects task type from user prompt and routes to appropriate pipeline. Use when task type is unclear or needs automatic detection.",
  triagePipeline
);

