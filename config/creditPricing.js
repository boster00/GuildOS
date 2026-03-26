/**
 * Dictionary-based credit costs per action.
 * Manually adjust each action's cost here.
 * 1 credit = $0.10 USD
 */
export const CREDIT_COSTS = {
  AI_TEXT_SHORT: 1.0,
  AI_TEXT_MEDIUM: 2.5,
  AI_TEXT_LONG: 5.0,
  AI_IMAGE_STANDARD: 0.4,
  AI_IMAGE_HD: 0.8,
  WEB_SEARCH: 0.05,
  WEB_EXTRACT_PER_URL: 0.01,
  V0_OUTLINE: 2.5,
  V0_FETCH: 0.01,
  DATAFORSEO_SERP: 0.01,
  EMBEDDINGS_BATCH: 0.02,
};

/**
 * Map monkey API type + params to CREDIT_COSTS key for lookup.
 */
export function getCreditCost(actionType, params = {}) {
  if (CREDIT_COSTS[actionType] !== undefined) {
    if (actionType === "WEB_EXTRACT_PER_URL" && params.urlCount) {
      return CREDIT_COSTS.WEB_EXTRACT_PER_URL * params.urlCount;
    }
    return CREDIT_COSTS[actionType];
  }
  return CREDIT_COSTS.AI_TEXT_SHORT;
}
