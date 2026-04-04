/**
 * Adventurer runtime — execution scope (`advance.js`) + innate actions.
 * Roster, UI registry, and server helpers live under `@/libs/proving_grounds`.
 */
export * from "./advance.js";

export const toc = {
  doNextAction: {
    description: "Execute the next step in the quest's execution_plan. Pops the current step, calls the skill book action, stores result in inventory.",
  },
};

/**
 * Execute the next step in the execution_plan.
 * @param {Record<string, unknown>} quest — quest row
 * @param {{ client: import("@/libs/council/database/types.js").DatabaseClient, userId: string }} ctx
 */
export async function doNextAction(quest, ctx) {
  const stage = String(quest.stage || "");
  const questId = String(quest.id || "");

  if (stage !== "execute") {
    return { action: "noop", ok: false, msg: `Adventurer doNextAction only runs in execute stage, got: ${stage}` };
  }

  const plan = Array.isArray(quest.execution_plan) ? quest.execution_plan : [];
  if (plan.length === 0) {
    // No more steps — advance to review
    const { updateQuest } = await import("@/libs/quest");
    await updateQuest(questId, { stage: "review" }, { client: ctx.client });
    return { action: "plan_complete", ok: true, stage: "review", msg: "All execution plan steps completed." };
  }

  // Pop the first step
  const [step, ...remaining] = plan;
  const skillBookId = String(step?.skillbook || step?.skillBook || "");
  const actionName = String(step?.action || "");

  if (!skillBookId || !actionName) {
    return { action: "execute_step", ok: false, msg: `Invalid plan step: missing skillbook or action. Got: ${JSON.stringify(step)}` };
  }

  // Load and run the action
  const { getSkillBook } = await import("@/libs/skill_book");
  const book = getSkillBook(skillBookId);
  if (!book) {
    return { action: "execute_step", ok: false, msg: `Skill book not found: ${skillBookId}` };
  }

  const fn = book[actionName];
  if (typeof fn !== "function") {
    return { action: "execute_step", ok: false, msg: `Action not found: ${skillBookId}.${actionName}` };
  }

  // Build payload — pass quest context and any step params
  const payload = {
    ...(step.params && typeof step.params === "object" ? step.params : {}),
    guildos: { quest },
  };

  let result;
  try {
    result = await fn(payload);
  } catch (err) {
    result = { ok: false, msg: err instanceof Error ? err.message : String(err) };
  }

  // Store result items in inventory and update the plan
  const { updateQuest } = await import("@/libs/quest");
  const currentInv = typeof quest.inventory === "object" ? quest.inventory : {};
  const newItems = result?.items && typeof result.items === "object" ? result.items : {};

  await updateQuest(questId, {
    inventory: { ...currentInv, ...newItems },
    // Persist the remaining plan (we popped the first step)
  }, { client: ctx.client });

  // Update execution_plan separately (updateQuest doesn't have an executionPlan field mapped through)
  const { updateQuestExecutionPlan } = await import("@/libs/quest");
  await updateQuestExecutionPlan(questId, remaining, { client: ctx.client });

  // If no more steps, advance to review
  if (remaining.length === 0) {
    await updateQuest(questId, { stage: "review" }, { client: ctx.client });
    return { action: "execute_step", ok: result?.ok ?? true, step: { skillBookId, actionName }, stage: "review", items: newItems };
  }

  return { action: "execute_step", ok: result?.ok ?? true, step: { skillBookId, actionName }, remaining: remaining.length, items: newItems };
}
