/**
 * Questmaster NPC (Wendy the Kitty / Cat)
 * Innate actions — code-defined behaviors for quest triage and assignment.
 */

export const toc = {
  doNextAction: {
    description: "Triage based on quest stage: idea → interpret, assign → assign, review with user comment → advance to execute.",
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

  if (stage === "idea") {
    // Interpret the request into a structured quest, then advance to assign
    const { getSkillBook } = await import("@/libs/skill_book");
    const book = getSkillBook("questmaster");
    const result = await book.planRequestToQuest({ initialRequest: quest.description });
    if (result?.error) return { action: "interpret", ok: false, error: result.error.message };

    // If the AI decided the request is too vague (stage: "idea"), escalate for clarification
    if (result.data?.stage === "idea") {
      const { recordQuestComment } = await import("@/libs/quest");
      const clarifyMsg =
        `This request could not be clearly understood. ` +
        `Original text: "${String(quest.description || "").slice(0, 200)}"\n\n` +
        `Please reply with a clearer description of what you need — ` +
        `for example, which system to use, what data to fetch, and any specific criteria.`;
      await recordQuestComment(questId, {
        source: "Cat",
        action: "escalate:clarification",
        summary: clarifyMsg,
        detail: { reason: "vague_request", originalDescription: quest.description, aiInterpretation: result.data },
      }, { client: ctx.client });
      return { action: "interpret:waiting_clarification", ok: true, stage: "idea", msg: clarifyMsg };
    }

    // Clear request — update quest with interpreted fields and advance to assign
    const { updateQuest } = await import("@/libs/quest");
    await updateQuest(questId, {
      title: result.data?.title || quest.title,
      description: result.data?.description || quest.description,
      stage: "assign",
    }, { client: ctx.client });
    return { action: "interpret", ok: true, stage: "assign", title: result.data?.title };
  }

  if (stage === "assign") {
    const { getSkillBook } = await import("@/libs/skill_book");
    const book = getSkillBook("questmaster");
    const result = await book.assign({ questId, guildos: { quest } });
    return { action: "assign", ok: !result?.error, ...result?.data };
  }

  if (stage === "review") {
    // Check if latest comment is from user (not system/NPC)
    const { readRecentCommentThread } = await import("@/libs/quest");
    const thread = await readRecentCommentThread(questId, { client: ctx.client });
    if (thread.hasUserReply) {
      const { updateQuest } = await import("@/libs/quest");
      const { updateQuestAssignee } = await import("@/libs/council/database/serverQuest.js");
      await updateQuest(questId, { stage: "execute" }, { client: ctx.client });
      const previousAssignee = thread.lastSystemComment?.detail?.previousAssignee;
      if (previousAssignee) {
        await updateQuestAssignee(questId, { assigneeId: null, assignedTo: previousAssignee }, { client: ctx.client });
      }
      return { action: "review_resolved", ok: true, stage: "execute", reassignedTo: previousAssignee, thread };
    }
    return { action: "review_waiting", ok: true, msg: "Waiting for user response." };
  }

  return { action: "noop", ok: false, msg: `Questmaster has no action for stage: ${stage}` };
}
