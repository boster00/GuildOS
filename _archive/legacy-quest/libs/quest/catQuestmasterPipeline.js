import { createServerClient } from "@/libs/council/database";
import { updateQuestExecutionPlan } from "@/libs/council/database/serverQuest.js";
import { runDungeonMasterChat } from "@/libs/council/ai/chatCompletion.js";
import {
  buildSmartQuestPlanPrompt,
  extractQuestPlanJson,
  questPlanPassesPlanningGate,
} from "@/libs/skill_book/questMasterSkills/index.js";
import { parseQuestPlanJsonFromText } from "@/libs/skill_book/default/index.js";
import {
  getQuestForOwner,
  transitionQuestStage,
  updateQuest,
  assignQuest,
  recordQuestComment,
} from "@/libs/quest/runtime.js";
import { listAdventurers, getAdventurer } from "@/libs/adventurer/create.js";
import { adventurerPresetKey } from "@/libs/adventurer/capabilitiesJson.js";
import { planRequestToQuest, findAdventurerForQUest } from "@/libs/skill_book/questmaster/index.js";
import {
  tocForAdventurer,
  qualifiedPlanStep,
  normalizePlanStep,
  resolveStepInventoryKeys,
} from "@/libs/skill_book";
import { runAdventurerExecutionFromIndexJs } from "@/libs/adventurer/runAdventurerExecution.js";

/**
 * @typedef {object} PipelineStep
 * @property {string} id
 * @property {string} title
 * @property {string} [skillBook]
 * @property {unknown} [input]
 * @property {unknown} [output]
 * @property {string | null} [error]
 */

/** @param {unknown} ids */
export function hasZohoSkillBook(ids) {
  if (!Array.isArray(ids)) return false;
  return ids.some((id) => id === "zoho" || id === "salesOrders");
}

/** @param {unknown} roster */
export function pickZohoScribe(roster) {
  if (!Array.isArray(roster)) return null;
  return roster.find((a) => adventurerPresetKey(a) === "scribe" && hasZohoSkillBook(a.skill_books)) ?? null;
}

const EXAMPLE_JSON = `{
  "title": "Verb-first title",
  "description": "SMART description",
  "deliverable": "What to submit (format)",
  "success_criteria": "How to judge success",
  "due_date": "Due date"
}`;

/**
 * @param {import("@/libs/council/database/types.js").DatabaseClient} client
 * @param {string} questId
 * @param {string} action
 * @param {{ ok?: boolean, steps?: PipelineStep[], stoppedAt?: string, summary?: string }} result
 */
async function catPipelineResultComment(client, questId, action, result) {
  await recordQuestComment(
    questId,
    {
      source: "cat_pipeline",
      action,
      summary: (result.summary || (result.ok === false ? "Failed" : "Completed")).slice(0, 2000),
      detail: { ok: result.ok !== false, stoppedAt: result.stoppedAt ?? null },
    },
    { client },
  );
  return result;
}

/**
 * Parse AI text into a raw steps array (before normalizePlanStep).
 * Accepts root JSON array or { "steps": [...] }.
 * @param {string} aiText
 * @returns {unknown[] | null}
 */
function parseModelTacticalPayload(aiText) {
  if (aiText == null || typeof aiText !== "string") return null;
  let s = aiText.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)```/im.exec(s);
  if (fence) s = fence[1].trim();

  const arrStart = s.indexOf("[");
  const objStart = s.indexOf("{");
  if (arrStart !== -1 && (objStart === -1 || arrStart < objStart)) {
    for (let i = arrStart; i < s.length; i++) {
      if (s[i] !== "[") continue;
      let depth = 0;
      for (let j = i; j < s.length; j++) {
        const ch = s[j];
        if (ch === "[") depth++;
        else if (ch === "]") {
          depth--;
          if (depth === 0) {
            try {
              const arr = JSON.parse(s.slice(i, j + 1));
              if (Array.isArray(arr)) return arr;
            } catch {
              return null;
            }
            break;
          }
        }
      }
    }
  }

  if (objStart === -1) return null;
  for (let i = objStart; i < s.length; i++) {
    if (s[i] !== "{") continue;
    let depth = 0;
    for (let j = i; j < s.length; j++) {
      if (s[j] === "{") depth++;
      else if (s[j] === "}") {
        depth--;
        if (depth === 0) {
          try {
            const obj = JSON.parse(s.slice(i, j + 1));
            if (obj && typeof obj === "object" && !Array.isArray(obj) && Array.isArray(obj.steps)) return obj.steps;
          } catch {
            return null;
          }
          break;
        }
      }
    }
  }
  return null;
}

/**
 * Planning phase: load quest, gates, AI SMART plan, updateQuest through 4a.
 * @param {{ questId: string, userId: string, client: import("@/libs/council/database/types.js").DatabaseClient }} opts
 */
export async function runCatQuestmasterPlanningThroughUpdate({ questId, userId, client }) {
  /** @type {PipelineStep[]} */
  const steps = [];

  const { data: quest, error: qErr } = await getQuestForOwner(questId, userId, { client });
  if (qErr || !quest) {
    return {
      ok: false,
      steps: [
        {
          id: "0-load-quest",
          title: "Load quest (owner check)",
          input: { questId, userId },
          output: null,
          error: qErr?.message || "Quest not found",
        },
      ],
      stoppedAt: "0-load-quest",
      summary: "Could not load quest",
      questRow: null,
    };
  }

  let questRow = quest;
  const userRequest = String(questRow.description ?? "").trim() || String(questRow.title ?? "").trim();

  if (userRequest.length < 3) {
    await updateQuest(
      questId,
      {
        description: questRow.description || "Please add a clearer description of what you need.",
      },
      { client },
    );
    steps.push({
      id: "0b-clarity",
      title: "Clarity gate — request too short",
      input: { userRequestLength: userRequest.length },
      output: { note: "description updated for clarity" },
      error: null,
    });
    return {
      ok: false,
      steps,
      stoppedAt: "0b-clarity",
      summary: "Request too short; add more detail to the quest description.",
      questRow,
    };
  }

  if (questRow.stage === "idea") {
    const { data: stagedPlan, error: planErr } = await transitionQuestStage(questId, "plan", { client });
    steps.push({
      id: "0c-idea-to-plan",
      title: "Align with questmaster cron — idea → plan",
      input: { questId, from: "idea", to: "plan" },
      output: stagedPlan ? { data: stagedPlan } : null,
      error: planErr ? planErr.message || String(planErr) : null,
    });
    if (planErr) {
      return { ok: false, steps, stoppedAt: "0c-idea-to-plan", summary: planErr.message || String(planErr), questRow };
    }
    const { data: refreshed } = await getQuestForOwner(questId, userId, { client });
    if (refreshed) questRow = refreshed;
  }

  const step1Input = {
    quest: {
      id: questRow.id,
      title: questRow.title,
      stage: questRow.stage,
      assigned_to: questRow.assigned_to,
    },
    userRequestUsedForPlanning: userRequest,
    exampleJsonShape: EXAMPLE_JSON,
    note: "Cat turns the raw user request into a SMART planning prompt (questMasterSkills.buildSmartQuestPlanPrompt).",
  };

  const composedPrompt = buildSmartQuestPlanPrompt(userRequest);

  steps.push({
    id: "1-compose-prompt",
    title: "Cat reads the request and composes the planning prompt",
    skillBook: "questMasterSkills — buildSmartQuestPlanPrompt",
    input: step1Input,
    output: { composedPrompt },
    error: null,
  });

  const apiAiBody = {
    messages: [{ role: "user", content: composedPrompt }],
    model: undefined,
  };

  let aiText = "";
  let aiMeta = null;
  try {
    const out = await runDungeonMasterChat({
      userId,
      messages: apiAiBody.messages,
      model: undefined,
      client,
    });
    aiText = out.text;
    aiMeta = { model: out.model, usage: out.usage, apiKeySource: out.apiKeySource };
  } catch (err) {
    const msg = err?.message || String(err);
    steps.push({
      id: "2-call-ai",
      title: "Call AI (Dungeon Master — same keys as product /api/ai with DM profile)",
      skillBook: "intrinsic → libs/council/ai/runDungeonMasterChat (POST /api/ai equivalent)",
      input: {
        endpointIntent: "POST /api/ai",
        body: {
          ...apiAiBody,
          note: "model omitted here uses DM default from Council Hall",
        },
      },
      output: null,
      error: msg,
    });
    return {
      ok: false,
      steps,
      stoppedAt: "2-call-ai",
      summary: msg,
      questRow,
    };
  }

  steps.push({
    id: "2-call-ai",
    title: "Call AI (Dungeon Master — same keys as product /api/ai with DM profile)",
    skillBook: "intrinsic → runDungeonMasterChat",
    input: {
      endpointIntent: "POST /api/ai",
      body: apiAiBody,
    },
    output: {
      ok: true,
      text: aiText,
      model: aiMeta.model,
      usage: aiMeta.usage,
      apiKeySource: aiMeta.apiKeySource,
    },
    error: null,
  });

  const rawExtract = extractQuestPlanJson(aiText);
  const defaultParse = parseQuestPlanJsonFromText(aiText);
  const parseAgrees = JSON.stringify(rawExtract || {}) === JSON.stringify(defaultParse || {});

  steps.push({
    id: "3-parse-json",
    title: "Parse JSON from model output",
    skillBook: "default — parseQuestPlanJsonFromText → extractQuestPlanJson",
    input: {
      rawTextLength: aiText.length,
      rawText: aiText,
      note: "default skill book delegates to questMasterSkills.extractQuestPlanJson",
    },
    output: {
      parsed: rawExtract,
      defaultSkillBookAliasMatches: parseAgrees,
    },
    error: rawExtract ? null : "No JSON object with title + deliverable could be extracted",
  });

  if (!rawExtract || !questPlanPassesPlanningGate(rawExtract)) {
    return {
      ok: false,
      steps,
      stoppedAt: "3-parse-json",
      summary: "Planning JSON missing or failed SMART gate (title + deliverable required)",
      questRow,
    };
  }

  const plan = /** @type {Record<string, unknown>} */ (rawExtract);
  const deliverablesRaw = plan.deliverable ?? plan.deliverables;
  const deliverablesText =
    deliverablesRaw == null
      ? ""
      : Array.isArray(deliverablesRaw)
        ? deliverablesRaw.map((x) => String(x).trim()).filter(Boolean).join("\n")
        : String(deliverablesRaw).trim();

  let dueDate = null;
  if (plan.due_date != null && String(plan.due_date).trim() !== "") {
    const t = Date.parse(String(plan.due_date));
    if (!Number.isNaN(t)) dueDate = new Date(t).toISOString();
  }

  const updatePayload = {
    title: String(plan.title ?? "").trim() || questRow.title,
    description: plan.description != null ? String(plan.description) : questRow.description,
    deliverables: deliverablesText || null,
    dueDate,
  };

  const updateInput = { questId, patch: updatePayload };

  const { data: updated, error: updErr } = await updateQuest(
    questId,
    {
      title: updatePayload.title,
      description: updatePayload.description,
      deliverables: updatePayload.deliverables ?? undefined,
      dueDate: updatePayload.dueDate ?? undefined,
    },
    { client },
  );

  steps.push({
    id: "4a-update-quest",
    title: "Update quest (quest master — updateQuest)",
    skillBook: "questMasterSkills / runtime.updateQuest",
    input: updateInput,
    output: updated ? { data: updated } : null,
    error: updErr ? updErr.message || String(updErr) : null,
  });

  if (updErr) {
    return {
      ok: false,
      steps,
      stoppedAt: "4a-update-quest",
      summary: updErr.message || String(updErr),
      questRow,
    };
  }

  return {
    ok: true,
    steps,
    summary: "Planning complete: quest updated with SMART title, description, deliverables, and due date.",
    questRow,
  };
}

/**
 * After successful 4a: list roster, pick Zoho scribe, assign, transition to assign (full pipeline tail).
 * @param {{ questId: string, userId: string, client: import("@/libs/council/database/types.js").DatabaseClient, questRow: object, steps: PipelineStep[] }} opts
 */
async function runAssignmentTailAfterPlan({ questId, userId, client, questRow, steps }) {
  const { data: roster, error: rosterErr } = await listAdventurers(userId, { client });
  if (rosterErr) {
    steps.push({
      id: "4b-list-adventurers",
      title: "List adventurers to assign a scribe with Zoho skill book",
      input: { userId },
      output: null,
      error: rosterErr.message || String(rosterErr),
    });
    return { ok: false, steps, stoppedAt: "4b-list-adventurers", summary: rosterErr.message || String(rosterErr) };
  }

  const scribe = pickZohoScribe(roster || []);
  steps.push({
    id: "4b-list-adventurers",
    title: "List adventurers — pick scribe with zoho or salesOrders skill book",
    input: { rosterSize: (roster || []).length },
    output: scribe
      ? { assignedName: scribe.name, presetKey: adventurerPresetKey(scribe), skill_books: scribe.skill_books }
      : { scribe: null },
    error: null,
  });

  if (!scribe) {
    const hint =
      String(questRow.description ?? "").trim() ||
      "No scribe with the Zoho skill book is available. Commission a scribe with skill book zoho (or salesOrders) in the Guildmaster's room.";
    await updateQuest(questId, { description: hint }, { client });
    steps.push({
      id: "4c-no-scribe",
      title: "No eligible scribe — note in description",
      input: {},
      output: { note: "description updated" },
      error: null,
    });
    return {
      ok: false,
      steps,
      stoppedAt: "4c-no-scribe",
      summary: "No scribe with zoho/salesOrders skill book; quest description updated with guidance.",
    };
  }

  const { data: assigned, error: asErr } = await assignQuest(questId, scribe.name, { client });
  steps.push({
    id: "4d-assign-quest",
    title: "Assign quest to scribe (assignQuest)",
    input: { questId, adventurerName: scribe.name },
    output: assigned ? { data: assigned } : null,
    error: asErr ? asErr.message || String(asErr) : null,
  });

  if (asErr) {
    return {
      ok: false,
      steps,
      stoppedAt: "4d-assign-quest",
      summary: asErr.message || String(asErr),
    };
  }

  const transitionInput = { questId, newStage: "assign" };
  const { data: staged, error: stErr } = await transitionQuestStage(questId, "assign", { client });

  steps.push({
    id: "4e-transition-stage",
    title: "Progress quest to stage assign (transitionQuestStage)",
    skillBook: "questMasterSkills — transitionQuestStage",
    input: transitionInput,
    output: staged ? { data: staged } : null,
    error: stErr ? stErr.message || String(stErr) : null,
  });

  if (stErr) {
    return {
      ok: false,
      steps,
      stoppedAt: "4e-transition-stage",
      summary: stErr.message || String(stErr),
    };
  }

  return {
    ok: true,
    steps,
    summary: `Cat pipeline completed: quest updated, assigned to ${scribe.name}, stage assign`,
  };
}

/**
 * Step 2.1 — list adventurers (read-only summary for dev testing).
 * @param {{ questId: string, userId: string, client?: import("@/libs/council/database/types.js").DatabaseClient }} opts
 */
export async function runCatPipelineListRoster({ questId, userId, client: injected }) {
  const client = injected || (await createServerClient());
  /** @type {PipelineStep[]} */
  const steps = [];

  const { data: roster, error: rosterErr } = await listAdventurers(userId, { client });
  if (rosterErr) {
    steps.push({
      id: "s1-list-roster",
      title: "List adventurers (names + capabilities)",
      input: { userId },
      output: null,
      error: rosterErr.message || String(rosterErr),
    });
    return catPipelineResultComment(client, questId, "listRoster", {
      ok: false,
      steps,
      stoppedAt: "s1-list-roster",
      summary: rosterErr.message || String(rosterErr),
    });
  }

  const rows = (roster || []).map((a) => {
    const r = /** @type {Record<string, unknown>} */ (a);
    return {
      id: r.id != null ? String(r.id) : "",
      name: r.name != null ? String(r.name) : "",
      capabilities: typeof r.capabilities === "string" ? r.capabilities : "",
      presetKey: adventurerPresetKey(r) || null,
      skill_books: r.skill_books,
    };
  });
  steps.push({
    id: "s1-list-roster",
    title: "List adventurers (names + capabilities)",
    input: { userId },
    output: { count: rows.length, roster: rows },
    error: null,
  });

  return catPipelineResultComment(client, questId, "listRoster", {
    ok: true,
    steps,
    summary: `Listed ${rows.length} adventurer(s).`,
  });
}

/**
 * Dev step 2 — skillBook(questmaster).planRequestToQuest → persist title, description, deliverables, due_date, stage.
 * @param {{ questId: string, userId: string, client?: import("@/libs/council/database/types.js").DatabaseClient }} opts
 */
export async function runCatPipelinePlanRequestToQuest({ questId, userId, client: injected }) {
  const LOG = "[GuildOS:planRequestToQuest]";
  console.log(LOG, "pipeline runCatPipelinePlanRequestToQuest start", {
    questId,
    userIdPrefix: typeof userId === "string" ? `${userId.slice(0, 8)}…` : userId,
  });
  const client = injected || (await createServerClient());
  /** @type {PipelineStep[]} */
  const steps = [];

  const { data: quest, error: qErr } = await getQuestForOwner(questId, userId, { client });
  if (qErr || !quest) {
    steps.push({
      id: "dev-plan",
      title: "skillBook(questmaster).planRequestToQuest",
      input: { questId },
      output: null,
      error: qErr?.message || "Quest not found",
    });
    console.warn(LOG, "load quest failed", { questId, err: qErr?.message || "no row" });
    return catPipelineResultComment(client, questId, "planRequestToQuest", {
      ok: false,
      steps,
      stoppedAt: "dev-plan",
      summary: qErr?.message || "Quest not found",
    });
  }

  const initialRequest = String(quest.description ?? "").trim() || String(quest.title ?? "").trim();
  console.log(LOG, "loaded quest for planning", {
    questId,
    stage: quest.stage,
    titleLen: String(quest.title ?? "").length,
    descLen: String(quest.description ?? "").length,
    initialRequestLen: initialRequest.length,
    initialFrom: String(quest.description ?? "").trim() ? "description" : "title",
  });

  const out = await planRequestToQuest(userId, { initialRequest, client });
  steps.push({
    id: "dev-plan",
    title: "skillBook(questmaster).planRequestToQuest",
    skillBook: "questmaster",
    input: { initialRequestLength: initialRequest.length },
    output: out.data ? { planned: out.data } : null,
    error: out.error ? out.error.message : null,
  });

  if (out.error || !out.data) {
    console.warn(LOG, "planRequestToQuest returned error", {
      questId,
      message: out.error?.message,
    });
    return catPipelineResultComment(client, questId, "planRequestToQuest", {
      ok: false,
      steps,
      stoppedAt: "dev-plan",
      summary: out.error?.message || "Planning failed",
    });
  }

  const p = out.data;
  const updatePayload = {
    title: p.title,
    description: p.description,
    deliverables: p.deliverables || null,
    dueDate: p.due_date,
    stage: p.stage,
  };
  console.log(LOG, "persisting updateQuest", {
    questId,
    keys: Object.keys(updatePayload),
    stage: updatePayload.stage,
    dueDate: updatePayload.dueDate,
    titlePreview: String(updatePayload.title ?? "").slice(0, 80),
  });

  const { error: updErr } = await updateQuest(questId, updatePayload, { client });

  if (updErr) {
    steps.push({
      id: "dev-plan-save",
      title: "Persist quest plan (updateQuest)",
      input: { questId },
      output: null,
      error: updErr.message || String(updErr),
    });
    console.error(LOG, "updateQuest failed after plan", {
      questId,
      message: updErr.message,
      string: String(updErr),
    });
    return catPipelineResultComment(client, questId, "planRequestToQuest", {
      ok: false,
      steps,
      stoppedAt: "dev-plan-save",
      summary: updErr.message || String(updErr),
    });
  }

  console.log(LOG, "pipeline planRequestToQuest complete", { questId, ok: true });
  return catPipelineResultComment(client, questId, "planRequestToQuest", {
    ok: true,
    steps,
    summary: "Quest updated from planRequestToQuest (title, description, deliverables, due date, stage).",
  });
}

/**
 * Dev step 3 — skillBook(questmaster).findAdventurerForQUest → assignQuest (sets assignee_id + assigned_to).
 * @param {{ questId: string, userId: string, client?: import("@/libs/council/database/types.js").DatabaseClient }} opts
 */
export async function runCatPipelineFindAdventurerForQUest({ questId, userId, client: injected }) {
  const client = injected || (await createServerClient());
  /** @type {PipelineStep[]} */
  const steps = [];

  const { data: quest, error: qErr } = await getQuestForOwner(questId, userId, { client });
  if (qErr || !quest) {
    steps.push({
      id: "dev-pick",
      title: "skillBook(questmaster).findAdventurerForQUest",
      input: { questId },
      output: null,
      error: qErr?.message || "Quest not found",
    });
    return catPipelineResultComment(client, questId, "findAdventurerForQUest", {
      ok: false,
      steps,
      stoppedAt: "dev-pick",
      summary: qErr?.message || "Quest not found",
    });
  }

  const { data: roster, error: rosterErr } = await listAdventurers(userId, { client });
  if (rosterErr) {
    steps.push({
      id: "dev-pick",
      title: "Load roster for matching",
      input: { userId },
      output: null,
      error: rosterErr.message || String(rosterErr),
    });
    return catPipelineResultComment(client, questId, "findAdventurerForQUest", {
      ok: false,
      steps,
      stoppedAt: "dev-pick",
      summary: rosterErr.message || String(rosterErr),
    });
  }

  const adventurers = (roster || []).map((a) => ({
    id: String(a.id),
    name: a.name,
    capabilities: a.capabilities,
    skill_books: a.skill_books,
  }));

  const pick = await findAdventurerForQUest(userId, {
    quest: {
      title: quest.title,
      description: quest.description,
      deliverables: quest.deliverables,
    },
    adventurers,
    client,
  });

  steps.push({
    id: "dev-pick",
    title: "skillBook(questmaster).findAdventurerForQUest",
    skillBook: "questmaster",
    input: { rosterSize: adventurers.length },
    output: pick.data ? pick.data : null,
    error: pick.error ? pick.error.message : null,
  });

  if (pick.error || !pick.data) {
    return catPipelineResultComment(client, questId, "findAdventurerForQUest", {
      ok: false,
      steps,
      stoppedAt: "dev-pick",
      summary: pick.error?.message || "Could not pick an adventurer",
    });
  }

  const { data: assigned, error: asErr } = await assignQuest(questId, pick.data.name, { client });
  steps.push({
    id: "dev-assign",
    title: "assignQuest (assignee_id + assigned_to)",
    input: { questId, adventurerName: pick.data.name, adventurerId: pick.data.adventurer_id },
    output: assigned ? { data: assigned } : null,
    error: asErr ? asErr.message || String(asErr) : null,
  });

  if (asErr) {
    return catPipelineResultComment(client, questId, "findAdventurerForQUest", {
      ok: false,
      steps,
      stoppedAt: "dev-assign",
      summary: asErr.message || String(asErr),
    });
  }

  return catPipelineResultComment(client, questId, "findAdventurerForQUest", {
    ok: true,
    steps,
    summary: `Assigned quest to ${pick.data.name} (assignee_id ${pick.data.adventurer_id}).`,
  });
}

/**
 * Plan-only: translate request → SMART quest + updateQuest (stops after 4a).
 * @param {{ questId: string, userId: string, client?: import("@/libs/council/database/types.js").DatabaseClient }} opts
 */
export async function runCatQuestmasterPlanOnly({ questId, userId, client: injected }) {
  const client = injected || (await createServerClient());
  const out = await runCatQuestmasterPlanningThroughUpdate({ questId, userId, client });
  if (!out.ok) {
    return catPipelineResultComment(client, questId, "planOnly", {
      ok: false,
      steps: out.steps,
      stoppedAt: out.stoppedAt,
      summary: out.summary || "Plan-only failed",
    });
  }
  return catPipelineResultComment(client, questId, "planOnly", {
    ok: true,
    steps: out.steps,
    summary: out.summary || "Plan-only completed",
  });
}

/**
 * Explicit cat (questmaster) pipeline with per-step payloads for UI logging.
 * @param {{ questId: string, userId: string, client?: import("@/libs/council/database/types.js").DatabaseClient }} opts
 * @returns {Promise<{ ok: boolean, steps: PipelineStep[], stoppedAt?: string, summary?: string }>}
 */
export async function runCatQuestmasterPipeline({ questId, userId, client: injected }) {
  const client = injected || (await createServerClient());
  /** @type {PipelineStep[]} */
  const steps = [];

  const planOut = await runCatQuestmasterPlanningThroughUpdate({ questId, userId, client });
  steps.push(...planOut.steps);

  if (!planOut.ok) {
    return catPipelineResultComment(client, questId, "full", {
      ok: false,
      steps,
      stoppedAt: planOut.stoppedAt,
      summary: planOut.summary,
    });
  }

  const questRow = planOut.questRow;
  if (!questRow) {
    return catPipelineResultComment(client, questId, "full", {
      ok: false,
      steps,
      stoppedAt: "4a-update-quest",
      summary: "Internal error: missing quest row after plan",
    });
  }

  const tail = await runAssignmentTailAfterPlan({ questId, userId, client, questRow, steps });
  if (!tail.ok) {
    return catPipelineResultComment(client, questId, "full", {
      ok: false,
      steps: tail.steps,
      stoppedAt: tail.stoppedAt,
      summary: tail.summary,
    });
  }

  return catPipelineResultComment(client, questId, "full", {
    ok: true,
    steps: tail.steps,
    summary: tail.summary,
  });
}

/**
 * Step 4 — Tactical planning: load assignee's skill books, prompt AI for execution plan.
 * @param {{ questId: string, userId: string, client?: import("@/libs/council/database/types.js").DatabaseClient }} opts
 */
export async function runCatPipelineTacticalPlan({ questId, userId, client: injected }) {
  const client = injected || (await createServerClient());
  /** @type {PipelineStep[]} */
  const steps = [];

  const { data: quest, error: qErr } = await getQuestForOwner(questId, userId, { client });
  if (qErr || !quest) {
    steps.push({ id: "tp-load", title: "Load quest", input: { questId }, output: null, error: qErr?.message || "Quest not found" });
    return catPipelineResultComment(client, questId, "tacticalPlan", {
      ok: false,
      steps,
      stoppedAt: "tp-load",
      summary: qErr?.message || "Quest not found",
    });
  }

  if (!quest.assignee_id) {
    steps.push({ id: "tp-assignee", title: "Check assignee", input: {}, output: null, error: "No assignee_id on quest" });
    return catPipelineResultComment(client, questId, "tacticalPlan", {
      ok: false,
      steps,
      stoppedAt: "tp-assignee",
      summary: "Quest has no assignee_id. Run step 3 first.",
    });
  }

  const { data: adventurer, error: advErr } = await getAdventurer(quest.assignee_id, { client });
  if (advErr || !adventurer) {
    steps.push({ id: "tp-adventurer", title: "Load assignee adventurer", input: { assigneeId: quest.assignee_id }, output: null, error: advErr?.message || "Adventurer not found" });
    return catPipelineResultComment(client, questId, "tacticalPlan", {
      ok: false,
      steps,
      stoppedAt: "tp-adventurer",
      summary: advErr?.message || "Assignee adventurer not found",
    });
  }

  const toc = tocForAdventurer(adventurer);
  steps.push({
    id: "tp-toc",
    title: "Load skill book TOC for assignee",
    input: { adventurerName: adventurer.name, skillBooks: adventurer.skill_books },
    output: { actionCount: toc.length, actions: toc.map((t) => qualifiedPlanStep({ skillbook: t.skillBookId, action: t.actionId })) },
    error: null,
  });

  if (toc.length === 0) {
    return catPipelineResultComment(client, questId, "tacticalPlan", {
      ok: false,
      steps,
      stoppedAt: "tp-toc",
      summary: "Adventurer has no actions in skill books.",
    });
  }

  const tocForPrompt = toc
    .filter((t) => t.skillBookId !== "default")
    .map((t) => ({
      name: `${t.skillBookId}.${t.actionId}`,
      skillbook: t.skillBookId,
      action: t.actionId,
      capabilities: t.summary,
      inputStandard: t.input,
      outputStandard: t.output,
    }));

  const prompt = `You are planning how to fulfill a quest using available actions.

Quest:
- Title: ${quest.title || "(untitled)"}
- Description: ${quest.description || "(none)"}
- Deliverables: ${quest.deliverables || "(none)"}

Each catalog entry has: name (qualified id), skillbook, action, capabilities, inputStandard (parameter specs: type, required, defaults, descriptions), outputStandard (shape of results). Executors derive inventory keys from the TOC: required inputs must exist in quest inventory before a step runs; each top-level outputStandard key becomes one persisted inventory artifact.

Available actions:
${JSON.stringify(tocForPrompt, null, 2)}

Respond with ONLY a JSON array (no wrapper object, no metadata). Each element must be exactly:
{ "skillbook": "<exact skillbook from catalog>", "action": "<exact action from catalog>" }

Do not include input or output arrays in the plan — those are defined only in the skill book TOC above.

Pick the minimum set of steps. skillbook and action must match one catalog entry exactly.`;

  let aiText = "";
  try {
    const out = await runDungeonMasterChat({
      userId,
      messages: [{ role: "user", content: prompt }],
      model: undefined,
      client,
    });
    aiText = out.text;
  } catch (err) {
    steps.push({ id: "tp-ai", title: "AI tactical planning", input: {}, output: null, error: err?.message || String(err) });
    return catPipelineResultComment(client, questId, "tacticalPlan", {
      ok: false,
      steps,
      stoppedAt: "tp-ai",
      summary: err?.message || String(err),
    });
  }

  const rawSteps = parseModelTacticalPayload(aiText);
  const planArray = Array.isArray(rawSteps) ? rawSteps.map(normalizePlanStep).filter(Boolean) : [];

  if (planArray.length === 0) {
    steps.push({ id: "tp-parse", title: "Parse execution plan", input: { rawLength: aiText.length }, output: { raw: aiText }, error: "Model did not return a valid JSON array of steps" });
    return catPipelineResultComment(client, questId, "tacticalPlan", {
      ok: false,
      steps,
      stoppedAt: "tp-parse",
      summary: "Model did not return a valid JSON array of {skillbook, action}.",
    });
  }

  const actionIds = new Set(toc.map((t) => `${t.skillBookId}.${t.actionId}`));
  const invalid = planArray.filter((ps) => !actionIds.has(qualifiedPlanStep(ps)));
  if (invalid.length > 0) {
    steps.push({
      id: "tp-validate",
      title: "Validate actions",
      input: { planned: planArray.map((ps) => qualifiedPlanStep(ps)) },
      output: null,
      error: `Unknown actions: ${invalid.map((ps) => qualifiedPlanStep(ps)).join(", ")}`,
    });
    return catPipelineResultComment(client, questId, "tacticalPlan", {
      ok: false,
      steps,
      stoppedAt: "tp-validate",
      summary: `Plan references unknown actions: ${invalid.map((ps) => qualifiedPlanStep(ps)).join(", ")}`,
    });
  }

  const { error: saveErr } = await updateQuestExecutionPlan(questId, planArray, { client });
  if (saveErr) {
    steps.push({ id: "tp-save", title: "Persist execution_plan column", input: { questId }, output: null, error: saveErr.message || String(saveErr) });
    return catPipelineResultComment(client, questId, "tacticalPlan", {
      ok: false,
      steps,
      stoppedAt: "tp-save",
      summary: saveErr.message || String(saveErr),
    });
  }

  steps.push({
    id: "tp-plan",
    title: "Tactical plan created",
    input: { prompt: prompt.slice(0, 200) + "..." },
    output: { execution_plan: planArray },
    error: null,
  });

  return catPipelineResultComment(client, questId, "tacticalPlan", {
    ok: true,
    steps,
    summary: `Tactical plan: ${planArray.length} step(s) — ${planArray.map((ps) => qualifiedPlanStep(ps)).join(" → ")}`,
  });
}

/**
 * Step 5 — Execute the tactical plan via `libs/adventurer/index.js` (source of truth) + runtime patches.
 * @param {{ questId: string, userId: string, client?: import("@/libs/council/database/types.js").DatabaseClient }} opts
 */
export async function runCatPipelineExecuteSteps(opts) {
  return runAdventurerExecutionFromIndexJs(opts);
}
