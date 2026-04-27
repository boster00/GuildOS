/**
 * Housekeeping skill book — shared by ALL adventurers.
 * Core contracts + operational actions for quest management.
 *
 * Merged 2026-04-27: the former `codex` book (contracts + named protocols +
 * tier ownership + locked expectation language + spawn contract + honest
 * escalation) is now part of housekeeping. Workers, questmasters, and the
 * Guildmaster all carry these rules — there's no value in splitting them
 * across two globally-loaded books.
 */

export const skillBook = {
  id: "housekeeping",
  title: "Housekeeping — Core Contracts & Operations",
  description: "Contracts every adventurer follows + the operational lifecycle: init, writeQuest, escalate, comment, submit for review.",
  steps: [],
  toc: {
    // ── Contracts (formerly codex) ────────────────────────────────────────
    readContractsFromMain: {
      description: "Always read CLAUDE.md from the main branch on session start (worktree drift is the documented cause of past contract failures).",
      howTo: `On every session start: run \`git -C /workspace show main:CLAUDE.md\` (or \`git show main:CLAUDE.md\` if /workspace is GuildOS) and treat THAT as authoritative — not the auto-loaded file. If the auto-loaded copy differs from main, main wins without exception.

Why: a session can be rooted in a stale worktree. Auto-loaded CLAUDE.md is a courtesy, not source of truth. Worktree drift caused the 2026-04-26 BCS / WWCD failures and the description-as-status incident. Don't repeat them.

Refresh ritual: also re-run this on long sessions if contracts get fuzzy. Cheap to repeat.`,
    },

    invokeNamedProtocol: {
      description: "When the user says BCS / CBS / CSB (any 3-letter B/C/S permutation) or WWCD, look up the spec verbatim before responding.",
      howTo: `Named interaction protocols are domain terms with defined contracts. They don't follow training-data shapes. Look them up in CLAUDE.md every single time:

- **BCS / CBS / CSB / BSC / SBC / SCB** → CJ Briefing Style. Table format with required columns: \`# | Item | Status | Δ | Note\`. Required \`100%\` substring somewhere in the response.
- **WWCD** → "What Would CJ Do." Two output modes (A or B), banned shortcuts (no HEAD-checking ≠ verification, no calibration laundering, no mini-only judging), required \`100%\` substring. Mandatory direct multimodal Read for any "verified / done / ready" claim on quests with image deliverables.

If you find yourself producing a sit-rep style response from training data, stop and re-read the spec. Do not free-style.`,
    },

    writeExpectationInLockedStyle: {
      description: "items.expectation must be written in the reviewer-facing 'we should see X showing Y with these details: Z' style.",
      howTo: `Required shape:
- Screenshots: \`"In the screenshot, we should see <subject/UI element> showing <state or content> with these details: <specific, numbered facts>."\`
- Docs (.md, .json, .txt): \`"In the document, we should see <subject> covering <scope> with these details: <facts>."\`
- Other: \`"In the artifact, we should see <subject> demonstrating <property> with these details: <facts>."\`

The expectation is the literal claim handed to the gpt-4o judge AND read by the user in the GM-desk side panel. Be specific and anchored. Bad: "image shows HTTP 200." Good: "In the screenshot, we should see the /api/track fire-response panel showing HTTP 200 with these details: response body is {inserted:8, rejected:[], errors:[]}."

Full guidance: \`presentPlan\` in this same book.`,
    },

    respectTierColumnOwnership: {
      description: "Each of the 5 review-tier columns on items is owned by exactly one tier; never write to a column you don't own.",
      howTo: `5 review-tier columns on \`items\`:
- \`self_check\`     — T0, owned by the worker at submit time (worker self-claim).
- \`openai_check\`   — T1, owned by the OpenAI judge (\`openai_images.judge\` weapon).
- \`purrview_check\` — T2, owned by Cat (questPurrview.approve / .bounce).
- \`claude_check\`   — T3.5, owned by the Guildmaster's local Claude direct multimodal review (questReview.pass / .bounce).
- \`user_feedback\`  — T4, owned by the user via the GM-desk Feedback button.

A tier may overwrite its OWN column (e.g. T1 re-judging is fine). It must NEVER overwrite another tier's column. The 2026-04-26 calibration laundering happened because a downstream layer rewrote upstream verdicts; that's structurally banned.`,
    },

    noBypassSpawnContract: {
      description: "Spawning a cursor agent is only valid via cursor.writeAgent — direct POSTs to the Cursor API skip the GuildOS credentials block.",
      howTo: `Every cursor agent spawn must go through \`cursor.writeAgent\`. The weapon prepends a setup block to the spawn prompt that provisions GUILDOS_NEXT_PUBLIC_SUPABASE_URL + GUILDOS_SUPABASE_SECRETE_KEY into the agent's ~/.guildos.env.

Without that block, agents end up with their project's Supabase but not GuildOS — the documented 2026-04-26 ptglab failure mode. The agent does the work, can't post items rows, can't call submitForPurrview, and either escalates honestly or fakes artifacts.

If you're tempted to do a direct POST to https://api.cursor.com/v0/agents — stop, use cursor.writeAgent. The credentials block is the whole point.`,
    },

    // ── Operations ────────────────────────────────────────────────────────
    initAgent: {
      description: "Initialize agent session — verify GuildOS access (provisioned by cursor.writeAgent's setup block), read instructions, check for work.",
      howTo: [
        "**On session start or re-init:**",
        "",
        "**Step 0: Verify GuildOS credentials are loaded**",
        "Every agent spawned via `cursor.writeAgent` (the only supported spawn path) gets a setup block at the top of its prompt that creates `~/.guildos.env` and sources it. By the time you run initAgent, that block should already have executed.",
        "Verify: `echo \"$GUILDOS_SUPABASE_SECRETE_KEY\" | head -c 12` should print a non-empty prefix. `echo \"$GUILDOS_NEXT_PUBLIC_SUPABASE_URL\"` should print `https://sdrqhejvvmbolqzfujej.supabase.co`. The basic-named SUPABASE_SECRETE_KEY and NEXT_PUBLIC_SUPABASE_URL are also exported as fallbacks.",
        "If GUILDOS_-prefixed vars are empty: the writeAgent setup block was skipped or your shell lost the source. Run `source ~/.guildos.env` once more. If that still fails, your spawn was created without the credentials block — escalate immediately with `housekeeping.escalate` (`detail.reason='spawn missing GuildOS credentials block'`, `detail.unblock_path='Guildmaster respawns this agent via cursor.writeAgent (the only supported path)'`). Do NOT try to work around this gap by uploading to your project's Supabase — that's the documented 2026-04-26 ptglab failure mode.",
        "",
        "**Step 1: Confirm /workspace = GuildOS**",
        "All agents are spawned with **GuildOS as the main repo** (locked 2026-04-27 for consistent agent behavior). Cursor checks GuildOS out into `/workspace` automatically. Verify: `cd /workspace && git remote -v | head -1` should show `boster00/GuildOS`. Pull latest: `cd /workspace && git pull origin main && npm install`. This gives you: global instructions (CLAUDE.md), skill books, weapons, env-cred templates — without any extra clone.",
        "If `/workspace` is NOT GuildOS, your spawn used the wrong repository — escalate (`detail.reason='spawn repo != GuildOS'`, `detail.unblock_path='Guildmaster respawns via cursor.writeAgent with repository=github.com/boster00/GuildOS'`).",
        "",
        "**Step 2: Clone your project repo (if you're a project-worker class)**",
        "If your role works on a specific project (CJGEO Dev → cjgeo, BosterBio Website Dev → bosterbio.com2026, Nexus Armor Dev → boster_nexus, etc.), clone that repo as a sibling so you have both:",
        "```bash",
        "cd ~ && git clone https://github.com/boster00/<your-project-repo>.git",
        "cd ~/<repo> && git pull origin main && npm install",
        "```",
        "Your `adventurers.system_prompt` names which project repo you own (read it next in step 3). Questmasters and pure-orchestration roles don't need a project clone — GuildOS is enough.",
        "",
        "**Step 3: Persist creds into GuildOS .env.local (already at /workspace)**",
        "The repo's `.env.local` is gitignored and missing on fresh clones. Mirror your shell vars into it so node scripts that read `--env-file=.env.local` work:",
        "```bash",
        "cat > /workspace/.env.local <<EOF",
        "GUILDOS_NEXT_PUBLIC_SUPABASE_URL=$GUILDOS_NEXT_PUBLIC_SUPABASE_URL",
        "GUILDOS_SUPABASE_SECRETE_KEY=$GUILDOS_SUPABASE_SECRETE_KEY",
        "NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL",
        "SUPABASE_SECRETE_KEY=$SUPABASE_SECRETE_KEY",
        "EOF",
        "```",
        "Do the same in your project repo's `.env.local` so its node scripts can also reach GuildOS for quest bookkeeping.",
        "Quest operations (read/write quests, items, quest_comments) use the GuildOS Supabase. Storage uploads to `GuildOS_Bucket` use the same project.",
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
      description: "Move a quest to escalated stage when truly blocked. Structured: writes a comment with detail.reason + detail.unblock_path so verifyQuestComplete can recognize escalated as a valid end state.",
      howTo: [
        "Escalate only when truly blocked — you cannot proceed at all.",
        "If a workaround exists (use placeholder image, skip non-critical step, etc.), note the issue in a regular comment and keep working. Reserve formal escalation for situations where you cannot make any progress.",
        "",
        "**Structured escalation contract.** `escalated` is a valid user-ready end state IFF the escalation comment carries structured `detail.reason` (what specifically failed) and `detail.unblock_path` (what the user must do to unblock). `housekeeping.verifyQuestComplete` refuses Mode A on escalated quests that lack these fields. Vague escalations are abandonment, not handoff.",
        "",
        "Escalation target: Guildmaster (higher-privilege actor with local machine access).",
        "",
        "Steps:",
        "1. Insert a comment with the structured payload:",
        "   ```javascript",
        "   import { recordQuestComment } from '@/libs/quest';",
        "   await recordQuestComment(questId, {",
        "     source: 'housekeeping',",
        "     action: 'escalate',",
        "     actor_name: '<your-adventurer-name>',",
        "     summary: '<one-sentence headline of what blocks you>',",
        "     detail: {",
        "       reason: '<specific, exact error or blocker — paste the error message verbatim if there is one>',",
        "       unblock_path: '<what the user (or Guildmaster) must do to unblock — specific: a credential to add, a file to drop, a decision to make>',",
        "       attempted: ['<what you tried>', '<and why it failed>'],",
        "     },",
        "   });",
        "   ```",
        "2. Update the quest stage to `escalated` via the standard quest update path.",
        "3. The Guildmaster will resolve directly or surface to the user; once resolved, the quest moves back to execute and you continue.",
        "4. If you have other active quests, work on the next highest-priority one while waiting.",
        "",
        "Quality bar (agent best effort — the gate cannot enforce these but Cat / Guildmaster will reject vague escalations):",
        "- `reason` is a specific symptom, not a category. ❌ 'auth failed'. ✅ 'Telnyx API returns 403 \"insufficient permissions\" when calling /v2/messaging_profiles; the API key lacks messaging_profile:write scope.'",
        "- `unblock_path` is a single concrete next action by an identifiable actor. ❌ 'fix the auth'. ✅ 'User needs to regenerate the Telnyx API key with messaging scope enabled at https://portal.telnyx.com/#/auth-keys and put it in profiles.env_vars.'",
        "",
        "Do NOT escalate for things you can figure out yourself or for permission to proceed — just proceed.",
        "Do NOT escalate with vague descriptions like 'something went wrong' or 'need help'. They will be bounced back.",
      ].join("\n"),
    },
    mountAuthBundle: {
      description: "Cursor agent: pull the user's exported browser auth bundle from Supabase Storage and write it to local disk so headless Playwright can mount it via `storageState`. Call ONCE at agent init for any task that needs authenticated UI access.",
      howTo: [
        "**When to use this.** Cursor cloud agents are sandboxed VMs that can't share the user's logged-in Chrome. For tasks needing authenticated UI access (Magento admin, Zoho UI, internal dashboards), the user runs `scripts/auth-capture.mjs --upload` locally; the bundle lands in Supabase Storage at `auth_bundles/<ownerId>/storageState.json`. This action pulls it.",
        "",
        "**Public-only tasks don't need this** (cherry farms, cabin-camping research, etc. — public sites). Skip if your quest is public-only.",
        "",
        "Usage:",
        "```javascript",
        "import { downloadBundle } from '@/libs/weapon/auth_state';",
        "const r = await downloadBundle({ ownerId: process.env.GUILDOS_OWNER_ID });",
        "if (!r.ok) {",
        "  // No bundle exists. Either ask the user to run auth-capture --upload,",
        "  // or proceed with a public-only path (and escalate if auth wall hit).",
        "}",
        "// r.path is now writeable; mount in Playwright:",
        "const browser = await chromium.launch();",
        "const context = await browser.newContext({ storageState: r.path });",
        "```",
        "",
        "**Freshness check.** The bundle has a default expiry (~7 days). Call `auth_state.readExpiryStatus({statePath})` before relying on it. If `needsRefresh: true`, escalate via `housekeeping.escalate` with `unblock_path: 'User to run scripts/auth-capture.mjs --upload to refresh expired cookies for: <expiredDomains>'`.",
        "",
        "**Don't ship credentials in screenshots.** If a deliverable screenshot inadvertently captures an account name, password, or session token, recapture before writeItem.",
      ].join("\n"),
    },
    verifyAdventurerSession: {
      description: "Pre-dispatch session-health probe. Calls cursor.syncSessionStatus to reconcile the adventurers DB row against the upstream Cursor API; returns whether the session can safely accept a followup. Required before any writeFollowup or writeAgent dispatch.",
      howTo: [
        "**Substrate guard.** Cursor sessions have an upstream lifecycle (CREATING → RUNNING → FINISHED → EXPIRED) that the adventurers DB does NOT auto-reflect. Sending a followup to an EXPIRED session returns 409 'Agent is deleted' silently breaking the dispatch. Always probe first.",
        "",
        "Call this before EVERY dispatch (writeFollowup or writeAgent). It costs one Cursor API call.",
        "",
        "```javascript",
        "import { syncSessionStatus } from '@/libs/weapon/cursor';",
        "const probe = await syncSessionStatus({ adventurerName: 'Researcher' });",
        "if (!probe.dispatch_safe) {",
        "  // probe.upstream_status: 'EXPIRED' | 'deleted_or_unreachable' | 'ERROR' | ...",
        "  // Either: respawn a fresh Cursor agent (cursor.writeAgent) and update adventurers.session_id,",
        "  //   OR pick a different adventurer for this task.",
        "  // Do NOT proceed to dispatch — the followup will silently fail.",
        "}",
        "// probe.dispatch_safe === true → followup is expected to land",
        "```",
        "",
        "Drift handling: if the local DB says `session_status='idle'` but upstream is EXPIRED, this function reconciles the DB to `'expired'` so subsequent code paths see the truth. `probe.was_drift === true` indicates a reconciliation just happened.",
        "",
        "Respawn protocol when `dispatch_safe === false`:",
        "  1. Per the no-repurpose rule (CLAUDE.md): the existing adventurer's identity is preserved; only the cursor session is refreshed.",
        "  2. Call `cursor.writeAgent({ repository, ref })` to spawn a fresh session bound to the adventurer's repo.",
        "  3. Update `adventurers.session_id` to the new session id; keep name, backstory, system_prompt, capabilities, skill_books unchanged.",
        "  4. Re-probe to confirm the new session is dispatch_safe.",
        "  5. Then send the followup.",
      ].join("\n"),
    },
    verifyQuestComplete: {
      description: "Programmatic check that a quest is in a valid user-ready end state. Required before any 'done' claim.",
      howTo: [
        "**This is the scripted version of the completion criteria.** Call it before declaring a quest done in any output (Mode A, BCS terminal verdict, agent task close-out). It returns ok:true only when:",
        "  - quest.stage === 'review' AND a `questReview.final_gate_pass` comment with the FINAL_GATE_PASS lockphrase exists, OR",
        "  - quest.stage === 'escalated' AND the latest `action='escalate'` comment carries non-empty `detail.reason` AND non-empty `detail.unblock_path`.",
        "Anything else returns ok:false with `missing` (the specific gate that failed) and `reason` (a one-sentence description for the agent to read).",
        "",
        "Usage:",
        "```javascript",
        "import { verifyQuestComplete } from '@/libs/quest';",
        "const v = await verifyQuestComplete({ questId });",
        "if (!v.ok) {",
        "  // v.missing: ['final_gate_pass' | 'final_gate_pass_lockphrase' | 'escalation_comment' | 'escalation_reason' | 'unblock_path' | 'end_state']",
        "  // v.reason: human-readable why this is not a valid end state",
        "  // Don't claim done; act on v.reason.",
        "}",
        "// v.ok === true when end_state ∈ ('review_ready', 'escalated_blocked')",
        "```",
        "",
        "Conventions on what counts as 'done' for this action:",
        "- **Code-checkable conditions** (existence) are enforced here.",
        "- **Quality conditions** (is the reason specific? is the unblock_path actionable?) are agent best-effort enforced upstream by housekeeping.escalate's contract and Cat's purrview review.",
        "Do not bypass this — write your own end-state check and you'll diverge from the canonical contract.",
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
- \`expectation\` — the **reviewer-facing claim** about the artifact, written so the Questmaster + the user know what to look for at a glance. Required style:
  - For screenshots: **"In the screenshot, we should see &lt;subject/element&gt; showing &lt;state or content&gt; with these details: &lt;numbered, specific facts&gt;."**
  - For docs (.md, .json, .txt): **"In the document, we should see &lt;subject&gt; covering &lt;scope&gt; with these details: &lt;facts&gt;."**
  - For other artifacts: **"In the artifact, we should see &lt;subject&gt; demonstrating &lt;property&gt; with these details: &lt;facts&gt;."**
  Example (good): \`"In the screenshot, we should see the /api/track fire-response panel showing HTTP 200 with these details: response body is {inserted:8, rejected:[], errors:[]}; sentinel user_pseudo_id appears in the row preview."\`
  Example (bad — too terse, no anchor): \`"image shows HTTP 200 and {inserted:8} JSON body"\` — the reviewer doesn't know where on the page to look or what counts as success.
  The expectation is the literal claim the gpt-4o judge (T1) is given verbatim, AND the literal claim the user reads in the side panel before reviewing. Specific, anchored, numbered.

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
- \`deliverables\`: array of \`{item_key, expectation}\` — one entry per planned artifact, expectation in the reviewer-facing style (see presentPlan). The submit gate enforces this.
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
    {
      item_key: 'd1_route_response',
      expectation: 'In the screenshot, we should see the /api/track fire-response panel showing HTTP 200 with these details: response body is {inserted:8, rejected:[], errors:[]}; sentinel user_pseudo_id is visible in the request log.',
    },
    {
      item_key: 'd2_bq_rows',
      expectation: 'In the screenshot, we should see the BigQuery rows-landed preview showing 8 of 8 rows for the smoke run with these details: each row carries the same sentinel user_pseudo_id; event_name column lists the Tier-1 allowlist (page_view, session_start, purchase, form_submit, GAds Conversion, P1.Search, P2.ClickProductLink, P4.AddToCart).',
    },
    // ... one per planned artifact, each in the same reviewer-facing style
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
