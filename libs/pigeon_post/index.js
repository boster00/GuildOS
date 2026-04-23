/**
 * Pigeon Post domain — pending pigeon letters across quests.
 */
import { database } from "@/libs/council/database";
import { publicTables } from "@/libs/council/publicTables";
import { pigeonLetterHasPendingWork } from "./letterSteps.js";

/** Legacy constant — kept for callers that imported this name; now only used as a display key. */
export const PIGEON_POST_ITEM_KEY = "pigeon_letters";

export { normalizePigeonLetterSteps, pigeonLetterHasPendingWork } from "./letterSteps.js";

/**
 * Pending pigeon letters across all quests for this owner (any stage).
 * Source: `pigeon_letters` table rows with status='pending'.
 * @param {string} userId
 * @returns {Promise<Array<{ questId: string, questTitle: string, questStage: string, letters: object[] }>>}
 */
export async function getPendingPigeonLetters(userId) {
  const db = await database.init("service");

  // Load quest titles/stages for context
  const { data: quests } = await db
    .from(publicTables.quests)
    .select("id, title, stage")
    .eq("owner_id", userId);

  const questLookup = new Map();
  for (const q of quests || []) questLookup.set(q.id, q);

  /** @type {Map<string, { questId: string, questTitle: string, questStage: string, letters: object[] }>} */
  const byQuest = new Map();

  // Pending pigeon letters from the dedicated table
  const { data: rows, error: plErr } = await db
    .from(publicTables.pigeonLetters)
    .select("id, quest_id, payload, channel, metadata")
    .eq("owner_id", userId)
    .eq("status", "pending");

  if (!plErr && rows) {
    for (const row of rows) {
      const qid = row.quest_id;
      const payload = row.payload && typeof row.payload === "object" ? row.payload : {};
      const letter = {
        ...payload,
        letterId: row.id,
        questId: qid,
        channel: row.channel,
      };
      // Filter out letters whose steps already have delivered items (using item key).
      // After the items-table migration, we no longer cross-reference JSONB inventory here;
      // the letter's own `status` column is the source of truth.
      if (!pigeonLetterHasPendingWork(letter, new Set())) continue;
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

export async function writePigeonLetter(userId, { questId, channel, payload }) {
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
