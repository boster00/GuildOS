/**
 * Blacksmith skill book — the Blacksmith uses the claudeCLI weapon to forge new weapons
 * (code files) and update the proving grounds setup steps for the user.
 */
import { skillActionOk, skillActionErr } from "@/libs/skill_book/actionResult.js";
import { invoke } from "@/libs/weapon/claudecli/index.js";
import { database } from "@/libs/council/database";
import { publicTables } from "@/libs/council/publicTables";

export const skillBook = {
  id: "blacksmith",
  title: "Blacksmith",
  description: "Forges weapons (API connectors / code modules) by invoking Claude CLI and updates proving grounds setup steps.",
  steps: [],
  toc: {
    plan: {
      description: "Evaluate whether a weapon is needed for the quest. References docs/weapon-crafting-guideline.md. Returns forge spec or skip.",
      input: {},
      output: {
        action: "string, one of: forge, skip",
        weapon_name: "string",
        msg: "string",
      },
    },
    review: {
      description: "Review blueprint from plan. Escalates to user if credentials or setup are needed, otherwise marks ready to forge.",
      input: {},
      output: {
        decision: "string, one of: ready, escalate, skip",
        msg: "string",
      },
    },
    forgeWeapon: {
      description: "Read weapon_spec from quest inventory, invoke Claude CLI to write the weapon file and skill book action, return an HTML report.",
      input: {
        weapon_spec: "object with name, description, codeGoal, actions[]",
      },
      output: {
        forge_report: "string, HTML report of what was created",
      },
    },
    updateProvingGrounds: {
      description: "Read setup_steps from quest inventory and save them to council_settings.proving_grounds_setup for the current user.",
      input: {
        setup_steps: "array of strings, e.g. ['Step 1: ...', 'Step 2: ...']",
      },
      output: {
        saved: "boolean",
      },
    },
  },
};

/** Read a key from the quest inventory regardless of whether it is an array or map. */
function readInventoryKey(guildos, key) {
  const quest = guildos?.quest && typeof guildos.quest === "object" ? guildos.quest : null;
  if (!quest) return undefined;
  const inv = /** @type {unknown} */ (quest.inventory);
  if (Array.isArray(inv)) {
    const entry = inv.find((i) => i && (i.item_key === key || i.key === key));
    return entry?.payload !== undefined ? entry.payload : entry?.value;
  }
  if (inv && typeof inv === "object" && !Array.isArray(inv)) {
    return /** @type {Record<string, unknown>} */ (inv)[key];
  }
  return undefined;
}

/**
 * @param {unknown} [a]
 * @param {unknown} [b]
 */
export async function forgeWeapon(a, b) {
  const input = b !== undefined && typeof b === "object" && b !== null && !Array.isArray(b) ? b
    : a !== undefined && typeof a === "object" && a !== null && !Array.isArray(a) ? a : {};
  const raw = /** @type {Record<string, unknown>} */ (input);

  const guildos = raw.guildos && typeof raw.guildos === "object" && !Array.isArray(raw.guildos)
    ? /** @type {Record<string, unknown>} */ (raw.guildos) : null;

  // weapon_spec may come from input, inventory, or be derived from blueprint (Blacksmith NPC plan stores blueprint, not weapon_spec)
  const blueprintFallback = readInventoryKey(guildos, "blueprint");
  const derivedFromBlueprint = blueprintFallback && typeof blueprintFallback === "object"
    && typeof blueprintFallback.weapon_name === "string" && blueprintFallback.weapon_name
    ? {
        name: blueprintFallback.weapon_name,
        description: String(blueprintFallback.msg || ""),
        codeGoal: `Create or expand the ${blueprintFallback.weapon_name} weapon connector. ${blueprintFallback.msg || ""} Actions to implement: ${Array.isArray(blueprintFallback.actions_to_implement) ? blueprintFallback.actions_to_implement.join(", ") : "see blueprint"}.`,
        actions: Array.isArray(blueprintFallback.actions_to_implement) ? blueprintFallback.actions_to_implement : [],
      }
    : null;
  const spec = raw.weapon_spec ?? readInventoryKey(guildos, "weapon_spec") ?? derivedFromBlueprint ?? null;
  if (!spec || typeof spec !== "object") {
    return skillActionErr("forgeWeapon: weapon_spec is required (in input, quest inventory, or derivable from blueprint).");
  }
  const s = /** @type {Record<string, unknown>} */ (spec);
  const weaponName = typeof s.name === "string" ? s.name.trim() : "";
  if (!weaponName) {
    return skillActionErr("forgeWeapon: weapon_spec.name is required.");
  }

  const codeGoal = typeof s.codeGoal === "string" ? s.codeGoal : typeof s.description === "string" ? s.description : "";
  const actions = Array.isArray(s.actions) ? s.actions.map((x) => String(x)).join(", ") : "";
  const targetSkillBook = typeof s.targetSkillBook === "string" ? s.targetSkillBook.trim() : "";

  const prompt = `You are writing production-quality JavaScript for a Next.js 15 project called GuildOS.
The project root is the current working directory. Use ES module syntax (import/export). No TypeScript.

## Task
${codeGoal}

## Project conventions
- Skill books live at libs/skill_book/<name>/index.js
- Weapons live at libs/weapon/<name>/index.js
- Skill book actions return { ok, msg, items } via skillActionOk/skillActionErr from @/libs/skill_book/actionResult.js
- TOC entries use inputExample and outputExample objects for UI field generation
- New skill books must be registered in libs/skill_book/index.js (SKILL_BOOKS and ADVENTURER_REGISTRY)
- New weapons must be registered in libs/weapon/registry.js (WEAPONS array)
- IMPORTANT: When adding a new action to an existing skill book, you must ALSO update libs/skill_book/index.js:
  1. Add the new function name to the import statement for that skill book
  2. Add it to that skill book's adventurerActions object (follow the pattern of existing entries)
- Follow the patterns in existing files exactly (e.g. testskillbook/index.js for action patterns)

## Spec
Name: ${weaponName}
${targetSkillBook ? `Target skill book: libs/skill_book/${targetSkillBook}/index.js` : ""}
Actions: ${actions || "inferred from goal"}

## Rules
- Do NOT create helper functions for logic used only once — inline it.
- Do NOT create files beyond what is needed.
- If modifying an existing file, keep changes minimal — add only, do not rewrite.
- Match the code style of the file you are editing.

## Output format
Your ENTIRE output must be a single valid HTML document. No markdown. No prose outside the HTML tags.
Structure the report as:
- A summary of what was created/modified
- For each file: show the full file path as a heading, then the complete file content in a <pre><code> block
- A "Verification" section listing what to check to confirm it works
- Use dark-themed CSS (background #1a1a1a, text #d1d5db, headings #a78bfa, code blocks #111)

Begin with <!DOCTYPE html> immediately. Do not include any text before it.`;

  const result = await invoke(prompt);

  if (!result.ok) {
    return skillActionErr(`forgeWeapon: claudeCLI failed — ${result.error || "unknown error"}`, { html: result.html });
  }

  return skillActionOk({ forge_report: result.html });
}

/**
 * @param {unknown} [a]
 * @param {unknown} [b]
 */
export async function updateProvingGrounds(a, b) {
  const input = b !== undefined && typeof b === "object" && b !== null && !Array.isArray(b) ? b
    : a !== undefined && typeof a === "object" && a !== null && !Array.isArray(a) ? a : {};
  const raw = /** @type {Record<string, unknown>} */ (input);

  const guildos = raw.guildos && typeof raw.guildos === "object" && !Array.isArray(raw.guildos)
    ? /** @type {Record<string, unknown>} */ (raw.guildos) : null;
  const profile = guildos?.profile && typeof guildos.profile === "object" && !Array.isArray(guildos.profile)
    ? /** @type {Record<string, unknown>} */ (guildos.profile) : null;

  const steps = raw.setup_steps ?? readInventoryKey(guildos, "setup_steps") ?? null;
  const stepsArr = Array.isArray(steps) ? steps.map((s) => String(s)) : null;
  if (!stepsArr || stepsArr.length === 0) {
    return skillActionErr("updateProvingGrounds: setup_steps array is required (in input or quest inventory).");
  }

  const ownerId = typeof profile?.owner_id === "string" ? profile.owner_id
    : typeof profile?.id === "string" ? profile.id : null;
  if (!ownerId) {
    return skillActionErr("updateProvingGrounds: could not resolve owner_id from guildos.profile.");
  }

  const db = await database.init("service");
  const { data: existing } = await db.from(publicTables.profiles).select("council_settings").eq("id", ownerId).single();
  const current = existing?.council_settings && typeof existing.council_settings === "object"
    ? existing.council_settings : {};
  const updated = { ...current, proving_grounds_setup: stepsArr };

  const { error } = await db.from(publicTables.profiles).update({ council_settings: updated }).eq("id", ownerId);
  if (error) {
    return skillActionErr(`updateProvingGrounds: failed to save settings — ${error.message}`);
  }

  return skillActionOk({ saved: true, step_count: stepsArr.length });
}

/**
 * Plan action — reads the weapon crafting guideline, evaluates whether a weapon is needed.
 * Returns { action: "forge", weapon_name, ... } or { action: "skip", msg }.
 */
export async function plan(a, b) {
  const input = b !== undefined && typeof b === "object" && b !== null && !Array.isArray(b) ? b
    : a !== undefined && typeof a === "object" && a !== null && !Array.isArray(a) ? a : {};
  const raw = /** @type {Record<string, unknown>} */ (input);

  const guildos = raw.guildos && typeof raw.guildos === "object" && !Array.isArray(raw.guildos)
    ? /** @type {Record<string, unknown>} */ (raw.guildos) : null;
  const quest = guildos?.quest && typeof guildos.quest === "object"
    ? /** @type {Record<string, unknown>} */ (guildos.quest) : {};

  const description = String(quest.description || raw.description || "");
  if (!description) {
    return skillActionErr("plan: quest description is required to evaluate weapon need.");
  }

  // Read the guideline doc for the prompt template
  const fs = await import("fs");
  const path = await import("path");
  const guidelinePath = path.join(process.cwd(), "docs/weapon-crafting-guideline.md");
  let guideline = "";
  try {
    guideline = fs.readFileSync(guidelinePath, "utf-8");
  } catch {
    return skillActionErr("plan: could not read docs/weapon-crafting-guideline.md");
  }

  // Extract the plan prompt template from the guideline
  const templateMatch = guideline.match(/## Plan prompt template\s*```([\s\S]*?)```/);
  const template = templateMatch ? templateMatch[1].trim() : "";
  if (!template) {
    return skillActionErr("plan: no plan prompt template found in weapon-crafting-guideline.md");
  }

  // Fill in the template
  const prompt = template.replace("{quest.description}", description);

  const { runDungeonMasterChat } = await import("@/libs/council/ai/chatCompletion.js");
  const { getAdventurerExecutionContext } = await import("@/libs/adventurer/advance.js");
  const execCtx = getAdventurerExecutionContext();
  let aiText = "";
  try {
    const out = await runDungeonMasterChat({
      userId: execCtx?.userId,
      client: execCtx?.client,
      messages: [{ role: "user", content: prompt }],
    });
    aiText = out.text;
  } catch (err) {
    return skillActionErr(`plan: AI call failed — ${err instanceof Error ? err.message : String(err)}`);
  }

  // Parse response
  let parsed = null;
  try {
    const jsonMatch = aiText.match(/\{[\s\S]*\}/);
    if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
  } catch { /* fall through */ }

  if (!parsed || !parsed.action) {
    return skillActionErr("plan: AI did not return valid JSON with action field.");
  }

  if (parsed.action === "skip") {
    return skillActionOk({
      blueprint: { action: "skip", msg: parsed.msg || "No weapon needed." },
      meta: { prompt, modelText: aiText },
    });
  }

  return skillActionOk({
    blueprint: {
      action: "forge",
      weapon_name: parsed.weapon_name || "",
      external_system: parsed.external_system || "",
      auth_type: parsed.auth_type || "env_var",
      credentials_needed: parsed.credentials_needed || "",
      requires_user_setup: Boolean(parsed.requires_user_setup),
      user_setup_reason: parsed.user_setup_reason || "",
      setup_steps: Array.isArray(parsed.setup_steps) ? parsed.setup_steps : [],
      actions_to_implement: Array.isArray(parsed.actions_to_implement) ? parsed.actions_to_implement : [],
      msg: parsed.msg || "",
    },
    meta: { prompt, modelText: aiText },
  });
}

/**
 * Review action — reads blueprint from inventory, applies review criteria from the guideline doc.
 * Escalates to review (Pig) if user input needed, or proceeds to forge.
 */
export async function review(a, b) {
  const input = b !== undefined && typeof b === "object" && b !== null && !Array.isArray(b) ? b
    : a !== undefined && typeof a === "object" && a !== null && !Array.isArray(a) ? a : {};
  const raw = /** @type {Record<string, unknown>} */ (input);

  const guildos = raw.guildos && typeof raw.guildos === "object" && !Array.isArray(raw.guildos)
    ? /** @type {Record<string, unknown>} */ (raw.guildos) : null;
  const blueprint = raw.blueprint || readInventoryKey(guildos, "blueprint") || null;
  if (!blueprint || typeof blueprint !== "object") {
    return skillActionErr("review: blueprint not found in inventory. Run plan first.");
  }

  const bp = /** @type {Record<string, unknown>} */ (blueprint);

  // If plan said skip, just pass through
  if (bp.action === "skip") {
    return skillActionOk({
      decision: "skip",
      msg: bp.msg || "No weapon needed.",
    });
  }

  // Apply review criteria from the guideline doc
  const escalateReasons = [];

  // 1. Credentials not yet configured
  if (bp.requires_user_setup) {
    escalateReasons.push(`User setup required: ${bp.user_setup_reason || bp.credentials_needed || "credentials needed"}`);
  }

  // 2. Ambiguous external system
  if (!bp.weapon_name || !bp.external_system) {
    escalateReasons.push("External system is not clearly identified in the blueprint.");
  }

  // 3. Multiple systems (check if description mentions multiple)
  const actions = Array.isArray(bp.actions_to_implement) ? bp.actions_to_implement : [];
  if (actions.length === 0) {
    escalateReasons.push("No actions specified in blueprint.");
  }

  if (escalateReasons.length > 0) {
    // Escalate — return comment for the quest
    const credKey = bp.credentials_needed ? String(bp.credentials_needed).split("—")[0].trim() : "";
    const comment = [
      "Weapon blueprint review — user input needed:",
      "",
      ...escalateReasons.map((r, i) => `${i + 1}. ${r}`),
      "",
      `Weapon: ${bp.weapon_name || "(unnamed)"}`,
      `External system: ${bp.external_system || "(unspecified)"}`,
      "",
      "Please add the following in the [Formulary](/town/council-hall/formulary):",
      ...(credKey ? [`  • Key name: \`${credKey}\``] : []),
      `  • Description: ${bp.credentials_needed || "see setup steps"}`,
      ...(Array.isArray(bp.setup_steps) && bp.setup_steps.length > 0
        ? ["", "Setup steps:", ...bp.setup_steps.map((s, i) => `  ${i + 1}. ${s}`)]
        : []),
      "",
      "Once saved, reply 'done' to this comment to resume.",
    ].join("\n");

    return skillActionOk({
      decision: "escalate",
      escalateReasons,
      comment,
      msg: "User input needed before forging. Escalating to review.",
    });
  }

  // Ready to forge
  return skillActionOk({
    decision: "ready",
    blueprint: bp,
    msg: `Ready to forge weapon: ${bp.weapon_name}`,
  });
}

export default { skillBook, plan, review, forgeWeapon, updateProvingGrounds };
