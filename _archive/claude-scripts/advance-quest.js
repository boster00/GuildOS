/**
 * Advance a quest by running doNextAction in a loop via the same path as the cron.
 * Stops on terminal stage, escalation, failure, or maxCycles.
 *
 * Usage (from project root):
 *   node claude-scripts/advance-quest.js <questId> [maxCycles]
 *   node claude-scripts/advance-quest.js <questId> 1          # single step
 *   node claude-scripts/advance-quest.js <questId> 20 --no-stop-on-fail
 *
 * Options:
 *   --no-stop-on-fail   Keep going even if a step returns ok:false
 *   --delay <ms>        Delay between cycles in ms (default: 500)
 */
import { db } from "./_loader.js";

const TERMINAL_STAGES = ["closing", "completed"];

const rawArgs = process.argv.slice(2);
const questId = rawArgs.find((a) => !a.startsWith("--") && isNaN(Number(a)));
const cycleArg = rawArgs.find((a) => !a.startsWith("--") && !isNaN(Number(a)) && Number(a) > 0);
const maxCycles = cycleArg ? Number(cycleArg) : 15;
const stopOnFail = !rawArgs.includes("--no-stop-on-fail");
const delayArg = rawArgs.indexOf("--delay");
const delay = delayArg !== -1 ? Number(rawArgs[delayArg + 1]) || 500 : 500;

if (!questId) {
  console.error("Usage: node claude-scripts/advance-quest.js <questId> [maxCycles]");
  process.exit(1);
}

// Load quest
const { data: initial, error: loadErr } = await db
  .from("quests")
  .select("id, title, stage, assigned_to, owner_id")
  .eq("id", questId)
  .single();

if (loadErr || !initial) {
  console.error("❌ Quest not found:", loadErr?.message || questId);
  process.exit(1);
}

console.log(`\n=== Advance Quest ===`);
console.log(`Quest: ${initial.title} (${questId})`);
console.log(`Stage: ${initial.stage} | Assigned: ${initial.assigned_to}`);
console.log(`Max cycles: ${maxCycles} | Stop on fail: ${stopOnFail}`);
console.log();

// Dynamically import the advance function (uses @/ alias — needs loader registered first)
const { advance } = await import("@/libs/quest/index.js");

for (let cycle = 1; cycle <= maxCycles; cycle++) {
  // Reload quest each cycle to get fresh state
  const { data: quest, error: reloadErr } = await db
    .from("quests")
    .select("id, title, description, stage, assigned_to, assignee_id, inventory, execution_plan, next_steps, owner_id")
    .eq("id", questId)
    .single();

  if (reloadErr || !quest) {
    console.error(`Cycle ${cycle}: ❌ Failed to reload quest:`, reloadErr?.message);
    break;
  }

  if (TERMINAL_STAGES.includes(quest.stage)) {
    console.log(`\n✓ Quest reached terminal stage: ${quest.stage}`);
    console.log(`  Inventory keys: ${Object.keys(quest.inventory || {}).join(", ") || "(empty)"}`);
    break;
  }

  const t0 = Date.now();
  console.log(`--- Cycle ${cycle} | Stage: ${quest.stage} | ${new Date().toISOString()} ---`);

  let result;
  try {
    result = await advance(quest, { client: db });
  } catch (err) {
    console.error(`  ❌ Error: ${err.message}`);
    if (stopOnFail) break;
    continue;
  }

  const elapsed = Date.now() - t0;
  const summary = JSON.stringify(result).slice(0, 600);
  console.log(`  Result (${elapsed}ms): ${summary}`);

  if (!result?.ok) {
    console.log(`  ⚠ Step returned ok:false`);
    if (stopOnFail) {
      console.error("  Stopping.");
      break;
    }
  }

  // Check for waitingForInventory — the quest is paused waiting for pigeon results
  if (result?.action === "execute:waitingForInventory") {
    console.log(`\n⏳ Waiting for inventory keys: ${result.detail?.waitingFor?.join(", ")}`);
    console.log("  Quest is paused — re-run after pigeon post delivers results.");
    break;
  }

  // Check for escalation (various shapes)
  const escalated = result?.items?.decision === "escalate" || result?.decision === "escalate"
    || result?.detail?.decision === "escalate"
    || (typeof result?.detail?.action === "string" && result.detail.action.includes("escalat"));
  if (escalated) {
    console.log(`\n⚠ Quest escalated — user input needed.`);
    const comment = result?.items?.comment || result?.detail?.comment || result?.comment;
    if (comment) console.log(`  Comment:\n${comment}`);
    break;
  }

  // Stop if not advancing (avoids infinite loops on unhandled stage combos)
  if (result?.advanced === false && result?.ok) {
    console.log(`\n⏸ No progress made (advanced: false) — stage "${quest.stage}" has no handler for current assignee.`);
    break;
  }

  if (delay > 0) await new Promise((r) => setTimeout(r, delay));
}

console.log("\n=== Done ===");
process.exit(0);
