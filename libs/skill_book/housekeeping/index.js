/**
 * Housekeeping skill book — shared by ALL adventurers.
 * Core operational actions for quest management, communication, and self-management.
 */
import { skillActionOk, skillActionErr } from "@/libs/skill_book/actionResult.js";
import { publicTables } from "@/libs/council/publicTables";

const ACTIVE_STAGES = ["execute", "escalated", "review", "closing"];

/** @param {unknown} row */
function priorityFromQuestRow(row) {
  if (row && typeof row === "object" && !Array.isArray(row)) {
    const r = /** @type {Record<string, unknown>} */ (row);
    const col = typeof r.priority === "string" ? r.priority.trim().toLowerCase() : "";
    if (col === "high" || col === "medium" || col === "low") return col;
    const sc = r.success_criteria;
    if (sc && typeof sc === "object" && !Array.isArray(sc)) {
      const p = String(/** @type {Record<string, unknown>} */ (sc).priority || "").trim().toLowerCase();
      if (p === "high" || p === "medium" || p === "low") return p;
    }
  }
  return "medium";
}

/** @param {string} p */
function priorityRank(p) {
  if (p === "high") return 0;
  if (p === "medium") return 1;
  return 2;
}

async function resolveDbClient(injected) {
  if (injected) return injected;
  const { getAdventurerExecutionContext } = await import("@/libs/adventurer/advance.js");
  const ctx = getAdventurerExecutionContext()?.client;
  if (ctx) return ctx;
  const { database } = await import("@/libs/council/database");
  return database.init("service");
}

export const skillBook = {
  id: "housekeeping",
  title: "Housekeeping — Core Agent Operations",
  description: "Shared actions for all adventurers: quest management, comments, escalation, planning.",
  steps: [],
  toc: {
    initAgent: {
      description: "Initialize agent session — set up GuildOS access, read instructions, check for work.",
      howTo: [
        "**On session start or re-init:**",
        "",
        "**Step 0: Environment check**",
        "Pull latest on your current branch. If it fails (merge conflicts, env errors), trigger setNewAgent.",
        "",
        "**Step 1: Clone GuildOS repo**",
        "Run: git clone https://github.com/boster00/GuildOS.git ~/guildos",
        "If already cloned: cd ~/guildos && git pull origin main",
        "Run: cd ~/guildos && npm install",
        "This gives you: global instructions, skill books, weapons, and env credentials.",
        "",
        "**Step 2: Set up env**",
        "Check if ~/guildos/.env.local exists and has NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRETE_KEY.",
        "If missing: escalate to user. Do NOT guess or auto-provision credentials.",
        "",
        "**Step 3: Read instructions**",
        "1. Read ~/guildos/docs/global-instructions.md",
        "2. Query your adventurer profile from Supabase (adventurers table by your ID) to get system_prompt and skill_books",
        "3. Read your system_prompt — project identity and conventions",
        "4. For each skill book, read ~/guildos/libs/skill_book/<name>/index.js",
        "",
        "**Step 4: Check for work**",
        "Use getActiveQuests to find quests assigned to you.",
        "Work on the highest priority quest first (high > medium > low).",
        "",
        "**When to re-init:** When told to refresh context, switching projects, or after environment errors.",
      ].join("\n"),
    },
    setNewAgent: {
      description: "Replace a broken agent session with a fresh one.",
      howTo: `
**When:** initAgent fails due to stale repo, broken environment, or unrecoverable errors.

**Steps:**
1. Before giving up, \`git push\` any uncommitted work to preserve progress.
2. Check which branch you were on: \`git branch --show-current\`. Note this branch name.
3. Tell the user: "My environment is broken. Please create a new Cursor cloud agent at cursor.com for repo [repo name], branch main. Then give me the new agent ID. My work-in-progress is on branch [branch name]."
4. Once the user provides the new agent ID, update the adventurer record:
   \`\`\`javascript
   await db.from('adventurers').update({
     session_id: '<new-agent-id>',
     session_status: 'idle'
   }).eq('id', '<adventurer-id>');
   \`\`\`
5. Send initAgent to the NEW agent session (via Cursor API writeFollowup).
6. Tell the new agent to inherit the old branch: "After init, run: git fetch origin && git checkout [old-branch-name] to pick up where the previous session left off."
7. Verify the new agent responds and passes the environment check.
8. Once confirmed running smoothly, archive the old agent:
   \`\`\`javascript
   // Update the outpost record if one exists
   await db.from('outposts').update({ status: 'archived' }).eq('session_id', '<old-agent-id>');
   \`\`\`

**The user's manual step:** Create the agent at cursor.com. Everything else is automated.
`,
    },
    comment: {
      description: "Post a comment to a quest for milestone reporting or escalation.",
      howTo: `
**When to comment:**
- Major milestone completion (not every small step)
- Escalating a problem
- Responding to feedback

**How:**
\`\`\`javascript
await db.from('quest_comments').insert({
  quest_id: '<quest-id>',
  source: 'adventurer',
  action: 'milestone',  // or 'escalate', 'response'
  summary: '<concise description of what happened>',
  detail: {}
});
\`\`\`

Or via API: \`POST /api/quest/comments\` with \`{ questId, source: "adventurer", action, summary }\`

**Do NOT comment for:** routine progress, asking permission, small updates. Only significant events.
`,
    },
    escalate: {
      description: "Move a quest to escalated stage when blocked.",
      howTo: `
**When to escalate:**
- Missing credentials or env vars you cannot obtain
- Need local machine access
- Need a decision from the user
- Blocked by external dependency

**Steps:**
1. Save your progress first: git add -A, git commit -m "WIP: ...", git push
2. Post a comment explaining exactly what is blocking you (be specific)
3. Update the quest stage to 'escalated':
   \`\`\`javascript
   await db.from('quests').update({ stage: 'escalated' }).eq('id', '<quest-id>');
   \`\`\`
3. If you have other active quests, work on the next highest-priority one

**Do NOT escalate for:** things you can figure out yourself, permission to proceed (just proceed), or questions you can answer by reading docs.
`,
    },
    presentPlan: {
      description: "Present a WBS-format plan with clear deliverables and measurement criteria.",
      howTo: `
**Format:** Work Breakdown Structure (WBS)
\`\`\`
1. Phase name
   1.1 Task name
       Deliverable: [what to produce — usually a screenshot]
       Measurement: [how to verify success]
   1.2 Task name
       Deliverable: ...
       Measurement: ...
2. Phase name
   2.1 ...
\`\`\`

**Rules:**
- Every task must have a deliverable (usually screenshot requirements)
- Every deliverable must have a measurable success criterion
- Include explicit reporting points: "Create a comment to report successful completion of this milestone"
- Present to user for iteration before creating the quest
`,
    },
    createQuest: {
      description: "Create a quest in execute stage after user approves the plan.",
      howTo: `
**Flow:**
1. User describes a project/task in chat
2. You present a WBS plan (presentPlan action)
3. User iterates until satisfied
4. You ask: "Shall I create this quest and start working on it?"
5. On confirmation, create the quest:

\`\`\`javascript
await db.from('quests').insert({
  owner_id: '<user-id>',
  title: '<quest title>',
  description: '<full WBS plan with deliverables>',
  stage: 'execute',
  priority: 'medium',  // or high/low as discussed
  assignee_id: '<your-adventurer-id>',
  assigned_to: '<your-name>',
  inventory: {}
});
\`\`\`

Or via API: \`POST /api/quest?action=request\` — but this creates in 'idea' stage. Prefer direct DB insert for execute stage.
`,
    },
    seekHelp: {
      description: "Contact the Questmaster for approval or assistance.",
      howTo: `
**Before seeking help:** Always git push first. Your branch is your work — if the session dies, the branch is the only record.

**When to seek help:**
- Need approval on a deliverable before moving to review
- Stuck on something that doesn't warrant full escalation
- Need a second opinion on approach

**How:**
1. Find the Questmaster adventurer:
   \`\`\`javascript
   const { data } = await db.from('adventurers').select('session_id').eq('name', 'Cat').single();
   \`\`\`
2. Send a message to the Questmaster's session:
   \`\`\`javascript
   // Use the cursor weapon or direct API
   await writeFollowup({ agentId: data.session_id, message:
     "I am [your name], working on quest [quest title] (id: [quest-id]). I need [approval/help] with: [specific request]"
   });
   \`\`\`
3. Follow the Questmaster's instructions

**When seeking review:** Include ALL deliverable URLs (screenshots, files) in your message so the Questmaster can evaluate them without having to look them up.

**Questmaster behavior:** It will first ask if you have what you need to proceed. If yes, it tells you to proceed. If not, it helps or asks you to escalate.
`,
    },
    getActiveQuests: {
      description:
        "List active quests: default owner scope (quests you own in execute/review/closing/escalated); pass assignee_id to filter by assignee. Sorted high > medium > low then updated_at. Prefer this action over raw SQL.",
      input: {
        limit: "number — max rows (default 50, max 200)",
        assignee_id: "string — optional adventurer UUID for assignee-scoped queue",
      },
      output: {
        quests: "JSON string — array of { id, title, stage, priority, updated_at }",
      },
      howTo: `
**Runtime:** Call housekeeping.getActiveQuests from adventurer execution context (or pass client in input for scripts).

**Manual query (assignee):**
\`\`\`javascript
const { data: quests } = await db.from('quests')
  .select('id, title, stage, priority, description')
  .eq('assignee_id', '<your-adventurer-id>')
  .not('stage', 'eq', 'complete')
  .order('priority', { ascending: true });  // high sorts before low alphabetically
\`\`\`

**After fetching:** If any quest has more than 10 comments, trigger summarizeComments on it before proceeding.

**Priority order:** Work on highest-priority quests first (high > medium > low).
`,
    },
    escalateBlockedQuest: {
      description: "Set quest stage to escalated and record a system comment with the blocker text.",
      input: {
        questId: "string — quest UUID",
        blocker: "string — why work cannot continue",
      },
      output: {
        questId: "string",
        stage: "escalated",
      },
    },
    summarizeComments: {
      description: "Compress old comments to prevent flooding. Keep latest 4, summarize the rest.",
      howTo: `
**When:** A quest has more than 10 comments.

**Steps:**
1. Fetch all comments for the quest, ordered by created_at ascending
2. Keep the latest 4 comments untouched
3. Summarize all earlier comments into a brief paragraph
4. Delete the old comments (all except the latest 4)
5. Insert a new comment at the earliest position with:
   \`\`\`javascript
   { source: 'system', action: 'summary', summary: '<brief summary of what happened before>' }
   \`\`\`

**Result:** Quest has 5 comments — 1 summary + 4 recent. Context is preserved without flooding.
`,
    },
  },
};

/**
 * @param {string} userId
 * @param {Record<string, unknown>} input
 */
export async function getActiveQuests(userId, input) {
  const uid = String(userId || "").trim();
  if (!uid) return skillActionErr("getActiveQuests requires execution user id.");

  const inObj = typeof input === "object" && input ? input : {};
  const limit = Math.min(Math.max(Number(inObj.limit) || 50, 1), 200);
  const assigneeFilter = String(inObj.assignee_id || inObj.assigneeId || "").trim();

  const db = await resolveDbClient(
    /** @type {import("@/libs/council/database/types.js").DatabaseClient | undefined} */ (inObj.client),
  );

  let q = db
    .from(publicTables.quests)
    .select("id, title, stage, priority, success_criteria, updated_at, owner_id, assignee_id")
    .in("stage", ACTIVE_STAGES)
    .order("updated_at", { ascending: false })
    .limit(500);

  if (assigneeFilter) {
    q = q.eq("assignee_id", assigneeFilter);
  } else {
    q = q.eq("owner_id", uid);
  }

  const { data: rows, error } = await q;
  if (error) return skillActionErr(error.message || "Failed to list quests.");

  const enriched = (rows || []).map((r) => ({
    id: r.id,
    title: r.title,
    stage: r.stage,
    priority: priorityFromQuestRow(r),
    updated_at: r.updated_at,
  }));

  enriched.sort((a, b) => {
    const pr = priorityRank(a.priority) - priorityRank(b.priority);
    if (pr !== 0) return pr;
    const ta = a.updated_at ? Date.parse(String(a.updated_at)) : 0;
    const tb = b.updated_at ? Date.parse(String(b.updated_at)) : 0;
    return tb - ta;
  });

  const sliced = enriched.slice(0, limit);
  return skillActionOk(
    { quests: JSON.stringify(sliced) },
    `Found ${sliced.length} active quest(s) (${assigneeFilter ? "assignee" : "owner"} scope, priority-sorted, cap ${limit}).`,
  );
}

/**
 * @param {string} userId
 * @param {Record<string, unknown>} input
 */
export async function escalateBlockedQuest(userId, input) {
  const uid = String(userId || "").trim();
  const inObj = typeof input === "object" && input ? input : {};
  const questId = String(inObj.questId || inObj.quest_id || "").trim();
  const blocker = String(inObj.blocker || inObj.reason || "").trim();

  if (!questId) return skillActionErr("questId is required.");
  if (!blocker) return skillActionErr("blocker (or reason) is required.");

  const db = await resolveDbClient(
    /** @type {import("@/libs/council/database/types.js").DatabaseClient | undefined} */ (inObj.client),
  );

  const { data: row, error: readErr } = await db
    .from(publicTables.quests)
    .select("id, owner_id, stage")
    .eq("id", questId)
    .maybeSingle();

  if (readErr || !row) return skillActionErr(readErr?.message || "Quest not found.");
  if (uid && String(row.owner_id) !== uid) {
    return skillActionErr("escalateBlockedQuest: quest owner mismatch.");
  }

  const { updateQuest, recordQuestComment } = await import("@/libs/quest");
  const up = await updateQuest(questId, { stage: "escalated" }, { client: db });
  if (up.error) {
    return skillActionErr(up.error instanceof Error ? up.error.message : String(up.error));
  }

  await recordQuestComment(
    questId,
    {
      source: "system",
      action: "escalateBlockedQuest",
      summary: blocker.slice(0, 2000),
      detail: { escalated: true },
    },
    { client: db },
  );

  return skillActionOk({ questId, stage: "escalated" }, "Quest moved to escalated with blocker comment.");
}

export const definition = skillBook;

const housekeeping = {
  definition,
  skillBook,
  getActiveQuests,
  escalateBlockedQuest,
};

export default housekeeping;
