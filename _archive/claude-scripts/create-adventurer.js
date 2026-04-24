/**
 * Create or update an adventurer row in the adventurers table.
 *
 * Usage:
 *   node claude-scripts/create-adventurer.js --name "Zoho Advisor" --skill-books zoho --user-id <uuid>
 *
 * Options:
 *   --name          Adventurer name (required)
 *   --capabilities  One-line capabilities string
 *   --skill-books   Comma-separated skill book IDs (e.g. zoho,default)
 *   --user-id       Owner user ID (defaults to first profile in DB)
 *   --update        If set, updates the first adventurer matching the name instead of inserting
 *
 * Prints the adventurer ID on the last line.
 */
import { db } from "./_loader.js";

const args = process.argv.slice(2);
function flag(name) {
  const i = args.indexOf(name);
  return i !== -1 ? args[i + 1] : null;
}
function hasFlag(name) { return args.includes(name); }

const name = flag("--name");
if (!name) {
  console.error("❌ --name is required");
  process.exit(1);
}

const capabilitiesArg = flag("--capabilities");
const skillBooksArg = flag("--skill-books");
const userIdArg = flag("--user-id");
const doUpdate = hasFlag("--update");

// ── Resolve userId ──
let userId = userIdArg;
if (!userId) {
  const { data: profiles, error } = await db.from("profiles").select("id").limit(1);
  if (error || !profiles?.length) {
    console.error("❌ Could not resolve user ID:", error?.message || "no profiles found");
    process.exit(1);
  }
  userId = profiles[0].id;
  console.log(`ℹ Using userId: ${userId}`);
}

// ── System prompts ──
// System prompts should NOT hardcode skill book action names. The adventurer
// discovers its capabilities at runtime via boast (from the skill book TOC).
// Keep the system prompt focused on role and planning instructions only.
const SYSTEM_PROMPTS = {
  "Zoho Advisor": `You are the Zoho Advisor, an expert in all Zoho products available through GuildOS.

Your skill books define what actions you can perform. At plan time, you will see the full TOC with action names, descriptions, and input/output formats.

## Planning instructions

When asked to plan, respond with a JSON execution plan. Use ONLY actions listed in the skill book TOC provided to you. Example:
{
  "execution_plan": [
    {
      "skillbook": "zoho",
      "action": "<action from TOC>",
      "input": [],
      "output": ["records"],
      "params": { "module": "<module name>", "limit": 5 }
    }
  ]
}

Do not fabricate actions that are not in the TOC. If the quest requires something not covered by any available action, respond with:
{ "execution_plan": [], "escalation": "No action available for this request." }
`,
};

const systemPrompt = SYSTEM_PROMPTS[name] || `You are ${name}. Execute quests using your assigned skill books.`;
const capabilities = capabilitiesArg || (name === "Zoho Advisor"
  ? "Search Zoho Books and CRM modules (sales orders, invoices, bills, contacts, quotes, leads, deals) via shared OAuth."
  : `${name} adventurer`);
const skillBooks = skillBooksArg ? skillBooksArg.split(",").map(s => s.trim()).filter(Boolean) : ["default"];

const row = {
  owner_id: userId,
  name,
  system_prompt: systemPrompt,
  capabilities,
  skill_books: skillBooks,
  backstory: null,
};

let adventurerId;

if (doUpdate) {
  const { data: existing } = await db.from("adventurers").select("id").eq("owner_id", userId).ilike("name", name).limit(1);
  if (!existing?.length) {
    console.error(`❌ No adventurer named "${name}" found to update. Run without --update to create.`);
    process.exit(1);
  }
  adventurerId = existing[0].id;
  const { error } = await db.from("adventurers").update({
    system_prompt: row.system_prompt,
    capabilities: row.capabilities,
    skill_books: row.skill_books,
  }).eq("id", adventurerId);
  if (error) {
    console.error("❌ Update failed:", error.message);
    process.exit(1);
  }
  console.log(`✅ Updated adventurer "${name}" (${adventurerId})`);
} else {
  const { data, error } = await db.from("adventurers").insert(row).select("id").single();
  if (error) {
    console.error("❌ Insert failed:", error.message);
    process.exit(1);
  }
  adventurerId = data.id;
  console.log(`✅ Created adventurer "${name}" with skill books [${skillBooks.join(", ")}]`);
}

// Print ID last for scripting
console.log(adventurerId);
