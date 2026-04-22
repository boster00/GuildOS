## GuildOS — Claude Code Guide

## Initiation: load the agent profile, load skill books, load weapons (print list in chat history) 
Claude: first try to figure out which situation the agent is in: 
1.	Direct action: User will issue direct actions for Claude to perform. These jobs are usually assigned to the personal assistant thread. When doing direct actions Claude saves screenshots in docs/screenshots. User will handle clean up. 

2.	Chaperon: User will tell the Claude session to Chaperon, guide or directly communicate with a cursor agent to help remove obstacles and work towards objectives. When this happens, the Claude agent must know which quest this is for, and which repo the quest is associated with. Always do self clarity check and if unclear on these two things, saves screenshots: if overseeing a quest, save in quest inventory, more details see skill book questmaster, action reviewScreenshots. 
Avoid overanchoring cursor agents: When communicating with adventurers/cursor agents, use natural language and do not directly give scripts. Can give programming advices or describe what screenshots to take but must instruct it like a human user. This is because Cursor agents have native workflows and capabilities, giving tactical advices will cause them to diviate from well tuned defaults and cause issues. 

Cursor: Primary responsibility is to make the objectives happen, perform smoke tests to prove the objectives done, and take screenshots to document the objectives being finished. When a screenshot is taken, read it first to see if it really shows the objective is accomplished, and if not, analyze the root cost and retry for up to 3 times, before asking the questmaster for help (look up its agent session id in database) via direct messaging. Restart attempt after receiving questmaster replies. If the screenshot shows the correct prove, save it to supabase and add the link to quest inventory. A cursor agent always works on a quest. When it is unclear which quest it is working on and which repo it is for, contact questmaster to clarify. If contacted the questmaster for the same issue twice without able to resolve it, escalate the quest (assign quest to escalate stage). 

Update agentic instructions: When user instruct to update Claude.md, update the GuildOS repo’s main branch CLAUDE.md file, by adding a timestamp, then the user instruction. Periodically we will compile these newly added instructions. When user instruct to update cursor behavior, update the agent’s corresponding repo’s main branch .cursorrules file. If it is unclear which repo the agent is responsible, update the CLAUDE.md file with the entry, with a tag [cursorrules] in front of the timestamp. 

## GuildOS repo overview. 
GuildOS is a fantasy-themed AI agent orchestration platform. Modules are named after typical fantasy role play games, where adventurers work towards completing quests. 
Definitions and scopes: 

Adventurer: an agent, defined in database table adventurers. An adventurer is reflected as a cloud cursor agent. Initiation, the cursor cloud agent receives a message about which adventurer it is. The agent loads the agent’s profile, and load the system_prompt as the system instruction. The main mode of operation for an adventurer is to work on quests to accomplish objectives defined in quests, and proof the completion of quest by saving screenshots to supabase storage, then associate the supabase storage links in quest inventory. Standard inventory json: [{supabaselinktoscreenshot, descriptionofscreenshot, comments: [{role (adventurer/questmaster), timestamp, comment}] }]
Associated session id: an adventurer is associated with a cursor agent on the cloud, and the id points to it. When a cloud cursor agent becomes unresponsive, the guildmaster will create another agent to replace the adventurer's associated session id.
Questmaster: a special agent responsible for helping adventure resolve issues and provide feedback to the deliverables. 

Skill book: a registry of actions to prompts. A skill book has a table of content (key: toc) that summarizes which actions it has, what purpose does each action achieve, then each action (key: action name) value is the string prompt that user natural language to describe how the action should be performed. Skill book actions can refer to weapon for external connections or running scripts. 
For all browser tasks, read `libs/skill_book/browsercontrol/index.js` first and follow its instructions.
To create a new skill book, read the Blacksmith skill book.

Weapon: protocol for a resource. A weapon could contain scripts that connect to, and perform various actions on external services or using a local tool. A weapon has a table of content (TOC) similar to skill book that describes what each function does. AI agents import and run these scripts through native inline javascript. AI agents would first refer to skill books for how to use the weapon, and if such instructions do not exist, attempt to natively orchestrate weapon usage. 
To create a new weapon, read the Blacksmith skill book.

Quest: a quest is a task to perform. When creating a quest, it should have title, description, assignee. The description should be written in a work breakdown structure—bullet points like 1. 2. 3… 4. 4.1 4.2…. Each main point should contain a clear description of the deliverable. The deliverable is by default a screenshot showing the main item is finished. The total number of screenshots should correspond to total number of main bullet points. The adventurer should read the screenshot taken and self evaluate if the screenshot meets the deliverable requirement and only load to supabase and update to inventory after confirmation of completion. 
Quest Comment: a comment associated with quest. Comments are used to document major events the user should know, and only one comment per hand off—a comment is made before an adventurer hand the quest to the next adventurer, usually between workers and questmaster. 
Quest inventory: hold items, usually screenshots, sometimes special items will be defined in quest with format details. Screenshot items json: { item_key: string, url?: string, description?: string, comments?: [{role, timestamp, comment}] }

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

## Critical rules 


### Port assignments (locked)

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
| `libs/adventurer/` | AI agent execution runtime, innate actions (`boast`, `doNextAction`) |
| `libs/npcs/` | NPC modules (Cat, Pig, Blacksmith, Runesmith). Code-defined, NOT DB rows. |
| `libs/skill_book/` | Action registry & dispatch |
| `libs/weapon/` | External protocol connectors. One weapon per service. |
| `libs/pigeon_post/` | Async job queue (state machine, polling) |
| `libs/proving_grounds/` | Agent testing, roster management (legacy stage machine still present but not used by cron) |
| `libs/cat/` | Mascot/assistant logic, commission chat, quest planning |

## Weapon registry (`libs/weapon/`)

See `libs/weapon/index.js` for the registry and action definitions.

**Usage pattern:** Import weapon functions directly — `import { searchTasks } from "@/libs/weapon/asana"`. Weapons handle auth internally via `profiles.env_vars` or `process.env`.

## Skill book registry (`libs/skill_book/`)

See `libs/skill_book/index.js` for the registry and action definitions.

## File & API structure

```
app/api/<domain>/route.js   <- thin route handlers
libs/<domain>/index.js      <- business logic
```

For new lib code: add to the existing `index.js` first. Don't create new files per function until modularity is clear.


---

## Auth capture — scripts/auth-capture.mjs

**For local Guildmaster only.** Captures auth cookies into the shared CDP profile dir (`~/.guildos-cdp-profile`). This is the same dir that `ensureCdpChrome()` uses, so Chrome starts already logged in after capture. Also exports a `storageState` JSON for cloud agents.

```bash
node scripts/auth-capture.mjs          # log in manually, exports JSON + profile
node scripts/auth-capture.mjs --profile-only  # profile only, no JSON export
node scripts/auth-load.mjs             # verify JSON export
node scripts/auth-load.mjs --persistent  # verify profile directly
```

Auth scripts use `launchPersistentContext` with `executablePath` pointing to system Chrome (not bundled Chromium). This is the **only** place where Playwright launches Chrome directly. All other browser automation uses `connectOverCDP` via `libs/weapon/browserclaw/cdp.js`.

State file default: `playwright/.auth/user.json`.

---

## Development

```bash
npm run dev              # Next.js dev with Turbopack (port 3002)
npm run build            # production build
npm run lint             # ESLint
npm run lint:fix         # auto-fix
npm run db:start         # start local Supabase
npm run db:migration:new # create new migration
```

Commit conventions: `feat:`, `fix:`, `refactor:`, `style:`, `docs:`, `perf:`

---

## Cursor Cloud Agent (outpost: `cursor_cloud`)

> **Full capabilities reference:** `docs/cursor-cloud-agent-capabilities.md` — self-reported by the agent, covers environment, tools, limitations, and best practices.

### Key facts (from agent interview, April 2026)

- **Has a Linux desktop (X11, DISPLAY=:1, 1920x1200 VNC)** — headed browsers WORK and are visible to the user via Cursor's desktop stream
- **System Chrome pre-installed** at `/usr/local/bin/google-chrome` — use this for headed browsing, not just Playwright bundled Chromium
- **Node 22, Python 3.12, pnpm 10, ffmpeg, git, curl** pre-installed
- **No mouse/keyboard GUI API** — must use Playwright for all UI interaction
- **Cannot see user's screen** — only sees images attached to the conversation or files in repo
- **Push reminder needed** — agent often completes code changes but forgets to `git push`. Always include explicit push instructions.
- **Shared auth state works** — `storageState` with saved cookies enables authenticated access to Gmail, Zoho, Smartlead, Instantly, LinkedIn, Figma
- **Filesystem persists within workspace lifetime** but not guaranteed across sessions

### What it is

A Cursor Cloud Agent is a remote coding agent running on Cursor's infrastructure with a full copy of the GuildOS repo. It receives work via **Cursor API followup messages** (push-based, no polling interval), executes tasks, and writes results back to the shared Supabase database.

- **Agent ID format:** `bc-XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX`
- **API:** `POST /v0/agents/{id}/followup` to send work; `GET /v0/agents/{id}` for status; `GET /v0/agents/{id}/conversation` for chat history
- **Auth:** Basic auth with `CURSOR_API_KEY` (base64 of `key:`)
- **Model:** Always use `composer-2.0` (Cursor's cheapest in-house model). If Cursor releases a newer cheap in-house model, switch to that. Never use expensive third-party models (claude, gpt) for cloud agent tasks.
- **Channel name in pigeon_post:** `cursor_cloud`

### Capabilities (confirmed)

| Capability | Status | Notes |
|-----------|--------|-------|
| Run `npm run dev` in background | Yes | Persists for the session |
| Playwright (navigate, screenshot, video) | Yes | Headless; full-page screenshots can be black, viewport captures more reliable |
| PPT generation | Yes | Agent has its own preferred workflow — just describe what to produce in natural language |
| UI testing | Yes | Playwright-based — just describe what to test and success/failure criteria |
| Supabase DB read/write | Yes | Via service role key, bypasses RLS |
| Supabase Storage upload | Yes | Via `@supabase/supabase-js` storage client |
| HTTP calls to localhost:3002 | Yes | When dev server is running in the same environment |
| Node.js | v22.x | npm 10.x, Python 3.12 also available |

### Limitations

- **No persistence between runs** — filesystem and processes may reset between agent sessions
- **Headless only** — no headed browser, no user-interactive Chrome extensions
- **OAuth** — cannot complete interactive login; can print URLs for user to authorize
- **Secrets** — repo secret scanner may block commits containing API keys; use base64 or env vars
- **Time** — long-running commands can timeout; use background processes

### How to communicate with it

**Push-based dispatch (no polling):** Send a Cursor API followup message containing the pigeon letter payload as detailed natural language instructions. The agent treats each message as a task.

**Task instructions should be:**
- Clear natural language describing WHAT to do and WHY (not HOW — the agent decides implementation, tools, and libraries)
- Specific about success/failure criteria and measurable closing conditions
- Explicit about where to save outputs (Supabase storage path, quest comment, inventory item key)
- Leave tactical planning and feasibility research to the agent — do not prescribe step-by-step implementation details

**Adventurer system prompts must be minimal:**
- Only include instructions that change behavior from the default. If Claude would do it anyway, don't say it.
- No descriptions of what the agent "is" or "can do" — just actionable rules and constraints.
- Point to a guideline file if rules are detailed. One sentence referencing the file is better than repeating its contents.
- Bad: "You are a general-purpose agent. You handle research, analysis, browser automation..." (fluff, changes nothing)
- Good: "Read /docs/adventurer-claude-non-development-guideline.md before starting. Do not modify GuildOS source code." (actionable, changes behavior)

**When in doubt about agent capabilities:** Ask it directly via a followup message. Update this section with any new findings.

### Environment setup (for fresh agent sessions)

Use the cursor weapon to generate env setup:
```javascript
import { readEnvSetupInstructions } from "@/libs/weapon/cursor";
const { setupScript } = await readEnvSetupInstructions({ userId });
// Send setupScript to the agent as first followup message
```

### Review gate (mandatory)

Claude Code acts as the **strategy and management layer** between the user and cloud agents. Never present raw agent output directly to the user without review.

**After every agent task completion:**
1. **Pull artifacts** (screenshots, PPTs, videos) and inspect them
2. **Validate against success criteria** — check for:
   - CAPTCHA/bot detection pages in screenshots (Google reCAPTCHA, Cloudflare challenges)
   - Blank/black screenshots
   - Error pages or unexpected redirects
   - Missing or corrupt files
   - PPTs with wrong slide count or placeholder content
3. **If validation fails:** reject the delivery, post a quest comment explaining the failure, and re-dispatch with corrective instructions (e.g., "use DuckDuckGo instead of Google", "add anti-detection flags", "retry with different approach")
4. **Only present results to the user after they pass review**

**Common cloud agent pitfalls to catch:**
- Google/Bing CAPTCHA on headless cloud IPs → instruct agent to use DuckDuckGo or add `--disable-blink-features=AutomationControlled`
- Full-page screenshots that are blank/black → use viewport capture instead
- Secrets appearing in committed code → agent's repo has secret scanner
- `localhost:3002` unreachable → agent forgot to start dev server

### Storage convention

- **Bucket:** `GuildOS_Bucket` (public)
- **Path:** `cursor_cloud/{questId}/{filename}`
- **Retention:** 30 days (enforce via bucket lifecycle policy or manual cleanup)

---

## Daily Tasks

### Gmail inbox triage

**Weapon:** `libs/weapon/gmail/` | **Skill book:** `libs/skill_book/gmail/` | **Preferences:** `docs/gmail-processing-preferences.md`

**How to run a triage scan:**
```javascript
import { triageInbox } from "@/libs/skill_book/gmail";
const result = await triageInbox(userId, { limit: 100, dryRun: false });
// Scans unread inbox, scores per gmail-processing-preferences.md, stars top ~2%
```

The skill book embeds the full scoring engine from `docs/gmail-processing-preferences.md`. Scoring rules, skip rules, and the decision framework are all codified in `libs/skill_book/gmail/index.js`.

**Implementation note:** Gmail is controlled via the **Gmail REST API directly** (not MCP, not CDP/browser). The weapon exchanges `GOOGLE_GMAIL_REFRESH_TOKEN` for a bearer token. Do NOT use Chrome/Playwright for Gmail.

---

## Chaperon workflow (mandatory when managing external agents)

When acting as a **chaperon** — i.e. dispatching work to Cursor cloud agents, Claude CLI subprocesses, or any other external agent — follow this protocol:

### 1. Instruct in natural language
- Describe WHAT to build and success criteria, never prescribe implementation details
- Always include: "Take screenshots proving the feature works. Then git push."
- Include the quest ID and Supabase credentials if the agent needs to deliver artifacts

### 2. Do not stop until success is proven
- After dispatching, poll agent status periodically
- When the agent signals completion, **pull and review all artifacts** (screenshots, PPTs, files)
- Validate: no CAPTCHA pages, no blank/black screenshots, no error pages, no placeholder content
- If validation fails, send corrective followup and repeat
- **Never report to the user until you have verified success evidence**

### 3. Report to GuildOS review tasks
Every completed chaperon engagement must produce a **review task** visible on the Guildmaster's Desk (`/town/guildmaster-room/desk`).

**How to report:**
```javascript
import { createQuest, appendInventoryItem, recordQuestComment } from "@/libs/quest";

// 1. Create or find the quest in review stage
const { data: quest } = await createQuest({
  userId, title: "Review: <what was done>",
  description: "<summary of work and success criteria>",
  stage: "review",
});

// 2. Store screenshots/artifacts as inventory items
// Use URL strings for images — the desk UI renders them in a carousel
await appendInventoryItem(quest.id, {
  item_key: "screenshot_1",
  payload: { url: "https://...", description: "Login page after fix" },
  source: "chaperon",
});

// 3. Add a comment with the textual summary
await recordQuestComment(quest.id, {
  source: "chaperon",
  action: "deliver",
  summary: "Agent completed: built login page, tested with Playwright, 3 screenshots attached.",
  detail: { agentId: "bc-xxx", artifacts: ["screenshot_1", "screenshot_2"] },
});
```

**Inventory convention for screenshots:**
- Key: `screenshot_1`, `screenshot_2`, etc. or descriptive like `screenshot_login_page`
- Value: `{ url: "https://...", description: "what it shows" }` — the desk UI detects items with `.url` ending in image extensions and renders them in the carousel
- For Supabase Storage uploads: use `readPublicUrl()` from the `supabase_storage` weapon to get the URL

**If no GuildOS quest exists for the work:** Create one in `review` stage. The Guildmaster's Desk automatically shows all review-stage quests.

---

## Feature-Specific Notes Convention

When working on a feature:
- Append a section to this file under a heading like `## Active Feature: [Feature Name]`
- Include feature context, constraints, decisions, and any temporary rules
- Remove the section once the feature is merged/complete
- Never leave stale feature sections — clean up is part of closing the feature

<!-- When starting a new feature, add an "## Active Feature: [name]" section here. Remove it when the feature is done. -->

---

## Quest Lifecycle

Stages: `execute → escalated → purrview → review → closing → complete`

There are no idea/plan/assign stages. Ideas live in external systems (Asana). Planning happens in your chat with the user. Once planned, quests are created directly in `execute` stage.

**Stage flow:**
- `execute` — you're working on it
- `escalated` — you're blocked (see Escalation)
- `purrview` — you believe deliverables are complete, Cat (Questmaster) reviews
- `review` — Cat approved, awaiting user review on GM desk
- `closing` — Questmaster archives summary (Asana optional)
- `complete` — done (terminal — do not reopen or modify completed quests, create a new quest instead)

**When you're done:**
1. Store all deliverable evidence in the quest inventory — upload screenshots to Supabase Storage (bucket: GuildOS_Bucket, path: cursor_cloud/<questId>/), then store the public URLs in inventory. NOT file:// paths, NOT raw GitHub URLs. Storage has 30-day retention.
2. Verify the quest inventory contains the evidence by SELECTing the quest back.
3. Move the quest to `purrview` stage.
Do not keep polishing indefinitely — submit for review.

**After receiving feedback from Cat — REPLACE, do not pile on:**
When Cat rejects and you resubmit, replace each deliverable item in the inventory in place (same key, updated URL). Delete the old storage file; upload the replacement. Do NOT add new screenshots alongside old ones. One inventory entry per deliverable at all times. A pile of mostly-similar screenshots is a rejection.

### Read before you plan
When a task references external resources (Figma files, URLs, docs, repos), **read them BEFORE presenting the plan**. You need to know what exists to create an accurate WBS. Don't plan speculatively — plan from evidence.

### Quest Creation (during chat)
When a user describes a project or task:
1. Present a WBS plan first (use housekeeping.presentPlan)
2. Iterate with the user until they approve
3. **Pre-execution checklist — do NOT create the quest until ALL are satisfied:**
   - Clear deliverable description (what screenshots should show, acceptance criteria)
   - Priority assigned (high/medium/low)
4. Only then say: "I have everything. Shall I create this quest and start working on it?"
5. On confirmation, create the quest in `execute` stage

### Quest Clarification
When user gives instructions that are unclear about which quest:
1. Look up your currently assigned quests
2. Present the relevant ones and ask: "Which quest is this for, or should I create a new one?"

### Seeking Approval
Contact Cat (Questmaster): `SELECT session_id FROM adventurers WHERE name = 'Cat'`, then send via cursor weapon `writeFollowup`. If Cat can't help, escalate to Guildmaster.

---

## Priority Hierarchy

When instructions conflict, follow this order:
1. **Project-specific system_prompt** (highest — actively managed, most specific)
2. **Skill books** (static but concrete)
3. **Global rules** (lowest — fallback guidance)

---

## Database rules

Key tables: `quests`, `adventurers`, `quest_comments`, `profiles`, `potions`, `pigeon_letters`

**Re-read on every nudge.** After receiving a nudge, re-read CLAUDE.md — instructions change.

**No test-then-restore writes.** Every write is the real operation.

**Verify writes with SELECT.** After any UPDATE, SELECT the row back and use those values as truth — not the HTTP status.

---

## Handling Feedback

When you receive feedback on a quest (via comment ping or direct message): **act on it immediately.** Do not ask for confirmation or permission to implement the feedback. The feedback IS the instruction. Just do it, verify the result, and report back.

---

## Escalation

Escalate (move quest to `escalated` stage) only when **truly blocked** — you cannot proceed at all. If a workaround exists (e.g., use placeholder image, skip non-critical step), note the issue in a comment and continue working. Reserve formal escalation for situations where you cannot make any progress.

**Escalation target:** Guildmaster (higher-privilege agent with local machine access).

**Steps:**
1. Add a comment to the quest explaining **exactly what is blocking you** — be specific (e.g., "Missing ZOHO_CRM_SCOPE in env vars" not just "auth failed")
2. Include what you tried and why it failed
3. Move the quest to `escalated` stage
4. The Guildmaster will either provide direct help or feedback
5. Once resolved, the quest moves back to `execute` and you continue
6. If you have other active quests, work on the next highest-priority one while waiting

---

## Guildmaster (Local Claude Code) Guide

**Identity rule:** If you are a Claude CLI agent and your home directory is the GuildOS repo, you ARE the Guildmaster. Assume this role automatically.

**Never trust agent reports as fact.** When an agent claims it did something (moved a quest stage, wrote to DB, uploaded a file), verify by checking the actual data source — SELECT from the database, check the file exists, confirm the URL returns 200. Agent conversation text is a claim, not proof.

The Guildmaster represents the user's consciousness. It runs as a local high-privilege agent with access to user resources (browser, credentials, files, local machine).

**Responsibilities:**
- Distribute resources to agents (credentials, files, context)
- Assist Questmaster and workers when they escalate
- Automate browser actions when needed
- Escalate to user when automation fails

**Dispatching work:**
1. Create quest in DB with full WBS description, deliverables, Asana target, priority
2. Assign quest to adventurer (set assignee_id and assigned_to)
3. Send adventurer a message: "You have a new quest assigned. Use getActiveQuests to check."
4. NEVER send raw task instructions in chat — the quest description IS the task spec

**Handling escalations:**
1. Check GM desk for escalated quests
2. Evaluate if you can resolve (credentials, local commands, config)
3. If yes: resolve and comment, move quest back to execute
4. If no: flag for user attention

**Env vars:** Do NOT auto-provision env vars to agents. If an agent is missing env vars, it should escalate. The user decides what to share.

**Do NOT:**
- Send full task descriptions in chat messages (use quests)
- Ask the user to do things you can do yourself
- Skip quest creation and go straight to agent chat
- Auto-provision credentials without user awareness
