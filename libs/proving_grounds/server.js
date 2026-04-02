/**
 * Server-only proving-grounds surface — roster CRUD, storage, runtime class,
 * and the quest advancement stage machine.
 */
import {
  insertAdventurerRow,
  updateAdventurerRow,
  deleteAdventurerForOwner,
  selectAdventurerForOwner,
  selectAdventurerById,
  listAdventurersForOwner,
} from "@/libs/council/database/serverAdventurer.js";
import { database } from "@/libs/council/database";
import { publicTables } from "@/libs/council/publicTables";
import { getStorageBucketName } from "@/libs/council/storageEnv.js";
import { runDungeonMasterChat } from "@/libs/council/ai/chatCompletion.js";
import { runWithAdventurerExecutionContext } from "@/libs/adventurer/advance.js";

export { selectAdventurerForOwner };
export const listAdventurers = listAdventurersForOwner;

export async function recruitAdventurer({ ownerId, draft, client }) {
  const { filterValidSkillBookNames } = await import("@/libs/skill_book");
  const sb = Array.isArray(draft.skill_books) ? filterValidSkillBookNames(draft.skill_books) : [];
  const insertRow = {
    owner_id: ownerId,
    name: String(draft.name ?? "").trim(),
    system_prompt: String(draft.system_prompt ?? draft.systemPrompt ?? "").trim(),
    skill_books: sb,
    backstory: draft.backstory != null ? String(draft.backstory).trim() || null : null,
    capabilities: draft.capabilities != null ? String(draft.capabilities) : null,
  };
  return insertAdventurerRow(insertRow, { client });
}

export async function updateAdventurer({ adventurerId, ownerId, draft, client }) {
  const { filterValidSkillBookNames } = await import("@/libs/skill_book");
  const updateRow = {
    name: String(draft.name ?? "").trim(),
    system_prompt: String(draft.system_prompt ?? draft.systemPrompt ?? "").trim(),
    skill_books: Array.isArray(draft.skill_books) ? filterValidSkillBookNames(draft.skill_books) : [],
    backstory: draft.backstory != null ? String(draft.backstory).trim() || null : null,
    capabilities: draft.capabilities != null ? String(draft.capabilities) : null,
  };
  return updateAdventurerRow(adventurerId, ownerId, updateRow, { client });
}

export async function decommissionAdventurer({ adventurerId, ownerId, client }) {
  return deleteAdventurerForOwner(adventurerId, ownerId, { client });
}

// ---------------------------------------------------------------------------
// Stage machine helpers
// ---------------------------------------------------------------------------

/**
 * Parse a JSON object from a model text response. Returns null on failure.
 * @param {string} text
 * @returns {Record<string, unknown> | null}
 */
function parseJsonFromModelText(text) {
  if (!text || typeof text !== "string") return null;
  const s = text.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)```/im.exec(s);
  const src = fence ? fence[1].trim() : s;
  const start = src.indexOf("{");
  if (start === -1) return null;
  for (let depth = 0, i = start; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") {
      depth--;
      if (depth === 0) {
        try {
          const obj = JSON.parse(src.slice(start, i + 1));
          if (obj && typeof obj === "object" && !Array.isArray(obj)) return obj;
        } catch { /* continue */ }
        break;
      }
    }
  }
  return null;
}

/**
 * Advance one step of the quest stage machine.
 *
 * @param {object} quest — full quest row
 * @param {{ client: import("@/libs/council/database/types.js").DatabaseClient }} opts
 * @returns {Promise<{ ok: boolean, advanced: boolean, stage: string, action?: string, detail?: unknown, note?: string, error?: string }>}
 */
export async function advanceQuest(quest, opts) {
  if (!quest || typeof quest !== "object") {
    return { ok: false, advanced: false, stage: "", error: "Invalid quest" };
  }

  const { client } = opts ?? {};
  const questId = String(quest.id ?? "");
  const ownerId = String(quest.owner_id ?? "");
  const stage = String(quest.stage ?? "idea");

  const {
    updateQuest,
    createSubQuest,
    getQuest,
    recordQuestComment,
    updateQuestExecutionPlan,
  } = await import("@/libs/quest/index.js");

  // ── idea: Cat triages — find matching adventurer or spawn recruiting quest ──
  if (stage === "idea") {
    const { selectAdventurer } = await import("@/libs/skill_book/questmaster/index.js");
    const questRecord = /** @type {Record<string, unknown>} */ (quest);
    const result = await runWithAdventurerExecutionContext({ userId: ownerId, client }, () =>
      selectAdventurer(ownerId, { quest: questRecord, client })
    );

    if (result.error) {
      return { ok: false, advanced: false, stage, action: "idea:selectAdventurer", error: result.error.message };
    }

    const { result: match, msg } = result.data;

    if (match && typeof match === "object" && "id" in match) {
      // Match found — assign and advance to plan
      await updateQuest(questId, { assigneeId: match.id, stage: "plan" }, { client });
      await recordQuestComment(questId, { source: "Cat", action: "triage", summary: `Assigned to ${match.name}: ${msg}` }, { client });
      return { ok: true, advanced: true, stage: "plan", action: "idea:assign", detail: { adventurerId: match.id, adventurerName: match.name } };
    }

    // No match — spawn recruiting quest, set next_steps with original description, close this one
    const childTitle = `Recruit adventurer for: ${String(quest.title ?? "").trim()}`;
    const originalDescription = String(quest.description ?? "").trim();
    const { data: childQuest, error: childErr } = await createSubQuest(
      { userId: ownerId, parentQuestId: questId, title: childTitle, description: originalDescription, stage: "idea", nextSteps: [originalDescription] },
      { client }
    );
    if (childErr) {
      return { ok: false, advanced: false, stage, action: "idea:spawnRecruit", error: childErr.message };
    }
    await updateQuest(questId, { stage: "closing" }, { client });
    await recordQuestComment(questId, { source: "Cat", action: "triage", summary: `No match — spawned recruiting quest. ${msg}`, detail: { childQuestId: childQuest?.id } }, { client });
    return { ok: true, advanced: true, stage: "closing", action: "idea:recruit", detail: { childQuestId: childQuest?.id, msg } };
  }

  // ── plan: assigned adventurer generates execution_plan via AI ──
  if (stage === "plan") {
    const assigneeId = String(quest.assignee_id ?? "");
    if (!assigneeId) {
      // No assignee — skip to execute with empty plan (shouldn't normally happen)
      await updateQuest(questId, { stage: "execute" }, { client });
      return { ok: true, advanced: true, stage: "execute", action: "plan:noAssignee" };
    }

    const { data: advRow, error: advErr } = await selectAdventurerById(assigneeId, { client });
    if (advErr || !advRow) {
      return { ok: false, advanced: false, stage, action: "plan:loadAdventurer", error: advErr?.message || "Adventurer not found" };
    }

    const systemPrompt = String(advRow.system_prompt ?? "").trim();
    const questTitle = String(quest.title ?? "").trim();
    const questDescription = String(quest.description ?? "").trim();

    // Build context about available skill books and inventory for the AI
    const { listSkillBooksForLibrary } = await import("@/libs/skill_book/index.js");
    const booksContext = listSkillBooksForLibrary().map((b) => `- ${b.id}: ${b.description}`).join("\n");

    // Include existing inventory as context (weapon_spec may have been set by prior quest)
    const { inventoryRawToMap } = await import("@/libs/quest/inventoryMap.js");
    const inventoryMap = inventoryRawToMap(quest.inventory);
    const inventoryContext = Object.keys(inventoryMap).length > 0
      ? `\nCurrent quest inventory (JSON):\n${JSON.stringify(inventoryMap, null, 2)}`
      : "";

    const userMessage = `Quest title: ${questTitle}\nQuest description: ${questDescription}${inventoryContext}\n\nAvailable skill books:\n${booksContext}`;

    const fullPrompt = `${systemPrompt}\n\n${userMessage}`;

    let aiText = "";
    try {
      const out = await runDungeonMasterChat({ userId: ownerId, messages: [{ role: "user", content: fullPrompt }], client });
      aiText = out.text;
    } catch (e) {
      return { ok: false, advanced: false, stage, action: "plan:aiCall", error: e instanceof Error ? e.message : String(e) };
    }

    const parsed = parseJsonFromModelText(aiText);
    if (!parsed) {
      return { ok: false, advanced: false, stage, action: "plan:parseResponse", error: "Adventurer did not return valid JSON", detail: { rawText: aiText.slice(0, 500) } };
    }

    // Extract execution_plan
    const executionPlan = Array.isArray(parsed.execution_plan) ? parsed.execution_plan : [];

    // Merge weapon_spec and setup_steps into inventory if present
    const inventoryUpdates = {};
    if (parsed.weapon_spec && typeof parsed.weapon_spec === "object") {
      inventoryUpdates.weapon_spec = parsed.weapon_spec;
    }
    if (Array.isArray(parsed.setup_steps) && parsed.setup_steps.length > 0) {
      inventoryUpdates.setup_steps = parsed.setup_steps;
    }

    // Handle child quest spawning (Pig's create_skillbook action)
    if (parsed.action === "create_skillbook" || parsed.action === "recruit") {
      const childTitle = typeof parsed.child_title === "string" ? parsed.child_title.trim() : `Next: ${questTitle}`;
      const childNextSteps = Array.isArray(parsed.next_steps) ? parsed.next_steps : [];
      const childInventory = inventoryUpdates;

      const { data: childQuest, error: childErr } = await createSubQuest(
        { userId: ownerId, parentQuestId: questId, title: childTitle, description: questDescription, stage: "idea", nextSteps: childNextSteps },
        { client }
      );
      if (childErr) {
        return { ok: false, advanced: false, stage, action: "plan:spawnChild", error: childErr.message };
      }

      // Merge weapon_spec into child quest inventory if present
      if (Object.keys(childInventory).length > 0) {
        const { appendInventoryItem } = await import("@/libs/quest/index.js");
        for (const [k, v] of Object.entries(childInventory)) {
          await appendInventoryItem(childQuest.id, { item_key: k, payload: v, source: "plan_stage" }, { client });
        }
      }

      await updateQuest(questId, { stage: "closing" }, { client });
      await recordQuestComment(questId, { source: advRow.name, action: "plan", summary: `Spawned dependency: ${childTitle}`, detail: { childQuestId: childQuest?.id, parsed } }, { client });
      return { ok: true, advanced: true, stage: "closing", action: "plan:spawnDependency", detail: { childQuestId: childQuest?.id, childTitle } };
    }

    // Normal planning — store execution_plan, merge inventory, advance to execute
    if (executionPlan.length > 0) {
      await updateQuestExecutionPlan(questId, executionPlan, { client });
    }
    if (Object.keys(inventoryUpdates).length > 0) {
      const { appendInventoryItem } = await import("@/libs/quest/index.js");
      for (const [k, v] of Object.entries(inventoryUpdates)) {
        await appendInventoryItem(questId, { item_key: k, payload: v, source: "plan_stage" }, { client });
      }
    }

    await updateQuest(questId, { stage: "execute" }, { client });
    await recordQuestComment(questId, { source: advRow.name, action: "plan", summary: `Plan created (${executionPlan.length} steps)`, detail: { executionPlan, parsed } }, { client });
    return { ok: true, advanced: true, stage: "execute", action: "plan:createPlan", detail: { executionPlan, stepCount: executionPlan.length } };
  }

  // ── execute: pop one step from execution_plan and dispatch it ──
  if (stage === "execute") {
    const { data: freshQuest } = await getQuest(questId, { client });
    const executionPlan = Array.isArray(freshQuest?.execution_plan) ? freshQuest.execution_plan : [];

    if (executionPlan.length === 0) {
      await updateQuest(questId, { stage: "review" }, { client });
      return { ok: true, advanced: true, stage: "review", action: "execute:complete" };
    }

    const [currentStep, ...remainingSteps] = executionPlan;
    const { normalizePlanStep } = await import("@/libs/skill_book/index.js");
    const step = normalizePlanStep(currentStep);

    if (!step) {
      await updateQuestExecutionPlan(questId, remainingSteps, { client });
      return { ok: true, advanced: true, stage: "execute", action: "execute:skipInvalidStep", detail: { currentStep } };
    }

    // Load the assignee adventurer row for context
    const assigneeId = String(freshQuest?.assignee_id ?? quest.assignee_id ?? "");
    let adventurerRow = null;
    if (assigneeId) {
      const { data } = await selectAdventurerById(assigneeId, { client });
      adventurerRow = data;
    }

    if (!adventurerRow) {
      return { ok: false, advanced: false, stage, action: "execute:loadAdventurer", error: "No assignee adventurer found for execute step" };
    }

    const { runProvingGroundsAction } = await import("@/libs/proving_grounds/index.js");
    const actionResult = await runProvingGroundsAction({
      userId: ownerId,
      client,
      skillBookId: step.skillbook,
      actionName: step.action,
      payload: {},
      adventurerRow,
      questRow: freshQuest,
    });

    // Persist any items returned by the action into quest inventory
    if (actionResult.ok && actionResult.items && Object.keys(actionResult.items).length > 0) {
      const { appendInventoryItem } = await import("@/libs/quest/index.js");
      for (const [k, v] of Object.entries(actionResult.items)) {
        await appendInventoryItem(questId, { item_key: k, payload: v, source: `${step.skillbook}.${step.action}` }, { client });
      }
    }

    // Pop the step we just ran from the execution_plan
    await updateQuestExecutionPlan(questId, remainingSteps, { client });

    await recordQuestComment(
      questId,
      { source: `${step.skillbook}.${step.action}`, action: "execute", summary: actionResult.ok ? "Step completed" : `Step failed: ${actionResult.msg}`, detail: { step, ok: actionResult.ok, msg: actionResult.msg } },
      { client }
    );

    if (!actionResult.ok) {
      return { ok: false, advanced: false, stage, action: `execute:${step.skillbook}.${step.action}`, error: actionResult.msg, detail: { step } };
    }

    const newStage = remainingSteps.length === 0 ? "review" : "execute";
    if (newStage === "review") {
      await updateQuest(questId, { stage: "review" }, { client });
    }
    return { ok: true, advanced: true, stage: newStage, action: `execute:${step.skillbook}.${step.action}`, detail: { remainingSteps: remainingSteps.length } };
  }

  // ── review: auto-advance to closing ──
  if (stage === "review") {
    await updateQuest(questId, { stage: "closing" }, { client });
    return { ok: true, advanced: true, stage: "closing", action: "review:autoClose" };
  }

  // ── closing: pop next_steps and spawn child quests ──
  if (stage === "closing") {
    const { popNextStep, childQuestFromNextStep } = await import("@/libs/quest/index.js");
    const { data: stepData } = await popNextStep(questId, { client });

    if (!stepData) {
      await updateQuest(questId, { stage: "completed" }, { client });
      return { ok: true, advanced: true, stage: "completed", action: "closing:complete" };
    }

    const { title: childTitle, description: childDesc } = childQuestFromNextStep(stepData.step);
    const childNextSteps = stepData.remaining;
    await createSubQuest(
      { userId: ownerId, parentQuestId: questId, title: childTitle, description: childDesc, stage: "idea", nextSteps: childNextSteps },
      { client }
    );
    return { ok: true, advanced: true, stage: "closing", action: "closing:spawnChild", detail: { childTitle, remainingNextSteps: childNextSteps.length } };
  }

  // ── completed: nothing to do ──
  if (stage === "completed") {
    return { ok: true, advanced: false, stage: "completed", note: "Quest is already completed." };
  }

  return { ok: true, advanced: false, stage, note: `No advance logic for stage: ${stage}` };
}

// ---------------------------------------------------------------------------
// runQuestToCompletion — loops advanceQuest until completed or maxSteps
// ---------------------------------------------------------------------------

/**
 * Advance a quest to completion (or until maxSteps is reached).
 * Returns logs for each step and the final HTML report if one was written to inventory.
 *
 * @param {string} questId
 * @param {{ client: import("@/libs/council/database/types.js").DatabaseClient, maxSteps?: number }} opts
 * @returns {Promise<{ ok: boolean, finalStage: string, logs: Array<Record<string, unknown>>, html: string }>}
 */
export async function runQuestToCompletion(questId, { client, maxSteps = 20 }) {
  const { getQuest } = await import("@/libs/quest/index.js");
  const { inventoryRawToMap } = await import("@/libs/quest/inventoryMap.js");
  /** @type {Array<Record<string, unknown>>} */
  const logs = [];
  let finalStage = "";
  let ok = true;

  for (let i = 0; i < maxSteps; i++) {
    const { data: quest, error: loadErr } = await getQuest(questId, { client });
    if (loadErr || !quest) {
      logs.push({ step: i, error: loadErr?.message || "Quest not found" });
      ok = false;
      break;
    }

    finalStage = String(quest.stage ?? "");

    if (finalStage === "completed") break;

    const result = await advanceQuest(quest, { client });
    logs.push({ step: i, ...result });

    if (!result.ok) {
      ok = false;
      break;
    }

    finalStage = result.stage;
    if (finalStage === "completed") break;
  }

  // Extract HTML report from inventory if present
  const { data: finalQuest } = await (await import("@/libs/quest/index.js")).getQuest(questId, { client });
  const inventoryMap = finalQuest ? inventoryRawToMap(finalQuest.inventory) : {};
  const html = typeof inventoryMap.report_html === "string" ? inventoryMap.report_html : "";

  return { ok, finalStage, logs, html };
}

// ---------------------------------------------------------------------------
// Storage helpers (unchanged from original)
// ---------------------------------------------------------------------------

export function commissionAvatarPath(userId, ext) {
  const u = String(userId ?? "").trim();
  const e = String(ext ?? "png").replace(/^\./, "");
  return `commission/${u}/${Date.now()}.${e}`;
}

export function adventurerAvatarPath(userId, adventurerId, ext) {
  const u = String(userId ?? "").trim();
  const a = String(adventurerId ?? "").trim();
  const e = String(ext ?? "png").replace(/^\./, "");
  return `adventurers/${u}/${a}.${e}`;
}

export async function uploadStorageObjectAsServiceRole({ path, bytes, contentType }) {
  const db = await database.init("service");
  const bucket = getStorageBucketName();
  const { data, error } = await db.storage.from(bucket).upload(path, bytes, {
    contentType: contentType || "application/octet-stream",
    upsert: true,
  });
  if (error) {
    return { error };
  }
  const pub = db.storage.from(bucket).getPublicUrl(data.path);
  return { data: { path: data.path, publicUrl: pub.data.publicUrl } };
}

export async function generateAndStoreAvatarSheet(opts) {
  void opts;
  return { error: new Error("Avatar sheet generation is not implemented in this build.") };
}

class Adventurer {
  constructor() {
    this.profile = null;
    this.quest = null;
    this.db = database.init("server");
  }

  async loadProfile(adventurerId, tempAttributes = {}) {
    if (!adventurerId) {
      throw new Error("adventurer.loadProfile: adventurerId is required");
    }

    const { data, error } = await this.db
      .from(publicTables.adventurers)
      .select("*")
      .eq("id", adventurerId)
      .single();

    if (error) {
      throw new Error(error.message || "Failed to load adventurer");
    }
    if (!data || typeof data !== "object") {
      throw new Error("Adventurer not found");
    }

    this.profile = data;
    this.profile = { ...this.profile, ...tempAttributes };
    return this.profile;
  }

  async loadQuest(questId) {
    if (!questId) {
      throw new Error("adventurer.loadQuest: questId is required");
    }
    let data;
    if (typeof questId === "object" && questId !== null) {
      data = questId;
    } else {
      const res = await this.db.from(publicTables.quests).select("*").eq("id", questId).single();
      if (res.error) {
        throw new Error(res.error.message || "Failed to load quest");
      }
      data = res.data;
    }
    this.quest = data;
    return this.quest;
  }

  async manage() {
    const { extendAdventurerWithManage } = await import("@/libs/adventurer/manage.js");
    extendAdventurerWithManage(this);
    this.test();
  }
}

export const adventurer = {
  Adventurer,
};

export * from "./ui.js";
