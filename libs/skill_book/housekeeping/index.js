/**
 * Housekeeping skill book — shared by ALL adventurers.
 * Core operational actions for quest management, communication, and self-management.
 */

export const skillBook = {
  id: "housekeeping",
  title: "Housekeeping — Core Agent Operations",
  description: "Manage quest lifecycle: init, createQuest, escalate, comment, submit for review.",
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
        "**Step 3: Read instructions and load your skill books (index first, content on demand)**",
        "1. Read ~/guildos/CLAUDE.md. Pay attention to the 'Read, don't improvise' and 'Index first, content on demand' rules — they apply to everything below.",
        "2. Query your adventurer profile from Supabase (adventurers table by your ID) to get system_prompt and skill_books.",
        "3. Read your system_prompt in full — project identity and conventions.",
        "4. Load skill book tocs only (NOT full howTos). Use this one-liner for each book (housekeeping first, then each id in your `skill_books` array):",
        "   ```",
        "   cd ~/guildos && node -e \"import('./libs/skill_book/<NAME>/index.js').then(m=>{const sb=m.skillBook||m.definition;const t=sb?.toc||{};console.log(JSON.stringify(Object.fromEntries(Object.entries(t).map(([k,v])=>[k,v?.description||(typeof v==='string'?v.split('\\\\n')[0].slice(0,120):'')])),null,2));})\"",
        "   ```",
        "   This prints a compact { actionName: description } map. Keep that in working context. Do NOT read the full file.",
        "5. When you're about to execute a specific action, open ONLY that action's `howTo` (e.g. `grep -A 40 '<actionName>:' libs/skill_book/<NAME>/index.js`). Follow the instruction verbatim. Discard the howTo from working context after the action completes.",
        "6. Your assigned books are the default working set, not a hard limit. When stuck with no matching action, BEFORE escalating: scan the registry at libs/skill_book/index.js, extract the toc of any book whose id looks relevant (same one-liner above), and try. Only escalate after that fallback is exhausted.",
        "7. **Never perform a non-trivial action natively if an instruction exists.** If in doubt, grep the skill books for the action name before freestyling.",
        "",
        "**Step 4: Check for work**",
        "Use searchQuests to find quests assigned to you.",
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
      description: "Move a quest to escalated stage when truly blocked.",
      howTo: [
        "Escalate only when truly blocked — you cannot proceed at all.",
        "If a workaround exists (use placeholder image, skip non-critical step, etc.), note the issue in a comment and keep working. Reserve formal escalation for situations where you cannot make any progress.",
        "",
        "Escalation target: Guildmaster (higher-privilege agent with local machine access).",
        "",
        "Steps:",
        "1. Post a comment on the quest describing:",
        "   - What you were trying to do (one sentence)",
        "   - What went wrong — the exact error or blocker (paste the error if any, be specific, e.g. 'Missing ZOHO_CRM_SCOPE in env vars' not 'auth failed')",
        "   - What you tried and why it failed",
        "   - What you need from the Guildmaster to unblock you (specific: a credential, a file, a decision)",
        "2. Update the quest stage to escalated.",
        "3. The Guildmaster will either resolve directly or give feedback; once resolved, the quest moves back to execute and you continue.",
        "4. If you have other active quests, work on the next highest-priority one while waiting.",
        "",
        "Do NOT escalate for things you can figure out yourself or permission to proceed — just proceed.",
        "Do NOT escalate with vague descriptions like 'something went wrong' or 'need help'.",
      ].join("\n"),
    },
    presentPlan: {
      description: "Present a WBS-format plan with clear deliverables and measurement criteria.",
      howTo: `
**Read before you plan.** When the task references external resources (Figma files, URLs, docs, repos), read them BEFORE presenting the plan. You need to know what exists to create an accurate WBS. Don't plan speculatively — plan from evidence.

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
    writeQuest: {
      description: "Create a quest in execute stage after user approves the plan.",
      howTo: `
**Flow:**
1. User describes a project/task in chat
2. Present a WBS plan (presentPlan action)
3. Iterate with the user until they approve

**Pre-execution checklist — do NOT create the quest until ALL are satisfied:**
- Clear deliverable description (what screenshots should show, acceptance criteria)
- Priority assigned (high/medium/low)

4. Ask: "I have everything. Shall I create this quest and start working on it?"
5. On confirmation, create the quest in \`execute\` stage:

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
    clarifyQuest: {
      description: "Clarify which quest the user means when their instructions are ambiguous.",
      howTo: `
1. Look up your currently assigned quests.
2. Present the relevant ones and ask: "Which quest is this for, or should I create a new one?"
`,
    },
    seekHelp: {
      description: "Contact the Questmaster (Cat) for approval or assistance.",
      howTo: `
Cat is a DB adventurer. Look up her session and send a followup via the cursor weapon:

\`\`\`javascript
// 1. Find Cat's session id
const { data } = await db.from('adventurers').select('session_id').eq('name', 'Cat').single();

// 2. Send a followup identifying yourself, your quest, and what you need
import { writeFollowup } from '@/libs/weapon/cursor';
await writeFollowup({
  agentId: data.session_id,
  message: "Quest <id> (<title>): <what you need>. Deliverable URLs if seeking review: ...",
});
\`\`\`

If Cat can't help, escalate to the Guildmaster via the escalate action.
`,
    },
    searchQuests: {
      description: "Search your assigned quests (default: not complete).",
      howTo: `
Query the quests table for your assigned quests that are not in complete stage. Order by priority (high > medium > low).
`,
    },
    submitForPurrview: {
      description: "Submit quest for Questmaster review by moving to purrview stage.",
      howTo: [
        "Before moving to purrview, you MUST:",
        "",
        "1. Upload every screenshot to Supabase Storage:",
        "   - Bucket: GuildOS_Bucket",
        "   - Path: cursor_cloud/<questId>/<filename>",
        "   - Use the `supabase_storage` weapon: `writeFile` to upload, `readPublicUrl` to get the URL.",
        "   - NOT file:// paths. NOT raw GitHub URLs. NOT in comments only.",
        "",
        "2. Upsert each deliverable into the items table via `writeItem`:",
        "",
        "   ```javascript",
        "   import { writeItem } from '@/libs/quest';",
        "   await writeItem({",
        "     questId,",
        "     item_key: 'screenshot_1',",
        "     url: 'https://.../bucket/.../screenshot_1.png',",
        "     description: 'what it shows',",
        "     source: '<your-adventurer-name>',",
        "   });",
        "   ```",
        "",
        "   The UNIQUE(quest_id, item_key) constraint makes resubmissions an UPSERT — same key overwrites in place. REPLACE, don't pile on.",
        "",
        "3. SELECT items for the quest and confirm the expected keys are all present.",
        "4. Move the quest stage to `purrview`.",
        "5. SELECT the quest back and confirm stage is purrview.",
        "",
        "**REPLACE, do not pile on.** If resubmitting after feedback: for each deliverable item that changed, delete the old storage file and call writeItem with the SAME item_key — the DB constraint handles the replace. Do NOT invent new keys like screenshot_1_v2. A pile of mostly-similar screenshots is an auto-reject.",
        "",
        "If no items exist for the quest when you move to purrview, Cat rejects immediately. Cat reviews from the items table, not from comments or your filesystem.",
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
