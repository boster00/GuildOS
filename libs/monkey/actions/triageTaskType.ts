/**
 * Triage action - determines which task type to run based on user prompt
 */

import { callStructured } from "../tools/runtime/callStructured";
import { getTriagePrompt } from "../prompts/triage";
import { triageTaskSchema } from "../references/schemas";
import { MonkeyTaskType } from "../references/types";

export interface TriageTaskArtifact {
  inferredTaskType: MonkeyTaskType;
  confidence: number; // 0-100
  reasoning: string;
}

/**
 * Triage user prompt to determine which task type to execute
 */
export async function triageTaskType(
  userPrompt: string,
  campaignContext?: any,
  options?: {
    apiKey?: string;
    userApiKeys?: Array<{ vendor: string; key: string }>;
  }
): Promise<TriageTaskArtifact> {
  const systemPrompt = getTriagePrompt().system;
  const userPromptText = getTriagePrompt().user
    .replace("{{userPrompt}}", userPrompt)
    .replace("{{campaignContext}}", JSON.stringify(campaignContext || {}, null, 2));

  const result = await callStructured("agent", [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPromptText },
  ], triageTaskSchema, {
    stepName: "triageTaskType",
    ...options,
  });

  if (!result.ok || !result.data) {
    throw new Error(result.error?.message || "Triage failed");
  }

  return result.data as TriageTaskArtifact;
}

