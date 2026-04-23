/**
 * Pigeon weapon — create pigeon letters (browser action packages) and deliver results to quest items.
 *
 * Storage:
 * - Letters live in the `pigeon_letters` table (status, payload, quest_id).
 * - Delivered results become rows in the `items` table (upsert on quest_id + item_key).
 */

export const toc = {
  buildPigeonLetterPayload: "Build a single-step pigeon letter payload (legacy shape).",
  buildPigeonLetterFromPartials: "Build a multi-step pigeon letter from an array of action partials.",
  replacePigeonLetters: "Replace pending pigeon letters for a quest with one new multi-step letter.",
  writePigeonLetter: "Convenience: replace pigeon letters with a single letter.",
  deliverPigeonResult: "Upsert delivered items into the items table and mark the pigeon letter completed.",
};
import { randomUUID } from "node:crypto";
import { writeItem, recordQuestComment } from "@/libs/quest/index.js";
import { publicTables } from "@/libs/council/publicTables";
import { database } from "@/libs/council/database";

/** Compat constant used by pigeon_post for filtering. */
export const PIGEON_LETTERS_ITEM_KEY = "pigeon_letters";

/**
 * Build one stored letter object (single-step legacy shape).
 * @param {string} questId
 * @param {{ action?: string, selector?: string, item?: string, url?: string }} letter
 */
export function buildPigeonLetterPayload(questId, letter) {
  const payload = {
    letterId: randomUUID(),
    action: String(letter?.action ?? "obtainText"),
    selector: String(letter?.selector ?? ""),
    item: String(letter?.item ?? ""),
    questId,
    createdAt: new Date().toISOString(),
  };
  const u = letter?.url != null ? String(letter.url).trim() : "";
  if (u) payload.url = u;
  return payload;
}

/**
 * One pigeon letter with a stack of steps; Browserclaw runs steps in order and POSTs one delivery.
 * @param {string} questId
 * @param {Array<Record<string, unknown>>} partials
 */
export function buildPigeonLetterFromPartials(questId, partials) {
  const list = Array.isArray(partials) ? partials : [];
  const steps = [];
  for (const p of list) {
    if (!p || typeof p !== "object" || Array.isArray(p)) continue;
    const action = String(p.action ?? "obtainText");
    const selector = String(p.selector ?? "");
    const item = String(p.item ?? "").trim();
    if (!item) continue;
    const u = p.url != null ? String(p.url).trim() : "";
    const step = { ...p, action, selector, item };
    if (u) step.url = u;
    else delete step.url;
    steps.push(step);
  }
  return { letterId: randomUUID(), questId, steps, createdAt: new Date().toISOString() };
}

/**
 * Replace pending pigeon letters for a quest with one multi-step letter.
 * Writes to the pigeon_letters TABLE (status=pending). Deletes existing pending letters for the quest first.
 * @param {string} questId
 * @param {Array<Record<string, unknown>>} partials
 */
export async function replacePigeonLetters(questId, partials, { client: injected } = {}) {
  const db = injected ?? (await database.init("service"));
  const list = Array.isArray(partials) ? partials : [];

  // Clear existing pending letters for this quest
  await db.from(publicTables.pigeonLetters).delete().eq("quest_id", questId).eq("status", "pending");

  if (list.length === 0) return { data: [], error: null };

  const letter = buildPigeonLetterFromPartials(questId, list);
  if (!letter.steps.length) {
    return { data: null, error: new Error("No valid pigeon steps (each step needs a non-empty item key).") };
  }

  // Resolve owner_id from the quest
  const { data: quest, error: qErr } = await db
    .from(publicTables.quests)
    .select("owner_id")
    .eq("id", questId)
    .single();
  if (qErr || !quest) return { data: null, error: qErr || new Error("Quest not found") };

  const { data: row, error } = await db
    .from(publicTables.pigeonLetters)
    .insert({
      quest_id: questId,
      owner_id: quest.owner_id,
      channel: "browserclaw",
      status: "pending",
      payload: letter,
    })
    .select("id")
    .single();
  if (error) return { data: null, error };

  return { data: [{ ...letter, letterId: row.id }], error: null };
}

/**
 * Single-letter shorthand.
 * @deprecated Prefer replacePigeonLetters with a full browserActions array.
 */
export async function writePigeonLetter(questId, letter) {
  return replacePigeonLetters(questId, [letter]);
}

function extractItemFields(payload) {
  if (payload == null) return { url: null, description: null };
  if (typeof payload === "string") return { url: null, description: payload };
  if (typeof payload !== "object") return { url: null, description: String(payload) };
  return {
    url: typeof payload.url === "string" ? payload.url : null,
    description: typeof payload.description === "string" ? payload.description : JSON.stringify(payload),
  };
}

/**
 * Pigeon delivered — upsert items into public.items, mark the letter completed, and log a quest comment.
 * @param {string} questId
 * @param {Record<string, unknown>} items — map of { item_key: payload }
 * @param {{ client?: object, letterId?: string }} [opts]
 */
export async function deliverPigeonResult(questId, items, { client: injected, letterId } = {}) {
  const db = injected ?? (await database.init("service"));
  const lid = letterId != null ? String(letterId).trim() : "";

  const delivered = [];
  const failed = [];
  for (const [key, value] of Object.entries(items || {})) {
    const { url, description } = extractItemFields(value);
    const { error } = await writeItem(
      { questId, item_key: key, url, description, source: "pigeon_delivery" },
      { client: db },
    );
    if (error) failed.push({ key, error: error.message });
    else delivered.push(key);
  }

  if (lid && failed.length === 0 && delivered.length > 0) {
    const { error: plErr } = await db
      .from(publicTables.pigeonLetters)
      .update({ status: "completed", result: items })
      .eq("id", lid);
    if (plErr) console.warn("[pigeon-post:deliver] pigeon_letters update failed", plErr.message);
  }

  await recordQuestComment(
    questId,
    {
      source: "pigeon_post",
      action: "deliver",
      summary: failed.length === 0
        ? `Delivered ${delivered.length} item(s) via pigeon post.`
        : `Pigeon delivery partial: ${delivered.length} ok, ${failed.length} failed.`,
      detail: { letterId: lid, delivered, failed },
    },
    { client: db },
  );

  return {
    data: { delivered, failed },
    error: failed.length > 0 && delivered.length === 0 ? new Error("All items failed") : null,
  };
}
