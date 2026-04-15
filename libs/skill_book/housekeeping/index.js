/**
 * Housekeeping skill book — list active quests and escalate blocked work.
 */
import { skillActionOk, skillActionErr } from "@/libs/skill_book/actionResult.js";

const ACTIVE_STAGES = new Set(["execute", "escalated", "review", "closing"]);

/** @param {unknown} v @returns {"high"|"medium"|"low"} */
function normalizePriority(v) {
  const s = String(v ?? "medium").trim().toLowerCase();
  if (s === "high" || s === "low" || s === "medium") return s;
  return "medium";
}

/** @param {Record<string, unknown>} row */
function priorityFromQuestRow(row) {
  const direct = row.priority;
  if (typeof direct === "string" && direct.trim()) return normalizePriority(direct);
  const sc = row.success_criteria;
  if (sc && typeof sc === "object" && !Array.isArray(sc) && "priority" in sc) {
    return normalizePriority(/** @type {{ priority?: unknown }} */ (sc).priority);
  }
  return "medium";
}

/** @param {"high"|"medium"|"low"} p */
function priorityRank(p) {
  if (p === "high") return 0;
  if (p === "medium") return 1;
  return 2;
}

async function resolveDbClient() {
  const { getAdventurerExecutionContext } = await import("@/libs/adventurer/advance.js");
  const ctx = getAdventurerExecutionContext()?.client;
  if (ctx) return ctx;
  const { database } = await import("@/libs/council/database");
  return database.init("service");
}

export const skillBook = {
  id: "housekeeping",
  title: "Housekeeping",
  description: "List active quests by priority and escalate blocked quests.",
  steps: [],
  toc: {
    getActiveQuests: {
      description:
        "Return quests owned by the user (or filtered by assignee) in active stages (execute, escalated, review, closing), sorted by priority high→medium→low then updated_at.",
      input: {
        assignee_name: "string — optional; when set, filter by assigned_to",
      },
      output: {
        quests: "string — JSON array of { id, title, stage, priority, updated_at, assigned_to }",
      },
    },
    escalateBlockedQuest: {
      description: "Move a quest to escalated and record a system comment with the blocker reason.",
      input: {
        quest_id: "string — quest UUID",
        reason: "string — non-empty explanation of the blocker",
      },
      output: {
        quest_id: "string",
        stage: "string — escalated",
      },
    },
  },
};

/**
 * @param {string} userId
 * @param {Record<string, unknown>} input
 */
export async function getActiveQuests(userId, input) {
  const inObj = typeof input === "object" && input ? input : {};
  const assigneeFilter = String(inObj.assignee_name || inObj.assigneeName || "").trim();

  if (!userId) return skillActionErr("userId is required.");

  let client;
  try {
    client = await resolveDbClient();
  } catch (e) {
    return skillActionErr(e instanceof Error ? e.message : String(e));
  }

  const { getQuestsForOwner } = await import("@/libs/quest");
  const { data: rows, error } = await getQuestsForOwner(userId, { client });
  if (error) return skillActionErr(error.message || String(error));

  const list = Array.isArray(rows) ? rows : [];
  const filtered = list.filter((r) => {
    if (!r || typeof r !== "object") return false;
    const stage = String(/** @type {{ stage?: unknown }} */ (r).stage || "");
    if (!ACTIVE_STAGES.has(stage)) return false;
    if (assigneeFilter) {
      const at = String(/** @type {{ assigned_to?: unknown }} */ (r).assigned_to || "").trim();
      if (at !== assigneeFilter) return false;
    }
    return true;
  });

  const enriched = filtered.map((r) => {
    const row = /** @type {Record<string, unknown>} */ (r);
    const priority = priorityFromQuestRow(row);
    return {
      id: String(row.id || ""),
      title: String(row.title || ""),
      stage: String(row.stage || ""),
      priority,
      updated_at: row.updated_at != null ? String(row.updated_at) : "",
      assigned_to: row.assigned_to != null ? String(row.assigned_to) : "",
    };
  });

  enriched.sort((a, b) => {
    const pr = priorityRank(/** @type {"high"|"medium"|"low"} */ (a.priority)) -
      priorityRank(/** @type {"high"|"medium"|"low"} */ (b.priority));
    if (pr !== 0) return pr;
    return String(b.updated_at).localeCompare(String(a.updated_at));
  });

  return skillActionOk(
    { quests: JSON.stringify(enriched) },
    `${enriched.length} active quest(s) for owner.`,
  );
}

/**
 * @param {string} userId
 * @param {Record<string, unknown>} input
 */
export async function escalateBlockedQuest(userId, input) {
  const inObj = typeof input === "object" && input ? input : {};
  const questId = String(inObj.quest_id || inObj.questId || "").trim();
  const reason = String(inObj.reason || inObj.blocker || "").trim();

  if (!questId) return skillActionErr("quest_id is required.");
  if (!reason) return skillActionErr("reason is required (non-empty blocker explanation).");

  let client;
  try {
    client = await resolveDbClient();
  } catch (e) {
    return skillActionErr(e instanceof Error ? e.message : String(e));
  }

  const { getQuestForOwner, updateQuest, recordQuestComment } = await import("@/libs/quest");
  const { data: quest, error: qErr } = await getQuestForOwner(questId, userId, { client });
  if (qErr || !quest) return skillActionErr(qErr?.message || "Quest not found or not owned by this user.");

  const stage = String(quest.stage || "");
  if (!ACTIVE_STAGES.has(stage)) {
    return skillActionErr(`Cannot escalate: quest stage "${stage}" is not an active pipeline stage.`);
  }

  const { error: upErr } = await updateQuest(questId, { stage: "escalated" }, { client });
  if (upErr) return skillActionErr(upErr.message || String(upErr));

  await recordQuestComment(
    questId,
    {
      source: "housekeeping",
      action: "escalateBlockedQuest",
      summary: `Escalated: ${reason.slice(0, 1800)}`,
      detail: { previous_stage: stage },
    },
    { client },
  );

  return skillActionOk({ quest_id: questId, stage: "escalated" }, "Quest moved to escalated.");
}

const housekeeping = { definition: skillBook, skillBook, getActiveQuests, escalateBlockedQuest };
export default housekeeping;
