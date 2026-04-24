/**
 * Roster skill book — adventurer lifecycle management.
 * Owned by the Guildmaster (Piggy). Covers spawning, archiving, and auditing
 * Cursor cloud agent sessions tied to adventurer records.
 *
 * Core rule: one adventurer = one live session at all times.
 * Always archive the old session before the new one takes over.
 */

export const skillBook = {
  id: "roster",
  title: "Roster",
  description:
    "Manage adventurer agent sessions: spawn replacements, archive stale sessions, audit the roster. " +
    "Core rule: one adventurer = one live session. Always archive before spawning.",

  toc: {
    spawnAgent: "Replace an adventurer's Cursor cloud agent session with a fresh one, then archive the old session. Never leave two live sessions for the same adventurer.",
    auditRoster: "Scan all adventurers for session health: detect unresponsive, duplicate, or unarchived sessions and flag them for action.",
  },

  spawnAgent: `
**When to spawn:**
- Adventurer is unresponsive after two follow-up messages with no reply.
- Environment is unrecoverable (initAgent failed, disk full, corrupt repo, repeated crashes).
- User explicitly requests a fresh session.

**The rule — never skip archiving:**
One adventurer = one live session. Spawning without archiving the old session bloats the
agent list and creates ambiguity about which session owns active quests. Always archive
the old session ID before the new session takes its first action.

**Steps:**

1. **Read the old session ID:**
   \`\`\`javascript
   import { database } from "@/libs/council/database";
   const db = await database.init("service");
   const { data: adv } = await db
     .from("adventurers")
     .select("id, name, session_id, skill_books")
     .eq("id", "<adventurer-id>")
     .single();
   const oldSessionId = adv.session_id;
   \`\`\`

2. **Create the new Cursor cloud agent** at cursor.com for the correct repo (main branch).
   Copy the new session ID from the Cursor UI.

3. **Update the adventurer record and verify:**
   \`\`\`javascript
   await db.from("adventurers").update({
     session_id: "<new-session-id>",
     session_status: "idle",
   }).eq("id", adv.id);

   // Verify — always confirm the write, never trust HTTP status alone:
   const { data: check } = await db
     .from("adventurers")
     .select("session_id, session_status")
     .eq("id", adv.id)
     .single();
   // check.session_id must equal <new-session-id>
   \`\`\`

4. **Archive the old session — do NOT skip:**
   \`\`\`javascript
   // Update outpost row if one exists for this session:
   await db.from("outposts")
     .update({ status: "archived" })
     .eq("session_id", oldSessionId);
   \`\`\`
   If no outpost row exists, log the old session ID in a quest comment so there is a record.
   After this step, the old session ID must never be written to again — treat it as dead.

5. **Dispatch initAgent to the new session** via the Cursor API (writeFollowup).
   Include the adventurer ID so the agent loads the correct profile and skill books.

6. **Hand off in-progress work:**
   If the old session had a WIP branch, tell the new agent:
   "After init, run: git fetch origin && git checkout <branch-name> to continue where the previous session left off."

7. **Verify** the new agent responds and completes initAgent before closing this task.
`.trim(),

  auditRoster: `
Scan all active adventurers for session health issues.

\`\`\`javascript
import { database } from "@/libs/council/database";
const db = await database.init("service");
const { data: adventurers } = await db
  .from("adventurers")
  .select("id, name, session_id, session_status, updated_at")
  .neq("session_status", "decommissioned");
\`\`\`

**Flag any adventurer where:**
- \`session_id\` is null or empty — no session assigned.
- \`session_status\` is stuck on "busy" for more than 24 hours (check \`updated_at\`).
- Two adventurers share the same \`session_id\` — should never happen; indicates a copy-paste error.

**For each flagged entry:** report the adventurer name, issue type, and recommended action
(assign session / run spawnAgent / manual review). Do not auto-fix — present findings to
the user before taking action.
`.trim(),
};

export default skillBook;
