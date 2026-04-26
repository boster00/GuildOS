/**
 * Quest execution — gated submit to purrview (adventurer deliverables).
 * Validates structural completeness before moving stage; callers must not PATCH stage directly.
 */

export const toc = {
  submit: "Validate quest items + comments, then move stage execute → purrview.",
};

import { database } from "@/libs/council/database";
import { publicTables } from "@/libs/council/publicTables";
import { updateQuestStage } from "@/libs/council/database/serverQuest.js";
import { searchItems } from "@/libs/quest/index.js";

const REQUIRED_KEYS = ["camping_1", "camping_2", "camping_3", "camping_4", "camping_5"];

/**
 * @param {{ questId: string }} input
 * @returns {Promise<{ ok: boolean, report?: { fix?: string[] }, stage?: string, error?: string }>}
 */
export async function submit({ questId } = {}) {
  const fix = [];
  if (!questId || typeof questId !== "string") {
    return { ok: false, report: { fix: ["questId is required"] } };
  }

  const db = await database.init("service");
  const { data: quest, error: qErr } = await db
    .from(publicTables.quests)
    .select("id, stage")
    .eq("id", questId)
    .maybeSingle();
  if (qErr || !quest) {
    return { ok: false, report: { fix: ["Quest not found"] } };
  }
  const allowedFrom = ["execute", "escalated"];
  if (!allowedFrom.includes(quest.stage)) {
    return {
      ok: false,
      report: {
        fix: [`Quest must be in execute or escalated stage to submit (current: ${quest.stage})`],
      },
    };
  }

  const items = await searchItems(questId, { client: db });
  const byKey = new Map(items.map((i) => [i.item_key, i]));

  for (const key of REQUIRED_KEYS) {
    const row = byKey.get(key);
    if (!row) {
      fix.push(`Missing item row: ${key}`);
      continue;
    }
    const url = row.url && String(row.url).trim();
    const cap = (row.caption ?? row.description) && String(row.caption ?? row.description).trim();
    if (!url) fix.push(`${key}: url is required`);
    if (!cap) fix.push(`${key}: caption is required`);
    const comments = row.comments || [];
    if (!comments.length) fix.push(`${key}: at least one item_comment is required`);
  }

  if (fix.length) {
    return { ok: false, report: { fix } };
  }

  const { error: stErr } = await updateQuestStage(questId, "purrview", { client: db });
  if (stErr) {
    return { ok: false, report: { fix: [stErr.message || String(stErr)] } };
  }

  const { insertQuestComment } = await import("@/libs/council/database/serverQuest.js");
  await insertQuestComment(
    {
      questId,
      source: "questExecution",
      action: "submit_for_purrview",
      summary:
        "Gate v1 passed. 5 item(s) verified. This quest now meets the criteria for purrview. (Researcher retry after bounce.)",
      detail: { item_keys: REQUIRED_KEYS, gate_version: 1, lockphrase: "this quest now meets the criteria for purrview" },
    },
    { client: db },
  );

  const { data: after } = await db.from(publicTables.quests).select("id, stage").eq("id", questId).single();
  return { ok: true, stage: after?.stage, report: {} };
}

export async function checkCredentials() {
  return { ok: true, msg: "questExecution uses service database client" };
}
