/**
 * Create a new quest directly via service role (no HTTP auth needed).
 *
 * Usage (from project root):
 *   node claude-scripts/create-quest.js "Quest title" "Detailed description"
 *   node claude-scripts/create-quest.js "Quest title" "Description" --stage idea --assigned-to cat
 *
 * Options:
 *   --stage <stage>          Quest stage (default: idea)
 *   --assigned-to <name>     Assignee name (default: cat)
 *   --user-id <uuid>         Owner user ID (default: first profile in DB)
 *
 * Prints the created quest ID to stdout so it can be piped to advance-quest.js.
 */
import { db } from "./_loader.js";

const args = process.argv.slice(2);

function getFlag(flag) {
  const idx = args.indexOf(flag);
  return idx !== -1 ? args[idx + 1] : null;
}

const positional = args.filter((a) => !a.startsWith("--") && !args[args.indexOf(a) - 1]?.startsWith("--"));
const title = positional[0] || "New request";
const description = positional[1] || "";

const stage = getFlag("--stage") || "idea";
const assignedTo = getFlag("--assigned-to") || "cat";
let userId = getFlag("--user-id");

if (!title) {
  console.error("Usage: node claude-scripts/create-quest.js <title> [description] [--stage idea] [--assigned-to cat]");
  process.exit(1);
}

// Resolve userId if not provided
if (!userId) {
  const { data: profiles, error } = await db.from("profiles").select("id").limit(1).single();
  if (error || !profiles?.id) {
    console.error("❌ Could not find a user profile. Pass --user-id explicitly.");
    process.exit(1);
  }
  userId = profiles.id;
}

console.log(`Creating quest for user ${userId}...`);
console.log(`  Title: ${title}`);
console.log(`  Description: ${description || "(none)"}`);
console.log(`  Stage: ${stage} | Assigned to: ${assignedTo}`);

const { data: quest, error } = await db
  .from("quests")
  .insert({
    owner_id: userId,
    title,
    description: description || null,
    stage,
    assigned_to: assignedTo,
  })
  .select("id, title, stage, assigned_to")
  .single();

if (error || !quest) {
  console.error("❌ Failed to create quest:", error?.message);
  process.exit(1);
}

console.log(`\n✓ Quest created: ${quest.id}`);
console.log(`  Title: ${quest.title}`);
console.log(`  Stage: ${quest.stage} | Assigned: ${quest.assigned_to}`);
console.log(`\nNext step:`);
console.log(`  node claude-scripts/advance-quest.js ${quest.id}`);

// Output quest ID on its own line for scripting
process.stdout.write("\n" + quest.id + "\n");
