import OpenAI from "openai";
import { resolveDungeonMasterRuntime } from "@/libs/council/councilSettings";

/**
 * Chat completion using the user’s Dungeon Master key / base URL / default model (same source as `/api/ai` intent for product flows).
 * @param {{ userId: string, messages: Array<{ role: string, content: string }>, model?: string, client: import("@/libs/council/database/types.js").DatabaseClient }} opts
 */
export async function runDungeonMasterChat({ userId, messages, model: modelOverride, maxTokens, client }) {
  if (!Array.isArray(messages) || messages.length === 0) {
    throw new Error("messages must be a non-empty array of { role, content }");
  }
  const rt = await resolveDungeonMasterRuntime(userId, { client });
  if (rt.error) {
    throw new Error(typeof rt.error.message === "string" ? rt.error.message : "Dungeon Master settings failed");
  }
  if (!rt.apiKey) {
    throw new Error(
      "No OpenAI API key: add one in Council Hall → Dungeon master’s room, or set OPENAI_API_KEY in the environment.",
    );
  }
  const model =
    (typeof modelOverride === "string" && modelOverride.trim()) ||
    rt.defaultModel ||
    process.env.OPENAI_DEFAULT_MODEL ||
    "gpt-4o-mini";

  const openai = new OpenAI({
    apiKey: rt.apiKey,
    ...(rt.baseUrl ? { baseURL: rt.baseUrl } : {}),
  });
  const createOpts = { model, messages };
  if (typeof maxTokens === "number" && maxTokens > 0) {
    createOpts.max_tokens = maxTokens;
  }
  const res = await openai.chat.completions.create(createOpts);
  const text = res.choices?.[0]?.message?.content ?? "";
  const finishReason = res.choices?.[0]?.finish_reason ?? null;
  return {
    text,
    model,
    finishReason,
    usage: res.usage ?? null,
    apiKeySource: rt.apiKeySource,
  };
}

/**
 * One-off generic chat completion.
 * Uses server env OPENAI_API_KEY; model from options or OPENAI_DEFAULT_MODEL or gpt-4o-mini.
 */
export async function runGenericChat({ messages, model: modelOverride } = {}) {
  if (!Array.isArray(messages) || messages.length === 0) {
    throw new Error("messages must be a non-empty array of { role, content }");
  }
  const apiKey = process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_1;
  if (!apiKey) {
    throw new Error(
      "No OpenAI API key: set OPENAI_API_KEY in the environment (e.g. .env.local).",
    );
  }
  const model =
    (typeof modelOverride === "string" && modelOverride.trim()) ||
    process.env.OPENAI_DEFAULT_MODEL ||
    "gpt-4o-mini";

  const openai = new OpenAI({ apiKey });
  const res = await openai.chat.completions.create({
    model,
    messages,
  });
  const text = res.choices?.[0]?.message?.content ?? "";
  return {
    text,
    model,
    usage: res.usage ?? null,
  };
}
