/**
 * Questmaster skill book — Cat uses these actions for planning and assignee matching.
 * Includes JSON extraction helpers shared with plan/find flows.
 */
import { runDungeonMasterChat } from "@/libs/council/ai/chatCompletion.js";

/** Server logs for tracing planRequestToQuest (grep: GuildOS:planRequestToQuest). */
const LOG = "[GuildOS:planRequestToQuest]";

/** @param {unknown} s @param {number} [max] */
function previewText(s, max = 280) {
  const t = s == null ? "" : String(s);
  return t.length <= max ? t : `${t.slice(0, max)}…`;
}

/**
 * Pull a JSON object from model text: tries ```json fences, then scans for balanced `{...}` and parses.
 * Expects objects with at least `title` and `deliverable` (quest-plan shape).
 * @param {string} text
 * @returns {Record<string, unknown>|null}
 */
function extractQuestPlanJson(text) {
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
            if (
              obj &&
              typeof obj === "object" &&
              !Array.isArray(obj) &&
              "title" in obj &&
              "deliverable" in obj
            ) {
              return obj;
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

export const definition = {
  id: "questmaster",
  title: "Questmaster",
  description:
    "Plan user requests into quest-shaped JSON and pick roster adventurers by capability.",
  toc: [
    {
      id: "planRequestToQuest",
      summary: "Translate a raw user request into a structured quest (title, description, deliverables, due date, stage).",
      input: { initialRequest: { type: "string", required: true } },
      output: { title: { type: "string" }, description: { type: "string" }, deliverables: { type: "string" }, due_date: { type: "string" }, stage: { type: "string" } },
    },
    {
      id: "findAdventurerForQUest",
      summary: "Given a quest and a roster of adventurers, pick the best-fit adventurer by capability.",
      input: { quest: { type: "object", required: true }, adventurers: { type: "array", required: true } },
      output: { adventurer_id: { type: "string" }, name: { type: "string" } },
    },
    {
      id: "selectAdventurer",
      summary:
        "Idea-stage roster match for a New Request: load capabilities + names, AI chooses one adventurer or returns { result: false, msg }.",
      input: { quest: { type: "object", required: true } },
      output: { result: { type: "object" }, msg: { type: "string" } },
    },
    {
      id: "interpretIdea",
      summary:
        "Turn a raw user request into a structured quest for a chosen adventurer (title, description with deliverable clarity, deliverables).",
      input: {
        initialRequest: { type: "string", required: true },
        adventurerName: { type: "string", required: true },
      },
      output: {
        title: { type: "string" },
        description: { type: "string" },
        deliverables: { type: "string" },
        due_date: { type: "string" },
      },
    },
  ],
  steps: [],
};

/**
 * @param {unknown} v
 * @returns {string}
 */
function deliverablesToText(v) {
  if (v == null) return "";
  if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean).join("\n");
  return String(v).trim();
}

/**
 * @param {unknown} raw
 * @returns {string | null}
 */
function parseDueDateIso(raw) {
  if (raw == null || raw === "") return null;
  const s = String(raw).trim();
  const t = Date.parse(s);
  if (Number.isNaN(t)) return null;
  return new Date(t).toISOString();
}

/**
 * @param {string} text
 * @returns {Record<string, unknown> | null}
 */
function extractJsonObject(text) {
  if (text == null || typeof text !== "string") return null;
  return extractQuestPlanJson(text) || tryBalancedJson(text);
}

/**
 * @param {string} s
 */
function tryBalancedJson(s) {
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
          try {
            const obj = JSON.parse(s.slice(i, j + 1));
            if (obj && typeof obj === "object" && !Array.isArray(obj)) return /** @type {Record<string, unknown>} */ (obj);
          } catch {
            return null;
          }
          return null;
        }
      }
    }
  }
  return null;
}

/**
 * Query AI with the user's initial request; return quest-compatible JSON and normalized fields.
 *
 * @param {string} userId
 * @param {{ initialRequest: string, client: import("@/libs/council/database/types.js").DatabaseClient }} opts
 */
export async function planRequestToQuest(userId, { initialRequest, client }) {
  const req = String(initialRequest ?? "").trim();
  if (req.length < 3) {
    console.warn(LOG, "reject: initial request too short", { len: req.length });
    return { data: null, error: new Error("Initial request is too short (need at least 3 characters).") };
  }

  console.log(LOG, "start", {
    userIdPrefix: typeof userId === "string" ? `${userId.slice(0, 8)}…` : String(userId),
    initialRequestLen: req.length,
    initialRequestPreview: previewText(req, 400),
    hasClient: Boolean(client),
  });

  const prompt = `The user submitted this request:

${req}

Respond with ONLY one JSON object (no prose) using exactly these keys:
{
  "title": "verb-first short title",
  "description": "SMART description of the work",
  "deliverables": "what must be submitted (string, or array of strings if multiple)",
  "due_date": "ISO 8601 datetime or clear date string",
  "stage": "plan"
}

"stage" must be "plan" unless the request is too vague — then use "idea".`;

  let aiText = "";
  try {
    console.log(LOG, "calling runDungeonMasterChat");
    const out = await runDungeonMasterChat({
      userId,
      messages: [{ role: "user", content: prompt }],
      model: undefined,
      client,
    });
    aiText = out.text;
    console.log(LOG, "model raw response", {
      responseChars: typeof aiText === "string" ? aiText.length : 0,
      rawPreview: previewText(aiText, 500),
    });
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    console.error(LOG, "runDungeonMasterChat failed", {
      message: e.message,
      name: e.name,
    });
    return { data: null, error: e };
  }

  const parsed = extractJsonObject(aiText);
  if (!parsed || typeof parsed.title !== "string" || String(parsed.title).trim() === "") {
    console.warn(LOG, "parse failed or missing title", {
      hasParsed: Boolean(parsed),
      titleType: parsed && typeof parsed.title,
      extractPreview: previewText(aiText, 600),
    });
    return { data: null, error: new Error("Model did not return valid quest JSON (title required).") };
  }

  const title = String(parsed.title).trim();
  const description = parsed.description != null ? String(parsed.description) : "";
  const deliverables = deliverablesToText(parsed.deliverables ?? parsed.deliverable);
  const dueRaw = parsed.due_date ?? parsed.dueDate;
  const due_date = parseDueDateIso(dueRaw);
  const stageRaw = parsed.stage != null ? String(parsed.stage).trim().toLowerCase() : "plan";
  const stage = stageRaw === "idea" || stageRaw === "plan" ? stageRaw : "plan";

  console.log(LOG, "normalized plan", {
    titleLen: title.length,
    titlePreview: previewText(title, 120),
    descriptionLen: description.length,
    deliverablesLen: deliverables.length,
    due_date,
    stage,
    dueRaw: dueRaw != null ? previewText(dueRaw, 80) : null,
  });

  return {
    data: {
      title,
      description,
      deliverables,
      due_date,
      stage,
      raw_model_text: aiText,
    },
    error: null,
  };
}

/**
 * Read quest fields + adventurer names/capabilities; pick one adventurer (AI-assisted).
 *
 * @param {string} userId
 * @param {{
 *   quest: { title?: unknown, description?: unknown, deliverables?: unknown },
 *   adventurers: Array<{ id: string, name: string, capabilities?: unknown, skill_books?: unknown }>,
 *   client: import("@/libs/council/database/types.js").DatabaseClient
 * }} opts
 */
export async function findAdventurerForQUest(userId, { quest, adventurers, client }) {
  const roster = Array.isArray(adventurers) ? adventurers : [];
  if (roster.length === 0) {
    return { data: null, error: new Error("No adventurers on roster.") };
  }

  const qTitle = String(quest?.title ?? "").trim() || "(untitled)";
  const qDesc = String(quest?.description ?? "").trim();
  const qDel = deliverablesToText(quest?.deliverables);

  const brief = roster.map((a) => {
    const cap =
      typeof a.capabilities === "string"
        ? a.capabilities
        : a.capabilities != null
          ? JSON.stringify(a.capabilities)
          : "";
    const books = Array.isArray(a.skill_books) ? a.skill_books.join(", ") : "";
    return {
      adventurer_id: a.id,
      name: a.name,
      capabilities_plain: cap,
      skill_books: books,
    };
  });

  const prompt = `You match guild quests to adventurers.

Quest:
Title: ${qTitle}
Description: ${qDesc || "—"}
Deliverables: ${qDel || "—"}

Adventurers (pick exactly one by id):
${JSON.stringify(brief, null, 2)}

Reply with ONLY: {"adventurer_id":"<uuid>"} using one of the listed adventurer_id values.`;

  let aiText = "";
  try {
    const out = await runDungeonMasterChat({
      userId,
      messages: [{ role: "user", content: prompt }],
      model: undefined,
      client,
    });
    aiText = out.text;
  } catch (err) {
    return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
  }

  const parsed = extractJsonObject(aiText);
  const id =
    parsed && typeof parsed.adventurer_id === "string"
      ? parsed.adventurer_id.trim()
      : parsed && typeof parsed.assignee_id === "string"
        ? parsed.assignee_id.trim()
        : "";

  const picked = id ? roster.find((a) => a.id === id) : null;
  if (!picked) {
    return {
      data: null,
      error: new Error('Model did not return a valid {"adventurer_id":"..."} for a listed adventurer.'),
    };
  }

  return { data: { adventurer_id: picked.id, name: picked.name }, error: null };
}

/**
 * @param {unknown} parsed
 * @returns {{ result: unknown, msg: string } | null}
 */
function normalizeSelectAdventurerConclusion(parsed) {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const o = /** @type {Record<string, unknown>} */ (parsed);
  if (!("result" in o)) return null;
  const msg = o.msg != null ? String(o.msg).trim() : "";
  if (!msg) return null;
  return { result: o.result, msg };
}

function selectResultMeansNoMatch(result) {
  if (result === false) return true;
  if (result === "false") return true;
  if (typeof result === "string" && result.trim().toLowerCase() === "false") return true;
  return false;
}

/**
 * Loads roster (dynamic import to avoid skill_book ↔ adventurer cycle), runs AI pick.
 *
 * @param {string} userId
 * @param {{
 *   quest: Record<string, unknown>,
 *   client: import("@/libs/council/database/types.js").DatabaseClient
 * }} opts
 * @returns {Promise<{ data: { result: false | { id: string, name: string }, msg: string, meta: { prompt: string, modelText: string } } | null, error: Error | null }>}
 */
export async function selectAdventurer(userId, { quest, client }) {
  const questRow = quest && typeof quest === "object" ? quest : null;
  const questId = questRow?.id;
  const initialRequest =
    String(questRow?.description ?? "").trim() || String(questRow?.title ?? "").trim();

  if (!questId || typeof questId !== "string") {
    return { data: null, error: new Error("selectAdventurer: quest.id is required") };
  }

  if (initialRequest.length < 3) {
    return { data: null, error: new Error("selectAdventurer: request text is too short.") };
  }

  const { listAdventurers } = await import("@/libs/proving_grounds/server.js");
  const { data: roster, error: rosterErr } = await listAdventurers(userId, { client });
  if (rosterErr) {
    return { data: null, error: rosterErr };
  }

  const rosterArr = Array.isArray(roster) ? roster : [];
  const brief = rosterArr.map((a) => ({
    id: a.id,
    name: a.name,
    capabilities:
      typeof a.capabilities === "string"
        ? a.capabilities
        : a.capabilities != null
          ? JSON.stringify(a.capabilities)
          : "",
    skill_books: Array.isArray(a.skill_books) ? a.skill_books.join(", ") : "",
    backstory: typeof a.backstory === "string" ? a.backstory : "",
  }));

  const prompt = `You match a NEW guild request to at most one adventurer on the roster (capabilities + name + id).

User request (raw):
${initialRequest}

Roster — each entry has "id" (UUID), "name", and "capabilities" (plain text). Copy id and name EXACTLY from this list:
${JSON.stringify(brief, null, 2)}

Reply with ONLY one JSON object (no markdown, no prose):

If one adventurer is a good match:
{
  "result": { "id": "<uuid from roster>", "name": "<exact name from roster>" },
  "msg": "<brief rationale>"
}

If NONE are a good match:
{
  "result": false,
  "msg": "<brief rationale why no one fits>"
}

Rules:
- "msg" must be a non-empty string.
- "result" is either an object with both "id" and "name" from the roster, or boolean false (or the string "false").`;

  if (rosterArr.length === 0) {
    const msg = "No adventurers on roster; cannot assign without recruitment.";
    return {
      data: {
        result: false,
        msg,
        meta: { prompt, modelText: "" },
      },
      error: null,
    };
  }

  let aiText = "";
  try {
    const out = await runDungeonMasterChat({
      userId,
      messages: [{ role: "user", content: prompt }],
      model: undefined,
      client,
    });
    aiText = out.text;
  } catch (err) {
    return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
  }

  const parsed = extractJsonObject(aiText);
  const conclusion = normalizeSelectAdventurerConclusion(parsed);

  if (!conclusion) {
    return {
      data: null,
      error: new Error(
        'selectAdventurer: model did not return valid JSON with "result" and non-empty "msg".',
      ),
    };
  }

  const meta = { prompt, modelText: aiText };

  if (selectResultMeansNoMatch(conclusion.result)) {
    return {
      data: { result: false, msg: conclusion.msg, meta },
      error: null,
    };
  }

  const resObj =
    conclusion.result && typeof conclusion.result === "object" && !Array.isArray(conclusion.result)
      ? /** @type {Record<string, unknown>} */ (conclusion.result)
      : null;
  const id =
    resObj && typeof resObj.id === "string"
      ? resObj.id.trim()
      : resObj && typeof resObj.adventurer_id === "string"
        ? resObj.adventurer_id.trim()
        : "";

  const picked = id ? rosterArr.find((a) => a.id === id) : null;
  if (!picked) {
    return {
      data: null,
      error: new Error("selectAdventurer: model id is not on the roster."),
    };
  }

  const nameFromModel = resObj && typeof resObj.name === "string" ? resObj.name.trim() : "";
  let msg = conclusion.msg;
  if (nameFromModel && nameFromModel !== picked.name) {
    msg = `${conclusion.msg} (model name "${nameFromModel}" normalized to roster name "${picked.name}")`;
  }

  return {
    data: {
      result: { id: picked.id, name: picked.name },
      msg,
      meta,
    },
    error: null,
  };
}

/**
 * @param {string} userId
 * @param {{
 *   initialRequest: string,
 *   adventurerName: string,
 *   client: import("@/libs/council/database/types.js").DatabaseClient
 * }} opts
 */
export async function interpretIdea(userId, { initialRequest, adventurerName, client }) {
  const req = String(initialRequest ?? "").trim();
  const adv = String(adventurerName ?? "").trim();
  if (req.length < 3) {
    return { data: null, error: new Error("Initial request is too short.") };
  }
  if (!adv) {
    return { data: null, error: new Error("Adventurer name is required for interpretIdea.") };
  }

  const prompt = `You convert a user's raw request into a structured guild quest for one adventurer who will execute it.

Chosen adventurer (by name): ${adv}

User request:
${req}

Respond with ONLY one JSON object (no prose) using exactly these keys:
{
  "title": "verb-first short title — REQUIRED",
  "description": "REQUIRED — clear narrative of the work, what success looks like, and that ${adv} is responsible for delivery",
  "deliverables": "REQUIRED — concrete definition of what must be submitted (string, or array of strings if multiple)",
  "due_date": "ISO 8601 datetime or null if unknown"
}

Rules:
- title must be non-empty.
- description must explicitly describe the deliverable and name/adscribe the work to ${adv}.
- deliverables must be non-empty (string or non-empty array of strings).`;

  let aiText = "";
  try {
    const out = await runDungeonMasterChat({
      userId,
      messages: [{ role: "user", content: prompt }],
      model: undefined,
      client,
    });
    aiText = out.text;
  } catch (err) {
    return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
  }

  const parsed = extractJsonObject(aiText);
  if (!parsed || typeof parsed.title !== "string" || String(parsed.title).trim() === "") {
    return { data: null, error: new Error("Model did not return valid interpretIdea JSON (title required).") };
  }

  const title = String(parsed.title).trim();
  const description = parsed.description != null ? String(parsed.description).trim() : "";
  if (!description) {
    return { data: null, error: new Error("interpretIdea: description is required.") };
  }

  const deliverables = deliverablesToText(parsed.deliverables ?? parsed.deliverable);
  if (!deliverables) {
    return { data: null, error: new Error("interpretIdea: deliverables are required.") };
  }

  const dueRaw = parsed.due_date ?? parsed.dueDate;
  const due_date = parseDueDateIso(dueRaw);

  return {
    data: {
      title,
      description,
      deliverables,
      due_date,
      raw_model_text: aiText,
    },
    error: null,
  };
}

const questmaster = {
  definition,
  planRequestToQuest,
  findAdventurerForQUest,
  selectAdventurer,
  interpretIdea,
};

export default questmaster;
