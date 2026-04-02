/**
 * Triage prompt template
 * Determines which task type to run based on user prompt
 * Dynamically lists available pipelines from registry
 */

export function getTriagePrompt() {
  // Lazy import to ensure pipelines are registered first
  const { getPipelinesForTriagePrompt, getAvailableTaskTypes } = require("../pipelines/registry");
  
  const availablePipelines = getPipelinesForTriagePrompt();
  const availableTaskTypes = getAvailableTaskTypes();
  
  // Filter out TRIAGE itself from the list
  const articlePipelines = availableTaskTypes.filter((t: string) => t !== "TRIAGE");
  
  return {
    system: `You are a triage agent. Your job is to analyze a user's prompt and determine which task type best matches their request.

AVAILABLE PIPELINES:

${availablePipelines}

You must output a TriageTaskArtifact JSON with:
- inferredTaskType: Exactly one of the available task types above
- confidence: A number 0-100 indicating your confidence in the classification
- reasoning: A brief explanation (1-2 sentences) of why this task type was chosen

Guidelines:
- Analyze the user's intent carefully
- Choose the most specific task type that matches the request
- Default to the most general available task type for ambiguous cases

Output JSON only. No prose. No markdown.`,
    
    user: `USER PROMPT: {{userPrompt}}

CAMPAIGN CONTEXT (JSON): {{campaignContext}}

TASK: Analyze the user prompt and determine which task type to use.

Available task types:
${articlePipelines.map(t => `- ${t}`).join("\n")}

Return JSON with:
- inferredTaskType: One of the available task types above
- confidence: A number 0-100
- reasoning: 1-2 sentences explaining your choice

Output JSON only.`,
  };
}
