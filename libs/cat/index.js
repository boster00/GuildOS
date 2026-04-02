/**
 * Cat assistant — import `cat` and call methods; no setup required.
 * For client components that only need `planQuest`, use `@/libs/cat/client` to avoid bundling skill_book.
 */
import { database } from "@/libs/council/database";
import { getQuestForOwner, transitionQuestStage, updateQuest } from "@/libs/quest";
import { listAdventurers } from "@/libs/proving_grounds/server.js";

/** Expected shape for idea→plan JSON (used by validateJson). */
const QUEST_PLAN_VALIDATION_EXAMPLE = {
  title: "",
  description: "",
  deliverables: "",
};

const MAX_PLAN_ATTEMPTS = 4;

/**
 * Pull a JSON object from model text: ```json fences, then balanced `{...}`.
 * @param {string} text
 * @returns {Record<string, unknown> | null}
 */
function extractJson(text) {
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
      const ch = s[j];
      if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) {
          const slice = s.slice(i, j + 1);
          try {
            const obj = JSON.parse(slice);
            if (obj && typeof obj === "object" && !Array.isArray(obj)) {
              return /** @type {Record<string, unknown>} */ (obj);
            }
          } catch {
            /* try next opening brace */
          }
          break;
        }
      }
    }
  }
  return null;
}

/**
 * Validate parsed JSON against an example object (same keys required; value types checked for strings / deliverables).
 * @param {unknown} parsed
 * @param {Record<string, unknown>} example
 * @returns {{ ok: true } | { ok: false, msg: string }}
 */
function validateJson(parsed, example) {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ok: false, msg: "Response is not a JSON object." };
  }
  const o = /** @type {Record<string, unknown>} */ (parsed);
  for (const key of Object.keys(example)) {
    if (!(key in o)) {
      return { ok: false, msg: `Missing required key "${key}".` };
    }
  }
  const title = o.title;
  if (typeof title !== "string" || !title.trim()) {
    return { ok: false, msg: 'Key "title" must be a non-empty string.' };
  }
  const description = o.description;
  if (description != null && typeof description !== "string") {
    return { ok: false, msg: 'Key "description" must be a string if present.' };
  }
  const del = o.deliverables;
  if (del == null) {
    return { ok: false, msg: 'Key "deliverables" is required.' };
  }
  if (typeof del === "string") {
    if (!del.trim()) return { ok: false, msg: 'Key "deliverables" must not be empty.' };
  } else if (Array.isArray(del)) {
    if (del.length === 0 || !del.every((x) => typeof x === "string" && x.trim())) {
      return { ok: false, msg: 'Key "deliverables" must be a non-empty array of non-empty strings.' };
    }
  } else {
    return { ok: false, msg: 'Key "deliverables" must be a string or an array of strings.' };
  }
  return { ok: true };
}

/**
 * POST `/api/ai` (authenticated). Forwards Cookie from Next when available.
 * @param {Array<{ role: string, content: string }>} messages
 * @returns {Promise<string>} assistant text
 */
async function postApiAi(messages) {
  const origin =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
    "http://127.0.0.1:3000";

  let cookieHeader = "";
  try {
    const { headers } = await import("next/headers");
    const h = await headers();
    cookieHeader = h.get("cookie") || "";
  } catch {
    /* not in a Next request context */
  }

  const res = await fetch(`${origin.replace(/\/$/, "")}/api/ai`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(cookieHeader ? { Cookie: cookieHeader } : {}),
    },
    body: JSON.stringify({ messages }),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const errMsg = typeof json?.error === "string" ? json.error : res.statusText;
    throw new Error(errMsg || `AI request failed (${res.status})`);
  }
  if (typeof json?.text !== "string") {
    throw new Error("AI response missing text");
  }
  return json.text;
}

/**
 * Default skill-book-style helper: send to AI via `/api/ai`, optionally extract + validate JSON.
 * @param {Record<string, unknown>} input
 * @param {string} input.user — primary user message (or use `content` / last user turn)
 * @param {string} [input.content] — alias for user message
 * @param {Array<{ role: string, content: string }>} [input.context] — prior messages
 * @param {string | Record<string, unknown>} [input.system] — system prompt
 * @param {Record<string, unknown>} [input.validationJson] — example shape for validateJson after extractJson
 * @returns {Promise<
 *   | { ok: true; text: string; parsed: Record<string, unknown> | null }
 *   | { ok: false; text: string; parsed: Record<string, unknown> | null; feedback: string }
 * >}
 */
export async function defaultThink(input) {
  const userRaw = input.user ?? input.content;
  const userContent = typeof userRaw === "string" ? userRaw : JSON.stringify(userRaw ?? "");
  const context = Array.isArray(input.context) ? input.context : [];
  const system = input.system;

  /** @type {Array<{ role: string, content: string }>} */
  const messages = [];
  if (system != null) {
    const sys =
      typeof system === "string" ? system : JSON.stringify(system, null, 2);
    messages.push({ role: "system", content: sys });
  }
  for (const m of context) {
    if (m && typeof m.content === "string" && (m.role === "user" || m.role === "assistant")) {
      messages.push({ role: m.role, content: m.content });
    }
  }
  messages.push({ role: "user", content: userContent });

  const text = await postApiAi(messages);

  const validationJson =
    input.validationJson && typeof input.validationJson === "object" && !Array.isArray(input.validationJson)
      ? /** @type {Record<string, unknown>} */ (input.validationJson)
      : null;

  if (!validationJson) {
    return { ok: true, text, parsed: null };
  }

  const parsed = extractJson(text);
  if (!parsed) {
    return {
      ok: false,
      text,
      parsed: null,
      feedback: "Could not extract a JSON object from the model response.",
    };
  }

  const v = validateJson(parsed, validationJson);
  if (!v.ok) {
    return { ok: false, text, parsed, feedback: v.msg };
  }
  return { ok: true, text, parsed };
}

/**
 * @param {string | undefined} userId
 * @param {import("@/libs/council/database/types.js").DatabaseClient} client
 */
async function resolveUserId(userId, db) {
  if (userId && typeof userId === "string") return userId;
  const {
    data: { user },
  } = await db.auth.getUser();
  return user?.id ?? null;
}

/**
 * Optional: skill book `questmaster` → `planQuest(userId, quest)` may return a custom user prompt string.
 * @param {typeof cat} catRef
 * @param {string} userId
 * @param {Record<string, unknown>} quest
 * @param {string} fallbackUserPrompt
 */
async function tryQuestmasterPlanQuestPrompt(catRef, userId, quest, fallbackUserPrompt) {
  try {
    const qm = await catRef.skillBook("questmaster");
    if (qm && typeof qm.planQuest === "function") {
      const out = await qm.planQuest(userId, quest);
      if (typeof out === "string" && out.trim()) return out;
      if (out && typeof out === "object" && typeof out.prompt === "string" && out.prompt.trim()) {
        return out.prompt;
      }
    }
  } catch {
    /* no questmaster book or action — use fallback */
  }
  return fallbackUserPrompt;
}

/**
 * Plan a quest from `idea` (AI JSON plan → persist → `plan`) or list adventurers in `plan` for select-adventurer.
 *
 * @param {{
 *   questId: string,
 *   userId?: string,
 *   client?: import("@/libs/council/database/types.js").DatabaseClient,
 * }} input
 * @returns {Promise<
 *   | { ok: true, data: unknown }
 *   | { ok: false, msg: string }
 *   | { ok: false, error: string }
 * >}
 */
export async function planQuest(input) {
  const questId = input?.questId;
  if (!questId || typeof questId !== "string") {
    return { ok: false, error: "questId is required" };
  }

  const db = input.client ?? (await database.init("server"));
  const userId = await resolveUserId(input.userId, db);
  if (!userId) {
    return { ok: false, error: "Not authenticated (userId missing and no session)." };
  }

  const { data: quest, error: qErr } = await getQuestForOwner(questId, userId, { client: db });
  if (qErr || !quest) {
    return { ok: false, error: qErr?.message || "Quest not found." };
  }

  const stage = quest.stage;
  if (stage !== "idea" && stage !== "plan") {
    return { ok: false, msg: "Quest is not in idea or plan stage." };
  }

  if (stage === "plan") {
    const { data: roster, error: rosterErr } = await listAdventurers(userId, { client: db });
    if (rosterErr) {
      return { ok: false, error: rosterErr.message || String(rosterErr) };
    }
    const adventurers = (roster || []).map((a) => ({
      name: a.name,
      display_name: a.display_name ?? null,
      skill_books: Array.isArray(a.skill_books) ? a.skill_books : [],
      capabilities:
        typeof a.capabilities === "string" ? a.capabilities : "",
    }));
    return {
      ok: true,
      data: {
        stage: "plan",
        step: "selectAdventurer",
        adventurers,
      },
    };
  }

  const userInstruction = [quest.title, quest.description].filter(Boolean).join("\n\n").trim() || "(empty)";

  const fallbackPrompt = `Here is the user instruction, convert it to the following json format {"title":"","description":"","deliverables":""} (deliverables may be a string or an array of strings).

User instruction:
${userInstruction}`;

  const userPrompt = await tryQuestmasterPlanQuestPrompt(cat, userId, quest, fallbackPrompt);

  let lastText = "";
  let lastFeedback = "";
  /** @type {Record<string, unknown> | null} */
  let planned = null;

  for (let attempt = 0; attempt < MAX_PLAN_ATTEMPTS; attempt++) {
    const userMessage =
      attempt === 0
        ? userPrompt
        : `${userPrompt}

Previous model response failed validation or parsing.
Raw response:
${lastText}

Validation feedback:
${lastFeedback}

Reply with ONLY a single JSON object matching the required keys and types.`;

    const res = await defaultThink({
      user: userMessage,
      validationJson: QUEST_PLAN_VALIDATION_EXAMPLE,
    });

    lastText = res.text;
    if (res.ok && res.parsed) {
      planned = res.parsed;
      break;
    }
    lastFeedback = "feedback" in res && typeof res.feedback === "string" ? res.feedback : "Validation failed.";
  }

  if (!planned) {
    return {
      ok: false,
      msg: lastFeedback || "Could not obtain valid plan JSON after retries.",
    };
  }

  const title = String(planned.title ?? "").trim();
  const description =
    planned.description != null && typeof planned.description === "string"
      ? planned.description
      : String(quest.description ?? "");

  const deliverables =
    planned.deliverables == null
      ? null
      : Array.isArray(planned.deliverables)
        ? planned.deliverables.map((x) => String(x).trim()).filter(Boolean).join("\n")
        : String(planned.deliverables).trim() || null;

  const { error: updErr } = await updateQuest(
    questId,
    {
      title: title || quest.title,
      description,
      deliverables,
    },
    { client: db },
  );
  if (updErr) {
    return { ok: false, error: updErr.message || String(updErr) };
  }

  const { error: trErr } = await transitionQuestStage(questId, "plan", { client: db });
  if (trErr) {
    return { ok: false, error: trErr.message || String(trErr) };
  }

  return {
    ok: true,
    data: {
      stage: "plan",
      questId,
      plan: {
        title: title || quest.title,
        description,
        deliverables: planned.deliverables,
      },
      deliverables,
    },
  };
}

export const cat = {
  /** @type {Map<string, unknown>} Cached skill book modules by folder name under libs/skill_book/ */
  skillBooks: new Map(),

  /**
   * Load a skill book by folder name (same as `libs/skill_book/<bookname>/`).
   * Caches in `skillBooks`; uses dynamic import on first request.
   * @param {string} bookname
   */
  async skillBook(bookname) {
    if (this.skillBooks.has(bookname)) {
      return this.skillBooks.get(bookname);
    }
    let mod;
    try {
      mod = await import(`../skill_book/${bookname}/index.js`);
    } catch {
      throw new Error(`Skill book "${bookname}" not found`);
    }
    const book = mod.default ?? mod;
    this.skillBooks.set(bookname, book);
    return book;
  },

  /** @see {defaultThink} — skill book "default"–style AI + optional JSON validation */
  think: defaultThink,

  planQuest,
};

export { runCommissionChat } from "./commissionChat.js";
