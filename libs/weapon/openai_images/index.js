/**
 * OpenAI Images weapon — image generation and editing via gpt-image-2.
 *
 * Credential: OPENAI_API_KEY from profiles.env_vars, fallback to process.env.
 *
 * ─── API surface ──────────────────────────────────────────────────────────
 * Generate: POST https://api.openai.com/v1/images/generations
 *   body (JSON): { model, prompt, size, quality, n }
 *   response:    { data: [{ b64_json }], usage }
 *
 * Edit: POST https://api.openai.com/v1/images/edits  (multipart/form-data)
 *   fields: model, prompt, size, quality, n, image[] (Blob | Buffer)
 *   response: { data: [{ b64_json }], usage }
 *
 * ─── Verified behavior (smoke-tested 2026-04-23) ──────────────────────────
 * - DO NOT pass response_format — causes unknown_parameter error; b64_json is
 *   always returned regardless.
 * - Supported sizes: "1024x1024" | "1024x1536" | "1536x1024" | "auto"
 * - Supported quality: "low" | "medium" | "high"
 * - gpt-image-2 requires org verification on the OpenAI platform before the
 *   model unlocks for API calls.
 */

import { database } from "@/libs/council/database";

export const toc = {
  generate:
    "Generate one or more images from a text prompt using gpt-image-2. Returns array of b64_json strings.",
  edit:
    "Restyle or composite existing images using gpt-image-2 edits endpoint. Accepts image Buffers + prompt. Returns array of b64_json strings.",
};

const BASE = "https://api.openai.com/v1";

async function loadKey(userId) {
  if (userId) {
    try {
      const db = await database.init("service");
      const { data } = await db
        .from("profiles")
        .select("env_vars")
        .eq("id", userId)
        .single();
      const k = data?.env_vars?.OPENAI_API_KEY;
      if (k) return k;
    } catch {
      /* fall through */
    }
  }
  return process.env.OPENAI_API_KEY || null;
}

/**
 * Generate images from a text prompt.
 *
 * @param {{ prompt: string, size?: string, quality?: string, n?: number }} input
 * @param {string} [userId]
 * @returns {Promise<string[]>} Array of base64-encoded PNG strings (one per image)
 */
export async function generate(
  { prompt, size = "1024x1024", quality = "medium", n = 1 } = {},
  userId
) {
  const key = await loadKey(userId);
  if (!key) throw new Error("OPENAI_API_KEY not configured");

  const res = await fetch(`${BASE}/images/generations`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: "gpt-image-2", prompt, size, quality, n }),
  });

  const json = await res.json();
  if (json.error) throw new Error(`OpenAI Images error: ${json.error.message}`);
  return json.data.map((d) => d.b64_json);
}

/**
 * Edit / restyle one or more images.
 *
 * @param {{ images: (Buffer|Blob)[], prompt: string, size?: string, quality?: string, n?: number }} input
 *   images — array of image Buffers (PNG preferred). Max 10 inputs.
 * @param {string} [userId]
 * @returns {Promise<string[]>} Array of base64-encoded PNG strings
 */
export async function edit(
  { images, prompt, size = "1024x1024", quality = "medium", n = 1 } = {},
  userId
) {
  const key = await loadKey(userId);
  if (!key) throw new Error("OPENAI_API_KEY not configured");
  if (!images?.length) throw new Error("At least one image is required for edit");

  const form = new FormData();
  form.append("model", "gpt-image-2");
  form.append("prompt", prompt);
  form.append("size", size);
  form.append("quality", quality);
  form.append("n", String(n));

  for (const img of images) {
    const blob =
      img instanceof Blob ? img : new Blob([img], { type: "image/png" });
    form.append("image[]", blob, "image.png");
  }

  const res = await fetch(`${BASE}/images/edits`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  });

  const json = await res.json();
  if (json.error) throw new Error(`OpenAI Images edit error: ${json.error.message}`);
  return json.data.map((d) => d.b64_json);
}
