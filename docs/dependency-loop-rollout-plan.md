# Dependency loop rollout — executable runbook

This document tracks building the **recursive dependency resolution** system (`next_steps`, quest handoffs, questmaster checks, `cursorCLI`, weaponsmith book). Work **top to bottom**; each phase has a **Verify** gate.

## What is defined enough to implement (as of last update)

| Phase | Status | Notes |
| --- | --- | --- |
| **1** Migration `next_steps` | **Done in repo** | File: `supabase/migrations/20260401120000_quests_next_steps.sql` — run `npx supabase db push` locally |
| **2** Quest helpers (`insertSubQuest`, `updateQuest`, `popNextStep`) | **Done in repo** | [`libs/council/database/serverQuest.js`](../libs/council/database/serverQuest.js), [`libs/quest/index.js`](../libs/quest/index.js) — includes `childQuestFromNextStep` |
| **3** `advanceClosing` + cron `closing` | **Done in repo** | [`libs/adventurer/index.js`](../libs/adventurer/index.js) |
| **4** Questmaster actions | **Needs decisions** — see [Open questions](#open-questions-before-phase-4) | Prompts, return shapes, where `createDependencyQuest` lives |
| **5** `advancePlan` / `advanceExecute` branching | **Depends on Phase 4** | `match: false`, `dependency_created` contract |
| **6** Presets + roster rows | **Depends on Phase 4–5** | Copy can live in [`indexCandidates.js`](../libs/adventurer/indexCandidates.js) |
| **7** `cursorCLI` weapon | **Needs security scope** | Allowlisted commands, repo root, audit log |
| **8** Weaponsmith skill book | **Depends on Phase 7** | |
| **9** Integration | **Depends on 4–8** | |

**Phases 1–3 are implemented in code** (2026-04-01). Apply the migration to your Supabase project (`npx supabase db push`), then run the Verify steps for each phase.

---

## Canonical shape for `next_steps` entries

Use **one** of these per entry (parser in `popNextStep` / `advanceClosing` should accept all):

1. **String** — becomes child quest `title`; child `description` may copy parent.
2. **`{ "instruction": "..." }`** — child `title` = `instruction`.
3. **`{ "title": "...", "description": "..." }`** — explicit fields for the child quest.

**After `popNextStep`:** the parent row’s `next_steps` is updated to the **tail** only. The child is created with `next_steps` = that **same tail** (remaining work), per design.

---

## Phase 1 — Migration: `next_steps` on `quests`

### Do this

1. Ensure migration file exists (example name): `supabase/migrations/20260401120000_quests_next_steps.sql`
2. Contents:
   - `ALTER TABLE public.quests ADD COLUMN IF NOT EXISTS next_steps jsonb NOT NULL DEFAULT '[]'::jsonb;`
3. Run: `npx supabase db push`
4. Run: `node scripts/pull-database-reference.js`
5. Confirm `next_steps` on `quests` in [`.cursor/database_reference/SCHEMA.md`](../.cursor/database_reference/SCHEMA.md) after regenerate.

### Verify

- Column exists and defaults to `[]`.

---

## Orchestration vs persistence

- **`libs/council/database/serverQuest.js`** — PostgREST helpers only (insert/update/select rows). No stage-machine logic here.
- **`libs/quest/index.js`** — Quest domain API: `getQuest`, `updateQuest`, `createSubQuest`, `popNextStep`, `childQuestFromNextStep`, etc.
- **`libs/adventurer/index.js`** — Owns **quest progression**: `advance` (stage machine) and **`advanceAssignedQuest`** (`advance` inside `runWithAdventurerExecutionContext` with `userId: quest.owner_id`). **Cron** (`processQuests`) and **proving grounds** (`POST /api/proving_grounds` with `action: advanceQuest`) call `advanceAssignedQuest`.

---

## Phase 2 — Extend quest DB helpers

### Do this

1. **`insertSubQuest`** in [`libs/council/database/serverQuest.js`](../libs/council/database/serverQuest.js): add optional `stage`, `executionPlan`, `nextSteps`. Insert uses `stage ?? "idea"`, `execution_plan: executionPlan ?? []`, `next_steps: nextSteps ?? []`.
2. **`createSubQuest`** in [`libs/quest/index.js`](../libs/quest/index.js): forward those three fields.
3. **`updateQuest`** in [`libs/quest/index.js`](../libs/quest/index.js): if `nextSteps !== undefined`, set `updates.next_steps`.
4. **`updateQuestRow` `.select(...)`**: include `next_steps` in the returned columns.
5. **`popNextStep(questId, { client })`** in [`libs/quest/index.js`](../libs/quest/index.js):
   - `getQuest` → read `next_steps` (normalize `null` to `[]`).
   - If empty, return `{ data: null }`.
   - Else `[first, ...rest] = steps`, `updateQuest(questId, { nextSteps: rest })`, return `{ data: { step: first, remaining: rest } }`.

### Verify

- Unit / manual: set `next_steps` to `[{"instruction":"a"},{"instruction":"b"}]`, call `popNextStep`, row should hold `[{"instruction":"b"}]` and return `step` = first element.

---

## Phase 3 — Closing stage handler

### Do this

1. **`processQuests`** in [`libs/adventurer/index.js`](../libs/adventurer/index.js): add `"closing"` to `.in("stage", [...])`; for each row call **`advanceAssignedQuest(quest, { client })`** (not bare `advance`), so skill actions see `runWithAdventurerExecutionContext`.
2. **`advance()`** `switch`: add `case "closing": await advanceClosing(quest, { client, logger }); break;`
3. **`advanceClosing`** (same file):
   - Call `popNextStep(questId, { client })`; on error → `review`.
   - If `data == null` → `transitionQuestStage(questId, "completed")`.
   - Else build child `title` / `description` from `step` (string or object — see canonical shape above).
   - `createSubQuest({ userId: quest.owner_id, parentQuestId: questId, title, description, assignedTo: "cat", stage: "idea", nextSteps: remaining, executionPlan: [] })`.
   - On success → `transitionQuestStage(questId, "completed")`; log child id.
4. **`finalizeAdvanceComment`**: optionally add a distinct summary when `finalStage === "closing"` (optional polish).

### Verify

- SQL: set a quest to `stage = 'closing'` and `next_steps` with one instruction; run cron (`processQuests`) **or** proving grounds: load the quest and click **Advance quest (cron step)**; expect child at `idea`, parent `completed`.

---

## Phase 4 — Questmaster: dependency pieces (not fully specified)

Scope: `findAdventurerForQUest` no-match JSON, `checkSkillBookCatalog`, `checkWeaponRegistry`, `commissionAdventurer`, internal `createDependencyQuest` helper, register in [`libs/skill_book/index.js`](../libs/skill_book/index.js).

Complete Phase 2–3 first, then resolve [open questions](#open-questions-before-phase-4) before coding.

### Verify (after implementation)

- Proving grounds: `checkSkillBookCatalog` with synthetic `quest` returns structured JSON.

---

## Phase 5 — Pipeline: `advancePlan` + `advanceExecute`

Respect pre-set `assigned_to`, branch on `match: false`, detect `dependency_created` after execute.

Depends on Phase 4.

---

## Phase 6 — Agent presets + seed rows

[`libs/adventurer/indexCandidates.js`](../libs/adventurer/indexCandidates.js) + commission three adventurers.

---

## Phase 7 — `cursorCLI` weapon

New file [`libs/weapon/cursorCLI/index.js`](../libs/weapon/cursorCLI/index.js); register in [`libs/weapon/registry.js`](../libs/weapon/registry.js). **Security review required** before trusting in production.

---

## Phase 8 — Weaponsmith skill book

New file [`libs/skill_book/weaponsmith/index.js`](../libs/skill_book/weaponsmith/index.js); register in hub.

---

## Phase 9 — Integration test

Full BigQuery-style chain across cron cycles + manual auth checkpoint.

---

## Decision log

### Dependency creation vs original goal (2026-04-01)

When opening a dependency (e.g. recruit / forge / skill book):

1. **Replace** the active quest’s **title** and **description** with the **new dependency step** (what must be done *now*).
2. **Prepend** the **original** user goal (the prior title + description / instruction) as the **first** entry in `next_steps`. Any existing `next_steps` entries **shift down** by one index (same array, longer by one at the front).

**Resolution (implemented):** **Phase 3** uses `createSubQuest` only when a quest in stage **`closing`** pops `next_steps` — that is **queue unwind**, not dependency discovery. The decision-log pattern (rewrite title/description, prepend original goal to `next_steps` on the **same** row) is reserved for **Phase 5** when a dependency is first opened.

---

## Open questions before Phase 4

Answer these (you can append decisions to this section):

1. **Parent quest when spawning a dependency:** See Decision log above. Still clarify: should **closing** spawn a *new* child row (current Phase 3), or only **mutate / pop** `next_steps` on the **same** row?
2. **`dependency_created` signal:** Prefer strict convention: skill actions append inventory item `{ item_key: "dependency_created", payload: { child_quest_id } }`, or record a quest activity row; structured work ordering lives on `quests.execution_plan`.
3. **`createDependencyQuest` home:** Keep helper in [`questmaster/index.js`](../libs/skill_book/questmaster/index.js) vs [`libs/quest/index.js`](../libs/quest/index.js) to avoid skill_book → quest circular imports.
4. **`commissionAdventurer`:** Minimal insert (name + `skill_books` + `system_prompt` + `capabilities`) vs full Cat commissioning flow?
5. **cursorCLI:** Allowed commands whitelist vs “any npm script” — how strict for v1?

---

## Proving Grounds UI

Synced with this doc in [`app/town/proving-grounds/ProvingGroundsClient.js`](../app/town/proving-grounds/ProvingGroundsClient.js): `WORKFLOW_STEPS` + **Dependency loop rollout** rail header. In-app `Link` targets only (no `/docs/...` route); runbook path is named in copy.

---

## Related code anchors

- [`libs/adventurer/index.js`](../libs/adventurer/index.js) — `advance`, `advanceIdea`, `advancePlan`, `advanceExecute`, `processQuests`
- [`libs/quest/index.js`](../libs/quest/index.js), [`libs/council/database/serverQuest.js`](../libs/council/database/serverQuest.js)
- [`libs/skill_book/index.js`](../libs/skill_book/index.js)
