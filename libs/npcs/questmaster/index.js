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
    // Evaluate if the request is clear enough and has measurable done criteria
    const { getSkillBook } = await import("@/libs/skill_book");
    const book = getSkillBook("questmaster");
    const result = await book.interpretIdea({ initialRequest: quest.description, adventurerName: "TBD" });
    if (result?.error) return { action: "interpret", ok: false, error: result.error.message };

    // Unclear request — leave clarification question, kick to review assigned to Pig
    if (result.data?.clear === false) {
      const { updateQuest, recordQuestComment } = await import("@/libs/quest");
      const { updateQuestAssignee } = await import("@/libs/council/database/serverQuest.js");
      await recordQuestComment(questId, {
        source: "Cat",
        action: "escalate:clarification",
        summary: result.data.question,
        detail: { reason: "unclear_request", originalDescription: quest.description },
      }, { client: ctx.client });
      await updateQuestAssignee(questId, { assigneeId: null, assignedTo: "Pig" }, { client: ctx.client });
      await updateQuest(questId, { stage: "review" }, { client: ctx.client });
      return { action: "interpret:needs_clarification", ok: true, stage: "review", question: result.data.question };
    }

    // Clear request — set action-verb title, keep original description, advance to assign
    const { updateQuest } = await import("@/libs/quest");
    await updateQuest(questId, {
      title: result.data?.title || quest.title,
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
