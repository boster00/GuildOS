/**
 * Housekeeping skill book — shared by ALL adventurers.
 * Core operational actions for quest management, communication, and self-management.
 */

export const skillBook = {
  id: "housekeeping",
  title: "Housekeeping — Core Agent Operations",
  description: "Manage quest lifecycle: init, writeQuest, escalate, comment, submit for review.",
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
    verifyDeliverable: {
      description: "Self-QA every deliverable against universal BS-screenshot checks before submitting to purrview.",
      howTo: [
        "Run this BEFORE `submitForPurrview`. If any check fails, fix the artifact first — do not submit.",
        "",
        "**This is a self-honesty gate, not a tactical instruction.** How you capture, fix, or re-render is up to you. These rules only describe what must be TRUE of every deliverable.",
        "",
        "### Universal checks (apply to every screenshot deliverable)",
        "",
        "1. **File size sanity.** A real page capture at 1400px is rarely under ~80KB. If a PNG is under ~50KB it is almost certainly a placeholder, an empty state, or an error page. Re-capture.",
        "2. **URL match.** The URL bar in the screenshot (or the captured route) must match the route you claim to be showing. A `/products` deliverable that shows a Next.js starter page, a 404, or `/login` fails this check.",
        "3. **HTTP 200 at capture time.** If the dev server returned 500 / 4xx / empty body, the capture is invalid regardless of how it looks. Confirm the response before capturing.",
        "4. **No dev overlays.** Next.js/Vite error overlays, `N Issues` badges, hot-reload toasts, React dev warnings visible in the frame = auto-reject. Dismiss or fix before capturing.",
        "5. **Expected content present.** Pages with placeholder blank rectangles where real content should be (blank product image, zero products on a catalog, skeleton loaders never resolved) fail. The quest's Deliverable Specification defines what 'real content' means for this quest.",
        "",
        "### Honesty checks (apply to the submission as a whole)",
        "",
        "6. **No fabricated scores.** If the quest asks for a Figma fidelity score, you must have either (a) actually read the Figma reference during this quest or (b) an explicit user waiver recorded in quest comments. Writing `figma_score: 9` because you hope it's 9 fails this check.",
        "7. **Submission describes the artifact, not the commit.** The purrview comment must say what the screenshots SHOW, not just list commit hashes. `commit abc123 + def456` is not a deliverable description; `catalog shows 5 products with filter sidebar; PDP shows real image, specs, cart CTA` is.",
        "8. **Correct repo / workspace.** If the quest is for a different repo (e.g. bosterbio.com2026) and your session is in GuildOS, switch repos before starting. Deliverables produced in the wrong repo fail this check.",
        "",
        "### Quest-specific acceptance",
        "",
        "9. **Cross-check against the quest's Deliverable Specification.** Re-read the quest description's Deliverable Specification section. Every acceptance criterion there must be verifiable in the deliverable. Self-reject any criterion you can't verify.",
        "",
        "### If a check fails",
        "",
        "- Fix the underlying issue, re-capture, re-upload to the SAME item_key (REPLACE, don't pile on).",
        "- If the issue is environmental (Medusa down, Postgres unreachable, 500 error you can't resolve), escalate the quest rather than submit a broken artifact — BS screenshots of a broken system are worse than no submission.",
        "",
        "### If all checks pass",
        "",
        "Proceed to `submitForPurrview`. Note in the purrview comment which rubric items you verified (e.g. 'all 9 verifyDeliverable checks passed; Figma score based on direct file read of NMfOvoGgMVFPYM4nLtN8zD').",
      ].join("\n"),
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
        "",
        "**Precondition:** run `verifyDeliverable` first and confirm every check passes. If a check fails, do not submit — fix the artifact first. Cat applies the same rubric on review; submitting a known-bad deliverable wastes a review cycle.",
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
