# GuildOS — Claude Code Guide

## Project overview

GuildOS is a fantasy-themed AI agent orchestration platform. Users create **quests** (tasks), recruit **adventurers** (AI agents), and run **skill books** (composable actions). A 5-minute cron loop auto-advances quests through a pipeline via LLM execution.

**Active app surfaces:** `app/town/**`, `app/signin`, `app/opening`, `app/api/*`
**Archived (do not treat as active):** `_archive/legacy-shipfast-root/`

> **ALWAYS READ FIRST:** `docs/project-architecture-documentation.md` — source of truth for quest pipeline, NPCs, adventurers, stage machine, preparation cascade, and common misunderstandings from past sessions.

---

## Local machine capabilities

This machine (Windows 11) has **full browser control access**. Use it when tasks require web browsing, checking dashboards, logging into services, or scraping pages.

**Chrome location:** `%LOCALAPPDATA%/Google/Chrome/Application/chrome.exe`

**To launch Chrome with CDP (Chrome DevTools Protocol):**
```bash
# Use a SEPARATE profile dir — never the main "User Data" dir (which requires killing main Chrome)
"$LOCALAPPDATA/Google/Chrome/Application/chrome.exe" --remote-debugging-port=9222 --user-data-dir="$LOCALAPPDATA/Google/Chrome/CDP_Profile" &
```
Then connect via `http://localhost:9222`. Load saved auth state (`playwright/.auth/user.json`) via `browser.newContext({ storageState })` for authenticated sessions.

**Important: NEVER close or kill the user's main Chrome browser.** All automated browsing and testing must happen in a **separate Playwright CDP profile**, not the user's main browser session. Launch a dedicated CDP Chrome instance with a different `--user-data-dir` (e.g. `$LOCALAPPDATA/Google/Chrome/CDP_Profile`). If the main browser is already running, launch the CDP instance alongside it on a different port or with a separate profile directory.

**CDP libraries available:**
- `playwright-core` (installed) — `chromium.connectOverCDP("http://localhost:9222")`
- Browserclaw CDP module — `libs/weapon/browserclaw/cdp.js` (navigate, click, typeText, screenshot, evaluate)

**When to use browser control:**
- Accessing dashboards with no API (Smartlead, Google Merchant Center, etc.)
- Verifying website changes visually
- Capturing screenshots for review
- Any task that says "check this page" or "access this service"

**Do not hesitate to use browser control** — it is an expected and authorized capability on this machine.

**Saved auth state:** `playwright/.auth/user.json` contains cookies/localStorage for logged-in sessions (Google, Asana, Figma, etc.). To use authenticated browser control:
```javascript
import { chromium } from 'playwright-core';
// Launch CDP profile first (see above), then:
const browser = await chromium.connectOverCDP('http://localhost:9222');
const context = await browser.newContext({ 
  storageState: 'playwright/.auth/user.json' 
});
const page = await context.newPage();
await page.goto('https://app.asana.com/...');  // logged in!
```
To refresh the auth state, run `scripts/auth-capture.mjs` (manual login → export). State file may expire — if pages show login screens, ask user to re-capture.

---

## Guideline discovery (convention-based)

Before working on a domain, check `docs/` for a matching guideline:

```
docs/<domain>-guideline.md
```

Current guidelines:
- `docs/weapon-crafting-guideline.md` — creating or expanding weapons
- `docs/skill-book-guideline.md` — creating or modifying skill books
- `docs/browser-automation-guideline.md` — Chrome Extension vs Browserclaw

New guidelines follow the same naming convention. No manual index needed.

---

## No file sprawl (strictest rule)

Do not create new files unless explicitly requested by the user or listed in an approved plan. Do not create scripts, stubs, or helpers that were not asked for. At the end of each turn: if any new file was created that was not explicitly requested, remove it.

---

## Tech stack

- **Next.js** 15.x with React 19 and Turbopack (`next dev --turbo`, port **3002**)
- **Tailwind CSS** 4.x (CSS-based config: `@import "tailwindcss"`)
- **DaisyUI** 5.x (use v5 class names)
- **Supabase** — PostgreSQL 17, SSR package with async cookies
- **OpenAI** — `gpt-4o-mini` default; `@openai/agents` SDK in dependencies
- **Zoho** — Books + CRM unified via `libs/weapon/zoho/` and `libs/skill_book/zoho/`

---

## Critical rules

### Database — always use the `database` facade

```javascript
import { database } from "@/libs/council/database";
const db = await database.init("server");  // SSR, user-scoped — call inside each handler
const db = await database.init("service"); // service role — cached after first init
```

Variable must always be named `db`. Never import `createServerClient`/`createBrowserClient`/`createServiceClient` directly. Never call `database.init("server")` at module top level.

### Next.js 15 — always `await` headers() and cookies()

### Imports — remove unused, prefer named, no wildcards

### Action naming — six standard verbs only

`read`, `write`, `delete`, `search`, `transform`, `normalize`. Do not use synonyms (`get`, `fetch`, `load`, `list`, `find`, `create`, `update`). Prefer multipurpose actions with parameters over one-per-entity.

### Environment variables

Never hardcode `localhost:3000` — dev default is **3002**. Check required vars before use.

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
| `libs/proving_grounds/` | Agent testing, roster management, stage machine (`advanceQuest`) |
| `libs/cat/` | Mascot/assistant logic, commission chat, quest planning |

## File & API structure

```
app/api/<domain>/route.js   <- thin route handlers
libs/<domain>/index.js      <- business logic
```

For new lib code: add to the existing `index.js` first. Don't create new files per function until modularity is clear.

---

## Common mistakes

1. Sync `headers()` / `cookies()` in Next 15 — must be awaited
2. Unused imports and dead code
3. Raw `createServerClient`/`createServiceClient` instead of `database.init`
4. `database.init("server")` at module top level
5. Hardcoded `localhost:3000` — dev default is **3002**
6. Using banned verb synonyms (`get`, `fetch`, `list`) in action names
7. Creating one action per entity instead of multipurpose with parameters

---

## Playwright — browser launch pattern

Always use these flags when launching a browser with Playwright. Without them, Google and other services block sign-in with "This browser may not be secure."

```javascript
import { chromium } from "playwright-core";

// Persistent context (auth capture, stateful sessions):
const context = await chromium.launchPersistentContext(USER_DATA_DIR, {
  headless: false,
  channel: "chrome",           // use system Chrome, not bundled Chromium
  viewport: null,
  args: [
    "--start-maximized",
    "--disable-blink-features=AutomationControlled", // hides navigator.webdriver
  ],
  ignoreDefaultArgs: ["--enable-automation"],        // removes automation banner
});

// Fresh context (load saved storageState):
const browser = await chromium.launch({
  headless: false,
  channel: "chrome",
  args: [
    "--start-maximized",
    "--disable-blink-features=AutomationControlled",
  ],
  ignoreDefaultArgs: ["--enable-automation"],
});
const context = await browser.newContext({ storageState: "path/to/state.json" });
```

Auth scripts: `scripts/auth-capture.mjs` (manual login → export state), `scripts/auth-load.mjs` (import state into fresh session). State file default: `playwright/.auth/user.json`.

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

```bash
npm install && npx playwright install chromium --with-deps && npm install -g @anthropic-ai/claude-code
```

Then write `.env.local` with the required environment variables (never commit this file).

### Workflow: pigeon_post → cursor_cloud → result

1. Quest creates a `pigeon_letters` row with `channel: "cursor_cloud"` and `payload` containing natural language instructions
2. GuildOS dispatches the letter by calling `POST /v0/agents/{agentId}/followup` with the instructions
3. Cursor agent receives the message, executes the task (Playwright, PPT generation, etc.)
4. Agent uploads artifacts to Supabase Storage (public bucket, 30-day retention)
5. Agent delivers results back: updates `pigeon_letters` status to `completed`, writes result to quest inventory, posts quest comment with viewable link

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

### Claude Code's role with cloud agents

Claude Code is the **strategy and management layer**, not the coding layer, when working with cloud agents on external repos (like CJGEO). Follow this workflow:

1. **Instruct, don't code.** Write clear natural language task descriptions for the agent. Describe WHAT to build and success criteria — not implementation details. The agent decides how to code it.
2. **Demand screenshots.** Every task must end with the agent producing screenshots proving the feature works. Specify screenshot requirements in the task (e.g., "take a screenshot of the Content Benchmarking page showing keyword results with the AI topic selector panel open").
3. **Review and nudge.** Pull the agent's screenshots and validate them. If something is wrong or incomplete, send a followup message with specific corrections. Do not accept partial results — keep nudging until the screenshots show success.
4. **Don't stop at "code written."** The agent tends to stop after writing code. Always require it to: start the dev server, navigate to the feature, interact with it, and screenshot the working result.
5. **Escalate when stuck.** If the agent fails repeatedly on the same issue, escalate to the user with what was tried and what failed.

**Anti-pattern:** Reading the external repo's code, writing the changes locally, then asking the agent to apply them. This wastes context and duplicates effort. Just describe what you want.

### Storage convention

- **Bucket:** `GuildOS_Bucket` (public)
- **Path:** `cursor_cloud/{questId}/{filename}`
- **Retention:** 30 days (enforce via bucket lifecycle policy or manual cleanup)

---

## Daily Tasks

### Gmail inbox triage

Filter to scan: `-label:important in:unread in:inbox -asana` (excludes Asana, unimportant, already-triaged mail)

**Weapon:** `libs/weapon/gmail/index.js` — OAuth2 via `GOOGLE_ID` + `GOOGLE_SECRET` + `GOOGLE_GMAIL_REFRESH_TOKEN` (all in `profiles.env_vars`).

**How to run a triage scan:**
```javascript
// 1. Get access token from refresh token (stored in profiles.env_vars)
// 2. Search: GET /gmail/v1/users/me/messages?q=<filter>&maxResults=100 (paginate)
// 3. Batch-fetch metadata (From, Subject, snippet) in groups of 50
// 4. Score each email and star top ~2% via batchModify with addLabelIds: ['STARRED']
```

**Scoring signals (higher = more important):**
- Wire transfers, invoices, purchase orders, freight quotes → +10
- Calendly new/updated events → +9
- Customer replies to quotes (Re: quote…) → +9
- SalesIQ live chats / missed chats → +8
- Security alerts (new sign-in, verification code) → +8
- New Boster sales orders → +7
- Direct emails from real people (non-noreply, non-marketing) → +3
- Newsletters, DMARC reports, conference spam → −3 to −5

**What NOT to star:** DMARC aggregate reports, Google Search Console validations, Bing Webmaster Tools, conference/webinar invites, marketing newsletters, Robinhood/investment promotions.

**Implementation note:** Gmail is controlled via the **Gmail REST API directly** (not MCP, not CDP/browser). The weapon exchanges `GOOGLE_GMAIL_REFRESH_TOKEN` for a bearer token and calls `https://www.googleapis.com/gmail/v1/...` directly. Do NOT use Chrome/Playwright for Gmail.

---

## Feature-Specific Notes Convention

When working on a feature:
- Append a section to this file under a heading like `## Active Feature: [Feature Name]`
- Include feature context, constraints, decisions, and any temporary rules
- Remove the section once the feature is merged/complete
- Never leave stale feature sections — clean up is part of closing the feature

<!-- When starting a new feature, add an "## Active Feature: [name]" section here. Remove it when the feature is done. -->
