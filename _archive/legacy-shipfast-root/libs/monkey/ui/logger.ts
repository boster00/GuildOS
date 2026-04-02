/**
 * Logging utilities for user-facing output
 */

export function shouldLogFull(): boolean {
  return process.env.MONKEY_LOG_FULL === "1";
}

export function shouldLog(): boolean {
  return process.env.NODE_ENV !== "production";
}

export function log(message: string, data?: any): void {
  if (!shouldLog()) return;
  
  if (data) {
  } else {
  }
}

export function logTruncated(label: string, text: string, maxChars: number = 1000): void {
  if (!shouldLog()) return;
  
  if (shouldLogFull()) {
  } else {
    const truncated = text.length > maxChars ? text.substring(0, maxChars) + "..." : text;
  }
}

export function logPrompt(prompt: { system: string; user: string }, sourceFile: string): void {
  // Removed - too verbose and not actionable
  // Only log if explicitly enabled via MONKEY_LOG_FULL
  if (!shouldLogFull()) return;
}

// ============================================
// Strategic Footprint Logging
// ============================================

/**
 * Log action trigger (when user initiates an AI action)
 */
export function logActionTrigger(
  actionName: string,
  mode: "agentic" | "high" | "mid",
  taskType?: string,
  metadata?: Record<string, any>
): void {
  if (!shouldLog()) return;
  if (metadata) {
    
  }
}

/**
 * Log agentic pipeline start
 */
export function logAgenticPipelineStart(pipelineName: string): void {
  if (!shouldLog()) return;
}

/**
 * Log agentic pipeline step
 */
export function logAgenticStep(
  stepNumber: number,
  stepName: string,
  input?: any,
  output?: any,
  previewChars: number = 200
): void {
  if (!shouldLog()) return;
  
  // Always show step progress
  // Only show input summary if it's meaningful (not just "available"/"none")
  if (input !== undefined && typeof input === "object" && input !== null) {
    const inputSummary = summarizeObject(input);
    if (inputSummary && inputSummary !== "{}") {
    }
  }
  
  // Only show output summary on success, and only key info
  if (output !== undefined && shouldLogFull()) {
    const outputSummary = summarizeObject(output, 150);
    if (outputSummary) {
    }
  }
}

/**
 * Summarize object for logging - extract key info only
 */
function summarizeObject(obj: any, maxChars: number = 200): string {
  if (!obj || typeof obj !== "object") {
    return String(obj).substring(0, maxChars);
  }
  
  // For arrays, show count and first item summary
  if (Array.isArray(obj)) {
    if (obj.length === 0) return "[]";
    return `[${obj.length} items]`;
  }
  
  // For objects, show key counts or important fields
  const keys = Object.keys(obj);
  if (keys.length === 0) return "{}";
  
  // Extract meaningful summary fields
  const summary: string[] = [];
  
  if (obj.id) summary.push(`id:${obj.id}`);
  if (obj.name) summary.push(`name:"${String(obj.name).substring(0, 30)}"`);
  if (obj.type) summary.push(`type:${obj.type}`);
  if (obj.level) summary.push(`level:${obj.level}`);
  if (obj.reviewType) summary.push(`review:${obj.reviewType}`);
  if (obj.hookType) summary.push(`hook:${obj.hookType}`);
  if (obj.sections && Array.isArray(obj.sections)) summary.push(`sections:${obj.sections.length}`);
  if (obj.validCompetitors && Array.isArray(obj.validCompetitors)) summary.push(`competitors:${obj.validCompetitors.length}`);
  if (obj.prioritizedUSPs && Array.isArray(obj.prioritizedUSPs)) summary.push(`USPs:${obj.prioritizedUSPs.length}`);
  
  // If we have meaningful summary, return it
  if (summary.length > 0) {
    return summary.join(", ");
  }
  
  // Otherwise show key count
  return `${keys.length} keys`;
}

/**
 * Log template-based call (non-agentic)
 */
export function logTemplateCall(
  templateName: string,
  templatePreview?: string,
  previewChars: number = 500
): void {
  if (!shouldLog()) return;
  if (templatePreview) {
    const preview = shouldLogFull() ? templatePreview : templatePreview.substring(0, previewChars) + (templatePreview.length > previewChars ? "..." : "");
  }
}

/**
 * Log final output preview
 */
export function logFinalOutput(output: any, previewChars: number = 1000): void {
  if (!shouldLog()) return;
  
  const outputStr = typeof output === "string" ? output : JSON.stringify(output, null, 2);
  const preview = shouldLogFull() ? outputStr : outputStr.substring(0, previewChars) + (outputStr.length > previewChars ? "..." : "");
}

/**
 * Log state update
 */
export function logStateUpdate(description: string, data?: any, previewChars: number = 500): void {
  if (!shouldLog()) return;
  if (data !== undefined) {
    const dataStr = typeof data === "string" ? data : JSON.stringify(data, null, 2);
    const preview = shouldLogFull() ? dataStr : dataStr.substring(0, previewChars) + (dataStr.length > previewChars ? "..." : "");
    
  }
}

// Re-export getSizeLimits from config for convenience
export { getSizeLimits } from "../references/config";
