/**
 * Housekeeping skill book — shared by ALL adventurers.
 * Core operational actions for quest management, communication, and self-management.
 */

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
**Before seeking help or submitting deliverables:**
1. Git push your branch first — your work must be saved
2. If the quest has more than 10 comments, run summarizeComments first to keep things clean

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
      description: "Get all quests assigned to you that are not complete.",
      howTo: `
**Query:**
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
