/**
 * Guildmaster NPC (Oinky the Piggy / Pig)
 * Innate actions — handles review escalations and adventurer recruitment.
 */

export const toc = {
  doNextAction: {
    description: "Triage based on quest stage: review → present to user (wait for comment), plan (prepare_adventurer) → plan adventurer setup.",
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

  if (stage === "review") {
    const { readRecentCommentThread, recordQuestComment } = await import("@/libs/quest");
    const thread = await readRecentCommentThread(questId, { client: ctx.client });

    // No new user comment → skip
    if (!thread.hasUserReply) {
      return { action: "review_waiting", ok: true, msg: "No new user comment. Waiting." };
    }

    // User replied — evaluate with AI whether the issue is resolved
    const npcComment = thread.lastSystemComment?.summary || "";
    const userReplies = thread.userReplies.map(c => c.summary).join("\n");

    const { runDungeonMasterChat } = await import("@/libs/council/ai/chatCompletion.js");
    const prompt = `You are the Guildmaster reviewing an escalated quest.

The system asked the user to do something:
${npcComment}

The user replied:
${userReplies}

Evaluate whether the user's reply resolves the underlying need — not just literal compliance with the exact wording. The user may:
- Confirm they completed the exact steps asked
- Propose a valid alternative that achieves the same goal (e.g. providing a different credential type that works equally well)
- Ask for clarification or push back

Accept alternatives if they reasonably solve the same problem. Only mark unresolved if the user has NOT addressed the underlying need at all.

Respond with ONLY one JSON object:
If the user's reply resolves the need (including valid alternatives): {"resolved": true, "msg": "<brief confirmation of what was accepted>"}
If the user has NOT addressed the need: {"resolved": false, "msg": "<what is still needed, in plain language>"}`;

    let aiText = "";
    try {
      const out = await runDungeonMasterChat({
        userId: ctx.userId,
        client: ctx.client,
        messages: [{ role: "user", content: prompt }],
      });
      aiText = out.text;
    } catch (err) {
      return { action: "review_evaluate", ok: false, error: err.message };
    }

    let parsed = null;
    try {
      const match = aiText.match(/\{[\s\S]*\}/);
      if (match) parsed = JSON.parse(match[0]);
    } catch { /* */ }

    if (parsed?.resolved) {
      // Resolved — advance to execute and reassign back
      const { updateQuest } = await import("@/libs/quest");
      const { updateQuestAssignee } = await import("@/libs/council/database/serverQuest.js");
      await updateQuest(questId, { stage: "execute" }, { client: ctx.client });
      const previousAssignee = thread.lastSystemComment?.detail?.previousAssignee;
      if (previousAssignee) {
        await updateQuestAssignee(questId, { assigneeId: null, assignedTo: previousAssignee }, { client: ctx.client });
      }
      return { action: "review_resolved", ok: true, stage: "execute", reassignedTo: previousAssignee, aiMsg: parsed.msg, meta: { prompt, modelText: aiText } };
    }

    // Not resolved — post follow-up comment
    await recordQuestComment(questId, {
      source: "system",
      action: "review_followup",
      summary: parsed?.msg || "The issue does not appear to be resolved. Please check and try again.",
      detail: { escalated: true, previousAssignee: thread.lastSystemComment?.detail?.previousAssignee },
    }, { client: ctx.client });
    return { action: "review_followup", ok: true, msg: parsed?.msg, meta: { prompt, modelText: aiText } };
  }

  if (stage === "plan") {
    // Prepare adventurer — use pre-engineered prompts to decide autonomous vs user setup
    // For now, always escalate to user for adventurer configuration
    const { getSkillBook } = await import("@/libs/skill_book");
    const defaultBook = getSkillBook("default");
    await defaultBook.escalate({
      questId,
      comment: `Adventurer recruitment needed for: ${quest.description || quest.title}. Please provide the adventurer's name, capabilities, and which skill books they should carry.`,
    });
    return { action: "escalate_recruitment", ok: true, msg: "Escalated to user for adventurer configuration." };
  }

  return { action: "noop", ok: false, msg: `Guildmaster has no action for stage: ${stage}` };
}
