/**
 * Pigeon weapon — create pigeon letters (browser action packages) and deliver results to quest inventory.
 */
import { randomUUID } from "node:crypto";
import {
  appendInventoryItem,
  replaceInventoryPigeonLetters,
  recordQuestComment,
  removePigeonLetterInventoryEntries,
} from "@/libs/quest/index.js";
import { PIGEON_LETTERS_KEY } from "@/libs/quest/inventoryMap.js";

export const PIGEON_LETTERS_ITEM_KEY = PIGEON_LETTERS_KEY;

/**
 * Build one stored letter object (inventory `pigeon_letters` entry) — legacy single-step shape.
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
 * One pigeon letter with a stack of steps (single `letterId`); Browserclaw runs steps in order and POSTs one deliver.
 * Each step shallow-merges the partial so extra fields (e.g. `attribute`, `value`) survive in storage and the extension.
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
  return {
    letterId: randomUUID(),
    questId,
    steps,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Replace `inventory.pigeon_letters` with exactly one multi-step letter built from `partials` (or clear when empty).
 * When a step omits `url`, Browserclaw runs that step on the active tab (no navigation).
 * @param {string} questId
 * @param {Array<Record<string, unknown>>} partials
 */
export async function replacePigeonLetters(questId, partials, { client: injected } = {}) {
  const list = Array.isArray(partials) ? partials : [];
  if (list.length === 0) {
    const { error } = await replaceInventoryPigeonLetters(questId, [], { client: injected });
    if (error) return { data: null, error };
    return { data: [], error: null };
  }
  const letter = buildPigeonLetterFromPartials(questId, list);
  if (!letter.steps.length) {
    return { data: null, error: new Error("No valid pigeon steps (each step needs a non-empty item key).") };
  }
  const { error } = await replaceInventoryPigeonLetters(questId, [letter], { client: injected });
  if (error) return { data: null, error };
  return { data: [letter], error: null };
}

/**
 * Replace pigeon letters with a single letter (same as `replacePigeonLetters(questId, [letter])`).
 * @deprecated Prefer {@link replacePigeonLetters} with a full `browserActions` array.
 */
export async function createPigeonLetter(questId, letter) {
  return replacePigeonLetters(questId, [letter]);
}

/**
 * Append delivered items to inventory, remove fulfilled pigeon letter(s), log to quest comments.
 * @param {string} questId
 * @param {Record<string, unknown>} items
 * @param {{ client?: import("@supabase/supabase-js").SupabaseClient, letterId?: string }} [opts]
 *   When `letterId` is set, only that letter is removed from `pigeon_letters`; otherwise removal matches by `item` key.
 */
const DELIVER_LOG = "[pigeon-post:deliver]";

export async function deliverPigeonResult(questId, items, { client: injected, letterId } = {}) {
  const lidIn = letterId != null ? String(letterId).trim() : "";
  console.info(`${DELIVER_LOG} start`, {
    questId,
    letterId: lidIn || undefined,
    itemKeys: Object.keys(items || {}),
  });

  const results = [];
  let firstErr = null;
  for (const [key, value] of Object.entries(items)) {
    const { data: appendData, error } = await appendInventoryItem(
      questId,
      {
        item_key: key,
        payload: value,
        source: "pigeon_delivery",
      },
      { client: injected },
    );
    const ok = !error;
    if (!ok && !firstErr) firstErr = error;
    results.push({ key, ok, error: error?.message });
    if (ok) {
      const inv = appendData?.inventory;
      const keys =
        inv && typeof inv === "object" && !Array.isArray(inv)
          ? Object.keys(inv)
          : [];
      console.info(`${DELIVER_LOG} appendInventoryItem ok`, { questId, item_key: key, inventoryKeysAfter: keys });
    } else {
      console.error(`${DELIVER_LOG} appendInventoryItem failed`, {
        questId,
        item_key: key,
        message: error?.message,
        code: error?.code,
        details: error?.details,
        hint: error?.hint,
      });
    }
  }

  const successfulKeys = results.filter((r) => r.ok).map((r) => r.key);
  const lid = lidIn;
  const allAppendsOk = !firstErr && results.length > 0 && results.every((r) => r.ok);
  if (successfulKeys.length > 0) {
    console.info(`${DELIVER_LOG} removePigeonLetterInventoryEntries`, {
      questId,
      successfulKeys,
      letterIds: lid && allAppendsOk ? [lid] : undefined,
    });
    const { error: remErr, data: remData } = await removePigeonLetterInventoryEntries(
      questId,
      successfulKeys,
      {
        client: injected,
        ...(lid && allAppendsOk ? { letterIds: [lid] } : {}),
      },
    );
    if (remErr) {
      console.error(`${DELIVER_LOG} removePigeonLetterInventoryEntries failed`, {
        questId,
        message: remErr?.message,
        code: remErr?.code,
      });
      if (!firstErr) firstErr = remErr;
    } else {
      const inv = remData?.inventory;
      const pigeon =
        inv && typeof inv === "object" && !Array.isArray(inv) ? inv.pigeon_letters : undefined;
      const pigeonLen = Array.isArray(pigeon) ? pigeon.length : pigeon ? 1 : 0;
      console.info(`${DELIVER_LOG} pigeon_letters after prune`, { questId, pigeonLettersCount: pigeonLen });
    }
  } else {
    console.warn(`${DELIVER_LOG} skip pigeon prune — no inventory keys written successfully`, {
      questId,
      results,
    });
  }

  await recordQuestComment(
    questId,
    {
      source: "pigeon_post",
      action: "deliver",
      summary: `Pigeon delivery: ${successfulKeys.length}/${results.length} item(s) stored; pigeon_letters pruned (${lid ? `letterId ${lid}` : "by item key"}).`,
      detail: { items, results, letterId: lid || undefined },
    },
    { client: injected },
  );

  return { data: results, error: firstErr ?? null };
}
