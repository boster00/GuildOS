/**
 * Print current quest state: stage, execution plan, inventory keys, recent comments.
 *
 * Usage (from project root):
 *   node claude-scripts/get-quest.js <questId>
 *   node claude-scripts/get-quest.js <questId> --full    # show full inventory values
 */
import { db } from "./_loader.js";

const questId = process.argv[2];
const full = process.argv.includes("--full");

if (!questId) {
  console.error("Usage: node claude-scripts/get-quest.js <questId> [--full]");
  process.exit(1);
}

const { data: quest, error } = await db
  .from("quests")
  .select("id, title, description, stage, assigned_to, assignee_id, inventory, execution_plan, next_steps, created_at, updated_at")
  .eq("id", questId)
  .single();

if (error || !quest) {
  console.error("❌ Quest not found:", error?.message || questId);
  process.exit(1);
}

console.log(`\n=== Quest: ${quest.title} ===`);
console.log(`ID:          ${quest.id}`);
console.log(`Stage:       ${quest.stage}`);
console.log(`Assigned to: ${quest.assigned_to || "(none)"} / ${quest.assignee_id || "(none)"}`);
console.log(`Updated:     ${quest.updated_at}`);

if (quest.description) {
  console.log(`\nDescription:\n  ${quest.description.slice(0, 300)}`);
}

console.log(`\nExecution plan (${Array.isArray(quest.execution_plan) ? quest.execution_plan.length : 0} steps):`);
if (Array.isArray(quest.execution_plan) && quest.execution_plan.length > 0) {
  quest.execution_plan.forEach((step, i) => {
    const wf = step.waitFor?.length ? ` [waitFor: ${step.waitFor.join(",")}]` : "";
    console.log(`  ${i + 1}. ${step.skillbook}.${step.action} | in: [${(step.input || []).join(",")}] → out: [${(step.output || []).join(",")}]${wf}`);
  });
} else {
  console.log("  (none)");
}

const inv = quest.inventory;
const invKeys = inv ? Object.keys(inv) : [];
console.log(`\nInventory (${invKeys.length} keys): ${invKeys.join(", ") || "(empty)"}`);

if (full && inv && invKeys.length > 0) {
  console.log();
  for (const key of invKeys) {
    const val = inv[key];
    const str = typeof val === "string" ? val.slice(0, 300) : JSON.stringify(val, null, 2)?.slice(0, 300);
    console.log(`  [${key}]:`);
    console.log(`    ${str}`);
  }
}

if (Array.isArray(quest.next_steps) && quest.next_steps.length > 0) {
  console.log(`\nNext steps:`);
  quest.next_steps.forEach((s, i) => console.log(`  ${i + 1}. ${s}`));
}

// Fetch recent comments
const { data: comments } = await db
  .from("quest_comments")
  .select("created_at, content, author")
  .eq("quest_id", questId)
  .order("created_at", { ascending: false })
  .limit(5);

if (comments && comments.length > 0) {
  console.log(`\nRecent comments (${comments.length}):`);
  for (const c of comments.reverse()) {
    const text = typeof c.content === "string" ? c.content : JSON.stringify(c.content);
    console.log(`  [${c.created_at?.slice(0, 16)}] ${c.author || "system"}: ${text.slice(0, 150)}`);
  }
}

console.log();
process.exit(0);
