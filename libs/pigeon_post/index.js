/**
 * Pigeon Post domain — pending pigeon letters across quests.
 */
import { database } from "@/libs/council/database";
import { publicTables } from "@/libs/council/publicTables";
// [items workflow migration] pigeon_letters currently piggybacks on quests.inventory JSONB via a reserved key.
// After migration, pigeon letters should live in their own table or be ported to quest_items with a `kind=pigeon_letter` column — decide when the migration starts.
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

/**
 * Insert a new pending pigeon letter into the `pigeon_letters` table.
 * @param {string} userId
 * @param {{ questId: string, channel: string, payload: object }} opts
 * @returns {Promise<{ data: object|null, error: object|null }>}
 */
/**
 * Review queue — pending review items for this owner.
 * @param {string} userId
 * @returns {Promise<object[]>} Flat array of review items with quest context
 */
export async function searchReviewItems(userId) {
  const db = await database.init("service");
  const { data, error } = await db
    .from("pigeon_letters")
    .select("id, quest_id, payload, metadata, created_at")
    .eq("owner_id", userId)
    .eq("channel", "review")
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error || !data?.length) return [];

  // Fetch quest titles for context
  const questIds = [...new Set(data.map((r) => r.quest_id).filter(Boolean))];
  const { data: quests } = questIds.length
    ? await db
        .from(publicTables.quests)
        .select("id, title, stage")
        .in("id", questIds)
    : { data: [] };
  const qMap = new Map((quests || []).map((q) => [q.id, q]));

  return data.map((row) => ({
    id: row.id,
    questId: row.quest_id,
    questTitle: qMap.get(row.quest_id)?.title ?? "",
    questStage: qMap.get(row.quest_id)?.stage ?? "",
    payload: row.payload || {},
    metadata: row.metadata || {},
    createdAt: row.created_at,
  }));
}

/**
 * Record a review verdict (approve or reject).
 * @param {string} letterId
 * @param {string} userId
 * @param {{ verdict: "approved"|"rejected", reason?: string }} opts
 */
export async function writeReviewVerdict(letterId, userId, { verdict, reason }) {
  const db = await database.init("service");

  // Verify ownership
  const { data: letter, error: fetchErr } = await db
    .from("pigeon_letters")
    .select("id, quest_id, owner_id, status")
    .eq("id", letterId)
    .single();

  if (fetchErr || !letter) return { error: { message: "Review item not found" } };
  if (letter.owner_id !== userId) return { error: { message: "Not your review item" } };
  if (letter.status !== "pending") return { error: { message: "Already reviewed" } };

  const newStatus = verdict === "approved" ? "completed" : "failed";
  const result = {
    verdict,
    rejection_reason: reason || null,
    reviewed_at: new Date().toISOString(),
  };

  const { error: updateErr } = await db
    .from("pigeon_letters")
    .update({ status: newStatus, result })
    .eq("id", letterId);

  if (updateErr) return { error: updateErr };

  // Record as quest comment
  if (letter.quest_id) {
    await db.from(publicTables.questComments).insert({
      quest_id: letter.quest_id,
      source: "user",
      action: verdict === "approved" ? "approval" : "rejection",
      summary: verdict === "approved"
        ? "Review item approved"
        : `Review item rejected: ${reason || "No reason given"}`,
      detail: { letterId, verdict, reason },
    });
  }

  return { data: { letterId, verdict } };
}

export async function createPigeonLetter(userId, { questId, channel, payload }) {
  const db = await database.init("service");
  const { data, error } = await db
    .from("pigeon_letters")
    .insert({
      quest_id: questId,
      owner_id: userId,
      channel: channel || "browserclaw",
      payload: payload || {},
      status: "pending",
    })
    .select("id, quest_id, channel, payload, status, created_at")
    .single();
  return { data, error };
}
