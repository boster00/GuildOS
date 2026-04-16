/**
 * Housekeeping skill book — shared by ALL adventurers.
 * Core operational actions for quest management, communication, and self-management.
 */
import { skillActionOk, skillActionErr } from "@/libs/skill_book/actionResult.js";

/** Stages a worker can run or advance (default for getActiveQuests). */
const RUNNABLE_STAGES = new Set(["execute", "purrview", "review", "closing"]);

/** Stages that may appear when include_escalated is true (Questmaster / full queue view). */
const EXPANDED_ACTIVE_STAGES = new Set(["execute", "escalated", "purrview", "review", "closing"]);

/** @param {unknown} v @returns {"high"|"medium"|"low"} */
function normalizePriority(v) {
  const s = String(v ?? "medium").trim().toLowerCase();
  if (s === "high" || s === "low" || s === "medium") return s;
  return "medium";
}

/** @param {Record<string, unknown>} row */
function priorityFromQuestRow(row) {
  const direct = row.priority;
  if (typeof direct === "string" && direct.trim()) return normalizePriority(direct);
  const sc = row.success_criteria;
  if (sc && typeof sc === "object" && !Array.isArray(sc) && "priority" in sc) {
    return normalizePriority(/** @type {{ priority?: unknown }} */ (sc).priority);
  }
  return "medium";
}

/** @param {"high"|"medium"|"low"} p */
function priorityRank(p) {
  if (p === "high") return 0;
  if (p === "medium") return 1;
  return 2;
}

async function resolveDbClient() {
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
        "Pull latest on your current branch (`git pull origin main` or merge as needed). Run `npm install`. If unrecoverable (merge conflicts, env errors), trigger setNewAgent.",
        "",
        "**Step 1: GuildOS repo**",
        "If you are already in the GuildOS workspace (e.g. Cursor cloud: `/workspace`), run `git pull origin main && npm install` there.",
        "Otherwise clone: `git clone https://github.com/boster00/GuildOS.git` then `cd` into it and `npm install`.",
        "",
        "**Step 2: Set up env**",
        "Ensure your local env file has the Supabase URL and server credential from the repo env template. If missing: escalate to user. Do NOT guess credentials.", // pragma: allowlist secret
        "",
        "**Step 3: Read instructions**",
        "1. Read docs/global-instructions.md",
        "2. Query your adventurer row in Supabase (adventurers table) for the system prompt and skill book list columns", // pragma: allowlist secret
        "3. Internalize your system prompt",
        "4. For each assigned skill book id, read libs/skill_book/<id>/index.js",
        "",
        "**Step 4: Check for work**",
        "Use **getActiveQuests** (runnable stages: execute, purrview, review, closing). Work highest priority first (high > medium > low).",
        "When deliverables are complete, move the quest to **purrview** for Questmaster review — do not skip to `review`.",
        "",
        "**When to re-init:** Refresh context, switching projects, or after environment errors.",
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
      description: "Post a comment to a quest.",
      howTo: `
Insert a row into quest_comments with: quest_id, source (adventurer), action (milestone/escalate/response), summary.

Only comment for significant events: major milestone completion, escalation, responding to feedback. Not routine progress.
`,
    },
    escalate: {
      description: "Move a quest to escalated stage.",
      howTo: `
Update the quest stage to escalated. Include a comment explaining the blocker before calling this.

Do NOT escalate for things you can figure out yourself or permission to proceed — just proceed.
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
Send a message to the Questmaster (Cat) asking for help or approval.

1. Query Cat's session: SELECT session_id FROM adventurers WHERE name = 'Cat'
2. Send a message identifying yourself, your quest, and what you need
3. When seeking review, include deliverable URLs in the message
`,
    },
    getActiveQuests: {
      description:
        "Return quests owned by the user in runnable stages (execute, purrview, review, closing) by default — sorted by priority high→medium→low then updated_at. Set include_escalated: true to also list escalated (blocked) quests.",
      input: {
        assignee_name: "string — optional; when set, filter by assigned_to",
        include_escalated: "boolean — optional; when true, include stage escalated in the list",
      },
      output: {
        quests: "string — JSON array of { id, title, stage, priority, updated_at, assigned_to }",
        escalated_count: "string — when include_escalated is false: count of escalated quests for same owner (same filters), for visibility",
      },
      howTo: `
Query quests for the owner that are in runnable stages (execute, purrview, review, closing), or include escalated when requested.
Order by priority (high > medium > low) then recency.
`,
    },
    summarizeComments: {
      description: "Compress old comments to prevent flooding. Keep latest 4, summarize the rest.",
      howTo: `
**When:** A quest has more than 10 comments.

**Steps:**
1. Fetch all comments for the quest, ordered by created_at ascending
2. Keep the latest 4 comments untouched
3. The 5th-from-last comment becomes the summary — update its text to a brief summary of everything before it
4. Delete all comments older than the 5th-from-last

**Result:** Quest has 5 comments — the oldest is the summary, then the 4 most recent. No new comments created.
`,
    },
    escalateBlockedQuest: {
      description: "Move a quest to escalated and record a system comment with the blocker reason.",
      input: {
        quest_id: "string — quest UUID",
        reason: "string — non-empty explanation of the blocker",
      },
      output: {
        quest_id: "string",
        stage: "string — escalated",
      },
    },
  },
};

/**
 * @param {string} userId
 * @param {Record<string, unknown>} input
 */
export async function getActiveQuests(userId, input) {
  const inObj = typeof input === "object" && input ? input : {};
  const assigneeFilter = String(inObj.assignee_name || inObj.assigneeName || "").trim();
  const includeEscalated =
    inObj.include_escalated === true || inObj.include_escalated === "true" || inObj.includeEscalated === true;

  if (!userId) return skillActionErr("userId is required.");

  let client;
  try {
    client = await resolveDbClient();
  } catch (e) {
    return skillActionErr(e instanceof Error ? e.message : String(e));
  }

  const { getQuestsForOwner } = await import("@/libs/quest");
  const { data: rows, error } = await getQuestsForOwner(userId, { client });
  if (error) return skillActionErr(error.message || String(error));

  const list = Array.isArray(rows) ? rows : [];
  const allowedStages = includeEscalated ? EXPANDED_ACTIVE_STAGES : RUNNABLE_STAGES;

  const sameAssignee = (r) => {
    if (!assigneeFilter) return true;
    const at = String(/** @type {{ assigned_to?: unknown }} */ (r).assigned_to || "").trim();
    return at === assigneeFilter;
  };

  const escalatedCount = list.filter((r) => {
    if (!r || typeof r !== "object") return false;
    if (String(/** @type {{ stage?: unknown }} */ (r).stage || "") !== "escalated") return false;
    return sameAssignee(r);
  }).length;

  const filtered = list.filter((r) => {
    if (!r || typeof r !== "object") return false;
    const stage = String(/** @type {{ stage?: unknown }} */ (r).stage || "");
    if (!allowedStages.has(stage)) return false;
    return sameAssignee(r);
  });

  const enriched = filtered.map((r) => {
    const row = /** @type {Record<string, unknown>} */ (r);
    const priority = priorityFromQuestRow(row);
    return {
      id: String(row.id || ""),
      title: String(row.title || ""),
      stage: String(row.stage || ""),
      priority,
      updated_at: row.updated_at != null ? String(row.updated_at) : "",
      assigned_to: row.assigned_to != null ? String(row.assigned_to) : "",
    };
  });

  enriched.sort((a, b) => {
    const pr =
      priorityRank(/** @type {"high"|"medium"|"low"} */ (a.priority)) -
      priorityRank(/** @type {"high"|"medium"|"low"} */ (b.priority));
    if (pr !== 0) return pr;
    return String(b.updated_at).localeCompare(String(a.updated_at));
  });

  const escalatedInList = enriched.filter((x) => x.stage === "escalated").length;
  const parts = includeEscalated
    ? [`${enriched.length} quest(s) in execute/purrview/review/closing/escalated.`]
    : [`${enriched.length} runnable active quest(s) (execute/purrview/review/closing).`];
  if (!includeEscalated && escalatedCount > 0) {
    parts.push(`${escalatedCount} escalated (blocked) — pass include_escalated: true to list them.`);
  }

  return skillActionOk(
    {
      quests: JSON.stringify(enriched),
      escalated_count: String(includeEscalated ? escalatedInList : escalatedCount),
    },
    parts.join(" "),
  );
}

/**
 * @param {string} userId
 * @param {Record<string, unknown>} input
 */
export async function escalateBlockedQuest(userId, input) {
  const inObj = typeof input === "object" && input ? input : {};
  const questId = String(inObj.quest_id || inObj.questId || "").trim();
  const reason = String(inObj.reason || inObj.blocker || "").trim();

  if (!questId) return skillActionErr("quest_id is required.");
  if (!reason) return skillActionErr("reason is required (non-empty blocker explanation).");

  let client;
  try {
    client = await resolveDbClient();
  } catch (e) {
    return skillActionErr(e instanceof Error ? e.message : String(e));
  }

  const { getQuestForOwner, updateQuest, recordQuestComment } = await import("@/libs/quest");
  const { data: quest, error: qErr } = await getQuestForOwner(questId, userId, { client });
  if (qErr || !quest) return skillActionErr(qErr?.message || "Quest not found or not owned by this user.");

  const stage = String(quest.stage || "");
  if (!RUNNABLE_STAGES.has(stage)) {
    if (stage === "escalated") {
      return skillActionErr(
        "Quest is already escalated; clear the blocker and return to execute/purrview/review/closing before re-escalating.",
      );
    }
    return skillActionErr(
      `Cannot escalate: quest stage "${stage}" is not runnable (need execute, purrview, review, or closing).`,
    );
  }

  const { error: upErr } = await updateQuest(questId, { stage: "escalated" }, { client });
  if (upErr) return skillActionErr(upErr.message || String(upErr));

  await recordQuestComment(
    questId,
    {
      source: "housekeeping",
      action: "escalateBlockedQuest",
      summary: `Escalated: ${reason.slice(0, 1800)}`,
      detail: { previous_stage: stage },
    },
    { client },
  );

  return skillActionOk({ quest_id: questId, stage: "escalated" }, "Quest moved to escalated.");
}

const housekeeping = {
  definition: skillBook,
  skillBook,
  getActiveQuests,
  escalateBlockedQuest,
};
export default housekeeping;
