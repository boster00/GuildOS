/**
 * Canonical model registry for Eden AI chat gateway.
 * Maps canonical id → Eden provider/model. Provider/model values sourced from env where possible.
 * registryVersion and lastUpdated for metadata.
 */

const registryVersion = "1.0.0";
const lastUpdated = "2025-02-28";

// Eden model names: prefer env EDEN_MODEL_<ID> so no hardcoded names in production.
function resolveEdenModel(id, defaultModel) {
  if (typeof process === "undefined" || !process.env) return defaultModel;
  const envKey = `EDEN_MODEL_${id.replace(/-/g, "_").toUpperCase()}`;
  return process.env[envKey] || defaultModel;
}

/** @type {Array<{ id: string, label: string, edenDefault: string, modalities: string[], supports: { streaming: boolean, vision: boolean }, limits: { maxTokens?: number }, pricing?: { inputPer1kTokens?: number, outputPer1kTokens?: number } }>} */
const MODELS = [
  {
    id: "openai-gpt-4o-mini",
    label: "GPT-4o Mini",
    edenDefault: "openai/gpt-4o-mini",
    modalities: ["chat"],
    supports: { streaming: true, vision: false },
    limits: { maxTokens: 16384 },
    pricing: { inputPer1kTokens: 0.00015, outputPer1kTokens: 0.0006 },
  },
  {
    id: "openai-gpt-4o",
    label: "GPT-4o",
    edenDefault: "openai/gpt-4o",
    modalities: ["chat"],
    supports: { streaming: true, vision: true },
    limits: { maxTokens: 128000 },
    pricing: { inputPer1kTokens: 0.0025, outputPer1kTokens: 0.01 },
  },
  {
    id: "anthropic-claude-sonnet",
    label: "Claude Sonnet 4.5",
    edenDefault: "anthropic/claude-sonnet-4-5",
    modalities: ["chat"],
    supports: { streaming: false, vision: true },
    limits: { maxTokens: 8192 },
    pricing: { inputPer1kTokens: 0.003, outputPer1kTokens: 0.015 },
  },
  {
    id: "anthropic-claude-haiku",
    label: "Claude Haiku 4.5",
    edenDefault: "anthropic/claude-haiku-4-5",
    modalities: ["chat"],
    supports: { streaming: false, vision: true },
    limits: { maxTokens: 4096 },
    pricing: { inputPer1kTokens: 0.00025, outputPer1kTokens: 0.00125 },
  },
  {
    id: "google-gemini-15-pro",
    label: "Gemini 1.5 Pro",
    edenDefault: "google/gemini-1-5-pro",
    modalities: ["chat"],
    supports: { streaming: false, vision: true },
    limits: { maxTokens: 8192 },
    pricing: { inputPer1kTokens: 0.00125, outputPer1kTokens: 0.005 },
  },
  {
    id: "mistral-large",
    label: "Mistral Large",
    edenDefault: "mistral/mistral-large-latest",
    modalities: ["chat"],
    supports: { streaming: false, vision: false },
    limits: { maxTokens: 8192 },
    pricing: { inputPer1kTokens: 0.003, outputPer1kTokens: 0.009 },
  },
  {
    id: "meta-llama-3-70b",
    label: "Llama 3.1 70B",
    edenDefault: "meta/llama-3.1-70b-instruct",
    modalities: ["chat"],
    supports: { streaming: false, vision: false },
    limits: { maxTokens: 4096 },
    pricing: { inputPer1kTokens: 0.00059, outputPer1kTokens: 0.00079 },
  },
];

function getModel(id) {
  const m = MODELS.find((x) => x.id === id);
  if (!m) return null;
  const model = resolveEdenModel(m.id, m.edenDefault);
  return {
    id: m.id,
    label: m.label,
    eden: { model },
    modalities: m.modalities,
    supports: m.supports,
    limits: m.limits,
    pricing: m.pricing,
  };
}

function getModels(filters = {}) {
  let list = [...MODELS];
  if (filters.modality) {
    list = list.filter((m) => m.modalities.includes(filters.modality));
  }
  if (filters.streaming !== undefined) {
    list = list.filter((m) => m.supports.streaming === filters.streaming);
  }
  if (filters.vision !== undefined) {
    list = list.filter((m) => m.supports.vision === filters.vision);
  }
  return list.map((m) => ({
    id: m.id,
    label: m.label,
    modalities: m.modalities,
    supports: m.supports,
    limits: m.limits,
  }));
}

module.exports = {
  registryVersion,
  lastUpdated,
  getModel,
  getModels,
  MODELS,
};
