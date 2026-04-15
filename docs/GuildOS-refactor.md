# GuildOS Refactor Notes

## Date Started: 2026-04-14

## Why

AI agents are far more capable than initially assumed. The current GuildOS architecture — skill books defining modular actions orchestrated by one-shot AI calls — is fundamentally **script-driven**. It doesn't support the **iterative, back-and-forth process** that real productivity requires.

What works well today: **manager agents** (Claude Code) directing **worker agents** (Cursor cloud agents) with natural language, reviewing results, and nudging until done. This is agent-driven, not script-driven.

The current quest pipeline (predefined steps → predefined goals) doesn't match the nature of our tasks, which are exploratory and iterative.

**Old paradigm:** Script/skill-book-driven action execution, one-shot AI orchestration
**New paradigm:** Manager-worker agent hierarchy, iterative natural language dispatch, review-and-nudge loops

## Old Paradigm Details

**Knowhow storage:** Scattered across various docs — mix of tactical and strategic advice. No clear separation.

**Weapons:** Work well as-is. External service connectors with clean interfaces.

**How Claude Code triggers actions today:**
- **Cron pipeline (automated):** `/api/council/cron/trigger` → `advanceQuest()` → spawns Claude CLI subprocess via `libs/weapon/claudecli/` (`claude --print`). One-shot, non-iterative.
- **Interactive (ad-hoc):** Claude Code directly imports weapons/skill books as JS modules and calls functions natively. Flexible but unstructured.
- **Skill books:** Registered action functions called directly in JS — not via API routes or scripts.

**Key limitation:** The cron pipeline is one-shot per stage advance. No back-and-forth. No review-and-nudge loop.

## Open Question: Can Cursor agents call GuildOS weapons natively?

Test dispatched (2026-04-14) to agent bc-1a4bfbeb: pull 5 sales orders from Zoho Books by importing `libs/weapon/zoho`.

Three possible outcomes:
1. **Does it by default** — agent naturally imports and calls GuildOS JS modules without being told how
2. **Can do it after instruction** — agent can run inline JS/Node scripts but needs to be told about the weapon pattern
3. **Cannot do it** — some environment limitation prevents it (unlikely since it has shell + Node.js)

Outcome (1) would mean the agent already understands the codebase conventions. (2) means we need to include weapon usage patterns in task prompts. (3) would require API-based wrappers.

**Result: Situation (2) confirmed.** Agent succeeded after instruction. Used `npx tsx` with tsconfig path aliases. Also found and fixed a bug (`getZohoBooksAppCredentials` used `database.init("server")` which calls `cookies()` — breaks outside Next.js). PR #7.

## Decisions
- If situation (2): skill books must include clear descriptions of how to import and call weapon functions natively (import path, function signature, required params, auth handling). Skill books become agent-readable documentation, not just action registries.

## Knowhow Layers

The refactor is about structuring **knowhow** (instructions for agents) and mapping core concepts to workflows.

### Layer 1: Global knowhow (world building)
Single document introducing:
- What entities exist in GuildOS (quests, adventurers, weapons, skill books, etc.)
- That agents can use weapon actions to do things
- How to read and follow skill book instructions
- Import patterns and auth handling

Lives in one doc. Confirmed: `.md` files are accessible via `fs.readFileSync` in server-side code on Vercel (bundled with serverless functions, Node.js runtime only — not edge).

### Layer 2: Strategic knowhow (per-adventurer)
Lives in adventurer's `system_prompt` in DB. Read once at session init. Adventurer keeps a local md copy and syncs significant changes back to DB.

### Layer 3: Tactical knowhow (skill books)
Skill book markdown docs describing how to accomplish specific objectives. Loaded at session init based on adventurer's `skill_books[]`. Agents can also discover and request additional skill books at runtime.

## Workflow Mapping

### Adventurers → Live Worker Agents

**Old model:** Adventurer = background context (system prompt, personality, skill book assignment) woven into a big prompt for one-shot execution during quest advance.

**New model:** Adventurer = a persistent, addressable worker agent mapped to a real compute session.

- Each adventurer has a **session ID** (e.g., Cursor agent ID `bc-xxxxxxxx`) linking it to a live VM
- Adventurers are **always-on entities** you can talk to, not prompt fragments
- GuildOS UI provides a **direct messaging interface** per adventurer → messages route to the underlying agent session (e.g., Cursor API followup)
- Future: worker environments beyond Cursor — GPU runpods, other cloud VMs
- The adventurer record in the DB holds the session ID, worker type, and status

### Adventurer Status Model (managed by Vercel cron)
| Status | Condition |
|--------|-----------|
| `inactive` | No live session linked, or session terminated |
| `idle` | Live session, no quest assigned in execute stage |
| `raised_hand` | Has quest assigned in execute, not yet dispatched |
| `busy` | Active dispatch in progress (Cursor agent RUNNING) |
| `confused` | `busy` longer than threshold (e.g., 30 min) |
| `error` | Cursor API returned error or session unreachable |

Inn UI shows `raised_hand` adventurers prominently (future: avatars).

### Two codebases, one repo
1. **Project management layer** — deployed to Vercel. Quest pipeline, status cron, UI, Asana reporting.
2. **Adventurer empowerment layer** — read by agents in their environments. Global instructions, skill book docs, weapon imports. GuildOS repo available in each agent's workspace.

### Implications
- Adventurer DB schema needs: `session_id`, `worker_type` (cursor_cloud, runpod, etc.), `session_status`
- UI needs: per-adventurer chat view that sends/receives messages
- Quest execution changes: instead of injecting adventurer context into a prompt, **send the task to the adventurer's live session**
- Adventurers can be re-used across quests (they persist)
- Status management runs on Vercel cron, polling Cursor agent status and cross-referencing quest assignments

### Weapons → No change
Weapons remain external service connectors with clean JS interfaces. Agents call them natively via import.

### Skill Books → Knowledge Registries

**Old model:** Skill book = collection of JS action functions (`search()`, `dispatchTask()`, `triageInbox()`) that execute predefined logic. Code-heavy, script-driven.

**New model:** Skill book = a **knowledge registry** — curated prompt content describing how to accomplish tactical objectives. Literally "books" that agents read, not code they execute.

- Contains: step-by-step guidance, weapon usage patterns, domain context, success criteria, gotchas
- Agents read the relevant skill book, then decide how to act (using weapons, their own tools, etc.)
- No more action dispatch — the agent IS the executor, the skill book is the reference material
- Think of it as: weapons = tools on the shelf, skill books = the manual for when/how to use them

### Quests → Mostly unchanged

- Quests remain the unit of work with stage-based progression
- Map to **Asana tasks** for reporting and archiving
- Output goal: surface **managerial decision-enabling summaries** into Asana — not raw details, but actionable conclusions and status
- Quest pipeline stays, but execution stage now means "send task to adventurer's live session" instead of "run skill book actions"
- **Closing stage change:** Questmaster summarizes the quest outcome and writes the report to the mapped Asana task. Successfully archiving to Asana = closing criteria for exiting the closing stage.

## Architecture Decisions (Resolved)

### Session recovery
No special recovery logic. Quest state lives in quest description, inventory, and comments. On session restart, adventurer reads all assigned quests in `execute` stage and picks up from there. Works through them one at a time until none remain.

### Manager pattern → Implicit, two-tier review
No explicit manager agent. Instead, two safeguards:
1. **Internal gate:** Global instructions require that before submitting for review, the adventurer runs Claude CLI to review screenshots. The "submit for review" action checks for a Claude-approved stamp — rejects if missing.
2. **Questmaster review:** Quest enters `review` stage → assigned to Questmaster (another live Cursor agent session). Questmaster checks screenshots against quest requirements. Pass → advance. Fail → comments with feedback, kicks quest back to `execute` stage for the adventurer.

### Skill book discovery
Skill book list lives in database. When no skill book matches AND the task can't be done natively, before escalating the adventurer scans all available skill books to see if any is suitable. Extra token cost is acceptable.

### Stage advancement
Adventurers and Questmaster are responsible for advancing stages. How-to lives in global instructions.

### Session lifecycle
Cursor VMs have no cost. Assume always-live. If a session dies, fire up a new one. Status check on object init is cheap and scriptable. Sessions are kept alive via:
- User chatting to adventurers in the Inn (UI)
- Cron-triggered spot checks ("are you still working on what you should be?")

### Local ↔ DB sync
`system_prompt` travels to local only on init and on-demand pull. No reactive sync needed for now.

## Cross-Cutting Contracts

- **Assignment:** `quests.assignee_id` is canonical. One active dispatch per quest. Adventurer may have N assigned quests but only 1 running dispatch at a time.
- **Dispatch token:** Every dispatch generates a UUID token stored on quest. Only matching token may submit results.
- **Atomic transitions:** `UPDATE quests SET stage = $new WHERE id = $id AND stage = $current AND dispatch_token = $token`
- **No conversation parsing:** Agents call `submit_results` API explicitly. Cron only monitors and nudges.
- **Fallback:** No session or error/inactive → Claude CLI fallback. Comments record execution path.
- **Session bootstrap mandatory** before first live dispatch.

## docs/ Consolidation (required for acceptance)

Currently 22 md files in docs/. Target: 1 file (`global-instructions.md`), plus `GuildOS-refactor.md` during refactor only.

**Absorb into global instructions:**
- `project-architecture-documentation.md` (entity model, pipeline)
- `adventurer-creed.md`, `adventurer-claude-non-development-guideline.md`
- `browser-automation-guideline.md`, `skill-book-guideline.md`, `weapon-crafting-guideline.md`
- `pigeon-letter-drafting-guide.md`
- `cursor-cloud-agent-capabilities.md`

**Absorb into skill book docs (stored in skill_book/ dirs or DB):**
- `weapon-usage-*.md` (8 files) → into their respective skill books
- `gmail-processing-preferences.md` → into gmail skill book

**Archive or delete:**
- `dependency-loop-rollout-plan.md`, `manual context.md`, `quest-trace-bigquery.md`
- `feature-test.md`, `feature-test-results.md`
- `GuildOS-refactor.md` (remove after refactor complete)

## Plan

See `.claude/plans/rustling-pondering-snowglobe.md` for the full 8-phase implementation plan (Phases 0-7).
