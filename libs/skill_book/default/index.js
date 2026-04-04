/**
 * Default skill book — helpers every adventurer is considered to carry (JSON parsing, inventory bridging).
 */
import { runDungeonMasterChat } from "@/libs/council/ai/chatCompletion.js";
import { skillActionOk, skillActionErr } from "@/libs/skill_book/actionResult.js";

export const definition = {
  id: "default",
  title: "Default",
  description: "Built-in helpers: JSON extraction, inventory bridging, escalation.",
  toc: [
    {
      id: "escalate",
      summary: "Escalate the quest to review. Sets stage to review, assigns to Guildmaster (Pig), posts the comment. Returns { escalated: true }.",
      input: {
        questId: { type: "string", required: true },
        comment: { type: "string", required: true, description: "Non-empty reason for escalation." },
      },
      output: { escalated: { type: "boolean" } },
    },
    {
      id: "organizeInventory",
      summary: "Bridge between actions: given quest context and current inventory, produce the input items needed by the next action.",
      input: {
        questTitle: { type: "string", required: true },
        questDescription: { type: "string", required: true },
        questDeliverables: { type: "string", required: false },
        currentItems: { type: "array", required: true, description: "Current quest inventory items." },
        neededInputSpec: { type: "object", required: true, description: "Input schema of the upcoming action." },
      },
      output: { items: { type: "array", description: "New or updated inventory items to merge." } },
    },
  ],
  steps: [],
};

/**
 * @param {string} text
 * @returns {Record<string, unknown> | null}
 */
function extractJson(text) {
  if (text == null || typeof text !== "string") return null;
  let s = text.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)```/im.exec(s);
  if (fence) s = fence[1].trim();
  const start = s.indexOf("{");
  if (start === -1) return null;
  for (let i = start; i < s.length; i++) {
    if (s[i] !== "{") continue;
    let depth = 0;
    for (let j = i; j < s.length; j++) {
      if (s[j] === "{") depth++;
      else if (s[j] === "}") {
        depth--;
        if (depth === 0) {
          try {
            const obj = JSON.parse(s.slice(i, j + 1));
            if (obj && typeof obj === "object" && !Array.isArray(obj)) return obj;
          } catch { /* try next */ }
          break;
        }
      }
    }
  }
  return null;
}

/**
 * Bridge action: derive missing input items from quest context + existing inventory.
 * @param {string} userId
 * @param {{ questTitle: string, questDescription: string, questDeliverables?: string, currentItems: unknown[], neededInputSpec: Record<string, unknown>, client: import("@/libs/council/database/types.js").DatabaseClient }} opts
 */
export async function organizeInventory(userId, { questTitle, questDescription, questDeliverables, currentItems, neededInputSpec, client }) {
  const prompt = `You are an inventory organizer for a quest execution engine.

Quest context:
- Title: ${questTitle}
- Description: ${questDescription}
- Deliverables: ${questDeliverables || "(none)"}

Current inventory items:
${JSON.stringify(currentItems, null, 2)}

The next action requires these input keys:
${JSON.stringify(neededInputSpec, null, 2)}

Produce a JSON object with ONLY the keys listed above, filled in from the quest context and inventory.
If a value cannot be determined, use a sensible default.
Respond with ONLY the JSON object.`;

  let aiText = "";
  try {
    const out = await runDungeonMasterChat({
      userId,
      messages: [{ role: "user", content: prompt }],
      model: undefined,
      client,
    });
    aiText = out.text;
  } catch (err) {
    return skillActionErr(err instanceof Error ? err.message : String(err));
  }

  const parsed = extractJson(aiText);
  if (!parsed) {
    return skillActionErr("organizeInventory: model did not return valid JSON.");
  }

  return skillActionOk(parsed);
}

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

  // Set stage to review
  const { error: stageErr } = await updateQuest(questId, { stage: "review" }, { client });
  if (stageErr) return skillActionErr(`escalate: failed to set review stage — ${stageErr.message}`);

  // Assign to Pig (Guildmaster)
  await updateQuestAssignee(questId, { assigneeId: null, assignedTo: "Pig" }, { client });

  // Post comment with previous assignee stored for reassignment after review
  await recordQuestComment(questId, {
    summary: comment,
    detail: { escalated: true, previousAssignee },
  }, { client });

  return skillActionOk({ escalated: true, questId, assignedTo: "Pig" });
}

/** Alias for dispatch / pipelines that expect the `run*` naming convention. */
export { organizeInventory as runOrganizeInventory };
