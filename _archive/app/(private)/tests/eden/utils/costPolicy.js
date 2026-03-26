// ARCHIVED: Original path was app/(private)/tests/eden/utils/costPolicy.js

/**
 * Cost policy: normalize Eden response into baseCost / billedCost.
 * Apply markup only when both base and markup are known (billedCost = baseCost * (1 + markup)).
 */

const path = require("path");
const { getModel } = require(path.resolve(__dirname, "../../../../libs/ai/eden/modelRegistry"));

/**
 * @param {object} edenResponse - Raw or normalized response from Eden (usage, cost, etc.)
 * @param {string} modelId - Model registry id
 * @param {string} mode - "chat" | "image" | "tts" | "video"
 * @returns {{ baseCost?: number, billedCost?: number, currency: string }}
 */
function normalizeCost(edenResponse, modelId, mode = "chat") {
  const out = { currency: "USD" };
  const usage = edenResponse?.usage || edenResponse?.data?.usage;
  const model = getModel(modelId);
  const pricing = model?.pricing;
  if (pricing && usage) {
    let base = 0;
    if (mode === "chat" && pricing.inputPer1kTokens != null && pricing.outputPer1kTokens != null) {
      const inTok = (usage.prompt_tokens || usage.input_tokens || 0) / 1000;
      const outTok = (usage.completion_tokens || usage.output_tokens || 0) / 1000;
      base = inTok * pricing.inputPer1kTokens + outTok * pricing.outputPer1kTokens;
    }
    if (base > 0) {
      out.baseCost = Math.round(base * 1e6) / 1e6;
      const markup = typeof process !== "undefined" && process.env?.EDEN_COST_MARKUP != null
        ? parseFloat(process.env.EDEN_COST_MARKUP, 10)
        : 0;
      if (!Number.isNaN(markup) && markup >= 0) {
        out.billedCost = Math.round(out.baseCost * (1 + markup) * 1e6) / 1e6;
      }
    }
  }
  return out;
}

module.exports = {
  normalizeCost,
};
