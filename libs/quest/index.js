import {
  insertQuest,
  selectQuestIdByOwnerTitle,
  insertQuestMinimal,
  selectPartyIdByQuestId,
  insertParty,
  updateQuestStage,
  insertQuestItem,
  appendQuestItem,
  replaceQuestPigeonLetters,
  removePigeonLetterInventoryEntries as removePigeonLetterRowsByTargetKeys,
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

const VALID_STAGES = [
  "idea",
  "plan",
  "assign",
  "execute",
  "escalated",
  "review",
  "closing",
  "complete",
  "completed",
];

/** Canonical ordered list for UI and APIs (same as {@link VALID_STAGES}). */
export const QUEST_STAGES = VALID_STAGES;

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
    (await insertQuestMinimal({ ownerId: userId, title, stage: "execute" }, { client: injected })).data?.id;
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

/** @deprecated Use appendInventoryItem instead. Kept for legacy compat. */
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
 * Replace `inventory.pigeon_letters` with `letters` (or clear when `[]`). Does not merge with existing letters.
 */
export async function replaceInventoryPigeonLetters(questId, letters, { client: injected } = {}) {
  return replaceQuestPigeonLetters(questId, letters, { client: injected });
}

/**
 * After pigeon webhook delivery, remove pigeon letters by `letterIds` or by matching `item` to delivered keys.
 * @param {string} questId
 * @param {string[]} deliveredItemKeys
 * @param {{ client?: import("@supabase/supabase-js").SupabaseClient, letterIds?: string[] }} [opts]
 */
export async function removePigeonLetterInventoryEntries(questId, deliveredItemKeys, opts = {}) {
  return removePigeonLetterRowsByTargetKeys(questId, deliveredItemKeys, opts);
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

  // Route to the correct NPC based on prep type, default to Cat
  const { PREP_NPC_ROUTING, getNpc } = await import("@/libs/npcs");
  const npcKey = PREP_NPC_ROUTING[nextObj.type] || "cat";
  const npc = getNpc(npcKey);
  const assignedTo = npc?.name || "Cat";
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
// Assignee resolution — derives NPC or adventurer from quest.assigned_to
// ---------------------------------------------------------------------------

/** Known NPC slugs → metadata. */
// Re-export from canonical source
export { NPC_REGISTRY as NPC_ROSTER } from "@/libs/npcs";

/**
 * Resolve an `assigned_to` string to either an NPC or an adventurer DB row.
 * @param {string} assignedTo
 * @param {import("@/libs/council/database/types.js").DatabaseClient} client
 * @returns {Promise<{ type: "npc", profile: object } | { type: "adventurer", profile: object } | { type: "unassigned" }>}
 */
export async function resolveAssignee(assignedTo, client) {
  const key = String(assignedTo ?? "").trim().toLowerCase();
  if (!key) return { type: "unassigned" };

  const { getNpc } = await import("@/libs/npcs");
  const npc = getNpc(key);
  if (npc) {
    return { type: "npc", profile: { ...npc, id: null } };
  }

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
  return { data: quest, error: null };
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
