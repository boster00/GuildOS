/**
 * Pigeon Post domain — pending pigeon letters across quests.
 */
import { database } from "@/libs/council/database";
import { publicTables } from "@/libs/council/publicTables";
import { inventoryRawToMap, PIGEON_LETTERS_KEY } from "@/libs/quest/inventoryMap.js";
import { pigeonLetterHasPendingWork } from "./letterSteps.js";

/** Same as `pigeon_letters` map key; kept for callers that imported this name. */
export const PIGEON_POST_ITEM_KEY = PIGEON_LETTERS_KEY;

export { normalizePigeonLetterSteps, pigeonLetterHasPendingWork } from "./letterSteps.js";

/**
 * Pending pigeon letters across all quests for this owner (any stage).
 * Sources: (1) legacy `quests.inventory` pigeon_letters entries, (2) `pigeon_letters` table rows with status='pending'.
 * @param {string} userId
 * @returns {Promise<Array<{ questId: string, questTitle: string, questStage: string, letters: object[] }>>}
 */
export async function getPendingPigeonLetters(userId) {
  const db = await database.init("service");

  // --- Source 1: legacy inventory-embedded letters ---
  const { data: quests, error } = await db
    .from(publicTables.quests)
    .select("id, title, stage, inventory")
    .eq("owner_id", userId);

  /** @type {Map<string, { questId: string, questTitle: string, questStage: string, letters: object[] }>} */
  const byQuest = new Map();

  if (!error && quests) {
    for (const quest of quests) {
      const map = inventoryRawToMap(quest.inventory);
      const keysDelivered = new Set(Object.keys(map).filter((k) => k !== PIGEON_LETTERS_KEY));
      const pigeonEntry = map[PIGEON_LETTERS_KEY];
      const rawLetters = Array.isArray(pigeonEntry)
        ? pigeonEntry
        : Array.isArray(pigeonEntry?.letters)
          ? pigeonEntry.letters
          : Array.isArray(pigeonEntry?.payload?.letters)
            ? pigeonEntry.payload.letters
            : [];
      for (const letter of rawLetters) {
        if (!letter || typeof letter !== "object") continue;
        if (!pigeonLetterHasPendingWork(letter, keysDelivered)) continue;
        const entry = byQuest.get(quest.id) ?? {
          questId: quest.id,
          questTitle: quest.title ?? "",
          questStage: quest.stage != null ? String(quest.stage) : "",
          letters: [],
        };
        entry.letters.push({ ...letter, questId: quest.id });
        byQuest.set(quest.id, entry);
      }
    }
  }

  // --- Source 2: pigeon_letters table (pending rows) ---
  const { data: rows, error: plErr } = await db
    .from("pigeon_letters")
    .select("id, quest_id, payload, channel, metadata")
    .eq("owner_id", userId)
    .eq("status", "pending");

  if (!plErr && rows) {
    // Build a quest-id → title/stage lookup from already-loaded quests
    const questLookup = new Map();
    if (quests) {
      for (const q of quests) questLookup.set(q.id, q);
    }

    for (const row of rows) {
      const qid = row.quest_id;
      const payload = row.payload && typeof row.payload === "object" ? row.payload : {};
      const letter = {
        ...payload,
        letterId: row.id,
        questId: qid,
        channel: row.channel,
      };

      const entry = byQuest.get(qid) ?? {
        questId: qid,
        questTitle: questLookup.get(qid)?.title ?? "",
        questStage: questLookup.get(qid)?.stage != null ? String(questLookup.get(qid).stage) : "",
        letters: [],
      };
      entry.letters.push(letter);
      byQuest.set(qid, entry);
    }
  }

  return Array.from(byQuest.values()).filter((g) => g.letters.length > 0);
}
