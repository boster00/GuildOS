/**
 * Housekeeping skill book — list active quests and escalate blocked work.
 */
import { skillActionOk, skillActionErr } from "@/libs/skill_book/actionResult.js";

/** Stages a worker can run or advance (default for getActiveQuests). */
const RUNNABLE_STAGES = new Set(["execute", "review", "closing"]);

/** Stages that may appear when include_escalated is true (Questmaster / full queue view). */
const EXPANDED_ACTIVE_STAGES = new Set(["execute", "escalated", "review", "closing"]);

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
        "Return quests owned by the user in runnable stages (execute, review, closing) by default — sorted by priority high→medium→low then updated_at. Set include_escalated: true to also list escalated (blocked) quests for Questmaster dashboards.",
      input: {
        assignee_name: "string — optional; when set, filter by assigned_to",
        include_escalated: "boolean — optional; when true, include stage escalated in the list",
      },
      output: {
        quests: "string — JSON array of { id, title, stage, priority, updated_at, assigned_to }",
        escalated_count: "string — when include_escalated is false: count of escalated quests for same owner (same filters), for visibility",
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
  const includeEscalated =
    inObj.include_escalated === true || inObj.include_escalated === "true" || inObj.includeEscalated === true;

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
  const allowedStages = includeEscalated ? EXPANDED_ACTIVE_STAGES : RUNNABLE_STAGES;

  const sameAssignee = (r) => {
    if (!assigneeFilter) return true;
    const at = String(/** @type {{ assigned_to?: unknown }} */ (r).assigned_to || "").trim();
    return at === assigneeFilter;
  };

  const escalatedCount = list.filter((r) => {
    if (!r || typeof r !== "object") return false;
    if (String(/** @type {{ stage?: unknown }} */ (r).stage || "") !== "escalated") return false;
    return sameAssignee(r);
  }).length;

  const filtered = list.filter((r) => {
    if (!r || typeof r !== "object") return false;
    const stage = String(/** @type {{ stage?: unknown }} */ (r).stage || "");
    if (!allowedStages.has(stage)) return false;
    return sameAssignee(r);
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

  const escalatedInList = enriched.filter((x) => x.stage === "escalated").length;
  const parts = includeEscalated
    ? [`${enriched.length} quest(s) in execute/review/closing/escalated.`]
    : [`${enriched.length} runnable active quest(s) (execute/review/closing).`];
  if (!includeEscalated && escalatedCount > 0) {
    parts.push(`${escalatedCount} escalated (blocked) — pass include_escalated: true to list them.`);
  }

  return skillActionOk(
    {
      quests: JSON.stringify(enriched),
      escalated_count: String(includeEscalated ? escalatedInList : escalatedCount),
    },
    parts.join(" "),
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
  if (!RUNNABLE_STAGES.has(stage)) {
    if (stage === "escalated") {
      return skillActionErr("Quest is already escalated; clear the blocker and return to execute/review/closing before re-escalating.");
    }
    return skillActionErr(
      `Cannot escalate: quest stage "${stage}" is not runnable (need execute, review, or closing).`,
    );
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
