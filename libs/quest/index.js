import {
  insertQuest,
  selectQuestIdByOwnerTitle,
  insertQuestMinimal,
  updateQuestStage,
  insertQuestComment,
  updateQuestRow,
  selectQuestById,
  selectQuestForOwner,
  selectQuestOwnerId,
  selectQuestsForOwnerList,
  selectQuestsByAssignee,
  updateQuestAssignee,
  insertSubQuest,
  selectQuestCommentsForQuest,
} from "@/libs/council/database/serverQuest.js";
import { listAdventurers } from "@/libs/proving_grounds/server.js";
import { getGlobalAssigneeMeta } from "@/libs/proving_grounds/ui.js";

export { inventoryRawToMap, inventoryToDisplayRows, PIGEON_LETTERS_KEY } from "./inventoryMap.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VALID_STAGES = ["execute", "escalated", "purrview", "review", "closing", "complete"];

/** Legacy stages — accepted on read but not for new quests. */
const LEGACY_STAGES = ["idea", "plan", "assign", "completed"];

/** Canonical ordered list for UI and APIs. */
export const QUEST_STAGES = VALID_STAGES;

/** All accepted stages (current + legacy) for validation. */
const ALL_ACCEPTED_STAGES = [...VALID_STAGES, ...LEGACY_STAGES];

/** PATCH handler calls {@link updateQuest} (body: `{ id, stage }`). */
export const QUEST_PATCH_RELATIVE_URL = "/api/quest";

// ---------------------------------------------------------------------------
// Runtime helpers (from legacy runtime.js — same signatures, same DB calls)
// ---------------------------------------------------------------------------

export async function createQuest({
  userId,
  title,
  description,
  deliverables,
  dueDate,
  assigneeId,
  assignedTo,
  stage = "execute",
  priority = "medium",
  client: injected,
}) {
  // Dedup: check for existing quest with same title that isn't complete
  const client = injected || (await import("@/libs/council/database").then((m) => m.database.init("service")));
  const { data: existing } = await client
    .from(publicTables.quests)
    .select("id, title, stage")
    .eq("owner_id", userId)
    .eq("title", title)
    .not("stage", "eq", "complete")
    .limit(1);

  if (existing?.length) {
    return { data: existing[0], deduplicated: true };
  }

  const { data, error } = await insertQuest(
    { userId, title, description, deliverables, dueDate, assigneeId, assignedTo, stage },
    { client: injected },
  );
  if (error) return { error };
  return { data };
}

export async function transitionQuestStage(questId, newStage, { client: injected } = {}) {
  if (!ALL_ACCEPTED_STAGES.includes(newStage)) {
    return { error: new Error(`Invalid stage: ${newStage}`) };
  }
  const { data, error } = await updateQuestStage(questId, newStage, { client: injected });
  if (error) return { error };
  return { data };
}

/**
 * Legacy shim — redirects to writeItem (upserts into public.items).
 * Extracts url/description from the payload shape.
 * @deprecated Use writeItem directly with { questId, item_key, url, description, source }.
 */
export async function appendInventoryItem(questId, item, { client: injected } = {}) {
  const key = item?.item_key != null ? String(item.item_key) : "";
  if (!key) return { error: new Error("appendInventoryItem: item_key is required") };
  const payload = item?.payload;
  let url = null;
  let description = null;
  if (typeof payload === "string") {
    description = payload;
  } else if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    url = typeof payload.url === "string" ? payload.url : null;
    description = typeof payload.description === "string" ? payload.description : null;
    if (!url && !description) description = JSON.stringify(payload);
  } else if (payload != null) {
    description = String(payload);
  }
  const source = typeof item?.source === "string" ? item.source : null;
  const { data, error } = await writeItem({ questId, item_key: key, url, description, source }, { client: injected });
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

/**
 * Get the recent comment thread since the last NPC/system comment.
 * Returns { lastSystemComment, userReplies, hasUserReply }.
 * Used by NPCs to check if the user has responded to an escalation.
 */
export async function readRecentCommentThread(questId, { client: injected } = {}) {
  const { data, error } = await selectQuestCommentsForQuest(questId, { limit: 50, client: injected });
  if (error || !data || data.length === 0) return { lastSystemComment: null, userReplies: [], hasUserReply: false };

  // Comments come newest-first. Find the last NPC/system comment, collect user replies after it.
  const userReplies = [];
  let lastSystemComment = null;

  for (const c of data) {
    const isSystem = c.source === "system" || c.source === "npc" || c.detail?.escalated;
    if (isSystem) {
      lastSystemComment = c;
      break;
    }
    userReplies.push(c);
  }

  // userReplies are newest-first, reverse to chronological
  userReplies.reverse();

  return {
    lastSystemComment,
    userReplies,
    hasUserReply: userReplies.length > 0,
  };
}

export async function updateQuest(
  questId,
  { title, description, deliverables, dueDate, stage, assigneeId, inventory, items, nextSteps },
  { client: injected } = {},
) {
  const updates = {};
  if (title !== undefined) updates.title = title;
  if (description !== undefined) updates.description = description;
  if (deliverables !== undefined) updates.deliverables = deliverables;
  if (dueDate !== undefined) updates.due_date = dueDate;
  if (stage !== undefined) {
    if (!VALID_STAGES.includes(stage)) {
      return { error: new Error(`Invalid stage: ${stage}`) };
    }
    updates.stage = stage;
  }
  if (assigneeId !== undefined) updates.assignee_id = assigneeId;
  if (inventory !== undefined) updates.inventory = inventory;
  else if (items !== undefined) updates.inventory = items;
  if (nextSteps !== undefined) updates.next_steps = nextSteps;

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
    return updateQuestAssignee(questId, { assigneeId: adv.id, assignedTo: adv.name }, { client: injected });
  }

  if (getGlobalAssigneeMeta(name)) {
    return updateQuestAssignee(questId, { assigneeId: null, assignedTo: name }, { client: injected });
  }

  return { error: new Error(`No adventurer named "${name}" on your roster`) };
}

export async function createSubQuest(
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
  const { data, error } = await insertSubQuest(
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
    { client: injected },
  );
  if (error) return { error };
  return { data };
}

/**
 * Pop the first element off `quests.next_steps` and persist the tail.
 * @returns {{ data: null } | { data: { step: unknown, remaining: unknown[] } } | { error: Error }}
 */
export async function popNextStep(questId, { client: injected } = {}) {
  const { data: quest, error } = await getQuest(questId, { client: injected });
  if (error) return { error };
  if (!quest) return { error: new Error("Quest not found") };

  let steps = quest.next_steps;
  if (steps == null) steps = [];
  if (!Array.isArray(steps)) return { error: new Error("next_steps must be an array") };
  if (steps.length === 0) return { data: null };

  const [first, ...rest] = steps;
  const { error: upErr } = await updateQuest(questId, { nextSteps: rest }, { client: injected });
  if (upErr) return { error: upErr };
  return { data: { step: first, remaining: rest } };
}

/**
 * @param {unknown} step
 * @returns {{ title: string, description: string | null }}
 */
export function childQuestFromNextStep(step) {
  if (typeof step === "string") {
    const t = step.trim();
    return { title: t || "Next step", description: null };
  }
  if (step && typeof step === "object" && !Array.isArray(step)) {
    const o = /** @type {Record<string, unknown>} */ (step);
    if (typeof o.instruction === "string" && o.instruction.trim()) {
      return {
        title: o.instruction.trim(),
        description: typeof o.description === "string" ? o.description : null,
      };
    }
    if (typeof o.title === "string" && o.title.trim()) {
      return {
        title: o.title.trim(),
        description: typeof o.description === "string" ? o.description : null,
      };
    }
  }
  return { title: "Next step", description: null };
}

// ---------------------------------------------------------------------------
// loadNextStep — pop first next_step, replace quest title/description, reset to assign
// ---------------------------------------------------------------------------

/**
 * Pop the first entry from `next_steps`, replace the quest's title/description/stage,
 * merge inventory (current quest items take priority), and persist.
 *
 * @param {string} questId
 * @param {{ client: import("@/libs/council/database/types.js").DatabaseClient }} opts
 */
export async function advanceToNextStep(questId, { client }) {
  const { data: quest, error } = await getQuest(questId, { client });
  if (error || !quest) return { error: error || new Error("Quest not found") };

  let steps = quest.next_steps;
  if (!Array.isArray(steps) || steps.length === 0) {
    return { data: null, done: true };
  }

  const [next, ...rest] = steps;
  const nextObj = typeof next === "string" ? { title: next } : (next && typeof next === "object" ? next : {});

  // Merge inventory: current quest items take priority
  let mergedInventory = quest.inventory;
  if (nextObj.inventory && typeof nextObj.inventory === "object") {
    mergedInventory = { ...nextObj.inventory, ...(quest.inventory || {}) };
  }

  const { error: upErr } = await updateQuest(questId, {
    title: nextObj.title || quest.title,
    description: nextObj.description || quest.description,
    nextSteps: rest,
    stage: nextObj.stage || "assign",
    assigneeId: null,
    inventory: mergedInventory,
  }, { client });

  if (upErr) return { error: upErr };

  // Route prep work to the Pig (local Claude handles weapon/skillbook/adventurer prep)
  const assignedTo = "Pig";
  await updateQuestAssignee(questId, { assigneeId: null, assignedTo }, { client });

  return {
    data: {
      loaded: nextObj,
      remaining: rest.length,
      newTitle: nextObj.title || quest.title,
    },
    done: false,
  };
}

// ---------------------------------------------------------------------------
// Preparation cascade — prepend weapon/skillbook/adventurer prep when assign finds no match
// ---------------------------------------------------------------------------

/**
 * When assign() finds no fitting adventurer, prepend 3 preparation steps + the original quest
 * to next_steps, then call loadNextStep to start the first prep.
 *
 * @param {Record<string, unknown>} quest — the current quest row
 * @param {{ client: import("@/libs/council/database/types.js").DatabaseClient }} opts
 */
export async function triggerPreparationCascade(quest, { client }) {
  const domain = String(quest.description || quest.title || "unknown domain").slice(0, 80);

  // Build the 4 next_steps entries (3 preps + original quest)
  const prepSteps = [
    { title: "Prepare weapon", type: "prepare_weapon", stage: "plan", description: `Forge a weapon/connector for: ${domain}` },
    { title: "Prepare skill book", type: "prepare_skillbook", stage: "plan", description: `Create skill book actions for: ${domain}` },
    { title: "Prepare adventurer", type: "prepare_adventurer", stage: "plan", description: `Recruit and configure an adventurer for: ${domain}` },
    { title: quest.title, description: quest.description, stage: "assign", inventory: quest.inventory },
  ];

  // Overwrite next_steps with prep cascade + any existing next_steps
  const existingSteps = Array.isArray(quest.next_steps) ? quest.next_steps : [];
  const allSteps = [...prepSteps, ...existingSteps];

  const { error: upErr } = await updateQuest(quest.id, { nextSteps: allSteps }, { client });
  if (upErr) return { error: upErr };

  // loadNextStep pops "Prepare weapon" and resets quest to assign stage
  return advanceToNextStep(quest.id, { client });
}

// ---------------------------------------------------------------------------
// Assignee resolution — derives an adventurer DB row from quest.assigned_to
// ---------------------------------------------------------------------------

/**
 * Resolve an `assigned_to` string to an adventurer DB row.
 * @param {string} assignedTo
 * @param {import("@/libs/council/database/types.js").DatabaseClient} client
 * @returns {Promise<{ type: "adventurer", profile: object } | { type: "unassigned" }>}
 */
export async function resolveAssignee(assignedTo, client) {
  const key = String(assignedTo ?? "").trim().toLowerCase();
  if (!key) return { type: "unassigned" };

  const { publicTables } = await import("@/libs/council/publicTables");
  // Try by name (case-insensitive)
  const { data: byName } = await client
    .from(publicTables.adventurers)
    .select("id, name, capabilities, skill_books, system_prompt, backstory")
    .ilike("name", key)
    .limit(1)
    .maybeSingle();
  if (byName) return { type: "adventurer", profile: byName };

  // Try by UUID
  const { data: byId } = await client
    .from(publicTables.adventurers)
    .select("id, name, capabilities, skill_books, system_prompt, backstory")
    .eq("id", assignedTo)
    .maybeSingle();
  if (byId) return { type: "adventurer", profile: byId };

  return { type: "unassigned" };
}

/**
 * Load a quest and auto-resolve its assignee from `assigned_to`.
 * Returns `{ quest, assignee }` where assignee has `.type` and `.profile`.
 *
 * @param {string} questId
 * @param {string} ownerId
 * @param {{ client: import("@/libs/council/database/types.js").DatabaseClient }} opts
 */
/**
 * Load a quest and auto-resolve its assignee. Returns a quest object with `.assignee` attached.
 * @param {string} questId
 * @param {string} ownerId
 * @param {{ client: import("@/libs/council/database/types.js").DatabaseClient }} opts
 * @returns {Promise<{ data: (Record<string, unknown> & { assignee: object }) | null, error: Error | null }>}
 */
export async function loadQuest(questId, ownerId, { client }) {
  const { data: quest, error } = await selectQuestForOwner(questId, ownerId, { client });
  if (error || !quest) {
    return { data: null, error: error || new Error("Quest not found.") };
  }
  quest.assignee = await resolveAssignee(quest.assigned_to, client);
  quest.items = await searchItems(questId, { client });
  return { data: quest, error: null };
}

// ---------------------------------------------------------------------------
// Items — replaces the old quests.inventory JSONB
// ---------------------------------------------------------------------------

/**
 * Upsert an item into quest_items. Same (quest_id, item_key) replaces in place.
 * @param {{ questId: string, item_key: string, url?: string|null, description?: string|null, source?: string|null }} input
 * @param {{ client?: import("@/libs/council/database/types.js").DatabaseClient }} [opts]
 * @returns {Promise<{ data: object|null, error: Error|null }>}
 */
export async function writeItem({ questId, item_key, url = null, description = null, source = null }, { client: injected } = {}) {
  const { publicTables } = await import("@/libs/council/publicTables");
  const { resolveServerClient } = await import("@/libs/council/database/resolveServer.js");
  const client = await resolveServerClient(injected);
  const { data, error } = await client
    .from(publicTables.items)
    .upsert({ quest_id: questId, item_key, url, description, source }, { onConflict: "quest_id,item_key" })
    .select("id, quest_id, item_key, url, description, source, created_at, updated_at")
    .single();
  return { data, error };
}

/**
 * Insert a comment on an item (e.g. Cat annotating a screenshot).
 * @param {string} itemId
 * @param {{ role: string, text: string }} input
 * @param {{ client?: import("@/libs/council/database/types.js").DatabaseClient }} [opts]
 */
export async function writeItemComment(itemId, { role, text }, { client: injected } = {}) {
  const { publicTables } = await import("@/libs/council/publicTables");
  const { resolveServerClient } = await import("@/libs/council/database/resolveServer.js");
  const client = await resolveServerClient(injected);
  const { data, error } = await client
    .from(publicTables.itemComments)
    .insert({ item_id: itemId, role, text })
    .select("id, item_id, role, text, created_at")
    .single();
  return { data, error };
}

/**
 * List items for a quest, each with its comments[] hydrated.
 * @param {string} questId
 * @param {{ client?: import("@/libs/council/database/types.js").DatabaseClient }} [opts]
 * @returns {Promise<object[]>}
 */
export async function searchItems(questId, { client: injected } = {}) {
  const { publicTables } = await import("@/libs/council/publicTables");
  const { resolveServerClient } = await import("@/libs/council/database/resolveServer.js");
  const client = await resolveServerClient(injected);
  const { data: items, error } = await client
    .from(publicTables.items)
    .select("id, item_key, url, description, source, created_at, updated_at")
    .eq("quest_id", questId)
    .order("created_at", { ascending: true });
  if (error || !items?.length) return [];

  const ids = items.map((i) => i.id);
  const { data: comments } = await client
    .from(publicTables.itemComments)
    .select("id, item_id, role, text, created_at")
    .in("item_id", ids)
    .order("created_at", { ascending: true });

  const byItem = new Map();
  for (const c of comments || []) {
    if (!byItem.has(c.item_id)) byItem.set(c.item_id, []);
    byItem.get(c.item_id).push(c);
  }
  return items.map((i) => ({ ...i, comments: byItem.get(i.id) || [] }));
}

/**
 * Delete an item (comments cascade).
 * @param {string} questId
 * @param {string} itemKey
 */
export async function deleteItem(questId, itemKey, { client: injected } = {}) {
  const { publicTables } = await import("@/libs/council/publicTables");
  const { resolveServerClient } = await import("@/libs/council/database/resolveServer.js");
  const client = await resolveServerClient(injected);
  return client.from(publicTables.items).delete().eq("quest_id", questId).eq("item_key", itemKey);
}

// ---------------------------------------------------------------------------
// advance — implemented in adventurer domain (actor owns the stage machine).
// ---------------------------------------------------------------------------

/**
 * @param {object} quest — full quest row (id, owner_id, stage, execution_plan, …)
 * @param {{ client: import("@/libs/council/database/types.js").DatabaseClient, counter?: number }} [opts]
 */
/**
 * Quest-side entry: resolve assignee → {@link Adventurer#advance}. Use from cron, HTTP, or tools instead of pulling batches inside adventurer.
 */
export async function advance(quest, opts) {
  const { advanceQuest } = await import("@/libs/proving_grounds/server.js");
  return advanceQuest(quest, opts ?? {});
}

export { updateQuestExecutionPlan } from "@/libs/council/database/serverQuest.js";
