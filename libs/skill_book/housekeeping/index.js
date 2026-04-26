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
      description: "Present a strategic plan with a separate, structured deliverables list. WBS lives in the strategy section as narrative; itemized artifacts live in `deliverables`.",
      howTo: `
**Read before you plan.** When the task references external resources (Figma files, URLs, docs, repos), read them BEFORE presenting. Plan from evidence, not speculation.

**Format — two sections:**

### Strategy
1–3 short paragraphs covering: goal, source of truth, scope (in / out), key dependencies, and the high-level approach. WBS-style phasing here is fine when sequence matters ("phase 1 ingest, phase 2 transform, phase 3 ship"). Do NOT itemize each artifact in this section — it's narrative, not a checklist.

### Deliverables (structured)
A list, one entry per artifact you'll ship. Each entry MUST have:
- \`item_key\` — stable kebab/snake identifier you'll reuse on the items row at submission time. Example: \`d1_route_response\`.
- \`description\` — one sentence on what the artifact shows / contains.
- \`accept_criteria\` — how to verify it's real (e.g., "image shows HTTP 200 and {inserted:8} JSON body" or "file >50KB and contains the string 'mvp_<timestamp>'"). The Questmaster grades against this.

**Rules:**
- The submitForPurrview gate refuses to advance unless every items row has \`url IS NOT NULL\`. Each entry is one screenshot/file you'll actually ship — keep the list tight and real.
- Don't restate the WBS as deliverables. Phases ≠ artifacts. A phase can produce multiple deliverables, or none.
- Present both sections to the user for iteration before creating the quest.
`,
    },
    writeQuest: {
      description: "Create a quest in execute stage with structured deliverables (not WBS-in-description).",
      howTo: `
**Flow:**
1. User describes a project/task in chat
2. Present a strategic plan (presentPlan action) — strategy paragraphs + structured deliverables list
3. Iterate with the user until they approve

**Pre-execution checklist — do NOT create the quest until ALL are satisfied:**
- \`description\`: strategic context only (goal, source of truth, scope, dependencies). NO itemized artifact list.
- \`deliverables\`: array of \`{item_key, description, accept_criteria}\` — one entry per planned artifact. The submit gate enforces this.
- Priority assigned (high/medium/low).

4. Ask: "I have everything. Shall I create this quest and start working on it?"
5. On confirmation, insert the quest in \`execute\` stage:

\`\`\`javascript
import { writeQuest } from "@/libs/quest";
const { data, error } = await writeQuest({
  userId,
  title: '<quest title>',
  description: '<strategic context — goal, source of truth, scope. NO itemized artifact list>',
  deliverables: [
    { item_key: 'd1_route_response', description: '/api/track returns 200 with {inserted:8}', accept_criteria: 'image shows HTTP 200 status and JSON body with inserted=8' },
    { item_key: 'd2_bq_rows',        description: 'BigQuery preview of 8 inserted rows',     accept_criteria: 'image shows 8 rows with the same user_pseudo_id sentinel' },
    // ... one per planned artifact
  ],
  stage: 'execute',
  priority: 'medium',
  assigneeId: '<your-adventurer-id>',
  assignedTo: '<your-name>',
});
\`\`\`

The \`deliverables\` column is JSONB. Each entry's \`item_key\` becomes the key for the corresponding \`items\` row at submission time — keep them stable, don't rename mid-quest.
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
      description: "Pre-flight self-honesty checks for every item. Advisory — the questExecution.submit gate enforces a subset; the rest is on you.",
      howTo: [
        "Run this BEFORE `submitForPurrview`. The submit gate already enforces:",
        "  - every items row has `expectation` set (declared spec)",
        "  - every items row has `url` set (no pending items)",
        "  - every item has ≥1 item_comments rationale row",
        "  - every item.url responds with content > 0 bytes",
        "",
        "These additional checks are NOT enforced in code but they're what gets you bounced by Cat anyway. Self-reject before submitting:",
        "",
        "1. **File-size sanity.** A real page capture at 1400px is rarely under ~80KB. Under ~50KB is almost certainly a placeholder/empty/error page. Re-capture.",
        "2. **URL match.** The URL bar in the screenshot (or captured route) must match the route you claim. `/products` showing a 404 or `/login` fails.",
        "3. **HTTP 200 at capture time.** If the server returned 500/4xx/empty, the capture is invalid regardless of how it looks. Confirm before capturing.",
        "4. **No dev overlays.** Next.js/Vite error overlays, `N Issues` badges, hot-reload toasts visible = auto-bounce. Dismiss or fix.",
        "5. **Expected content present.** Blank product images, zero rows on a catalog, never-resolved skeleton loaders all fail. Each item's `expectation` defines what 'real content' means for that row — the imageJudge / Cat verifier grades against it.",
        "6. **Stock-image substitution = bounce.** If you uploaded a beach photo with a description claiming it's a sales chart, Cat will catch it on vision review and bounce. Always upload the actual artifact.",
        "7. **No fabricated scores.** Don't invent Figma-fidelity scores or test counts. If you didn't run/read it, don't claim it.",
        "8. **Per-item comment is the artifact rationale, not a commit log.** `commit abc123` is not a rationale; `catalog page shows 5 real products with filter sidebar — matches accept_criteria \"page must show ≥3 products with images\"` is.",
        "9. **Correct repo/workspace.** If the quest is for a different repo and your session is in GuildOS, switch before starting.",
        "",
        "### If a check fails",
        "Fix the artifact, re-upload to Supabase Storage, call `writeItem` with the SAME item_key (UPSERT replaces in place — never invent `_v2` keys).",
        "If the failure is environmental (system down) and you can't produce a real artifact, ESCALATE the quest. Do not submit known-bad work.",
        "",
        "### If all checks pass",
        "Proceed to `submitForPurrview`. The submit gate will run the enforced subset; Cat's review will run the rest.",
      ].join("\n"),
    },
    submitForPurrview: {
      description: "Submit quest for Questmaster review. Hard-gated by code via questExecution.submit — no agent shortcut around it.",
      howTo: [
        "**THE GATE IS THE ONLY PATH.** Do not write `quests.stage = 'purrview'` directly. Do not post a self-attestation comment claiming submission. The next consumer (`questPurrview.confirmSubmission`) refuses to act unless the SUBMIT lockphrase comment is present, and the only path that produces that comment is calling `questExecution.submit({questId})` from this skill book action. Bypass attempts are caught downstream and the quest is treated as untrusted — your work won't get reviewed.",
        "",
        "Submission is a code-enforced gate. The questExecution weapon refuses to advance the quest unless ALL of:",
        "  1. quest is in `execute` stage",
        "  2. items rows exist for the quest",
        "  3. every items row has `expectation` set (the declared spec, set at quest creation)",
        "  4. every items row has `url` set (no items still pending)",
        "  5. each item has ≥1 item_comments entry (your rationale: what it shows + why it satisfies the expectation)",
        "  6. each item.url responds with content > 0 bytes (no zero-byte placeholders, no 404s)",
        "",
        "On success, the gate writes a quest_comments row containing the SUBMIT lockphrase ('this quest now meets the criteria for purrview'). The Questmaster's `confirmSubmission` greps for that phrase before opening any screenshot — no phrase, no review.",
        "",
        "### Pre-submission steps (per deliverable spec entry)",
        "",
        "1. Produce the artifact and upload to Supabase Storage:",
        "   - Bucket: `GuildOS_Bucket`, path: `cursor_cloud/<questId>/<filename>`",
        "   - Use the `supabase_storage` weapon (`writeFile` to upload, `readPublicUrl` to get the URL).",
        "",
        "2. Upsert into `items` using the SAME `item_key` as the items row that was created with the quest:",
        "   ```javascript",
        "   import { writeItem, writeItemComment } from '@/libs/quest';",
        "   const { data: item } = await writeItem({",
        "     questId,",
        "     item_key: 'd1_route_response', // matches the items row's item_key",
        "     url: 'https://.../bucket/.../d1_route_response.png',",
        "     caption: 'what the screenshot actually shows',",
        "   });",
        "   ```",
        "   The upsert only writes the fields you pass — it will NOT overwrite the `expectation` that was set at quest creation. UNIQUE(quest_id, item_key) means resubmits replace in place. Do NOT invent `_v2` keys.",
        "",
        "3. Post a worker rationale comment on each item:",
        "   ```javascript",
        "   await writeItemComment(item.id, {",
        "     role: 'worker',",
        "     text: 'Screenshot shows /api/track responding with HTTP 200 and {inserted:8}. Matches accept_criteria.',",
        "   });",
        "   ```",
        "",
        "4. Call the gate:",
        "   ```javascript",
        "   import { submit } from '@/libs/weapon/questExecution';",
        "   const result = await submit({ questId });",
        "   if (!result.ok) {",
        "     // result.failed = ['<gate-id>'], result.report = { msg, fix, ...details }",
        "     // Read result.report.fix and address it. Do NOT retry without fixing.",
        "   }",
        "   ```",
        "",
        "If `submit` returns `ok: false`, follow `result.report.fix` verbatim. Do NOT attempt to write `stage='purrview'` directly — there's no other path that produces the lockphrase, and Cat will reject the quest on review.",
        "",
        "If submit fails 3 times in a row on a gate you can't resolve, escalate the quest with the failure report attached.",
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
