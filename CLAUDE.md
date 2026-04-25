# GuildOS — Claude Code Guide

## Work on main. No ad-hoc branches.
All ad-hoc changes — refactors, fixes, weapon/skill-book edits, CLAUDE.md updates — commit directly to `main`. Do not create feature branches or worktrees for this work. Branches fragment state and hide changes from other agents. If you're on a non-main branch, switch back before committing. Unless user specifically ask for a branch, in which case do what the user asks for. 

## Never ask user low value questions.
Avoid asking questions that you can do without the user's input. The bypass permission is usually turned on and the goal for this system is to enable maximum leverage by allowing mutiple threads to run parallel. The goal to strike for is to ask user for questions and help only if there is no obvious answer/choice, or if there is a block that only the user can resolve, or if there are significant risk involved for proceeding. We shall lock down the rule here that before you present the list of questions to the user, ask yourself at least one time: do I really need user's input on this? Can I do this myself with the tools I have? Especially consider the CIC, most things the user can do you can do it through CIC as a fallback. Auto-approve on all low risk decisions and decisions that can easily be reversed without real harm.

## sit rep standard
When user says "sit rep", output in table format all action items in this thread only, with (if applicable) 
1. status (usually the progression stages are defined by the user defined strategy), 
2. delta, 
3. recommendations/questions/your message about the item (column name= note). 

## "What would CJ do" / WWCD

Triggered by "WWCD" or "what would CJ do." You exit in exactly one of two modes — never both.

### Filter pass (kill every question and every "I can't" you can)

Run each candidate through these gates in order. First hit kills it.

1. **Low-value question?** (See "Never ask user low value questions" above.) → kill, assume obvious choice.
2. **Already defined in a skill book or weapon?** Check assigned books first, then scan `libs/skill_book/index.js` registry. → read the howTo, use it.
3. **CIC can retrieve the missing context?** (Logged-in dashboards, page state, anything the user can see.) → use CIC.
4. **"Latest / current" question?** → web search.
5. **A small-scope smoke test will answer it?** (No destructive writes, limited blast radius, can reverse.) → run it.

A question survives only if all five gates fail.

### Completion check before claiming "done"

**Quest-backed work:**
- Deliverables are screenshots attached to a quest currently in `review` or later (Cat has approved).
- You opened each screenshot and visually confirmed it shows what the description claims.
- Every main bullet in the quest description has a matching screenshot — no gaps.

**Local-only work (no quest):** produce concrete evidence (file paths changed with diff, command output, terminal/UI screenshot) and verify it yourself before claiming done. Quest gate doesn't apply, rigor does.

Full rubric: `housekeeping.verifyDeliverable`.

### Output mode — pick exactly one

**Mode A — Everything done:** sit rep, then end with the literal string `Everything is 100% done.` No question list. Do not include the Mode B preface.

**Mode B — Blocked / questions outstanding:**
1. *(Optional)* a brief comments block giving context for the surviving questions. Comments are about questions that *survived* — never about options you eliminated.
2. The literal sentence, verbatim:
   `I have done everything CJ would have done and I am 100% confident that what I am telling you is worth your attention`
3. The bare question list. One sentence per question. Nothing after.

The user greps responses for the substring `100%`. Both modes contain it; a response missing it is rejected unread. This is enforcement, not stylistic preference — quote the sentences verbatim.

### Self-audit before sending

- Did I leak any eliminated option, filter-pass reasoning, or "here's how I decided" commentary?
- Does the questions section contain anything the user didn't explicitly need to decide?
- Is each surviving question one sentence, no padding?
- Is `100%` present in the right slot?

## Priority hierarchy
When instructions conflict, follow this order:
1. **Project-specific system_prompt** (highest — actively managed, most specific)
2. **Skill books** (static but concrete)
3. **Global rules** (lowest — fallback guidance)

## Read, don't improvise
**Never perform a non-trivial action natively if an instruction exists.** Before acting:
1. Check your loaded skill book tocs for a matching action.
2. If one exists, read its `howTo` and follow it.
3. If nothing fits, scan the registry at `libs/skill_book/index.js` — a fitting action may live in a book you haven't loaded.
4. Only freestyle when you've confirmed no instruction exists.

**Index first, content on demand.** Load only tocs at boot (for both skill books and weapons). Open a specific action's `howTo` only when you're about to execute it. Discard it after — don't keep it in working context once the action is done.

## Initiation
On session start: load the agent profile, load skill books, load weapons (print the list in chat history). Discover skill books and weapons under `libs/skill_book/<name>/index.js` and `libs/weapon/<name>/index.js`; the registries are in `libs/skill_book/index.js` and `libs/weapon/registry.js`.

Then figure out which situation you are in:

1. **Direct action** — user issues direct tasks for Claude to perform (usually the personal assistant thread). Save screenshots in `docs/screenshots`; the user handles cleanup.

2. **Chaperon cursor** — user tells the Claude session to chaperon (guide or directly communicate with) a cursor agent to remove obstacles and drive toward objectives. You must know which quest this is for and which repo the quest is associated with. If unclear, do a self-clarity check. Screenshots during chaperon work go in quest inventory — see `questmaster.reviewScreenshots`. Avoid overanchoring: communicate with cursor agents in natural language. Programming advice or screenshot requirements are fine; do not prescribe scripts or step-by-step tactics. Cursor agents have well-tuned defaults; tactical overrides cause them to deviate and fail.

**Chaperon claude** — user tells the local Claude (Guildmaster) to chaperon other Claude sessions (claude.ai/code threads, each running as its own agent). Standard locked in 2026-04-24:

**Primary metric — agent uptime.** The chaperon is not optimizing for full-pass completeness; the chaperon is optimizing for keeping the maximum number of agents working productively. A "stopped" agent that the chaperon could have re-engaged is wasted time. Most cycles are a quick uptime scan (who stopped, can I dispatch them?), not a full sit rep. The chaperon also keeps its own thread alive by acting every cycle — sitting completely idle risks context compaction.

**1. Comms channel — CIC only.** API and SDK both create forks (separate conversations); messages never land in the target thread. CIC (`mcp__Claude_in_Chrome__*`) is the only path that injects into the actual thread. Verified send protocol: navigate → wait for input field empty + no spinner → click into input → `type` action (real keystrokes; React state-aware, unlike `execCommand`/JS-insert which leaves Send disabled) → press `Return` → screenshot to confirm a blue user bubble appeared in the thread. Never trust a Send-button click alone — it is silently swallowed when the agent is busy. Enter bypasses the disabled-button state. If the first click+type fails (input still empty), retry once; the page may not have fully rendered.

**2. Sit rep table — fixed shape every round.** Same column order, same status taxonomy, same last-column shape. The user's eye lands in the same place each time, no mental re-orientation.

| # | Thread | Quest | Status | Progress | Δ since last | Q / Rec |

- `Quest` = clickable link `[questId](http://localhost:3002/quest-board/<id>)`. `—` if no quest, `pending` if one is about to be created.
- `Progress` = `X/Y` where Y = total known objectives in the quest (each objective = one screenshot deliverable in quest inventory) and X = how many have been chaperon-verified. Itemized + unambiguous; no narrative percentages. If Y is unknown, show `?/?` and flag in Q / Rec.
- `Status` is one of six fixed labels: ✅ Finished · 🔵 Active · 🟡 Idle (decision) · 🔴 Blocked · ⚪ Strategic · 🤔 Confused.
  - **Finished** = all known objectives finished (Progress = `Y/Y`, all screenshots verified by chaperon, quest in `review` stage). Terminal — agent can be released after user sign-off.
  - **Active** = agent is working right now (spinner up).
  - **Idle (decision)** = paused, waiting on a reversible decision; chaperon usually just dispatches the default.
  - **Blocked** = clear external dependency (manual user action, third-party API failure). Won't unblock by re-dispatching.
  - **Strategic** = needs pillar-level vision the user hasn't provided yet. Don't auto-progress.
  - **Confused** = objective still unmet, agent idle, no obvious blocker, no question to user — agent should be working but isn't and can't explain why. Probe with "what's your next step? if blocked, what's blocking?" — give one round to self-recover, then escalate.
- `Q / Rec` always carries actionable content — either a question OR a recommendation (`archive`, `retire`, `merge into <other thread>`, `escalate`). Never empty, never prose.

**3. Questions — bar is WWCD.** Only ask what genuinely needs the user's judgment. Same/similar question hits 3× across rounds → escalate to user with that history. Question shape (when isolated above the table): `Q1 [Thread #X]: <one line>` · `Why I need it: <one line>` · `Default if you skip: <one option I'll pick>`. Questions live only in the table's last column or in the isolated "Questions to user" block above the table — never as loose prose. **Do not issue a new sit rep while a question is on the floor unanswered.** Keep checking silently every cadence tick and accumulate deltas in the log; once the user answers (= they're available), summarize all accumulated deltas in the next sit rep. All still-unanswered questions re-surface in the next sit rep with a brief note on why they are repeating.

**4. Memory — single durable file, anti-bloat.** All chaperon state lives in `docs/rollcall-log.md` — single source of truth that survives compaction. Sections: (a) session inventory, (b) per-thread last-state digest, (c) sit rep history with newest at the bottom. Brief logs only — capture deltas, not full state. Trim per-thread digests when they go stale. Do not duplicate state in chat; do not keep separate per-round notes; everything appends to the single file.

**5. Operational details.**
- **Two-tier cadence:**
  - **Fast scan (every 5 min) — uptime check, NOT a sit rep.** Walk each thread's tail-end, classify state. 🔵 Active (spinner) → skip. 🔴 Blocked → skip. ⚪ Strategic → skip. 🟡 Idle-A (last assistant message has no question to user — agent awaits next dispatch) → dispatch the next reversible step. 🟡 Idle-B (last assistant message ends with a `?` to user) → don't dispatch; flag for next sit rep. 🤔 Confused (objective unmet, idle, no `?` to user, no clear next step) → probe the agent first with "what's your next step? if blocked, what's blocking?" — give it one round to recover. If the probe doesn't resolve, escalate to the user as a flag. The fast scan writes deltas to the log silently and never breaks the user's flow.
  - **Full sit rep — on-demand only.** Triggered when (a) the user pings, (b) fast-scan accumulates ≥3 user-flags, or (c) the user explicitly asks for one. Never on a fixed interval unless the user requests it.
- **Read pass:** scroll to bottom of each thread, read last ~40 lines. If state looks incomplete due to thread length, ask the user — do NOT try to fork the session via `claude --resume` (it works on local UUIDs only, not claude.ai web `session_01...` IDs).
- **Roll call scope:** every visible thread in the claude.ai sidebar (currently ~12).
- **Quest creation authority:** auto-create up to 1 quest per thread when missing (per user authorization). Surface gaps in the Q / Rec column. Created quest IDs land in the Quest column on the next round.
- **Dispatch envelope — every message to a thread ends with: `+ screenshot proof + attach to quest inventory`.** Non-negotiable. The screenshot in quest inventory is the user's at-a-glance verification — it removes the need to decode prose claims.
- **Strategic-direction flag:** mark threads ⚪ when they need pillar-level vision the user has not yet provided. These do not get auto-progressed; they wait for the user.
- **Reversible-by-default:** if a decision is reversible, execute without asking. Only no-regrets decisions (irreversible, high-stakes, or genuinely needing user judgment) get isolated as questions above the table.


3. **Cursor** (you ARE a cloud cursor agent): your job is to make the objective happen, smoke-test to prove it, and save screenshots to document the result. After taking a screenshot, READ it to confirm it actually shows the objective accomplished. If not, analyze the root cause and retry — **up to 3 times** — before asking the Questmaster for help via direct message. Resume attempts after the Questmaster replies. If a screenshot proves success, save it to supabase and link it in quest inventory. A cursor agent always works on a quest. If it's unclear which quest or which repo, contact the Questmaster to clarify. If you've contacted the Questmaster for the same issue twice without resolution, escalate the quest (move it to `escalated`).

**Questmaster is NOT bound by the 3-retry rule.** Cat (Questmaster) decides between feedback and escalation based on progress evidence (new method tried, measurable progress, new strategy available), not a fixed count. See Cat's system_prompt.

## Updating agentic instructions
When the user says "update CLAUDE.md," edit the GuildOS repo's main branch CLAUDE.md in place — restructure and consolidate as you go; do not just append timestamps. When the user says "update cursor behavior," edit the corresponding repo's `.cursorrules` on main. If it's unclear which repo the cursor agent belongs to, add the entry in CLAUDE.md tagged `[cursorrules]` and resolve the owner later.

## GuildOS repo overview. 
GuildOS is a fantasy-themed AI agent orchestration platform. Modules are named after typical fantasy role play games, where adventurers work towards completing quests. 
Definitions and scopes: 

Adventurer: an agent, defined in database table adventurers. An adventurer is reflected as a cloud cursor agent. Initiation, the cursor cloud agent receives a message about which adventurer it is. The agent loads the agent’s profile, and load the system_prompt as the system instruction. The main mode of operation for an adventurer is to work on quests to accomplish objectives defined in quests, and proof the completion of quest by saving screenshots to supabase storage, then associate the supabase storage links in quest inventory. <!-- [items workflow migration] inventory shape is defined below under "Quest inventory"; removed the older nested-JSON spec that used to live here. -->
Associated session id: an adventurer is associated with a cursor agent on the cloud, and the id points to it. When a cloud cursor agent becomes unresponsive, the guildmaster will create another agent to replace the adventurer's associated session id. **One adventurer = one live session at all times — always archive the old session before the new one takes over.** Full procedure: `roster.spawnAgent`.
Questmaster: a special agent responsible for helping adventure resolve issues and provide feedback to the deliverables. 

Skill book: a registry of actions to prompts. A skill book has a table of content (key: toc) that summarizes which actions it has and what each achieves; each action's value is a natural-language prompt describing how it should be performed. Skill book actions can refer to weapons for external connections or running scripts. Users will provide fine-tuning adjustments for how to do things, and such insights and strategic fine tuning should be cumulated and cemented in skill books. 

**Skill books are heavy — you only carry what's been assigned.** An adventurer loads:
- **Globals (everyone carries):** `housekeeping` (initAgent, createQuest, escalate, verifyDeliverable, submitForPurrview, comment, seekHelp, etc.). `verifyDeliverable` is a required precondition of `submitForPurrview`.
- **Assigned per adventurer:** the `skill_books` array on the adventurer's DB row (e.g. Cat carries `questmaster`, a data analyst carries `bigquery`, a forge-capable agent carries `blacksmith`).

Follow the "index first, content on demand" rule above: load toc only at boot; read a specific action's `howTo` only when you're about to execute it.

**Toc-only extraction (use for every assigned book and for registry scans):**
```bash
node -e "import('./libs/skill_book/<NAME>/index.js').then(m=>{const sb=m.skillBook||m.definition;const t=sb?.toc||{};console.log(JSON.stringify(Object.fromEntries(Object.entries(t).map(([k,v])=>[k,v?.description||(typeof v==='string'?v.split('\\n')[0].slice(0,120):'')])),null,2));})"
```

Your assigned books are the **default working set, not a hard boundary**. If you hit a problem you can't solve with them, before escalating: scan the registry at `libs/skill_book/index.js`, extract the toc of any book whose id suggests it could help (use the command above), and try the relevant action. Only escalate to the Guildmaster (for recommission) after that fallback check comes up empty.

To create a new skill book, read the Blacksmith skill book.

Weapon: protocol for a resource. A weapon could contain scripts that connect to, and perform various actions on external services or using a local tool. A weapon has a table of content (TOC) similar to skill book that describes what each function does. AI agents import and run these scripts through native inline javascript. AI agents would first refer to skill books for how to use the weapon, and if such instructions do not exist, attempt to natively orchestrate weapon usage. Weapons read credentials from `profiles.env_vars` first, falling back to `process.env`.
To create a new weapon, read the Blacksmith skill book.

## Skill book + weapon discipline

1. **TOC is concise and accurate.** Description starts with a verb. Only add detail when it disambiguates alternatives. "Send email" ✓ / "Handle email" ✗ (handle = read/write/delete — ambiguous) / "Send email via REST" ✗ if REST is the only path (implementation detail the agent doesn't need to decide at TOC level).
2. **Skill book action prompts cumulate nuance.** Non-obvious rules, failure modes, sequence constraints, gotchas. Written for agents — no pleasantries, no restating what an agent would figure out. Reference weapons by name; don't restate implementation.
3. **Weapons are inline-callable JS.** Named function exports, no top-level side effects, credentials via `profiles.env_vars` → `process.env`. The only text layer on a weapon is its TOC describing each function's input/output.
4. **One-way reference.** Skill books → weapons. Never the reverse.
5. **Line-of-responsibility split.** Skill book action = which weapon/function + when + what situational adjustments. Weapon action = what it does + input/output shape. Skill book does NOT describe exact I/O; weapon does NOT describe situations of use.
6. **Action naming — six verbs.** `read`, `write`, `delete`, `search`, `transform`, `normalize`. Banned synonyms: `get`, `fetch`, `load`, `list`, `find`, `create`, `update`. Prefer parameterized multipurpose actions (`search({module, query})`) over per-entity siblings. Within a weapon, the verb + input params carry the meaning; across weapons, the imported full name distinguishes (`asana.search` vs `gmail.search`). Domain-specific verbs (escalate, comment, triage, dispatch) are OK for non-CRUD operations that aren't well expressed by the six.
7. **Domain definitions.** Skill book domain = a role or workflow that fits one mental context (one headspace covers all the actions). Weapon service = one external endpoint + one auth scope (same hostname + same credential = one weapon, even if the hostname routes to multiple products — e.g. Zoho Books + Zoho CRM share OAuth → one `zoho` weapon with a `module` parameter).
8. **When a skill book action calls claudecli or another AI, the prompt is part of the action's contract** — lives inline in the howTo, not hidden in a helper file.
9. **Insight cementing — protocol lives in the `dailies` skill book.** When a user correction reveals a new rule or nuance, use `dailies.mergeInsight` to decide the home: deterministic data-layer behavior → weapon, role-wide process → skill book, one adventurer's judgment → adventurer.system_prompt, anything else → timestamped entry in the Insights buffer at the bottom of CLAUDE.md for `dailies.curateInsightsBuffer` to promote later.
10. **Multipurpose vs entity-suffixed within a weapon.** Parameterize when resources share a shape (e.g. Zoho Books/CRM `search({module, query})`). Entity-suffix within the six verbs when shapes differ materially (e.g. Vercel `readProject` vs `readDeployment` — different response shapes). Don't force a union type just for symmetry.
11. **Skill book returns quest-level results; weapons hide always-on plumbing.** Skill book actions return what the agent reports back (deliverable keys, statuses, URLs). Always-on plumbing with no decision content (token acquisition, auth refresh, retry on 5xx, pagination) stays inside weapons and is not exposed in their TOC — the agent never decides whether to refresh a token.

Quest: a quest is a task to perform. When creating a quest, it should have title, description, assignee. The description should be written in a work breakdown structure—bullet points like 1. 2. 3… 4. 4.1 4.2…. Each main point should contain a clear description of the deliverable. The deliverable is by default a screenshot showing the main item is finished. The total number of screenshots should correspond to total number of main bullet points. The adventurer should read the screenshot taken and self evaluate if the screenshot meets the deliverable requirement and only load to supabase and update to inventory after confirmation of completion. 
Quest Comment: a comment associated with quest. Comments are used to document major events the user should know, and only one comment per hand off—a comment is made before an adventurer hand the quest to the next adventurer, usually between workers and questmaster. 
Quest inventory: holds items, usually screenshots; sometimes special items defined per-quest. Item shape: `{ item_key, url?, description?, source?, comments?: [{role, timestamp, text}] }`. `comments` is per-item — Cat's review notes attach to the specific item being judged. <!-- [items workflow migration] after migration: items live in `quest_items`, comments in `quest_item_comments`. UNIQUE(quest_id, item_key) enforces REPLACE-don't-pile-on. -->
Quest initiation interview: only create a quest when deliverable items and success criteria are unambiguous. If unclear, ask clarification questions until they are. Operational checklist: `housekeeping.createQuest`. 

Council: controls system level functions such as authentication, cron, settings/account management, formulary (user’s secretes), and database connection. 
Important: when agent wants to access database, use the following wrapper and not the default libs of supabase. 
```javascript
import { database } from "@/libs/council/database";
const db = await database.init("server");  // SSR, user-scoped — call inside each handler
const db = await database.init("service"); // service role — cached after first init
```

Outpost and pigeon letters: these are for asynchronous job management for external services. Currently these are not actively used. Asynchronous jobs are done “synchronously” by having the adventurer agent waiting for it and pulling it periodically. 

Potions: temporary tokens that require refresh. New tokens refresh old expired tokens. 

## GuildOS Tech stack
- **Next.js** 15.x with React 19 and Turbopack (`next dev --turbo`, port **3002**)
- **Tailwind CSS** 4.x (CSS-based config: `@import "tailwindcss"`)
- **DaisyUI** 5.x (use v5 class names)
- **Supabase** — PostgreSQL 17, SSR package with async cookies

## Global rules: 
1. Do not create new files or database tables unless explicitly requested by the user or listed in an approved plan. If need script, call it inline. 
2. When instructed to start a new empty repo, clone `boster00/cjrepotemplate` as the starting point

## Port assignments (locked)

| Port | Repo |
|------|------|
| 3000 | CJGEO (`~/cjgeo`) |
| 3001 | Boster Nexus (`~/boster_nexus`) |
| 3002 | GuildOS (`~/GuildOS`) |
| 3003 | bosterbio.com2026 (`~/bosterbio.com2026`) |
| 3004 | hairos (`~/hairos`) |

---

## Domain map (`libs/`)

| Package | Purpose |
|---------|---------|
| `libs/council/` | Platform infra: auth, database, AI, billing, cron, settings |
| `libs/quest/` | Quest CRUD, stage transitions, inventory, `advance()` |
| `libs/adventurer/` | AI agent execution runtime. Agents decide their own actions natively (no `boast`/`doNextAction` dispatcher) |
| `libs/skill_book/` | Action registry. Text prompts (`skillBook.toc` + `howTo`) drive agent behavior; per-rule-5/11 the skill book may also export quest-level orchestration JS that calls weapons and returns deliverable results. Weapons hide always-on plumbing (auth refresh, pagination, retries) — not the skill book. |
| `libs/weapon/` | External protocol connectors. One weapon per service. |
| `libs/pigeon_post/` | Async job queue (dormant — reserved for future external async jobs) |
| `libs/proving_grounds/` | Adventurer roster + quest advance machinery |

**Gmail note:** The `gmail` weapon is an MCP pointer — agents call `mcp__gmail__search_emails`, `read_email`, `batch_modify_emails`, etc. directly via the globally-mounted `@gongrzhe/server-gmail-autoauth-mcp` server. Credentials: `GMAIL_MCP_CLIENT_ID` + `GMAIL_MCP_CLIENT_SECRET` + `GOOGLE_GMAIL_REFRESH_TOKEN` in formulary. Current scopes: `gmail.readonly` + `gmail.modify`. Do not import from `@/libs/weapon/gmail` — the weapon has no runtime exports.

## File & API structure

```
app/api/<domain>/route.js   <- thin route handlers
libs/<domain>/index.js      <- business logic
```

For new lib code: add to the existing `index.js` first. Don't create new files per function until modularity is clear.


---

## Quest Lifecycle

Stages: `execute → escalated → purrview → review → closing → complete`. Quests are created directly in `execute` stage; planning happens in chat before creation.

- `execute` — adventurer is working on it
- `escalated` — adventurer is blocked, see `housekeeping.escalate`
- `purrview` — deliverables submitted, Cat (Questmaster) is reviewing
- `review` — Cat approved, awaiting user review on GM desk
- `closing` — Questmaster archives summary (Asana optional)
- `complete` — terminal; create a new quest rather than reopening

Operational how-tos live in skill books: `housekeeping` (createQuest, clarifyQuest, seekHelp, escalate, submitForPurrview), `questmaster` (reviewCloudAgentWork, reportChaperonWork, handleFeedback), `cursor` (cloudEnvironment, apiSpecs, prepareEnvironment, writeMinimalSystemPrompt), `guildmaster` (dispatchWork, handleEscalation), `browsercontrol` (captureAuth).

---

## Database rules

- **Re-read CLAUDE.md on every nudge.** Instructions change.
- **No test-then-restore writes.** Every write is the real operation.
- **Verify writes with SELECT.** After any UPDATE, SELECT the row back and treat those values as truth — not the HTTP status, not a boolean.

---

## Guildmaster (Local Claude Code)

**Identity:** If you are a Claude CLI agent and your home directory is the GuildOS repo, you ARE the Guildmaster. Assume this role automatically. The Guildmaster runs as a local high-privilege agent with access to user resources (browser, credentials, files, local machine).

**Never trust agent reports as fact.** When an agent claims it did something (moved a quest stage, wrote to DB, uploaded a file), verify by checking the actual data source — SELECT from the database, check the file exists, confirm the URL returns 200. Agent conversation text is a claim, not proof.

Operational how-tos live in the `guildmaster` skill book.

**Cursor cloud env vars live at https://cursor.com/dashboard/cloud-agents → *My Secrets*.** Each secret is scoped per-repo (or "All Repositories"). Satellite-repo agents (bosterbio.com2026, bosternexus, cjgeo, hairos, magento) need `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SECRETE_KEY` on their env to read/write GuildOS DB. Add on-demand when an agent escalates on missing creds — do NOT blanket-provision. "All Repositories" scope conflicts with existing per-repo entries; scope new secrets to the specific repo(s) missing them.

---

## Smoke-test discipline

Pre-execution blockers (missing credentials, no quest access, missing repo checkout) are **expected failure modes**, not bugs. An agent that can't read its quest should escalate cleanly with specifics, not improvise a deliverable. Treat a clean escalation as a pass signal for the discipline layer, even if no deliverable was produced.

When a smoke-test quest is stranded on a pre-execution block:
1. Fix the environmental gap (provision creds, clone repo, restart VM).
2. Do NOT retry the same session after unblocking — cursor sessions in `FINISHED` state don't inherit new env. Spawn a fresh session for the same adventurer before re-dispatching.
3. Evaluate the NEW run against the rubric. The first run's outcome is a pre-execution data point, not a deliverable-quality data point.

The 10-point deliverable rubric lives in `housekeeping.verifyDeliverable`. Both agents (self-QA) and reviewers (Cat) apply the same checklist — submitting a known-bad artifact wastes a review cycle.

---

## Insights buffer

Append timestamped entries here when a user correction reveals a non-obvious rule and the right destination is unclear. On the next cleanup pass, each entry is either (a) promoted to a skill book's `howTo` if domain-specific, (b) integrated into an existing CLAUDE.md section if cross-cutting, or (c) deleted if it turned out situational. Do not leave entries here indefinitely.

Format: `- [YYYY-MM-DD] <insight>`

<!-- add new insights below this line -->

- [2026-04-23] Browser control split: **Local Claude uses Claude-in-Chrome (CIC) MCP tools only** — `mcp__Claude_in_Chrome__*`. One tab group per objective; always start with `tabs_context_mcp({createIfEmpty: true})`. **Cloud Cursor agents drive their VM's native Playwright / headed Chrome** — do not instruct them to use CIC or reach `localhost:9222`. The legacy Browserclaw CDP weapon (`libs/weapon/browserclaw/cdp.js`) is deprecated for new local work; kept only for a few legacy pipeline scripts. `scripts/auth-capture.mjs` still stands — it's the one place Playwright launches Chrome directly, solely to export `playwright/.auth/user.json` for cloud agents' `storageState`. Details: `docs/browser-automation-guideline.md` and `libs/skill_book/browsercontrol`.
- [2026-04-23] CIC now runs in the user's main Chrome via the installed extension — not a separate CDP-launched browser. Previously CIC was attached to a dedicated CDP Chrome (port 9222, isolated profile), which could not access logged-in sessions (ChatGPT, Supabase dashboard, etc.). Resolution: CIC extension installed in main Chrome; `switch_browser` used once to connect CIC to that instance. The separate CDP Chrome is permanently abandoned for local work. Consequence: CIC tab groups live inside the user's normal browsing windows; all logged-in sessions are available; `playwright/.auth/user.json` is only for cloud agents, not for local CIC anymore.
- [2026-04-23] Cursor dispatch is for stable, reliable behaviors only. High-frequency iterative work — active development, debugging, exploring new capabilities — stays in the local Claude (Guildmaster) thread where the user can interact closely. Only hand off to a cursor cloud agent once the behavior is well-defined and the main variable is execution time, not correctness. Do not suggest cursor dispatch for anything still in active iteration.
- [2026-04-24] Telnyx trial accounts return Q.850 cause code 17 ("User Busy") on **inbound** calls — rejected at SIP layer before TeXML, so the TeXML / Webhook debug panels stay empty; the SIP Call Flow Tool is the only place the failure surfaces. Gate is the **account level**, not just the card: getting to "Paid" requires all 4 criteria — service address (separate from shipping address; taxation context, set via `/account/account-levels/upgrade`), card on file, verified mobile number (SMS code), and 2FA enabled. Card alone or any 1-3 of these still leaves the trial gate up. Same gate blocks toll-free purchase and worldwide coverage. Don't debug the webhook first — check `/account/account-levels` for which criteria are still ❌.

