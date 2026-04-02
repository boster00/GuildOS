/**
 * Video gateway: async-first. createVideoJob → jobId; getVideoJobStatus → status.
 * Wired to Eden AI v2 video generation API.
 * Amazon Nova Reel requires start frame to be exactly 1280x720.
 */

const sharp = require("sharp");
const { edenPost, edenPostFormData, edenGet } = require("./edenClient");

const I2V_IMAGE_SIZE = { width: 1280, height: 720 };

async function resizeToI2VFormat(buffer) {
  return sharp(buffer)
    .resize(I2V_IMAGE_SIZE.width, I2V_IMAGE_SIZE.height, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 1 },
    })
    .png()
    .toBuffer();
}

function devLog(step, data) {
  if (typeof process !== "undefined" && process.env && process.env.NODE_ENV === "development") {
    
  }
}

/**
 * Create a video generation job via Eden v2 API.
 * POST /v2/video/generation_async
 * @param {object} options - { prompt?, text?, providers?, imageBase64? }
 * @returns {Promise<{ jobId: string, requestId: string }>}
 */
async function createVideoJob(options) {
  const prompt = options?.prompt || options?.text || "";
  const providers = options?.providers || "amazon";
  const imageBase64 = options?.imageBase64;

  devLog("createVideoJob.Input", {
    options: { ...options, imageBase64: imageBase64 ? "[present]" : undefined },
    prompt: prompt?.slice(0, 80),
    providers,
  });

  let requestId;
  let response;
  let latencyMs;

  if (imageBase64) {
    const inputBuffer = Buffer.from(imageBase64, "base64");
    const buffer = await resizeToI2VFormat(inputBuffer);
    const formData = new FormData();
    formData.set("providers", providers);
    formData.set("text", prompt);
    const blob = new Blob([buffer], { type: "image/png" });
    formData.append("file", blob, "image.png");
    devLog("createVideoJob.I2V", {
      providers,
      promptLen: prompt.length,
      inputSize: inputBuffer.length,
      resizedSize: buffer.length,
      dimensions: `${I2V_IMAGE_SIZE.width}x${I2V_IMAGE_SIZE.height}`,
    });
    const result = await edenPostFormData(
      "/v2/video/generation_async",
      formData,
      "videoGateway"
    );
    ({ requestId, response, latencyMs } = result);
  } else {
    const body = { providers, text: prompt };
    const result = await edenPost("/v2/video/generation_async", body, "videoGateway");
    ({ requestId, response, latencyMs } = result);
  }

  devLog("createVideoJob.EdenResponse", { requestId, latencyMs, responseKeys: Object.keys(response || {}) });

  const publicId =
    response?.public_id ||
    response?.publicId ||
    response?.job_id ||
    (response?.results && typeof response.results === "object" && Object.values(response.results)[0]?.public_id) ||
    (response?.results && typeof response.results === "object" && Object.values(response.results)[0]?.publicId);

  if (!publicId) {
    const err = new Error("No job ID (public_id) in Eden response");
    err.code = "EDEN_API_ERROR";
    err.requestId = requestId;
    err.raw = response;
    devLog("createVideoJob.NoJobId", {
      requestId,
      hadImage: !!imageBase64,
      fullResponse: response,
    });
    throw err;
  }

  const result = { jobId: String(publicId), requestId };
  devLog("createVideoJob.Output", result);
  return result;
}

/**
 * Get video job status via Eden v2 API.
 * GET /v2/video/generation_async/{jobId}/
 * @param {string} jobId - Eden public_id from createVideoJob
 * @returns {Promise<{ status: string, progress?: number, result?: { video_url: string }, error?: string, requestId?: string }>}
 */
async function getVideoJobStatus(jobId) {
  devLog("getVideoJobStatus.Input", { jobId });

  if (!jobId || typeof jobId !== "string") {
    return { status: "failed", error: "Job ID required", requestId: null };
  }

  const { requestId, response } = await edenGet(
    `/v2/video/generation_async/${encodeURIComponent(jobId)}/`,
    { response_as_dict: true, show_original_response: false },
    "videoGateway"
  );

  devLog("getVideoJobStatus.EdenResponse", { requestId, responseKeys: Object.keys(response || {}) });

  const status =
    response?.status ||
    (response?.results && typeof response.results === "object" && Object.values(response.results)[0]?.status);

  const pickUrl = (obj) =>
    obj?.video_url || obj?.video_resource_url || obj?.url || obj?.resource_url;

  let videoUrl = null;
  if (response?.amazon) videoUrl = pickUrl(response.amazon);
  if (!videoUrl && response?.results?.amazon) videoUrl = pickUrl(response.results.amazon);
  if (!videoUrl && response?.results && typeof response.results === "object") {
    for (const r of Object.values(response.results)) {
      videoUrl = pickUrl(r);
      if (videoUrl) break;
    }
  }
  if (!videoUrl && (status === "success" || status === "finished")) {
    devLog("getVideoJobStatus.NoVideoUrl", { jobId, fullResponse: response });
  }

  const errorMsg = response?.error || response?.message;

  const result = {
    status: status || "unknown",
    progress: response?.progress,
    result: videoUrl ? { video_url: videoUrl } : undefined,
    error: errorMsg,
    requestId,
  };

  devLog("getVideoJobStatus.Output", { jobId, result });
  return result;
}

module.exports = {
  createVideoJob,
  getVideoJobStatus,
  resizeToI2VFormat,
  I2V_IMAGE_SIZE,
};
