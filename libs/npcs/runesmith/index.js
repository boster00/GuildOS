/**
 * Runesmith NPC (Nick Wildrunes)
 * Innate actions — skill book planning, review, and creation.
 * References: docs/skill-book-crafting-guideline.md (to be created)
 */

export const toc = {
  doNextAction: {
    description: "Triage based on quest stage: plan → evaluate skill book need, review → check user input, execute → create skill book via claudeCLI.",
  },
};

/**
 * Decide and perform the next action based on quest state.
 * @param {Record<string, unknown>} quest — quest row with .assignee resolved
 * @param {{ client: import("@/libs/council/database/types.js").DatabaseClient, userId: string }} ctx
 */
export async function doNextAction(quest, _ctx) {
  const stage = String(quest.stage || "");

  // Runesmith follows similar pattern to Blacksmith but for skill books.
  // Placeholder — will be fleshed out when docs/skill-book-crafting-guideline.md is written.

  if (stage === "plan") {
    return { action: "plan", ok: false, msg: "Runesmith plan not yet implemented. Needs docs/skill-book-crafting-guideline.md." };
  }

  if (stage === "review") {
    return { action: "review", ok: false, msg: "Runesmith review not yet implemented." };
  }

  if (stage === "execute") {
    return { action: "execute", ok: false, msg: "Runesmith execute not yet implemented." };
  }

  return { action: "noop", ok: false, msg: `Runesmith has no action for stage: ${stage}` };
}
