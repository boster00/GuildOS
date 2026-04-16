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
        "Pull latest on your current branch. If git pull origin main fails, run: git remote show origin | grep HEAD to find the default branch and pull that instead. If merge conflicts or env errors, trigger setNewAgent.",
        "",
        "**Step 1: Clone GuildOS repo**",
        "Run: git clone https://github.com/boster00/GuildOS.git ~/guildos",
        "If already cloned: cd ~/guildos && git pull origin main",
        "Run: cd ~/guildos && npm install",
        "This gives you: global instructions, skill books, weapons, and env credentials.",
        "",
        "**Step 2: Set up GuildOS env**",
        "~/guildos/.env.local is gitignored and won't exist after clone.",
        "GuildOS uses a DIFFERENT Supabase project than your project repo.",
        "The GuildOS Supabase URL is: https://sdrqhejvvmbolqzfujej.supabase.co",
        "Check if you have SUPABASE_SECRETE_KEY for THIS project (not your project's key).",
        "If you do NOT have the GuildOS service role key: escalate immediately.",
        "Quest operations (read/write quests, comments, inventory) use the GuildOS Supabase, not your project's Supabase.",
        "Storage uploads (GuildOS_Bucket) also use the GuildOS Supabase.",
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
      description: "Post a comment to a quest.",
      howTo: `
Insert a row into quest_comments with: quest_id, source (adventurer), action (milestone/escalate/response), summary.

Only comment for significant events: major milestone completion, escalation, responding to feedback. Not routine progress.
`,
    },
    escalate: {
      description: "Move a quest to escalated stage.",
      howTo: [
        "Before moving to escalated, post a comment that clearly describes:",
        "1. What you were trying to do (one sentence)",
        "2. What went wrong — the exact error or blocker (paste the error message if there is one)",
        "3. What you need from the Guildmaster to unblock you (specific: a credential, a file, a decision)",
        "",
        "Then update the quest stage to escalated.",
        "",
        "Do NOT escalate for things you can figure out yourself or permission to proceed — just proceed.",
        "Do NOT escalate with vague descriptions like 'something went wrong' or 'need help'.",
      ].join("\n"),
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
      description: "Get all quests assigned to you that are not complete.",
      howTo: `
Query the quests table for your assigned quests that are not in complete stage. Order by priority (high > medium > low).
`,
    },
    submitForPurrview: {
      description: "Submit quest for Questmaster review by moving to purrview stage.",
      howTo: [
        "Before moving to purrview, you MUST:",
        "1. Upload all screenshots to Supabase Storage (bucket: GuildOS_Bucket, path: cursor_cloud/<questId>/)",
        "   Use the supabase_storage weapon: writeFile to upload, readPublicUrl to get the URL",
        "2. Store ALL public URLs in quest inventory (UPDATE quests SET inventory = ...)",
        "   Each item: { item_key, payload: { url, description } }",
        "   NOT file:// paths, NOT raw GitHub URLs, NOT in comments only",
        "3. SELECT the quest back and confirm inventory is populated (not empty)",
        "4. Only then UPDATE stage to purrview",
        "5. SELECT the quest back and confirm stage is purrview",
        "",
        "If resubmitting after feedback: REPLACE the old inventory with new screenshots, do not append.",
        "Delete old storage files and upload fresh ones so Cat reviews the latest version only.",
        "",
        "If inventory is empty when you move to purrview, Cat will reject it immediately.",
        "The Questmaster reviews from quest inventory, not from comments or your filesystem.",
      ].join("\n"),
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
  },
};
