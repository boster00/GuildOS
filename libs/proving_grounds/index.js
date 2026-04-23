/**
 * Proving grounds — invoke one skill-book action under the adventurer execution context (dev / QA).
 * Dependencies: `./server.js`, `@/libs/adventurer/advance.js`, `@/libs/quest`, `@/libs/skill_book`.
 */
import { runWithAdventurerExecutionContext } from "@/libs/adventurer/advance.js";
import { selectAdventurerForOwner } from "@/libs/council/database/serverAdventurer.js";
import { getDefaultDraft, mergeDraftPatch, normalizeAdventurerRow } from "@/libs/proving_grounds/ui.js";
import { getQuestForOwner } from "@/libs/quest";
import { getSkillBook, listSkillBooksForLibrary, filterValidSkillBookNames } from "@/libs/skill_book";

export function listSkillBooksForProvingGrounds() {
  return listSkillBooksForLibrary();
}

/**
 * Owner-scoped adventurer row (normalized). Same shape as the former `libs/adventurer` export.
 * @param {string} adventurerId
 * @param {string} ownerId
 * @param {{ client?: import("@/libs/council/database/types.js").DatabaseClient }} [opts]
 */
export async function getAdventurerForOwner(adventurerId, ownerId, opts = {}) {
  const { data, error } = await selectAdventurerForOwner(adventurerId, ownerId, opts);
  if (error) {
    return { error };
  }
  if (!data) {
    return { error: new Error("Adventurer not found.") };
  }
  return { data: normalizeAdventurerRow(data) };
}

/**
 * Table-shaped draft from a DB row (commission form).
 * @param {Record<string, unknown> | null | undefined} row
 */
export function adventurerRowToDraft(row) {
  const base = getDefaultDraft();
  if (!row || typeof row !== "object") return base;
  const r = normalizeAdventurerRow(row);
  return mergeDraftPatch(base, {
    name: r.name ?? "",
    system_prompt: r.system_prompt ?? "",
    skill_books: Array.isArray(r.skill_books) ? r.skill_books : [],
    backstory: r.backstory ?? "",
    capabilities: r.capabilities ?? "",
  });
}

/**
 * @param {Record<string, unknown> | null | undefined} row
 * @param {{ draft?: Record<string, unknown> | null, actionInput?: Record<string, unknown> | null }} [overlays]
 * @returns {Record<string, unknown>}
 */
function mergeProvingGroundsIntoAdventurerProfile(row, overlays = {}) {
  const { draft, actionInput } = overlays;
  const base = normalizeAdventurerRow(row);
  if (!draft && !actionInput) return base;

  /** @type {Record<string, unknown>} */
  let out = { ...base };

  if (draft && typeof draft === "object") {
    const sb = draft.skill_books ?? draft.skillBooks;
    const skillBooksFiltered = Array.isArray(sb) ? filterValidSkillBookNames(sb) : out.skill_books;

    out = {
      ...out,
      name: draft.name != null ? String(draft.name).trim() : out.name,
      system_prompt:
        draft.system_prompt != null || draft.systemPrompt != null
          ? String(draft.system_prompt ?? draft.systemPrompt ?? "").trim()
          : String(out.system_prompt ?? ""),
      skill_books: Array.isArray(sb) ? skillBooksFiltered : Array.isArray(out.skill_books) ? out.skill_books : [],
      backstory: draft.backstory != null ? String(draft.backstory).trim() || null : out.backstory,
      capabilities: draft.capabilities != null ? String(draft.capabilities).trim() : out.capabilities,
    };
  }

  if (actionInput && typeof actionInput === "object" && !Array.isArray(actionInput)) {
    const prevPg =
      out.proving_grounds && typeof out.proving_grounds === "object" && !Array.isArray(out.proving_grounds)
        ? /** @type {Record<string, unknown>} */ (out.proving_grounds)
        : {};
    out.proving_grounds = { ...prevPg, actionInput: { ...actionInput } };
  }

  return out;
}

/**
 * Map DB quest row to the shape used by skill actions. After the items-table migration,
 * inventory is loaded from the items table separately (via loadQuest in libs/quest) and
 * passed in as `row.items`. This function wraps it into the { key, value, item_key, payload } shape.
 * @param {Record<string, unknown>} row
 */
function normalizeQuestRowForAdventurer(row) {
  if (!row || typeof row !== "object") return row;
  const itemsArr = Array.isArray(row.items) ? row.items : [];
  const inv = itemsArr.map((it) => ({
    key: it.item_key,
    value: { url: it.url, description: it.description, source: it.source },
    item_key: it.item_key,
    payload: { url: it.url, description: it.description, source: it.source },
  }));
  return { ...row, inventory: inv };
}

/**
 * @param {{ adventurerId: string, ownerId: string, client: import("@/libs/council/database/types.js").DatabaseClient }} opts
 */
export async function getAdventurerDraftForOwner({ adventurerId, ownerId, client }) {
  const { data, error } = await selectAdventurerForOwner(adventurerId, ownerId, { client });
  if (error || !data) {
    return { error: error || new Error("Adventurer not found.") };
  }
  const normalized = normalizeAdventurerRow(data);
  return { data: { id: normalized.id, draft: adventurerRowToDraft(data), row: normalized } };
}

/**
 * @param {{ questId: string, ownerId: string, client: import("@/libs/council/database/types.js").DatabaseClient }} opts
 */
export async function getQuestContextForOwner({ questId, ownerId, client }) {
  const { data, error } = await getQuestForOwner(questId, ownerId, { client });
  if (error || !data) {
    return { error: error || new Error("Quest not found.") };
  }
  const quest = normalizeQuestRowForAdventurer(data);
  return {
    data: {
      quest,
      preview: {
        id: quest.id,
        title: quest.title != null ? String(quest.title) : "",
        stage: quest.stage != null ? String(quest.stage) : "",
      },
    },
  };
}

const RESERVED_SKILL_BOOK_KEYS = new Set([
  "id",
  "title",
  "description",
  "steps",
  "toc",
  "__proto__",
  "constructor",
  "prototype",
]);

/**
 * @param {unknown} out
 * @returns {{ ok: boolean, msg: string, items: Record<string, unknown> }}
 */
function normalizeRunEnvelope(out) {
  if (out && typeof out === "object" && "ok" in out) {
    const o = /** @type {{ ok: boolean, msg?: string, items?: unknown }} */ (out);
    const items =
      o.items && typeof o.items === "object" && !Array.isArray(o.items)
        ? /** @type {Record<string, unknown>} */ (o.items)
        : {};
    return {
      ok: Boolean(o.ok),
      msg: typeof o.msg === "string" ? o.msg : o.ok ? "" : "Action failed",
      items,
    };
  }
  if (out && typeof out === "object" && "error" in out && out.error) {
    const err = /** @type {{ error: unknown }} */ (out).error;
    return {
      ok: false,
      msg: err instanceof Error ? err.message : String(err),
      items: {},
    };
  }
  if (out && typeof out === "object" && "data" in out && !("ok" in out)) {
    const d = /** @type {{ data?: unknown }} */ (out).data;
    if (d != null && typeof d === "object" && !Array.isArray(d)) {
      return { ok: true, msg: "", items: /** @type {Record<string, unknown>} */ (d) };
    }
    return { ok: true, msg: "", items: d === undefined ? {} : { _value: d } };
  }
  return { ok: true, msg: "", items: out !== undefined ? { _result: out } : {} };
}

/**
 * @param {{
 *   userId: string,
 *   client: import("@/libs/council/database/types.js").DatabaseClient,
 *   skillBookId: string,
 *   actionName: string,
 *   payload?: Record<string, unknown>,
 *   adventurerRow: Record<string, unknown>,
 *   draft?: Record<string, unknown> | null,
 *   questRow?: Record<string, unknown> | null,
 * }} opts
 */
export async function runProvingGroundsAction({
  userId,
  client,
  skillBookId,
  actionName,
  payload,
  adventurerRow,
  draft,
  questRow,
}) {
  const book = getSkillBook(skillBookId);
  if (!book) {
    return { ok: false, msg: `Unknown skill book: ${skillBookId}`, items: {} };
  }
  if (!actionName || RESERVED_SKILL_BOOK_KEYS.has(actionName)) {
    return { ok: false, msg: "Invalid or reserved action name.", items: {} };
  }
  const fn = book[actionName];
  if (typeof fn !== "function") {
    return {
      ok: false,
      msg: `No callable action "${actionName}" on skill book "${skillBookId}".`,
      items: {},
    };
  }
  if (!adventurerRow || typeof adventurerRow !== "object") {
    return { ok: false, msg: "adventurerRow is required.", items: {} };
  }
  const profile = mergeProvingGroundsIntoAdventurerProfile(adventurerRow, {
    draft: draft ?? undefined,
    actionInput: payload && typeof payload === "object" && !Array.isArray(payload) ? payload : undefined,
  });
  const base = payload && typeof payload === "object" && !Array.isArray(payload) ? { ...payload } : {};
  const questNormalized =
    questRow && typeof questRow === "object" ? normalizeQuestRowForAdventurer(questRow) : null;
  /** Same `guildos` shape as executePlan: merged profile (fresh draft + action KV on profile.proving_grounds). */
  const enrichedPayload = {
    ...base,
    guildos: {
      quest: questNormalized,
      profile,
    },
  };
  try {
    const out = await runWithAdventurerExecutionContext({ userId, client }, async () =>
      fn(enrichedPayload),
    );
    return normalizeRunEnvelope(out);
  } catch (e) {
    return { ok: false, msg: e instanceof Error ? e.message : String(e), items: {} };
  }
}
