/**
 * Quest runner — standalone script that mimics the proving grounds API flow.
 * Bypasses HTTP auth by using the service client directly.
 *
 * Usage: node scripts/test-quest-runner.mjs <questId> [maxCycles]
 *
 * Runs doNextAction in a loop until the quest reaches closing/completed or hits maxCycles.
 */

import { config } from "dotenv";
config({ path: ".env.local" });

// Register @/ path alias for running outside Next.js
import { register } from "node:module";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const projectRoot = resolve(import.meta.dirname, "..");
register("data:text/javascript," + encodeURIComponent(`
  export function resolve(specifier, context, next) {
    if (specifier.startsWith("@/")) {
      return next(pathToFileURL("${projectRoot.replace(/\\/g, "/")}/" + specifier.slice(2)).href, context);
    }
    return next(specifier, context);
  }
`), pathToFileURL(projectRoot + "/"));

import { createClient } from "@supabase/supabase-js";

const questId = process.argv[2];
const maxCycles = Number(process.argv[3]) || 10;

if (!questId) {
  console.error("Usage: node scripts/test-quest-runner.mjs <questId> [maxCycles]");
  process.exit(1);
}

// Build service client directly (no next/headers needed)
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRETE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY in .env.local");
  process.exit(1);
}
const db = createClient(url, key);

// Resolve the quest owner
const { data: questRow, error: qErr } = await db
  .from("quests")
  .select("id, title, description, stage, assigned_to, assignee_id, inventory, execution_plan, next_steps, owner_id")
  .eq("id", questId)
  .single();

if (qErr || !questRow) {
  console.error("Quest not found:", qErr?.message || questId);
  process.exit(1);
}

const userId = questRow.owner_id;
console.log(`\n=== Quest Runner ===`);
console.log(`Quest: ${questRow.title} (${questId})`);
console.log(`Stage: ${questRow.stage} | Assigned: ${questRow.assigned_to}`);
console.log(`Owner: ${userId}`);
console.log(`Max cycles: ${maxCycles}\n`);

// Import modules (these work outside Next.js since they don't use next/headers)
const { getNpc } = await import("../libs/npcs/index.js");
const { runWithAdventurerExecutionContext } = await import("../libs/adventurer/advance.js");

const TERMINAL_STAGES = ["closing", "completed"];

for (let cycle = 1; cycle <= maxCycles; cycle++) {
  // Reload quest each cycle
  const { data: quest, error: loadErr } = await db
    .from("quests")
    .select("id, title, description, stage, assigned_to, assignee_id, inventory, execution_plan, next_steps, owner_id")
    .eq("id", questId)
    .single();

  if (loadErr || !quest) {
    console.error(`Cycle ${cycle}: Failed to load quest:`, loadErr?.message);
    break;
  }

  if (TERMINAL_STAGES.includes(quest.stage)) {
    console.log(`\n✓ Quest reached terminal stage: ${quest.stage}`);
    console.log(`  Title: ${quest.title}`);
    console.log(`  Inventory keys: ${Object.keys(quest.inventory || {}).join(", ") || "(empty)"}`);
    break;
  }

  const assignedTo = String(quest.assigned_to || "").trim();
  if (!assignedTo) {
    console.error(`Cycle ${cycle}: No assignee. Cannot proceed.`);
    break;
  }

  // Resolve assignee
  const npc = getNpc(assignedTo);
  let mod;
  try {
    if (npc) {
      mod = await import(`../libs/npcs/${npc.slug}/index.js`);
      quest.assignee = { type: "npc", profile: { ...npc, id: null } };
    } else {
      mod = await import("../libs/adventurer/index.js");
      // Load adventurer profile from DB
      const { data: adv } = await db.from("adventurers").select("*").eq("id", quest.assignee_id).single();
      quest.assignee = { type: "adventurer", profile: adv };
    }
  } catch (e) {
    console.error(`Cycle ${cycle}: Failed to load module for "${assignedTo}":`, e.message);
    break;
  }

  if (typeof mod.doNextAction !== "function") {
    console.error(`Cycle ${cycle}: No doNextAction on module for "${assignedTo}"`);
    break;
  }

  console.log(`--- Cycle ${cycle} ---`);
  console.log(`  Stage: ${quest.stage} | Assigned: ${assignedTo} (${npc ? "npc:" + npc.slug : "adventurer"})`);
  console.log(`  Title: ${quest.title}`);

  const ctx = { userId, client: db };
  const t0 = Date.now();

  let result;
  try {
    result = await runWithAdventurerExecutionContext(ctx, () => mod.doNextAction(quest, ctx));
  } catch (e) {
    console.error(`  ERROR: ${e.message}`);
    break;
  }

  const elapsed = Date.now() - t0;
  console.log(`  Result (${elapsed}ms): ${JSON.stringify(result).slice(0, 500)}`);

  if (!result?.ok && result?.action !== "plan") {
    console.error(`  FAILED — stopping.`);
    break;
  }

  // Check for escalation
  if (result?.items?.decision === "escalate" || result?.decision === "escalate") {
    console.log(`\n⚠ Quest escalated to review. User input needed.`);
    console.log(`  Comment: ${result?.items?.comment || result?.comment || "(see quest)"}`);
    break;
  }

  // Small delay between cycles
  await new Promise(r => setTimeout(r, 500));
}

console.log("\n=== Done ===");
process.exit(0);
