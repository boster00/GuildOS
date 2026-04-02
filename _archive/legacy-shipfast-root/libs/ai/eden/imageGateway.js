/**
 * Image gateway: generateImageFromText, updateImageFromImage (Eden universal-ai).
 * Returns normalized result shape { ok, requestId, latencyMs, data: { url }, rawPreview, raw }.
 */

const { edenPost, truncateRaw } = require("./edenClient");

const IMAGE_GENERATION_MODEL = "image/generation/openai/dall-e-3";

/**
 * @param {object} opts - { prompt, style?, size? }
 * @returns {Promise<{ ok: boolean, requestId: string, latencyMs: number, data: { url: string }, rawPreview?: string, raw?: object }>}
 */
async function generateImageFromText(opts) {
  const { prompt, size = "1024x1024" } = opts;
  const body = {
    model: IMAGE_GENERATION_MODEL,
    input: {
      text: prompt,
      resolution: size,
      num_images: 1,
    },
  };
  const { requestId, response, latencyMs } = await edenPost(
    "/v3/universal-ai",
    body,
    "imageGateway"
  );
  const output = response.output;
  const items = output && output.items;
  const firstItem = items && items[0];
  const url =
    (firstItem && (firstItem.image_resource_url || firstItem.image_url || firstItem.url)) ||
    (output && (output.image_resource_url || output.image_url || output.url));
  if (!url) {
    if (process.env.NODE_ENV === "development") {
      
    }
    const err = new Error("No image URL in response");
    err.code = "EDEN_API_ERROR";
    err.requestId = requestId;
    err.raw = response;
    throw err;
  }
  return {
    ok: true,
    requestId,
    latencyMs,
    data: { url },
    rawPreview: truncateRaw(response),
    raw: response,
  };
}

/**
 * Image-to-image edit (stub: Eden may use different model/input).
 * @param {object} opts - { imageBase64, prompt, strength? }
 */
async function updateImageFromImage(opts) {
  const { imageBase64, prompt } = opts;
  const body = {
    model: "image/generation/openai/dall-e-3",
    input: {
      text: prompt,
      resolution: "1024x1024",
      num_images: 1,
      image: imageBase64,
    },
  };
  try {
    const { requestId, response, latencyMs } = await edenPost(
      "/v3/universal-ai",
      body,
      "imageGateway"
    );
    const output = response.output;
    const items = output && output.items;
    const firstItem = items && items[0];
    const url =
      (firstItem && (firstItem.image_resource_url || firstItem.image_url || firstItem.url)) ||
      (output && (output.image_resource_url || output.image_url || output.url));
    if (!url) throw new Error("No image URL in response");
    return {
      ok: true,
      requestId,
      latencyMs,
      data: { url },
      rawPreview: truncateRaw(response),
      raw: response,
    };
  } catch (e) {
    e.requestId = e.requestId || require("./edenClient").generateRequestId();
    throw e;
  }
}

module.exports = {
  generateImageFromText,
  updateImageFromImage,
};
