// ARCHIVED: Original path was libs/monkey/references/config.ts

/**
 * Configuration utilities
 */

export function getEnv(name: string, defaultValue: string): string {
  return process.env[name] || defaultValue;
}

export function getModelConfig(): {
  provider: string;
  agent: string;
  high: string;
  mid: string;
} {
  return {
    provider: getEnv("MONKEY_PROVIDER", "openai"),
    // TODO: remove — "agent" model tier is deprecated
    agent: getEnv("MONKEY_MODEL_AGENT", "gpt-4o"),
    high: getEnv("MONKEY_MODEL_HIGH", "gpt-4o"),
    mid: getEnv("MONKEY_MODEL_MID", "gpt-4o"),
  };
}

export function getSizeLimits(): {
  maxOutputCharsJson: number;
  maxOutputCharsHtml: number;
  maxRetriesJson: number;
  maxRetriesHtml: number;
} {
  return {
    maxOutputCharsJson: parseInt(getEnv("MONKEY_MAX_OUTPUT_CHARS_JSON", "200000"), 10),
    maxOutputCharsHtml: parseInt(getEnv("MONKEY_MAX_OUTPUT_CHARS_HTML", "400000"), 10),
    maxRetriesJson: parseInt(getEnv("MONKEY_MAX_RETRIES_JSON", "2"), 10),
    maxRetriesHtml: parseInt(getEnv("MONKEY_MAX_RETRIES_HTML", "2"), 10),
  };
}
