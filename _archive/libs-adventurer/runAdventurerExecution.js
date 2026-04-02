import { installAdventurerRuntimePatches } from "./adventurerRuntimePatch.js";
import { runWithAdventurerExecutionContext } from "./executionContext.js";
import { normalizeQuestRowForAdventurer } from "./normalizeQuestForAdventurer.js";
import { getAdventurer } from "./create.js";
import { getQuestForOwner, recordQuestComment } from "@/libs/quest/runtime.js";
import { createServerClient } from "@/libs/council/database";

const MAX_EXECUTION_STEPS = 10;

/**
 * Execute `quest.execution_plan` using `libs/adventurer/index.js` (source of truth) inside async context.
 *
 * @param {{ questId: string, userId: string, client?: import("@/libs/council/database/types.js").DatabaseClient }} opts
 */
export async function runAdventurerExecutionFromIndexJs({ questId, userId, client: injected }) {
  const client = injected || (await createServerClient());
  /** @type {Array<{ id: string, title: string, input?: unknown, output?: unknown, error?: string | null }>} */
  const steps = [];

  const { data: quest, error: qErr } = await getQuestForOwner(questId, userId, { client });
  if (qErr || !quest) {
    steps.push({ id: "ex-load", title: "Load quest", input: { questId }, output: null, error: qErr?.message || "Quest not found" });
    return finalizeExecuteSteps(client, questId, { ok: false, steps, stoppedAt: "ex-load", summary: qErr?.message || "Quest not found" });
  }

  if (!quest.assignee_id) {
    steps.push({ id: "ex-assignee", title: "Check assignee", input: {}, output: null, error: "No assignee_id on quest" });
    return finalizeExecuteSteps(client, questId, {
      ok: false,
      steps,
      stoppedAt: "ex-assignee",
      summary: "No assignee_id on quest. Run step 3 first.",
    });
  }

  const { data: adventurerRow, error: advErr } = await getAdventurer(quest.assignee_id, { client });
  if (advErr || !adventurerRow) {
    steps.push({
      id: "ex-adventurer",
      title: "Load assignee adventurer",
      input: { assigneeId: quest.assignee_id },
      output: null,
      error: advErr?.message || "Adventurer not found",
    });
    return finalizeExecuteSteps(client, questId, {
      ok: false,
      steps,
      stoppedAt: "ex-adventurer",
      summary: advErr?.message || "Assignee adventurer not found",
    });
  }

  const rawPlan = quest.execution_plan;
  const planLen = Array.isArray(rawPlan) ? rawPlan.length : 0;
  if (!Array.isArray(rawPlan) || planLen === 0) {
    steps.push({ id: "ex-plan", title: "Check execution plan", input: {}, output: null, error: "No execution_plan on quest (empty or invalid)." });
    return finalizeExecuteSteps(client, questId, {
      ok: false,
      steps,
      stoppedAt: "ex-plan",
      summary: "No tactical plan in execution_plan column. Run step 4 first.",
    });
  }

  if (planLen > MAX_EXECUTION_STEPS) {
    steps.push({
      id: "ex-limit",
      title: "Step limit",
      input: { count: planLen },
      output: null,
      error: `Execution plan has ${planLen} steps (max ${MAX_EXECUTION_STEPS}).`,
    });
    return finalizeExecuteSteps(client, questId, {
      ok: false,
      steps,
      stoppedAt: "ex-limit",
      summary: `Too many steps (${planLen}). Max is ${MAX_EXECUTION_STEPS}.`,
    });
  }

  const adventurer = await installAdventurerRuntimePatches();
  const questForAdv = normalizeQuestRowForAdventurer(quest);

  let caught = null;
  await runWithAdventurerExecutionContext({ userId, client }, async () => {
    const { Adventurer } = adventurer;
    const adv = new Adventurer(adventurerRow);
    try {
      await adv.executePlan(questForAdv);
      steps.push({
        id: "ex-adventurer",
        title: "Adventurer.executePlan (libs/adventurer/index.js)",
        input: { steps: planLen },
        output: { completed: true },
        error: null,
      });
    } catch (e) {
      caught = e;
      steps.push({
        id: "ex-adventurer",
        title: "Adventurer.executePlan",
        input: {},
        output: null,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  });

  if (caught) {
    return finalizeExecuteSteps(client, questId, {
      ok: false,
      steps,
      stoppedAt: "ex-adventurer",
      summary: caught instanceof Error ? caught.message : String(caught),
    });
  }

  return finalizeExecuteSteps(client, questId, {
    ok: true,
    steps,
    summary: `Adventurer executed ${planLen} planned step(s) (index.js).`,
  });
}

/**
 * @param {import("@/libs/council/database/types.js").DatabaseClient} client
 * @param {string} questId
 * @param {{ ok?: boolean, steps?: unknown[], stoppedAt?: string, summary?: string }} result
 */
async function finalizeExecuteSteps(client, questId, result) {
  await recordQuestComment(
    questId,
    {
      source: "cat_pipeline",
      action: "executeSteps",
      summary: (result.summary || (result.ok === false ? "Failed" : "Completed")).slice(0, 2000),
      detail: { ok: result.ok !== false, stoppedAt: result.stoppedAt ?? null },
    },
    { client },
  );
  return result;
}
