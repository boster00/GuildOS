/**
 * Default skill book — shared escalate action.
 */
import { skillActionOk, skillActionErr } from "@/libs/skill_book/actionResult.js";

export const definition = {
  id: "default",
  title: "Default",
  description: "Escalate the quest when truly blocked.",
  toc: {
    escalate: {
      description: "Escalate the quest to review. Sets stage to review, assigns to Guildmaster (Pig), posts the comment.",
      input: {
        questId: "string, the quest ID",
        comment: "string, non-empty reason for escalation",
      },
      output: {
        escalated: "boolean",
      },
    },
  },
  steps: [],
};

/**
 * Escalate a quest to review — sets stage, assigns to Pig, posts comment.
 * Any NPC or adventurer can call this.
 *
 * @param {string} _userId
 * @param {Record<string, unknown>} input
 */
export async function escalate(_userId, input) {
  const questId = String(input?.questId || input?.guildos?.quest?.id || "").trim();
  const comment = String(input?.comment || "").trim();

  if (!questId) return skillActionErr("escalate: questId is required.");
  if (!comment) return skillActionErr("escalate: comment is required (reason for escalation).");

  const { updateQuest, recordQuestComment } = await import("@/libs/quest");
  const { updateQuestAssignee } = await import("@/libs/council/database/serverQuest.js");
  const { getAdventurerExecutionContext } = await import("@/libs/adventurer/advance.js");
  const client = getAdventurerExecutionContext()?.client;
  if (!client) return skillActionErr("escalate: no execution context client.");

  // Read current assignee before overwriting
  const previousAssignee = input?.previousAssignee || input?.guildos?.quest?.assigned_to || null;

  // Set stage to escalated — assignee stays the same (adventurer owns the quest)
  const { error: stageErr } = await updateQuest(questId, { stage: "escalated" }, { client });
  if (stageErr) return skillActionErr(`escalate: failed to set escalated stage — ${stageErr.message}`);

  // Post comment with escalation details
  await recordQuestComment(questId, {
    summary: comment,
    detail: { escalated: true, previousAssignee },
  }, { client });

  return skillActionOk({ escalated: true, questId });
}

