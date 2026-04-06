/**
 * Blacksmith NPC (Flash Blacksloth)
 * Innate actions — weapon planning, review, and forging.
 * References: docs/weapon-crafting-guideline.md
 */

export const toc = {
  doNextAction: {
    description: "Triage based on quest stage: plan → blacksmith.plan, review → blacksmith.review (escalate or ready), execute → blacksmith.forgeWeapon.",
  },
};

/**
 * Decide and perform the next action based on quest state.
 * @param {Record<string, unknown>} quest — quest row with .assignee resolved
 * @param {{ client: import("@/libs/council/database/types.js").DatabaseClient, userId: string }} ctx
 */
export async function doNextAction(quest, ctx) {
  const stage = String(quest.stage || "");
  const questId = String(quest.id || "");
  // Inventory may be array of {key, value} or flat object — normalize to flat
  const { inventoryRawToMap } = await import("@/libs/quest/inventoryMap.js");
  const inventory = inventoryRawToMap(quest.inventory);

  if (stage === "plan") {
    const { getSkillBook } = await import("@/libs/skill_book");
    const book = getSkillBook("blacksmith");
    const result = await book.plan({ guildos: { quest } });
    if (!result?.ok) return { action: "plan", ok: false, error: result?.msg };

    const blueprint = result.items?.blueprint;
    // Store blueprint in inventory
    const { appendInventoryItem, updateQuest } = await import("@/libs/quest");
    await appendInventoryItem(questId, { item_key: "blueprint", payload: blueprint }, { client: ctx.client });

    if (blueprint?.action === "skip") {
      await updateQuest(questId, { stage: "closing" }, { client: ctx.client });
      return { action: "plan", ok: true, decision: "skip", msg: blueprint.msg };
    }

    // Weapon needed — advance to review
    await updateQuest(questId, { stage: "review" }, { client: ctx.client });
    return { action: "plan", ok: true, decision: "forge", blueprint };
  }

  if (stage === "review") {
    // Check if user responded to an escalation
    const { readRecentCommentThread } = await import("@/libs/quest");
    const thread = await readRecentCommentThread(questId, { client: ctx.client });
    if (thread.lastSystemComment?.detail?.escalated && !thread.hasUserReply) {
      return { action: "review_waiting", ok: true, msg: "Waiting for user response to escalation." };
    }

    const { getSkillBook } = await import("@/libs/skill_book");
    const book = getSkillBook("blacksmith");
    const result = await book.review({ guildos: { quest }, blueprint: inventory.blueprint });

    if (result?.items?.decision === "escalate") {
      const defaultBook = getSkillBook("default");
      let escalateResult;
      try {
        escalateResult = await defaultBook.escalate({ questId, comment: result.items.comment, previousAssignee: "Blacksmith" });
      } catch (e) {
        return { action: "review", ok: false, decision: "escalate", escalateError: e.message, comment: result.items.comment };
      }
      return { action: "review", ok: true, decision: "escalate", escalateResult, comment: result.items.comment?.slice(0, 200) };
    }

    if (result?.items?.decision === "skip") {
      const { updateQuest } = await import("@/libs/quest");
      await updateQuest(questId, { stage: "closing" }, { client: ctx.client });
      return { action: "review", ok: true, decision: "skip" };
    }

    if (result?.items?.decision === "ready") {
      const { updateQuest } = await import("@/libs/quest");
      await updateQuest(questId, { stage: "execute" }, { client: ctx.client });
      return { action: "review", ok: true, decision: "ready" };
    }

    return { action: "review", ok: false, msg: result?.msg || "Unexpected review result" };
  }

  if (stage === "execute") {
    const { getSkillBook } = await import("@/libs/skill_book");
    const book = getSkillBook("blacksmith");
    // blueprint is in inventory — forgeWeapon derives weapon_spec from it automatically
    const result = await book.forgeWeapon({ guildos: { quest } });
    if (result?.ok) {
      const { appendInventoryItem, updateQuest } = await import("@/libs/quest");
      await appendInventoryItem(questId, { item_key: "forge_report", payload: result.items?.forge_report ?? result.items, source: "blacksmith.forgeWeapon" }, { client: ctx.client });
      await updateQuest(questId, { stage: "closing" }, { client: ctx.client });
    }
    return { action: "forge", ok: result?.ok, items: result?.items, msg: result?.msg };
  }

  return { action: "noop", ok: false, msg: `Blacksmith has no action for stage: ${stage}` };
}
