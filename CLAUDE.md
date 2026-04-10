# GuildOS — Claude Code Guide

## Project overview

GuildOS is a fantasy-themed AI agent orchestration platform. Users create **quests** (tasks), recruit **adventurers** (AI agents), and run **skill books** (composable actions). A 5-minute cron loop auto-advances quests through a pipeline via LLM execution.

**Active app surfaces:** `app/town/**`, `app/signin`, `app/opening`, `app/api/*`
**Archived (do not treat as active):** `_archive/legacy-shipfast-root/`

> **ALWAYS READ FIRST:** `docs/project-architecture-documentation.md` — source of truth for quest pipeline, NPCs, adventurers, stage machine, preparation cascade, and common misunderstandings from past sessions.

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
