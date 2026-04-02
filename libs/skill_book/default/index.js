/**
 * Default skill book — helpers every adventurer is considered to carry (JSON parsing, inventory bridging).
 */
import { runDungeonMasterChat } from "@/libs/council/ai/chatCompletion.js";
import { skillActionOk, skillActionErr } from "@/libs/skill_book/actionResult.js";

export const definition = {
  id: "default",
  title: "Default",
  description: "Built-in helpers: JSON extraction, inventory bridging between action steps.",
  toc: [
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

/** Alias for dispatch / pipelines that expect the `run*` naming convention. */
export { organizeInventory as runOrganizeInventory };
