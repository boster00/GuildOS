/**
 * Guildmaster skill book — Pig uses these for recruitment / roster orchestration.
 */
export const skillBook = {
  id: "guildmaster",
  title: "Guildmaster",
  description: "Recruit adventurers and respond when the guild needs new members.",
  steps: [],
  toc: {
    callToArms: {
      description: "Activation hook when a quest is handed off for recruitment (idea-stage reroute).",
      inputExample: { quest: { id: "string", title: "string" } },
      outputExample: { ok: true },
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
