import OpenAI from "openai";

function resolveApiKey() {
  const key = (process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_1 || "").trim();
  if (!key) {
    throw new Error(
      "No OpenAI API key: set OPENAI_API_KEY in the environment (e.g. .env.local).",
    );
  }
  return key;
}

function defaultModel() {
  return (process.env.OPENAI_DEFAULT_MODEL || "").trim() || "gpt-4o-mini";
}

/**
 * @param {string | Record<string, unknown>} input
 * @returns {{ messages: Array<{ role: string, content: string }>, wantFull: boolean, model?: string }}
 */
function normalizeQueryInput(input) {
  if (typeof input === "string") {
    return {
      messages: [{ role: "user", content: input }],
      wantFull: false,
      model: undefined,
    };
  }

  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error('ai.query expects a string or a plain object with messages (or role + content).');
  }

  const wantFull = input.fullReponse === true || input.fullResponse === true;

  const model =
    typeof input.model === "string" && input.model.trim() ? input.model.trim() : undefined;

  let messages;
  if (Array.isArray(input.messages) && input.messages.length > 0) {
    messages = input.messages;
  } else if (typeof input.role === "string" && typeof input.content === "string") {
    messages = [{ role: input.role, content: input.content }];
  } else {
    throw new Error(
      "ai.query object input must include a non-empty `messages` array or both `role` and `content`.",
    );
  }

  return { messages, wantFull, model };
}

/**
 * Extract a single JSON object from model text (fenced ```json` or first `{...}` block).
 * @param {string} text
 * @returns {Record<string, unknown> | null}
 */
function parseJsonObjectFromText(text) {
  if (text == null || typeof text !== "string") return null;
  let s = text.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)```/im.exec(s);
  if (fence) s = fence[1].trim();
  const start = s.indexOf("{");
  if (start === -1) return null;
  for (let i = start; i < s.length; i++) {
    if (s[i] !== "{") continue;
    let depth = 0;
    for (let j = i; j < s.length; j++) {
      if (s[j] === "{") depth++;
      else if (s[j] === "}") {
        depth--;
        if (depth === 0) {
          try {
            const obj = JSON.parse(s.slice(i, j + 1));
            if (obj && typeof obj === "object" && !Array.isArray(obj)) return obj;
          } catch {
            return null;
          }
          break;
        }
      }
    }
  }
  return null;
}

export const ai = {
  /** Model used when `query` is not given a `model` on the input object. From OPENAI_DEFAULT_MODEL or gpt-4o-mini. */
  get defaultModel() {
    return defaultModel();
  },

  /**
   * Chat completion against the OpenAI Chat Completions API (env key from .env.local / process.env).
   * @param {string | { messages?: Array<{ role: string, content: string }>, role?: string, content?: string, model?: string, fullReponse?: boolean, fullResponse?: boolean, resultFormat?: unknown }} input
   * @returns {Promise<string | import("openai/resources").OpenAI.Chat.Completions.ChatCompletion | { data: { items: Record<string, unknown> } }>}
   */
  async query(input) {
    const hasResultFormat =
      typeof input === "object" && input !== null && !Array.isArray(input) && "resultFormat" in input;

    if (hasResultFormat) {
      const inner = /** @type {Record<string, unknown>} */ (input);
      if (inner.fullReponse === true || inner.fullResponse === true) {
        throw new Error("ai.query: resultFormat cannot be combined with fullResponse.");
      }
    }

    const { messages, wantFull, model } = normalizeQueryInput(input);
    const openai = new OpenAI({ apiKey: resolveApiKey() });
    const res = await openai.chat.completions.create({
      model: model || defaultModel(),
      messages,
    });

    if (wantFull) {
      return res;
    }

    const content = res.choices?.[0]?.message?.content ?? "";

    if (hasResultFormat) {
      const parsed = parseJsonObjectFromText(content);
      const obj = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
      return { data: { items: obj } };
    }

    return content;
  },
};
