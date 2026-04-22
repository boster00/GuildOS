/**
 * Quest **persistence** (Supabase/PostgREST). Stage progression and `popNextStep` orchestration live in
 * `libs/quest` + `libs/adventurer` (`advance` / `advanceAssignedQuest`); do not add business rules here.
 */
import { publicTables } from "@/libs/council/publicTables";
// [items workflow migration] inventoryRawToMap goes away once items live in quest_items + quest_item_comments tables.
import { inventoryRawToMap, PIGEON_LETTERS_KEY } from "@/libs/quest/inventoryMap.js";
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

export async function selectPartyIdByQuestId(questId, { client: injected } = {}) {
  const client = await resolve(injected);
  return client.from(publicTables.parties).select("id").eq("quest_id", questId).maybeSingle();
}

export async function insertParty({ ownerId, questId }, { client: injected } = {}) {
  const client = await resolve(injected);
  return client.from(publicTables.parties).insert({ owner_id: ownerId, quest_id: questId }).select("id").single();
}

export async function updateQuestStage(questId, newStage, { client: injected } = {}) {
  const client = await resolve(injected);
  return client.from(publicTables.quests).update({ stage: newStage }).eq("id", questId).select("id, stage").single();
}

export async function insertQuestItem(
  { partyId, questId, itemKey, itemPayload },
  { client: injected } = {},
) {
  const client = await resolve(injected);
  return client
    .from(publicTables.items)
    .insert({
      party_id: partyId,
      quest_id: questId,
      item_key: itemKey,
      payload: itemPayload,
    })
    .select("id")
    .single();
}

export async function updateQuestRow(questId, updates, { client: injected } = {}) {
  const client = await resolve(injected);
  return client
    .from(publicTables.quests)
    .update(updates)
    .eq("id", questId)
    .select(
      "id, title, description, deliverables, due_date, stage, assignee_id, assigned_to, inventory, execution_plan, next_steps",
    )
    .single();
}

export async function appendQuestItem(questId, item, { client: injected } = {}) {
  const client = await resolve(injected);
  const { data: row, error: readErr } = await client
    .from(publicTables.quests)
    .select("inventory")
    .eq("id", questId)
    .single();
  if (readErr) return { data: null, error: readErr };
  const map = inventoryRawToMap(row?.inventory);
  const ik = String(item.item_key ?? "");
  if (!ik) return { data: null, error: new Error("item_key is required") };

  if (ik === PIGEON_LETTERS_KEY) {
    const letter = item.payload;
    const prev = map[ik];
    let prevLetters = [];
    if (Array.isArray(prev)) {
      prevLetters = [...prev];
    } else if (prev && typeof prev === "object" && Array.isArray(prev.letters)) {
      prevLetters = [...prev.letters];
    } else if (prev && typeof prev === "object" && Array.isArray(prev.payload?.letters)) {
      prevLetters = [...prev.payload.letters];
    }
    if (letter && typeof letter === "object") {
      prevLetters.push(letter);
    }
    map[ik] = prevLetters;
  } else {
    map[ik] = item.payload;
  }

  return client
    .from(publicTables.quests)
    .update({ inventory: map })
    .eq("id", questId)
    .select("id, inventory")
    .single();
}

/**
 * Replace `inventory.pigeon_letters` entirely (not append). Pass `[]` to clear the key.
 * @param {string} questId
 * @param {unknown[]} letters — canonical Letter[] objects
 */
export async function replaceQuestPigeonLetters(questId, letters, { client: injected } = {}) {
  const client = await resolve(injected);
  const { data: row, error: readErr } = await client
    .from(publicTables.quests)
    .select("inventory")
    .eq("id", questId)
    .single();
  if (readErr) return { data: null, error: readErr };
  const map = inventoryRawToMap(row?.inventory);
  const arr = Array.isArray(letters) ? letters : [];
  if (arr.length === 0) {
    delete map[PIGEON_LETTERS_KEY];
  } else {
    map[PIGEON_LETTERS_KEY] = arr;
  }
  return client
    .from(publicTables.quests)
    .update({ inventory: map })
    .eq("id", questId)
    .select("id, inventory")
    .single();
}

/**
 * Remove pigeon letters after delivery: by `letterIds` when provided, else by matching `item` to delivered keys.
 * @param {string} questId
 * @param {string[]} deliveredItemKeys — keys that were written to inventory (e.g. `h1text`)
 * @param {{ client?: import("@supabase/supabase-js").SupabaseClient, letterIds?: string[] }} [opts]
 */
export async function removePigeonLetterInventoryEntries(
  questId,
  deliveredItemKeys,
  { client: injected, letterIds } = {},
) {
  const client = await resolve(injected);
  const keySet = new Set((deliveredItemKeys || []).map((k) => String(k)));
  const idSet = new Set((letterIds || []).map((id) => String(id)).filter(Boolean));
  if (idSet.size === 0 && keySet.size === 0) {
    return { data: null, error: null };
  }
  const { data: row, error: readErr } = await client
    .from(publicTables.quests)
    .select("inventory")
    .eq("id", questId)
    .single();
  if (readErr) return { data: null, error: readErr };
  const map = inventoryRawToMap(row?.inventory);
  const entry = map[PIGEON_LETTERS_KEY];
  const letters = Array.isArray(entry)
    ? entry
    : Array.isArray(entry?.letters)
      ? entry.letters
      : Array.isArray(entry?.payload?.letters)
        ? entry.payload.letters
        : [];
  if (!Array.isArray(letters) || letters.length === 0) {
    console.info("[pigeon-post:remove-letters] no pigeon_letters in inventory to prune", { questId });
    return { data: row, error: null };
  }
  const nextLetters = letters.filter((l) => {
    if (idSet.size > 0) {
      const lid = l && typeof l === "object" && l.letterId != null ? String(l.letterId) : "";
      if (lid && idSet.has(lid)) return false;
      return true;
    }
    const target = l && typeof l === "object" && l.item != null ? String(l.item) : "";
    if (!target || !keySet.has(target)) return true;
    return false;
  });
  console.info("[pigeon-post:remove-letters]", {
    questId,
    mode: idSet.size > 0 ? "letterId" : "itemKey",
    deliveredItemKeys: [...keySet],
    letterIds: [...idSet],
    beforeCount: letters.length,
    afterCount: nextLetters.length,
    letterIdsInQueue: letters
      .map((l) => (l && typeof l === "object" && l.letterId != null ? String(l.letterId) : ""))
      .filter(Boolean),
  });
  if (nextLetters.length === 0) {
    delete map[PIGEON_LETTERS_KEY];
  } else {
    map[PIGEON_LETTERS_KEY] = nextLetters;
  }
  return client
    .from(publicTables.quests)
    .update({ inventory: map })
    .eq("id", questId)
    .select("id, inventory")
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

export async function insertQuestComment({ questId, source, action, summary, detail }, { client: injected } = {}) {
  const client = await resolve(injected);
  const row = {
    quest_id: questId,
    source: String(source || "system"),
    action: String(action || "unknown"),
    summary: String(summary || "").slice(0, 2000),
    detail: detail != null && typeof detail === "object" && !Array.isArray(detail) ? detail : {},
  };
  return client
    .from(publicTables.questComments)
    .insert(row)
    .select("id, source, action, summary, detail, created_at")
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

export async function selectPartyOwnerIdsForQuest(questId, client) {
  return client.from(publicTables.parties).select("owner_id").eq("quest_id", questId).limit(1);
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
