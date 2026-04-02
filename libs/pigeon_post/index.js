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
 * @param {string} userId
 * @returns {Promise<Array<{ questId: string, questTitle: string, questStage: string, letters: object[] }>>}
 */
export async function getPendingPigeonLetters(userId) {
  const db = await database.init("server");
  const { data: quests, error } = await db
    .from(publicTables.quests)
    .select("id, title, stage, inventory")
    .eq("owner_id", userId);

  if (error || !quests) return [];

  const out = [];
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
    const letters = [];
    for (const letter of rawLetters) {
      if (!letter || typeof letter !== "object") continue;
      if (!pigeonLetterHasPendingWork(letter, keysDelivered)) continue;
      letters.push({ ...letter, questId: quest.id });
    }
    if (letters.length > 0) {
      out.push({
        questId: quest.id,
        questTitle: quest.title ?? "",
        questStage: quest.stage != null ? String(quest.stage) : "",
        letters,
      });
    }
  }
  return out;
}
