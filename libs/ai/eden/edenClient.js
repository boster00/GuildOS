/**
 * Low-level HTTP client for Eden AI. Key from env; requestId per call; standardized errors.
 * Used only by gateways. Logs only in development (per .cursorrules).
 */

const EDEN_BASE_URL = "https://api.edenai.run";

function generateRequestId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return "eden-" + Date.now() + "-" + Math.random().toString(36).slice(2, 11);
}

function log(routeName, step, details) {
  if (typeof process !== "undefined" && process.env && process.env.NODE_ENV === "development") {
  }
}

function parseEdenErrorMessage(data) {
  if (typeof data?.detail === "string") return data.detail;
  if (typeof data?.message === "string") return data.message;
  if (data?.error) {
    const e = data.error;
    if (typeof e === "string") return e;
    if (typeof e.message === "string") return e.message;
    if (typeof e.message === "object") return JSON.stringify(e.message);
    return JSON.stringify(e);
  }
  return null;
}

/**
 * POST to Eden AI with Bearer auth. Returns { requestId, response, latencyMs } or throws.
 * @param {string} path - e.g. "/v3/llm/chat/completions"
 * @param {object} body - JSON body
 * @param {string} routeName - for logs
 * @returns {Promise<{ requestId: string, response: object, latencyMs: number }>}
 */
async function edenPost(path, body, routeName = "edenClient") {
  const requestId = generateRequestId();
  const apiKey = typeof process !== "undefined" && process.env && process.env.EDEN_AI_API_KEY;
  if (!apiKey) {
    const err = new Error("Server configuration error");
    err.code = "EDEN_MISSING_KEY";
    err.requestId = requestId;
    throw err;
  }
  const url = path.startsWith("http") ? path : `${EDEN_BASE_URL}${path}`;
  const start = Date.now();
  log(routeName, "Request", { requestId, path, model: body?.model });
  let response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch (e) {
    log(routeName, "Error", { requestId, message: e.message });
    const err = new Error(e.message || "Eden API request failed");
    err.code = "EDEN_NETWORK_ERROR";
    err.requestId = requestId;
    throw err;
  }
  const latencyMs = Date.now() - start;
  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  if (!response.ok) {
    log(routeName, "API Error", { requestId, status: response.status, body: data });
    const errMsg = parseEdenErrorMessage(data) || `HTTP ${response.status}`;
    const err = new Error(errMsg);
    err.code = "EDEN_API_ERROR";
    err.status = response.status;
    err.requestId = requestId;
    err.raw = data;
    throw err;
  }
  log(routeName, "Response", { requestId, latencyMs });
  return { requestId, response: data, latencyMs };
}

/**
 * POST FormData to Eden AI (multipart/form-data). Used when endpoint expects form with file.
 * @param {string} path - e.g. "/v2/video/generation_async"
 * @param {FormData} formData - FormData with fields and file(s)
 * @param {string} routeName - for logs
 * @returns {Promise<{ requestId: string, response: object, latencyMs: number }>}
 */
async function edenPostFormData(path, formData, routeName = "edenClient") {
  const requestId = generateRequestId();
  const apiKey = typeof process !== "undefined" && process.env && process.env.EDEN_AI_API_KEY;
  if (!apiKey) {
    const err = new Error("Server configuration error");
    err.code = "EDEN_MISSING_KEY";
    err.requestId = requestId;
    throw err;
  }
  const url = path.startsWith("http") ? path : `${EDEN_BASE_URL}${path}`;
  const start = Date.now();
  log(routeName, "Request", { requestId, path, method: "POST", body: "FormData" });
  let response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: formData,
    });
  } catch (e) {
    log(routeName, "Error", { requestId, message: e.message });
    const err = new Error(e.message || "Eden API request failed");
    err.code = "EDEN_NETWORK_ERROR";
    err.requestId = requestId;
    throw err;
  }
  const latencyMs = Date.now() - start;
  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  if (!response.ok) {
    log(routeName, "API Error", { requestId, status: response.status, body: data });
    const errMsg = parseEdenErrorMessage(data) || `HTTP ${response.status}`;
    const err = new Error(errMsg);
    err.code = "EDEN_API_ERROR";
    err.status = response.status;
    err.requestId = requestId;
    err.raw = data;
    throw err;
  }
  log(routeName, "Response", { requestId, latencyMs });
  return { requestId, response: data, latencyMs };
}

/**
 * GET to Eden AI with Bearer auth. Returns { requestId, response, latencyMs } or throws.
 * @param {string} path - e.g. "/v2/video/generation_async/abc123/"
 * @param {object} params - optional query params
 * @param {string} routeName - for logs
 * @returns {Promise<{ requestId: string, response: object, latencyMs: number }>}
 */
async function edenGet(path, params = {}, routeName = "edenClient") {
  const requestId = generateRequestId();
  const apiKey = typeof process !== "undefined" && process.env && process.env.EDEN_AI_API_KEY;
  if (!apiKey) {
    const err = new Error("Server configuration error");
    err.code = "EDEN_MISSING_KEY";
    err.requestId = requestId;
    throw err;
  }
  let url = path.startsWith("http") ? path : `${EDEN_BASE_URL}${path}`;
  if (Object.keys(params).length) {
    const qs = new URLSearchParams(params).toString();
    url += (url.includes("?") ? "&" : "?") + qs;
  }
  const start = Date.now();
  log(routeName, "Request", { requestId, path, method: "GET" });
  let response;
  try {
    response = await fetch(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${apiKey}` },
    });
  } catch (e) {
    log(routeName, "Error", { requestId, message: e.message });
    const err = new Error(e.message || "Eden API request failed");
    err.code = "EDEN_NETWORK_ERROR";
    err.requestId = requestId;
    throw err;
  }
  const latencyMs = Date.now() - start;
  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  if (!response.ok) {
    log(routeName, "API Error", { requestId, status: response.status, body: data });
    const errMsg = parseEdenErrorMessage(data) || `HTTP ${response.status}`;
    const err = new Error(errMsg);
    err.code = "EDEN_API_ERROR";
    err.status = response.status;
    err.requestId = requestId;
    err.raw = data;
    throw err;
  }
  log(routeName, "Response", { requestId, latencyMs });
  return { requestId, response: data, latencyMs };
}

/**
 * Upload a file to Eden and return file_id for use in file-based features.
 * POST /v3/upload with multipart/form-data.
 * @param {Buffer} buffer - File contents
 * @param {string} filename - e.g. "image.png"
 * @param {string} routeName - for logs
 * @returns {Promise<{ file_id: string, requestId: string }>}
 */
async function edenUploadFile(buffer, filename = "image.png", routeName = "edenClient") {
  const requestId = generateRequestId();
  const apiKey = typeof process !== "undefined" && process.env && process.env.EDEN_AI_API_KEY;
  if (!apiKey) {
    const err = new Error("Server configuration error");
    err.code = "EDEN_MISSING_KEY";
    err.requestId = requestId;
    throw err;
  }
  const url = `${EDEN_BASE_URL}/v3/upload`;
  const start = Date.now();
  log(routeName, "Upload", { requestId, filename, size: buffer?.length });

  const formData = new FormData();
  const blob = new Blob([buffer], { type: "image/png" });
  formData.append("file", blob, filename);

  let response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: formData,
    });
  } catch (e) {
    log(routeName, "Upload Error", { requestId, message: e.message });
    const err = new Error(e.message || "Eden upload request failed");
    err.code = "EDEN_NETWORK_ERROR";
    err.requestId = requestId;
    throw err;
  }

  const latencyMs = Date.now() - start;
  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }

  if (!response.ok) {
    log(routeName, "Upload API Error", { requestId, status: response.status, body: data });
    const errMsg = parseEdenErrorMessage(data) || `HTTP ${response.status}`;
    const err = new Error(errMsg);
    err.code = "EDEN_API_ERROR";
    err.status = response.status;
    err.requestId = requestId;
    err.raw = data;
    throw err;
  }

  const fileId = data?.file_id ?? data?.fileId;
  if (!fileId) {
    const err = new Error("No file_id in Eden upload response");
    err.code = "EDEN_API_ERROR";
    err.requestId = requestId;
    err.raw = data;
    throw err;
  }

  log(routeName, "Upload Response", { requestId, file_id: fileId, latencyMs });
  return { file_id: String(fileId), requestId };
}

/**
 * Truncate raw payload for rawPreview (plan: first 5KB + "... [truncated]").
 */
function truncateRaw(raw, maxChars = 5120) {
  if (raw === undefined || raw === null) return undefined;
  const str = typeof raw === "string" ? raw : JSON.stringify(raw);
  if (str.length <= maxChars) return str;
  return str.slice(0, maxChars) + "\n... [truncated]";
}

module.exports = {
  EDEN_BASE_URL,
  generateRequestId,
  edenPost,
  edenPostFormData,
  edenGet,
  edenUploadFile,
  truncateRaw,
  log,
};
