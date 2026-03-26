/**
 * Cost registry: path -> credits (primary) and action -> credits (legacy).
 * Pure module, no app imports. Used by meterSpend, getCostByPath, getCost.
 * 1 credit = $0.10 retail. DataForSEO: 10x actual cost (SERP $0.015 -> 0.15 credits, others $0.01 -> 0.1 credits).
 */

/**
 * Path-based cost registry. If a request path is in this map, apiCall auto-meters it.
 * Keys: normalized pathname (e.g. /api/content-magic/topics/suggest-priorities).
 */
/** @type {Record<string, number>} */
export const PATH_COSTS = {
  "/api/content-magic/topics/suggest-priorities": 1,
  "/api/content-magic/topics/suggest-implementation": 1,
  "/api/content-magic/topics/evaluate-topic": 1,
  "/api/content-magic/prompts/suggest-implementation": 1,
  "/api/content-magic/ai-optimization-score": 1,
  "/api/content-magic/repurpose-content/generate": 1,
  "/api/content-magic/suggest-prompts": 1,
  "/api/content-magic/benchmark": 1,
  "/api/content-magic/search": 0.2,
  "/api/ai": 1,
  "/api/content-magic/generate-image": 3,
  "/api/dataforseo/related-keywords": 0.1,
  "/api/dataforseo/ranking-keywords": 0.1,
  "/api/v0/generate-with-files": 14,
  "/api/content-magic/suggest-research-prompts": 1,
  "/api/content-magic/generate-outline": 25,
  "/api/content-magic/outline-feedback": 20,
  "/api/content-magic/outline-pull-raw": 0,
  "/api/content-magic/keyword-suggestions/generate": 1,
  "/api/content-magic/get-second-opinions": 0,
};

/**
 * Paths that actually call external providers (tavily, dataforseo, openai, eden, etc.).
 * Only these get external_requests rows. No default for unmapped paths — avoid logging non-external routes.
 */
export const EXTERNAL_REQUEST_PATHS = new Set([
  "/api/content-magic/topics/suggest-priorities",
  "/api/content-magic/topics/suggest-implementation",
  "/api/content-magic/topics/evaluate-topic",
  "/api/content-magic/prompts/suggest-implementation",
  "/api/content-magic/ai-optimization-score",
  "/api/content-magic/repurpose-content/generate",
  "/api/content-magic/suggest-prompts",
  "/api/content-magic/benchmark",
  "/api/content-magic/search",
  "/api/ai",
  "/api/content-magic/generate-image",
  "/api/dataforseo/related-keywords",
  "/api/dataforseo/ranking-keywords",
  "/api/v0/generate-with-files",
  "/api/content-magic/suggest-research-prompts",
  "/api/content-magic/generate-outline",
  "/api/content-magic/outline-feedback",
  "/api/content-magic/keyword-suggestions/generate",
  "/api/content-magic/get-second-opinions",
]);

/**
 * Path-to-provider/operation map for external_requests. Only paths in EXTERNAL_REQUEST_PATHS
 * with explicit mapping get external_requests rows.
 * @type {Record<string, { provider: string, operation: string }>}
 */
export const EXTERNAL_REQUEST_PATH_MAP = {
  "/api/content-magic/topics/suggest-priorities": { provider: "openai", operation: "topics_suggest_priorities" },
  "/api/content-magic/topics/suggest-implementation": { provider: "openai", operation: "topic_suggest_implementation" },
  "/api/content-magic/topics/evaluate-topic": { provider: "openai", operation: "evaluate_topic" },
  "/api/content-magic/prompts/suggest-implementation": { provider: "openai", operation: "prompts_suggest_implementation" },
  "/api/content-magic/ai-optimization-score": { provider: "openai", operation: "ai_optimization_score" },
  "/api/content-magic/repurpose-content/generate": { provider: "openai", operation: "repurpose_social" },
  "/api/content-magic/suggest-prompts": { provider: "openai", operation: "suggest_prompts" },
  "/api/content-magic/benchmark": { provider: "tavily", operation: "benchmark" },
  "/api/content-magic/search": { provider: "tavily", operation: "search" },
  "/api/ai": { provider: "openai", operation: "chat" },
  "/api/content-magic/generate-image": { provider: "openai", operation: "image" },
  "/api/dataforseo/related-keywords": { provider: "dataforseo", operation: "related_keywords" },
  "/api/dataforseo/ranking-keywords": { provider: "dataforseo", operation: "ranking_keywords" },
  "/api/v0/generate-with-files": { provider: "v0", operation: "generate" },
  "/api/content-magic/suggest-research-prompts": { provider: "openai", operation: "suggest_research_prompts" },
  "/api/content-magic/generate-outline": { provider: "openai", operation: "generate_outline" },
  "/api/content-magic/outline-feedback": { provider: "openai", operation: "outline_feedback" },
  "/api/content-magic/keyword-suggestions/generate": { provider: "openai", operation: "keyword_suggestions" },
  "/api/content-magic/get-second-opinions": { provider: "eden", operation: "get_second_opinions" },
};

/**
 * @param {string} path - Normalized path
 * @returns {{ provider: string, operation: string } | null} Mapping if path is external and explicitly mapped, else null
 */
export function getExternalRequestMapping(path) {
  if (path == null || typeof path !== "string") return null;
  const key = normalizePath(path);
  if (!EXTERNAL_REQUEST_PATHS.has(key)) return null;
  return EXTERNAL_REQUEST_PATH_MAP[key] ?? null;
}

/**
 * Normalize URL or path to pathname only (no origin, no query).
 * @param {string} pathOrUrl
 * @returns {string}
 */
export function normalizePath(pathOrUrl) {
  if (pathOrUrl == null || typeof pathOrUrl !== "string") return "";
  try {
    if (pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://")) {
      const u = new URL(pathOrUrl);
      return u.pathname;
    }
    const beforeQuery = pathOrUrl.split("?")[0];
    return beforeQuery || pathOrUrl;
  } catch {
    return pathOrUrl.split("?")[0] || pathOrUrl;
  }
}

/**
 * @param {string} path - API path or full URL (will be normalized)
 * @returns {number} Credits for the path, or 0 if not in PATH_COSTS.
 */
export function getCostByPath(path) {
  if (path == null || typeof path !== "string") return 0;
  const key = normalizePath(path);
  return PATH_COSTS[key] !== undefined ? PATH_COSTS[key] : 0;
}

/**
 * Legacy: action-name cost registry. No longer used for metering; path-based registry is used.
 * Kept for backward compatibility (e.g. test-metering, CreditCostBadge with action prop). Can be removed in the future.
 * @type {Record<string, number>}
 */
export const COSTS = {
  openai_text: 1,
  openai_image: 3,
  tavily_search: 0.2,
  tavily_extract: 0.2,
  dataforseo_related_keywords: 0.1,
  dataforseo_ranked_keywords: 0.1,
  dataforseo_relevant_pages: 0.1,
  dataforseo_bulk_traffic_estimation: 0.1,
  dataforseo_serp_organic: 0.15,
  dataforseo_bulk_search_volume: 0.1,
  v0: 14,
  "eden.chat": 1,
  "eden.image": 2,
  "eden.video": 20,
  "eden.tts": 1,
  benchmark_topics: 1,
  evaluate_topic: 1,
  topics_suggest_priorities: 1,
  topic_suggest_implementation: 1,
  prompts_suggest_implementation: 1,
  repurpose_social: 1,
  geo_report: 1,
  suggest_prompts: 1,
  internal_link_evaluation: 1,
  admin_add: 0,
  admin_deduct: 0,
};

/**
 * @param {string} action
 * @returns {number} Credits for the action, or 0 if unknown.
 */
export function getCost(action) {
  if (action == null || typeof action !== "string") return 0;
  return COSTS[action] !== undefined ? COSTS[action] : 0;
}

/**
 * Run cost registry checks: missing action returns 0, known action returns expected.
 * @returns {{ pass: boolean, message?: string }}
 */
export function runCostRegistryChecks() {
  if (getCost("nonexistent") !== 0) {
    return { pass: false, message: "getCost('nonexistent') should return 0" };
  }
  const v0Cost = getCost("v0");
  if (v0Cost !== 14) {
    return { pass: false, message: `getCost('v0') should return 14, got ${v0Cost}` };
  }
  if (getCost("openai_text") !== 1) {
    return { pass: false, message: "getCost('openai_text') should return 1" };
  }
  return { pass: true };
}
