/**
 * Blacksmith skill book — pure text registry.
 * Each action value is a natural-language prompt describing how the adventurer
 * should perform the action. The adventurer uses weapons (claudecli, database)
 * inline to execute. No JS logic here.
 */

export const skillBook = {
  id: "blacksmith",
  title: "Blacksmith",
  description: "Forges new weapons and skill books, and records proving-grounds setup steps for the user.",

  toc: {
    plan: "Read the quest description and decide whether a new weapon is needed. If yes, produce a blueprint JSON; if no, return skip.",
    review: "Inspect the blueprint in quest inventory. Escalate to the user if credentials or setup are missing; otherwise mark ready to forge.",
    forgeWeapon: "Use the claudecli weapon to write the weapon file (and any associated skill book action) per the blueprint, then verify it via a browser smoke test.",
    updateProvingGrounds: "Save the blueprint's setup_steps to profiles.council_settings.proving_grounds_setup for the current user.",
  },

  plan: `
You are planning whether a new weapon is needed to complete a quest.

Inputs you must gather:
- The quest description (from quest inventory or quest.description).

Decide:
- "forge" — an external system or local tool must be called and no existing weapon in libs/weapon/ covers it.
- "skip"  — an existing weapon already covers the need, or the quest is pure in-repo code work.

If "forge", output JSON with this exact shape:
{
  "action": "forge",
  "weapon_name": "<lowercase, no spaces>",
  "external_system": "<e.g. Stripe, Zoho Books, local filesystem>",
  "auth_type": "env_var | oauth | none",
  "credentials_needed": "<env var names or 'none'>",
  "requires_user_setup": true | false,
  "user_setup_reason": "<why the user must act, if any>",
  "setup_steps": ["Step 1: ...", "Step 2: ..."],
  "actions_to_implement": ["actionName1", "actionName2"],
  "msg": "<one-sentence summary>"
}

If "skip", output:
{ "action": "skip", "msg": "<why no weapon is needed>" }

Save the blueprint to quest inventory under key "blueprint".
`.trim(),

  review: `
You are reviewing the blueprint produced by the plan action. Read it from quest inventory under key "blueprint".

If blueprint.action === "skip", pass through with decision "skip".

Otherwise, escalate (decision "escalate") if ANY of:
- blueprint.requires_user_setup === true
- blueprint.weapon_name or blueprint.external_system is empty
- blueprint.actions_to_implement is empty

When escalating, post a quest comment of this form:

  Weapon blueprint review — user input needed:
  1. <reason>
  2. <reason>

  Weapon: <weapon_name>
  External system: <external_system>

  Please add the following in the Formulary (/town/council-hall/formulary):
    • Key name: <credentials_needed key>
    • Description: <credentials_needed>

  Setup steps:
    1. <setup_steps[0]>
    2. <setup_steps[1]>

  Once saved, reply 'done' to this comment to resume.

Otherwise return decision "ready" with the blueprint unchanged.
`.trim(),

  forgeWeapon: `
Use the claudecli weapon (import { invoke } from "@/libs/weapon/claudecli") to forge the weapon.
Read weapon_spec from input or derive it from quest inventory key "blueprint":
  { name, description, codeGoal, actions[], targetSkillBook? }

Send this prompt to claudecli.invoke():

---
You are writing production-quality JavaScript for a Next.js 15 project called GuildOS.
The project root is the current working directory. Use ES module syntax (import/export). No TypeScript.

## Task
<codeGoal>

## Project conventions
- Weapons live at libs/weapon/<name>/index.js
- Skill books live at libs/skill_book/<name>/index.js as pure text-prompt registries (no JS logic)
- New weapons must be registered in libs/weapon/registry.js (WEAPONS array)
- New skill books must be registered in libs/skill_book/index.js (SKILL_BOOKS and ADVENTURER_REGISTRY)
- When adding an action to an existing skill book, only add a new key to its toc and a new top-level prompt string — do not add functions
- Follow the patterns in existing files exactly

## Discipline
Follow the "Skill book + weapon discipline" section in CLAUDE.md — especially the six-verb action naming rule and the line-of-responsibility split between weapons and skill books.

## Spec
Name: <weaponName>
Target skill book (optional): libs/skill_book/<targetSkillBook>/index.js
Actions: <actions joined by comma>

## Rules
- Do NOT create helper functions for logic used only once — inline it.
- Do NOT create files beyond what is needed.
- If modifying an existing file, keep changes minimal — add only, do not rewrite.
- Match the code style of the file you are editing.

## Output format
Your ENTIRE output must be a single valid HTML document. No markdown. No prose outside HTML tags.
- Dark theme: background #1a1a1a, text #d1d5db, headings #a78bfa, code blocks #111
- Start with <!DOCTYPE html>
- Summary → per-file heading with full path → complete file content in <pre><code> → Verification section at the end
---

Save the returned HTML to quest inventory under key "forge_report".

Then verify the forge by invoking claudecli.invoke() a second time with Chrome Extension MCP tools enabled:
- Navigate to {SITE_URL}/town/proving-grounds/weapons/<weaponName>/
- If 404, navigate to {SITE_URL}/town/town-square/forge and confirm the weapon appears
- Take a screenshot, check for obvious errors
- Return JSON: { "verified": boolean, "reason": "<one sentence>", "screenshotId": "<id or null>" }

Save verification result to quest inventory under key "forge_verification".
`.trim(),

  updateProvingGrounds: `
Read setup_steps from input or from quest inventory key "setup_steps" (array of strings).
Resolve the owner_id from guildos.profile.owner_id (or guildos.profile.id).

Using the database facade:
  import { database } from "@/libs/council/database";
  const db = await database.init("service");
  const { data } = await db.from("profiles").select("council_settings").eq("id", ownerId).single();
  const merged = { ...(data?.council_settings || {}), proving_grounds_setup: setup_steps };
  await db.from("profiles").update({ council_settings: merged }).eq("id", ownerId);

Return { saved: true, step_count: setup_steps.length }.
`.trim(),
};

export default skillBook;
