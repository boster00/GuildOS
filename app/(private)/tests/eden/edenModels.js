/**
 * Client-safe static model list for Eden Test. Matches registry ids/labels
 * so the model selector is never empty when the API fails.
 */
export const EDEN_MODELS = [
  { id: "openai-gpt-4o-mini", label: "GPT-4o Mini" },
  { id: "openai-gpt-4o", label: "GPT-4o" },
  { id: "anthropic-claude-sonnet", label: "Claude Sonnet 4.5" },
  { id: "anthropic-claude-haiku", label: "Claude Haiku 4.5" },
];
