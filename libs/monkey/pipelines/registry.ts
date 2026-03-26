/**
 * Dynamic Pipeline Registry
 * Automatically discovers and registers all pipelines in this folder
 */

import { MonkeyTaskRequest, MonkeyTaskResponse } from "../references/types";

export interface PipelineInfo {
  taskType: string;
  name: string;
  description: string;
  handler: (request: MonkeyTaskRequest, options?: any) => Promise<MonkeyTaskResponse>;
}

// Pipeline registry - initialized immediately to avoid temporal dead zone issues
const pipelineRegistry = new Map<string, PipelineInfo>();

/**
 * Register a pipeline
 */
export function registerPipeline(
  taskType: string,
  name: string,
  description: string,
  handler: (request: MonkeyTaskRequest, options?: any) => Promise<MonkeyTaskResponse>
) {
  pipelineRegistry.set(taskType, {
    taskType,
    name,
    description,
    handler,
  });
}

/**
 * Get all registered pipelines
 */
export function getRegisteredPipelines(): PipelineInfo[] {
  return Array.from(pipelineRegistry.values());
}

/**
 * Get pipeline by task type
 */
export function getPipeline(taskType: string): PipelineInfo | undefined {
  return pipelineRegistry.get(taskType);
}

/**
 * Check if a pipeline exists
 */
export function hasPipeline(taskType: string): boolean {
  return pipelineRegistry.has(taskType);
}

/**
 * Execute a pipeline
 */
export async function executePipeline(
  taskType: string,
  request: MonkeyTaskRequest,
  options?: any
): Promise<MonkeyTaskResponse> {
  const pipeline = pipelineRegistry.get(taskType);
  if (!pipeline) {
    return {
      ok: false,
      runId: `run-${Date.now()}`,
      artifacts: {},
      errors: [{
        code: "PROVIDER_ERROR" as any,
        message: `Unknown task type: ${taskType}. Available pipelines: ${Array.from(pipelineRegistry.keys()).join(", ")}`,
      }],
    };
  }
  
  return await pipeline.handler(request, options);
}

/**
 * Get list of available task types for triage prompt
 */
export function getAvailableTaskTypes(): string[] {
  return Array.from(pipelineRegistry.keys());
}

/**
 * Get formatted list of pipelines for triage prompt
 */
export function getPipelinesForTriagePrompt(): string {
  const pipelines = getRegisteredPipelines();
  if (pipelines.length === 0) {
    return "No pipelines available.";
  }
  
  return pipelines.map((p, index) => 
    `${index + 1}. ${p.taskType} - ${p.name}\n   ${p.description}`
  ).join("\n\n");
}

