/**
 * Chat gateway: sendChatPrompt → Eden /v3/llm/chat/completions.
 * Returns normalized result shape { ok, requestId, latencyMs, data, rawPreview, raw }.
 */

const { edenPost, truncateRaw } = require("./edenClient");
const { getModel } = require("./modelRegistry");

/**
 * @param {object} opts
 * @param {string} opts.prompt
 * @param {string} opts.model - canonical model id (resolved via registry)
 * @param {number} [opts.temperature]
 * @param {number} [opts.maxTokens]
 * @param {boolean} [opts.stream]
 * @returns {Promise<{ ok: boolean, requestId: string, latencyMs: number, data: { text: string, usage?: object }, rawPreview?: string, raw?: object }>}
 */
async function sendChatPrompt(opts) {
  const { prompt, model: modelId, temperature = 0.7, maxTokens = 2048, stream = false } = opts;
  const modelDef = getModel(modelId);
  if (!modelDef) {
    const err = new Error(`Unknown model: ${modelId}`);
    err.code = "VALIDATION_ERROR";
    throw err;
  }
  const edenModel = modelDef.eden.model;
  const body = {
    model: edenModel,
    messages: [{ role: "user", content: prompt }],
    temperature: Math.max(0, Math.min(2, temperature)),
    max_tokens: Math.max(1, Math.min(128000, maxTokens || 2048)),
    stream: !!stream,
  };
  const { requestId, response, latencyMs } = await edenPost(
    "/v3/llm/chat/completions",
    body,
    "chatGateway"
  );
  // OpenAI-style response: choices[0].message.content, usage
  const choice = response.choices && response.choices[0];
  const text = choice && choice.message && typeof choice.message.content === "string"
    ? choice.message.content
    : (choice && choice.message && choice.message.content
      ? JSON.stringify(choice.message.content)
      : "");
  const usage = response.usage || undefined;
  const data = { text, usage };
  const rawPreview = truncateRaw(response);
  return {
    ok: true,
    requestId,
    latencyMs,
    data,
    rawPreview,
    raw: response,
  };
}

module.exports = {
  sendChatPrompt,
};
