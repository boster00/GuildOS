/**
 * Quest **persistence** (Supabase/PostgREST). Stage progression and `popNextStep` orchestration live in
 * `libs/quest` + `libs/adventurer` (`advance` / `advanceAssignedQuest`); do not add business rules here.
 */
import { publicTables } from "@/libs/council/publicTables";
import { resolveServerClient } from "./resolveServer.js";

async function resolve(injected) {
  return resolveServerClient(injected);
}

export async function insertQuest(
  { userId, title, description, deliverables, dueDate, assigneeId, assignedTo, stage = "idea" },
  { client: injected } = {},
) {
  const client = await resolve(injected);
  const row = {
    owner_id: userId,
    title,
    description: description || null,
    deliverables: deliverables ?? null,
    due_date: dueDate ?? null,
    assignee_id: assigneeId ?? null,
    assigned_to: assignedTo || null,
    stage,
  };
  return client.from(publicTables.quests).insert(row).select("id").single();
}

export async function selectQuestIdByOwnerTitle(userId, title, { client: injected } = {}) {
  const client = await resolve(injected);
  return client.from(publicTables.quests).select("id").eq("owner_id", userId).eq("title", title).maybeSingle();
}

export async function insertQuestMinimal({ ownerId, title, stage }, { client: injected } = {}) {
  const client = await resolve(injected);
  return client.from(publicTables.quests).insert({ owner_id: ownerId, title, stage }).select("id").single();
}

export async function updateQuestStage(questId, newStage, { client: injected } = {}) {
  const client = await resolve(injected);
  return client.from(publicTables.quests).update({ stage: newStage }).eq("id", questId).select("id, stage").single();
}

export async function updateQuestRow(questId, updates, { client: injected } = {}) {
  const client = await resolve(injected);
  return client
    .from(publicTables.quests)
    .update(updates)
    .eq("id", questId)
    .select(
      "id, title, description, deliverables, due_date, stage, assignee_id, assigned_to, execution_plan, next_steps",
    )
    .single();
}

/** @param {unknown[]} planArray — { skillbook, action }[] (optional legacy input/output string[]); IO from skill book TOC */
export async function updateQuestExecutionPlan(questId, planArray, { client: injected } = {}) {
  const client = await resolve(injected);
  const arr = Array.isArray(planArray) ? planArray : [];
  return client
    .from(publicTables.quests)
    .update({ execution_plan: arr })
    .eq("id", questId)
    .select("id, execution_plan")
    .single();
}

export async function insertQuestComment({ questId, source, action, summary, detail, actor_name = null }, { client: injected } = {}) {
  const client = await resolve(injected);
  const row = {
    quest_id: questId,
    source: String(source || "system"),
    action: String(action || "unknown"),
    summary: String(summary || "").slice(0, 2000),
    detail: detail != null && typeof detail === "object" && !Array.isArray(detail) ? detail : {},
    actor_name: actor_name ? String(actor_name).slice(0, 80) : null,
  };
  return client
    .from(publicTables.questComments)
    .insert(row)
    .select("id, source, action, summary, detail, actor_name, created_at")
    .single();
}

export async function selectQuestCommentsForQuest(questId, { limit = 100, client: injected } = {}) {
  const client = await resolve(injected);
  const lim = Math.min(Math.max(Number(limit) || 100, 1), 500);
  return client
    .from(publicTables.questComments)
    .select("id, source, action, summary, detail, created_at")
    .eq("quest_id", questId)
    .order("created_at", { ascending: false })
    .limit(lim);
}

/** Updates comment text; scoped by quest id so a stray id cannot alter another quest’s row. */
export async function updateQuestCommentSummaryById(
  { questId, commentId, summary },
  { client: injected } = {},
) {
  const client = await resolve(injected);
  const text = String(summary ?? "").trim().slice(0, 2000);
  return client
    .from(publicTables.questComments)
    .update({ summary: text })
    .eq("id", commentId)
    .eq("quest_id", questId)
    .select("id, source, action, summary, detail, created_at")
    .maybeSingle();
}

/** Deletes one comment row; scoped by quest id so a stray id cannot remove another quest’s row. */
export async function deleteQuestCommentById({ questId, commentId }, { client: injected } = {}) {
  const client = await resolve(injected);
  return client
    .from(publicTables.questComments)
    .delete()
    .eq("id", commentId)
    .eq("quest_id", questId)
    .select("id");
}

export async function deleteAllQuestCommentsForQuest(questId, { client: injected } = {}) {
  const client = await resolve(injected);
  return client.from(publicTables.questComments).delete().eq("quest_id", questId);
}

export async function selectQuestById(questId, { client: injected } = {}) {
  const client = await resolve(injected);
  return client.from(publicTables.quests).select("*").eq("id", questId).single();
}

export async function selectQuestForOwner(questId, ownerId, { client: injected } = {}) {
  const client = await resolve(injected);
  return client.from(publicTables.quests).select("*").eq("id", questId).eq("owner_id", ownerId).maybeSingle();
}

export async function selectQuestOwnerId(questId, client) {
  return client.from(publicTables.quests).select("owner_id").eq("id", questId).maybeSingle();
}

export async function selectQuestsForOwnerList(userId, { client: injected } = {}) {
  const client = await resolve(injected);
  return client
    .from(publicTables.quests)
    .select(
      "id, title, description, deliverables, due_date, stage, assignee_id, assigned_to, created_at, updated_at, parent_quest_id",
    )
    .eq("owner_id", userId)
    .order("updated_at", { ascending: false });
}

export async function selectQuestsByAssignee(adventurerName, { stages = ["idea", "plan"], client: injected } = {}) {
  const client = await resolve(injected);
  return client
    .from(publicTables.quests)
    .select("id, title, description, deliverables, due_date, stage, assignee_id, assigned_to, parent_quest_id")
    .eq("assigned_to", adventurerName)
    .in("stage", stages);
}

export async function updateQuestAssignee(questId, { assigneeId, assignedTo }, { client: injected } = {}) {
  const client = await resolve(injected);
  return client
    .from(publicTables.quests)
    .update({ assignee_id: assigneeId ?? null, assigned_to: assignedTo ?? null })
    .eq("id", questId)
    .select("id, assignee_id, assigned_to")
    .single();
}

export async function insertSubQuest(
  {
    userId,
    parentQuestId,
    title,
    description,
    deliverables,
    dueDate,
    assigneeId,
    assignedTo,
    stage,
    executionPlan,
    nextSteps,
  },
  { client: injected } = {},
) {
  const client = await resolve(injected);
  /** @type {Record<string, unknown>} */
  const row = {
    owner_id: userId,
    parent_quest_id: parentQuestId,
    title,
    description: description || null,
    deliverables: deliverables ?? null,
    due_date: dueDate ?? null,
    assignee_id: assigneeId ?? null,
    assigned_to: assignedTo || null,
    stage: typeof stage === "string" && stage ? stage : "idea",
    execution_plan: Array.isArray(executionPlan) ? executionPlan : [],
    next_steps: Array.isArray(nextSteps) ? nextSteps : [],
  };
  return client.from(publicTables.quests).insert(row).select("id, title, stage, assignee_id, assigned_to").single();
}
