import {
  insertQuest,
  selectQuestIdByOwnerTitle,
  insertQuestMinimal,
  selectPartyIdByQuestId,
  insertParty,
  updateQuestStage,
  insertQuestItem,
  appendQuestItem,
  insertQuestComment,
  updateQuestRow,
  selectQuestAgentExecution,
  selectQuestById,
  selectQuestForOwner,
  selectQuestOwnerId,
  selectQuestsForOwnerList,
  selectQuestsByAssignee,
  updateQuestAssignee,
  insertSubQuest,
} from "@/libs/council/database/serverQuest.js";
import { listAdventurers } from "@/libs/adventurer/create.js";
import { getGlobalAssigneeMeta } from "@/libs/adventurer/globalAssignees.js";

const VALID_STAGES = ["idea", "plan", "assign", "execute", "review", "closing", "completed"];

export async function createQuest({
  userId,
  title,
  description,
  deliverables,
  dueDate,
  assigneeId,
  assignedTo,
  stage = "idea",
  client: injected,
}) {
  const { data, error } = await insertQuest(
    { userId, title, description, deliverables, dueDate, assigneeId, assignedTo, stage },
    { client: injected },
  );
  if (error) return { error };
  return { data };
}

export async function ensureQuestParty(userId, title = "Quest 1: Recent Sales Orders", { client: injected } = {}) {
  const { data: existingQuest } = await selectQuestIdByOwnerTitle(userId, title, {
    client: injected,
  });

  const questId =
    existingQuest?.id ??
    (await insertQuestMinimal({ ownerId: userId, title, stage: "execute" }, { client: injected }))
      .data?.id;

  const { data: existingParty } = await selectPartyIdByQuestId(questId, { client: injected });

  const partyId =
    existingParty?.id ??
    (await insertParty({ ownerId: userId, questId }, { client: injected })).data?.id;

  return { questId, partyId };
}

export async function transitionQuestStage(questId, newStage, { client: injected } = {}) {
  if (!VALID_STAGES.includes(newStage)) {
    return { error: new Error(`Invalid stage: ${newStage}`) };
  }
  const { data, error } = await updateQuestStage(questId, newStage, { client: injected });
  if (error) return { error };
  return { data };
}

/** @deprecated Use appendInventoryItem instead. Kept for legacy scribe pipeline. */
export async function recordQuestItemHandoff({ partyId, questId, itemKey, itemPayload, client: injected }) {
  const { data: itemRow, error: itemError } = await insertQuestItem(
    { partyId, questId, itemKey, itemPayload },
    { client: injected },
  );

  if (itemError) return { error: itemError };
  return { data: itemRow };
}

export async function appendInventoryItem(questId, item, { client: injected } = {}) {
  const { data, error } = await appendQuestItem(questId, item, { client: injected });
  if (error) return { error };
  return { data };
}

/**
 * Best-effort activity log row for quest detail / audit (fails open — warns to console).
 * @param {string} questId
 * @param {{ source: string, action: string, summary: string, detail?: Record<string, unknown> }} payload
 */
export async function recordQuestComment(questId, payload, { client: injected } = {}) {
  const { source, action, summary, detail } = payload;
  const { error } = await insertQuestComment(
    {
      questId,
      source,
      action,
      summary: String(summary || "").slice(0, 2000),
      detail: detail && typeof detail === "object" && !Array.isArray(detail) ? detail : {},
    },
    { client: injected },
  );
  if (error) {
    console.warn("[recordQuestComment]", questId, error.message || String(error));
  }
}

export async function updateQuest(
  questId,
  { title, description, deliverables, dueDate, stage, assigneeId, agentExecution, inventory, items },
  { client: injected } = {},
) {
  const updates = {};
  if (title !== undefined) updates.title = title;
  if (description !== undefined) updates.description = description;
  if (deliverables !== undefined) updates.deliverables = deliverables;
  if (dueDate !== undefined) updates.due_date = dueDate;
  if (stage !== undefined) updates.stage = stage;
  if (assigneeId !== undefined) updates.assignee_id = assigneeId;
  if (agentExecution !== undefined) updates.agent_execution = agentExecution;
  if (inventory !== undefined) updates.inventory = inventory;
  else if (items !== undefined) updates.inventory = items;

  if (Object.keys(updates).length === 0) {
    return { error: new Error("No fields to update") };
  }

  const { data, error } = await updateQuestRow(questId, updates, { client: injected });
  if (error) {
    console.warn("[GuildOS:updateQuest]", "PostgREST error", {
      questId,
      columns: Object.keys(updates),
      message: error.message,
      code: /** @type {{ code?: string }} */ (error).code,
      details: /** @type {{ details?: string }} */ (error).details,
    });
    return { error };
  }
  return { data };
}

const MAX_AGENT_ATTEMPTS = 24;

export async function patchQuestAgentExecution(questId, partial, { client: injected } = {}) {
  const { data: row, error: readErr } = await selectQuestAgentExecution(questId, {
    client: injected,
  });
  if (readErr) return { error: readErr };
  const prev =
    row?.agent_execution && typeof row.agent_execution === "object" && !Array.isArray(row.agent_execution)
      ? row.agent_execution
      : {};
  const next = { ...prev, ...partial };
  return updateQuest(questId, { agentExecution: next }, { client: injected });
}

export async function appendAgentExecutionAttempt(questId, attempt, { client: injected } = {}) {
  const { data: row, error: readErr } = await selectQuestAgentExecution(questId, {
    client: injected,
  });
  if (readErr) return { error: readErr };
  const prev =
    row?.agent_execution && typeof row.agent_execution === "object" && !Array.isArray(row.agent_execution)
      ? row.agent_execution
      : {};
  const attempts = Array.isArray(prev.attempts) ? [...prev.attempts, attempt] : [attempt];
  const trimmed = attempts.length > MAX_AGENT_ATTEMPTS ? attempts.slice(-MAX_AGENT_ATTEMPTS) : attempts;
  const out = await updateQuest(questId, { agentExecution: { ...prev, attempts: trimmed } }, { client: injected });
  if (!out.error) {
    const a = attempt && typeof attempt === "object" ? attempt : {};
    const parts = [];
    if (a.phase != null) parts.push(String(a.phase));
    if (a.note) parts.push(String(a.note));
    if (a.error) parts.push(`Error: ${a.error}`);
    if (a.ok === true) parts.push("ok");
    if (a.ok === false) parts.push("failed");
    if (a.rowCount != null) parts.push(`${a.rowCount} rows`);
    const summary = (parts.length ? parts.join(" · ") : "Agent trace").slice(0, 2000);
    await recordQuestComment(
      questId,
      {
        source: "agent_execution",
        action: String(a.phase || "attempt"),
        summary,
        detail: {
          phase: a.phase,
          ok: a.ok,
          note: a.note,
          error: a.error,
          rowCount: a.rowCount,
        },
      },
      { client: injected },
    );
  }
  return out;
}

export async function ensurePartyForQuest(questId, userId, { client: injected } = {}) {
  const { data: existing } = await selectPartyIdByQuestId(questId, { client: injected });
  if (existing?.id) return { data: { partyId: existing.id } };
  const { data: ins, error } = await insertParty({ ownerId: userId, questId }, { client: injected });
  if (error) return { error };
  return { data: { partyId: ins.id } };
}

export async function getQuest(questId, { client: injected } = {}) {
  const { data, error } = await selectQuestById(questId, { client: injected });
  if (error) return { error };
  return { data };
}

export async function getQuestForOwner(questId, ownerId, { client: injected } = {}) {
  const { data, error } = await selectQuestForOwner(questId, ownerId, { client: injected });
  if (error) return { error };
  if (!data) return { error: new Error("Quest not found.") };
  return { data };
}

export async function resolveQuestOwnerUserId(questId, client) {
  const { data: q } = await selectQuestOwnerId(questId, client);
  return q?.owner_id ?? null;
}

export async function getQuestsForOwner(userId, { client: injected } = {}) {
  const { data, error } = await selectQuestsForOwnerList(userId, { client: injected });
  if (error) return { error };
  return { data: data || [] };
}

export async function getQuestsByAssignee(adventurerName, { stages = ["idea", "plan"], client: injected } = {}) {
  const { data, error } = await selectQuestsByAssignee(adventurerName, {
    stages,
    client: injected,
  });
  if (error) return { error };
  return { data: data || [] };
}

export async function assignQuest(questId, adventurerName, { client: injected } = {}) {
  const name = String(adventurerName ?? "").trim();
  if (!name) return { error: new Error("Adventurer name is required") };

  const { data: quest, error: qErr } = await getQuest(questId, { client: injected });
  if (qErr || !quest) return { error: qErr || new Error("Quest not found") };

  const ownerId = quest.owner_id;
  const { data: roster, error: rErr } = await listAdventurers(ownerId, { client: injected });
  if (rErr) return { error: rErr };

  const adv = (roster || []).find((a) => a.name === name);
  if (adv?.id) {
    return updateQuestAssignee(
      questId,
      { assigneeId: adv.id, assignedTo: adv.name },
      { client: injected },
    );
  }

  if (getGlobalAssigneeMeta(name)) {
    return updateQuestAssignee(
      questId,
      { assigneeId: null, assignedTo: name },
      { client: injected },
    );
  }

  return { error: new Error(`No adventurer named "${name}" on your roster`) };
}

export async function createSubQuest(
  { userId, parentQuestId, title, description, deliverables, dueDate, assigneeId, assignedTo },
  { client: injected } = {},
) {
  const { data, error } = await insertSubQuest(
    { userId, parentQuestId, title, description, deliverables, dueDate, assigneeId, assignedTo },
    { client: injected },
  );
  if (error) return { error };
  return { data };
}
