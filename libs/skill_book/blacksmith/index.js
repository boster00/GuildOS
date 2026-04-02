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
    forgeWeapon: {
      description: "Reads weapon_spec from quest inventory, invokes Claude CLI to write the weapon file + skill book action, returns HTML report.",
      inputExample: { weapon_spec: { name: "string", description: "string", codeGoal: "string", actions: [] } },
      outputExample: { html: "string", report_html: "string" },
    },
    updateProvingGrounds: {
      description: "Reads setup_steps from quest inventory and saves them to council_settings.proving_grounds_setup for the current user.",
      inputExample: { setup_steps: ["Step 1: ...", "Step 2: ..."] },
      outputExample: { saved: true },
    },
  },
};

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
  const questInventory = guildos?.quest && typeof guildos.quest === "object" && !Array.isArray(guildos.quest)
    ? /** @type {Record<string, unknown>} */ (/** @type {Record<string, unknown>} */ (guildos.quest).inventory ?? {}) : {};

  const spec = raw.weapon_spec ?? questInventory.weapon_spec ?? null;
  if (!spec || typeof spec !== "object") {
    return skillActionErr("forgeWeapon: weapon_spec is required (in input or quest inventory).");
  }
  const s = /** @type {Record<string, unknown>} */ (spec);
  const weaponName = typeof s.name === "string" ? s.name.trim() : "";
  if (!weaponName) {
    return skillActionErr("forgeWeapon: weapon_spec.name is required.");
  }

  const codeGoal = typeof s.codeGoal === "string" ? s.codeGoal : typeof s.description === "string" ? s.description : "";
  const actions = Array.isArray(s.actions) ? s.actions.map((x) => String(x)).join(", ") : "";
  const safeName = weaponName.toLowerCase().replace(/[^a-z0-9_-]/g, "_");

  const prompt = `You are writing production-quality JavaScript for a Next.js 15 project called GuildOS.
The project root is the current working directory. Use ES module syntax (import/export). No TypeScript.

Your task: Create a new weapon module and wire it into an existing skill book action.

## Weapon spec
Name: ${weaponName}
File to create: libs/weapon/${safeName}/index.js
Goal: ${codeGoal}
Actions to export: ${actions || "inferred from goal"}

## Instructions
1. Create libs/weapon/${safeName}/index.js — export one named async function per action. Each function accepts an input object and returns { ok, data?, error? }.
2. Add the weapon to libs/weapon/registry.js — append to the WEAPONS array: { id: "${safeName}", title: "${weaponName}", description: "<one sentence>", requiresActivation: false }
3. If the spec mentions wiring into an existing skill book action (e.g. testskillbook "test" action), update that skill book file to import and call the weapon. Keep the update minimal — do not rewrite the whole file.
4. Do NOT create helper functions for logic used only once — inline it.
5. Do NOT create additional files beyond what is listed above.

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

  return skillActionOk({ html: result.html, report_html: result.html });
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
  const questInventory = guildos?.quest && typeof guildos.quest === "object" && !Array.isArray(guildos.quest)
    ? /** @type {Record<string, unknown>} */ (/** @type {Record<string, unknown>} */ (guildos.quest).inventory ?? {}) : {};
  const profile = guildos?.profile && typeof guildos.profile === "object" && !Array.isArray(guildos.profile)
    ? /** @type {Record<string, unknown>} */ (guildos.profile) : null;

  const steps = raw.setup_steps ?? questInventory.setup_steps ?? null;
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

export default { skillBook, forgeWeapon, updateProvingGrounds };
