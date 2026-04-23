/**
 * Guildmaster skill book — Pig uses these for recruitment / roster orchestration.
 */
export const skillBook = {
  id: "guildmaster",
  title: "Guildmaster",
  description: "Recruit adventurers, dispatch new quests, handle escalations.",
  steps: [],
  toc: {
    callToArms: {
      description: "Trigger recruitment when a quest is handed off (idea-stage reroute).",
      input: {
        quest: "object with id, title",
      },
      output: {
        ok: "boolean",
      },
    },
    dispatchWork: {
      description: "Hand a new quest to an adventurer.",
      howTo: `
1. Create the quest in DB with full WBS description, deliverables, and priority.
2. Set \`assignee_id\` and \`assigned_to\` to the chosen adventurer.
3. Send the adventurer a short message: "You have a new quest assigned. Use searchQuests to check."
4. NEVER send raw task instructions in chat — the quest description IS the task spec.

Do NOT:
- Send full task descriptions in chat messages (use quests).
- Ask the user to do things you can do yourself.
- Skip quest creation and go straight to agent chat.
- Auto-provision credentials without user awareness. If an agent is missing env vars, it should escalate. The user decides what to share.
`,
    },
    handleEscalation: {
      description: "Process an escalated quest.",
      howTo: `
1. Check GM desk for escalated quests.
2. Evaluate if you can resolve (credentials, local commands, config).
3. If yes: resolve, post a comment explaining the fix, move the quest back to \`execute\`.
4. If no: flag for user attention.
`,
    },
  },
};

/**
 * @param {string} userId
 * @param {Record<string, unknown>} [input]
 */
export async function callToArms(userId, input) {
  const quest =
    input && typeof input === "object" && input !== null && "quest" in input
      ? /** @type {Record<string, unknown>} */ (input).quest
      : null;
  console.log("[GuildOS:guildmaster:callToArms]", "call to arms is activated", {
    userId: typeof userId === "string" ? `${userId.slice(0, 8)}…` : userId,
    questId: quest && typeof quest === "object" && quest !== null && "id" in quest ? quest.id : undefined,
  });
  return { ok: true };
}

export default { skillBook, callToArms };
