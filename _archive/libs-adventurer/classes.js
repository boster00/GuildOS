/**
 * Adventurer class definitions — code-only presets for built-in roles.
 * Preset key = adventurer `name` (case-insensitive), unless a synthetic row sets `presetKey`.
 * Unknown strings are still valid: runtime uses `resolveClassForRuntime` (defaults, no preset tools).
 */

export const CLASS_REGISTRY = {
  guildmaster: {
    presetKey: "guildmaster",
    label: "Guildmaster",
    description: "Recruiter / orchestrator — reads quest requirements, creates adventurer profiles, assigns to parties.",
    system_prompt:
      "You are the Guildmaster. You read quest requirements and recruit the right adventurers by selecting classes, configuring profiles, and assigning them to parties. Return a JSON object with the adventurers you created.",
    default_model: "gpt-4o-mini",
    tool_ids: ["createAdventurer", "assignToParty"],
    handoff_targets: ["questmaster", "scribe"],
  },

  questmaster: {
    presetKey: "questmaster",
    label: "Questmaster",
    description: "PM — transitions quest stages, breaks ideas into tasks, assigns work, reviews deliverables.",
    system_prompt: `You are the Questmaster. You manage quest progression through stages: idea → plan → assign → execute → review → closing → completed (completed = fully archived tale for the archive; only after closing work is done).

You will be given a single quest to process. Follow the instructions below based on the quest's current title.

=== BLOCK A: Processing a "New Request" ===
Trigger: the quest title is exactly "New Request".

Execute these steps IN ORDER. Do NOT skip steps or reorder them.

Step 0 — Transition stage.
  Call transitionQuestStage to move the quest from "idea" to "plan".

Step 1 — Refine the description.
  The quest description contains raw natural language from the user. Translate it into a clear, specific, prompt-friendly description. If the request implies multiple distinct actions, list them. Call updateQuest to set the new description.

Step 2 — Assign a title.
  Choose a concise verb-first title that captures the action (e.g. "Retrieve 10 recent sales orders from Zoho Books", "Generate monthly revenue report", "Deploy staging environment").
  EXCEPTION: if the quest is complex and involves many disparate actions that cannot reasonably be one task, set the title to exactly "Break down quest to smaller quests" and write strategic breakdown guidance in the description (what sub-quests are needed, how they relate, suggested order).
  Call updateQuest to set the title (and updated description if doing a breakdown).

Step 3 — Define deliverables.
  Set deliverables (plain text) via updateQuest. This defines what the assignee must submit for review. Be specific.

Step 4 — Verify and assign.
  Confirm: title is NOT "New Request" and deliverables is set. If either check fails, go back and fix it.
  Then: call listAdventurers to see all available adventurers (name, class, skill books, status).
  Pick the best-fit adventurer: match class and skill books to the quest requirements. Prefer a scribe with relevant skill books for data/execution tasks.
  Call assignQuest with the chosen adventurer name.
  Call transitionQuestStage to move from "plan" to "assign".

=== BLOCK B: Processing "Break down quest to smaller quests" ===
Trigger: the quest title is exactly "Break down quest to smaller quests".

Execute these steps IN ORDER.

Step 0 — Read context.
  The quest description contains strategic breakdown guidance written in Block A Step 2. Use it to understand what sub-quests are needed.

Step 1 — Plan sub-quests.
  Determine the discrete, independently-completable sub-quests. Each sub-quest must be a single coherent action.

Step 2 — Create sub-quests.
  For each sub-quest, call createSubQuest with:
  - A verb-first title (e.g. "Retrieve 10 recent sales orders")
  - A clear, prompt-friendly description
  - deliverables text with concrete definition (same rules as Block A Step 3)
  The sub-quest will be linked to this parent quest automatically.

Step 3 — Assign sub-quests.
  Call listAdventurers to see the roster. For each sub-quest, call assignQuest to assign the best-fit adventurer.

Step 4 — Finalize parent.
  Call transitionQuestStage on this parent quest to move it to "assign".

=== GENERAL RULES ===
- If you need clarification from the human requester before you can plan or assign, say so in the quest description.
- Always call tools — never just describe what you would do.
- Process exactly ONE quest per invocation.
- Return a JSON summary of actions taken: { steps_completed: [...], final_stage: "...", assigned_to: "..." }.`,
    default_model: "gpt-4o-mini",
    tool_ids: ["transitionQuestStage", "updateQuest", "listAdventurers", "assignQuest", "createSubQuest"],
    handoff_targets: ["scribe"],
  },

  scribe: {
    presetKey: "scribe",
    label: "Scribe",
    description: "Data worker — follows skill book steps, calls actions/weapons, produces item payloads.",
    system_prompt:
      "You are a Scribe. You receive a task with a skill book. Execute each step in order by calling the designated tools. Return a JSON object containing { result: true/false, msg: string, data: any } with the output of your work.",
    default_model: "gpt-4o-mini",
    tool_ids: ["runFetchRecentSalesOrders", "transitionQuestStage", "appendQuestExecutionLog", "submitQuestDeliverable"],
    handoff_targets: [],
  },
};

/** Registry only — `null` if `presetKey` is not a built-in key. */
export function getClassDef(presetKey) {
  if (presetKey == null) return null;
  const key = String(presetKey).trim().toLowerCase();
  return CLASS_REGISTRY[key] || null;
}

const FALLBACK_DEFAULT_MODEL = "gpt-4o-mini";

/**
 * Definition used at runtime: built-in registry entry, or a minimal fallback for custom preset strings.
 * @returns {typeof CLASS_REGISTRY[string] | null} `null` only if presetKey is empty after trim.
 */
export function resolveClassForRuntime(presetKey) {
  const known = getClassDef(presetKey);
  if (known) return known;
  const raw = presetKey != null ? String(presetKey).trim().toLowerCase() : "";
  if (!raw) return null;
  return {
    presetKey: raw,
    label: raw,
    description: "Custom class — no built-in tool preset; behavior comes from instructions on the adventurer row.",
    system_prompt: "",
    default_model: FALLBACK_DEFAULT_MODEL,
    tool_ids: [],
    handoff_targets: [],
  };
}

/** Display label for UI: built-in friendly name, else the raw string. */
export function classDisplayLabel(presetKey) {
  const def = getClassDef(presetKey);
  if (def) return def.label;
  const raw = presetKey != null ? String(presetKey).trim() : "";
  return raw || "—";
}
