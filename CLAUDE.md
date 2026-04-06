# GuildOS — Claude Code Guide

## Project overview

GuildOS is a fantasy-themed AI agent orchestration platform. Users create **quests** (tasks), recruit **adventurers** (AI agents), and run **skill books** (composable actions). A 5-minute cron loop auto-advances quests through a pipeline via LLM execution.

**Active app surfaces:** `app/town/**`, `app/signin`, `app/opening`, `app/api/*`
**Archived (do not treat as active):** `_archive/legacy-shipfast-root/`

> **ALWAYS READ FIRST:** `docs/project-architecture-documentation.md` is the source of truth for the quest pipeline, NPC behavior, stage machine, and preparation cascade. Read it at the start of every session involving quest lifecycle, NPCs, adventurers, skill books, or weapons. It also documents common misunderstandings that have recurred across sessions.

---

## NEW FILES — STRICTEST RULE (highest priority)

This project is especially prone to accidental file sprawl. Enforce the following with maximum strictness.

**Do not create new files unless that creation is explicitly requested by the user or listed in an approved plan.**

- Only edit files that already exist unless the user explicitly asks for a new file.
- Do not create scripts, stubs, or "temporary" helpers that were not asked for.
- At the end of each turn: if any new file was created that was not explicitly requested, remove it.

---

## Tech stack

- **Next.js** 15.x with React 19 and Turbopack (`next dev --turbo`, port **3002**)
- **Tailwind CSS** 4.x (CSS-based config: `@import "tailwindcss"`)
- **DaisyUI** 5.x (use v5 class names: `card-border`, `card-sm`, etc.)
- **Supabase** — PostgreSQL 17, SSR package with async cookies
- **OpenAI** — `gpt-4o-mini` default; `@openai/agents` SDK in dependencies
- **Stripe** — dependency present; webhook/plan routes not yet in `app/api`
- **Zoho Books** — CRM integration via `libs/skill_book/zoho/` and `libs/weapon/zoho/`

---

## Critical rules

### 1. Database (always use the `database` facade)

Import only from `@/libs/council/database`. Never import `createServerClient`, `createBrowserClient`, or `createServiceClient` directly.

```javascript
import { database } from "@/libs/council/database";

// Server (SSR, user-scoped, reads fresh cookies — call inside each route handler/page):
const db = await database.init("server");

// Service role (cached after first init in process):
const db = await database.init("service");

// Browser (rare — prefer server fetching):
const db = await database.init("client");
```

The variable must always be named `db`. Do not use `serviceDb`, `svc`, etc.

Do NOT call `database.init("server")` at module top level — modules are long-lived; server clients must see the current request's cookies. Call it inside each route handler or server component.

Middleware may keep `createServerClient` from `@supabase/ssr` where required.

### 2. Next.js 15 — always `await` `headers()` and `cookies()`

```javascript
// WRONG
const sig = headers().get("stripe-signature");

// CORRECT
const sig = (await headers()).get("stripe-signature");
```

### 3. Imports

- Remove unused imports.
- Prefer named imports over wildcards.
- Do not leave imports only used by commented-out code — comment both or remove both.

### 4. React hook dependencies

Include real dependencies, or create clients inside `useEffect` to avoid stale closures.

### 5. Tailwind CSS v4

Do not put pseudo-selectors inside `@utility`. Use separate CSS rules for `:hover`, etc.

### 6. DaisyUI v5

Use v5 class names. Do not use v4 theme import paths.

### 7. Environment variables

Check required vars before use (Supabase, Stripe, site URL). Never hardcode `localhost:3000` — dev default is **3002**.

```javascript
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ||
  process.env.SITE_URL ||
  (process.env.NODE_ENV === "development"
    ? `http://localhost:${process.env.PORT || 3002}`
    : `https://${site.domainName}`);
```

Required env vars: `NEXT_PUBLIC_SITE_URL`, `SITE_URL`, `PORT` (optional).

### 8. Images

Use `remotePatterns` in `next.config.mjs`, not deprecated `images.domains`.

---

## File & API structure

```
app/api/<domain>/route.js   ← thin route handlers
libs/<domain>/index.js      ← business logic
```

- Use `async`/`await` for all DB and external calls.
- Return appropriate HTTP status codes and consistent JSON error shapes.
- For new lib code: add to the package's existing `index.js` first. Don't create new files per function until modularity is clear.

---

## Domain map (`libs/`)

| Package | Purpose |
|---------|---------|
| `libs/council/` | Platform infra: auth, database, AI, billing, cron, settings |
| `libs/quest/` | Quest CRUD, stage transitions, inventory, `advance()` |
| `libs/adventurer/` | AI agent execution runtime (`advance.js`) |
| `libs/skill_book/` | Action registry & dispatch (see authoring guide below) |
| `libs/pigeon_post/` | Async job queue (state machine, polling) |
| `libs/cat/` | Mascot/assistant logic, commission chat, quest planning |
| `libs/item/` | Quest inventory item management |
| `libs/weapon/` | Weapon forging + Zoho CRM proxy |
| `libs/proving_grounds/` | Agent testing, roster management |

### Quest stages (in order)

`idea → plan → assign → execute → review → closing → completed`

### Skill book authoring

Guide: `libs/skill_book/How_To_Develop_New_Skill_Books.md`
Pattern: create `libs/skill_book/<bookId>/`, export `skillBook` + actions, register in `libs/skill_book/index.js` (`SKILL_BOOKS`, `ADVENTURER_REGISTRY`).

---

## UI patterns

### Fantasy voice + Merchant Guild Explain

- **Headings/buttons:** fantasy flavor is fine.
- **Explanatory blocks** (page intros, "what is this?" copy): pair fantasy text with a plain "Merchant Guild" version using `MerchantGuildExplain` from `@/components/MerchantGuildExplain`.
- Toggle label: **Explain** / **Story**. Tooltip exact phrase: `"Explain to me again, this time in the Merchant Guild's language"` (export `MERCHANT_GUILD_EXPLAIN_TOOLTIP`).
- Merchant text: professional, concise, no fantasy metaphors.
- Default to this pattern for any teaching/explanatory copy unless it's a single label.

### Styling

```css
@import "tailwindcss";
@plugin "daisyui";
/* @theme for design tokens; @utility for small reusable utilities */
```

---

## Performance patterns

- Default to async server components for data fetching.
- Use `"use client"` only for interactive UI.
- Browser Supabase client: `await database.init("client")` from `@/libs/council/database`.
- Use `@/libs/council/site` for branding/theme settings.
- Always use `@/` absolute imports.

---

## Billing / Stripe (current state)

- No `libs/monkey/`, no `getPlanContext`/`assertPlan`, no `app/api/plan` or `app/api/webhook/stripe` yet.
- `stripe` is in `package.json`; scripts `dev:stripe`/`stripe:listen` forward to `localhost:3002`.
- When adding billing: new modules under `libs/council/` (or approved `libs/<pkg>/`) + thin `app/api/*` routes.

---

## Database migrations

- Prefer `ADD COLUMN IF NOT EXISTS` for new columns.
- Use `DO $$` blocks only for renames or conditional logic.
- Migration files: `supabase/migrations/YYYYMMDDHHMMSS_description.sql`
- Local dev: `npm run db:start`, `npm run db:migration:new`

---

## Browserclaw (Chrome extension, MV3)

- **Path:** `browserclaw/` at repo root — not bundled by Next.js.
- Load via **Load unpacked** in `chrome://extensions` (Developer mode), pointing at `browserclaw/`.
- Layout: `manifest.json`, `background/service-worker.js`, `popup/`, `settings/`, `content/`, `shared/constants.js`, `shared/domCaptureEvents.js`, `assets/`.
- Do NOT import Next.js/Node-only code from `libs/` or `app/` into extension scripts. Keep Browserclaw self-contained.

---

## Common mistakes to avoid

1. Sync `headers()` / `cookies()` in Next 15 — must be awaited
2. Unused imports and dead code
3. Tailwind v3 `@tailwind` directives in a v4 project
4. Old DaisyUI v4 theme import paths
5. Raw `createServerClient`/`createServiceClient` imports instead of `database.init`
6. Mixing server-only APIs into client components
7. `images.domains` in `next.config` — use `remotePatterns`
8. Hardcoded `localhost:3000` — dev default is **3002**
9. `database.init("server")` at module top level (must be inside each handler)

---

## Debugging

1. Trace entry → failure point.
2. Log at branches and around awaits; include request/task IDs where safe.
3. Use consistent prefix: `[Feature] [step] message`, `{ context }`.
4. Guard verbose logs behind `NODE_ENV === "development"`.
5. `_archive/` — consult only when the task involves history or porting.

---

## Commit conventions

`feat:`, `fix:`, `refactor:`, `style:`, `docs:`, `perf:`

Before merge: no unused imports, all async APIs awaited, ESLint clean, `npm run build` passes, env-sensitive routes guarded.

---

## Development commands

```bash
npm run dev              # Next.js dev with Turbopack (port 3002)
npm run build            # production build
npm run lint             # ESLint
npm run lint:fix         # auto-fix
npm run db:start         # start local Supabase
npm run db:migration:new # create new migration
```
