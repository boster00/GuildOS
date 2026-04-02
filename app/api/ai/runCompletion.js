import OpenAI from "openai";
import { resolveDungeonMasterRuntime } from "@/libs/council/councilSettings";
import { runGenericChat } from "@/libs/council/ai/chatCompletion.js";

/**
 * Prefer the signed-in user’s Dungeon Master key; fall back to env OPENAI_API_KEY (same as legacy `/api/ai`).
 * @param {{
 *   userId: string,
 *   client: import("@/libs/council/database/types.js").DatabaseClient,
 *   messages: Array<{ role: string, content: string }>,
 *   model?: string,
 *   json?: boolean,
 *   forceEnv?: boolean,
 * }} opts
 */
export async function runAuthenticatedCompletion({
  userId,
  sessionClient,
  messages,
  model: modelOverride,
  json = false,
  forceEnv = false,
}) {
  if (forceEnv) {
    return runGenericChatWithJson({ messages, model: modelOverride, json });
  }

  const rt = await resolveDungeonMasterRuntime(userId, { client: sessionClient });
  if (!rt.error && rt.apiKey) {
    const model =
      (typeof modelOverride === "string" && modelOverride.trim()) ||
      rt.defaultModel ||
      process.env.OPENAI_DEFAULT_MODEL ||
      "gpt-4o-mini";

    const openai = new OpenAI({
      apiKey: rt.apiKey,
      ...(rt.baseUrl ? { baseURL: rt.baseUrl } : {}),
    });

    const res = await openai.chat.completions.create({
      model,
      messages,
      ...(json ? { response_format: { type: "json_object" } } : {}),
    });

    const text = res.choices?.[0]?.message?.content ?? "";
    return {
      text,
      model,
      usage: res.usage ?? null,
      apiKeySource: rt.apiKeySource ?? "dungeon_master",
    };
  }

  return runGenericChatWithJson({ messages, model: modelOverride, json });
}

/**
 * @param {{ messages: Array<{ role: string, content: string }>, model?: string, json?: boolean }} opts
 */
async function runGenericChatWithJson({ messages, model: modelOverride, json }) {
  const apiKey = process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_1;
  if (!apiKey) {
    throw new Error(
      "No OpenAI API key: add one in Council Hall → Dungeon master’s room, or set OPENAI_API_KEY in the environment.",
    );
  }
  const model =
    (typeof modelOverride === "string" && modelOverride.trim()) ||
    process.env.OPENAI_DEFAULT_MODEL ||
    "gpt-4o-mini";

  const client = new OpenAI({ apiKey });
  const res = await client.chat.completions.create({
    model,
    messages,
    ...(json ? { response_format: { type: "json_object" } } : {}),
  });
  const text = res.choices?.[0]?.message?.content ?? "";
  return {
    text,
    model,
    usage: res.usage ?? null,
    apiKeySource: "env",
  };
}
