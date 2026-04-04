This is the architecture document for how GuildOS functions. It defines workflows, modules, file conventions, and standards. **This document is the source of truth** — code that conflicts must be fixed, uncovered code flagged for review.

## Dictionary

| Fantasy Term | Programming Term | Database |
|---|---|---|
| action | function | — |
| adventurer | agent | `adventurers` |
| quest | task | `quests` |
| quest.inventory | state memory | `quests.inventory` — `{item_key: value, ...}` |
| skill book | action collection (single-purpose business logic) | — |
| weapon | external protocol (API/MCP connector) | — |
| pigeon post | async messaging — posts to `pigeon_letters`, listens for webhook response with quest_id + items | `pigeon_letters` |
| potions | temporary auth tokens (programmatic) | `potions` — managed in Town Square > Apothecary |
| env_vars | permanent access keys | `profiles.env_vars` — managed in Council Hall > Formulary |

Database ref: `@/docs/database-schema.sql`

## Action Naming Conventions

Six standard verbs for non-business-logic actions. **Do not use their synonyms.**

| Verb | Intent | Banned synonyms |
|------|--------|-----------------|
| **read** | Get one record (enriched by default) | get, load, fetch |
| **write** | Create or update (id present → update, absent → create) | create, update, save, upsert |
| **delete** | Remove a record | remove, destroy |
| **search** | Find records (no criteria → list all) | list, find, query, filter |
| **transform** | Reshape data X → Y, no business logic | format, convert, map |
| **normalize** | Standardize shape/defaults, no business logic | clean, sanitize |

Business-logic actions (e.g., `resolveAssignee`, `assign`, `forge`) are named by what they do — no attempt to generalize into a universal verb.

**Function threshold:** A named function must involve at least 2 steps/basic actions AND be used in more than 1 place. Do not create single-use functions or functions that wrap a single line of code. Inline the logic instead.

*These conventions will be applied gradually during refactors. New code should follow them immediately.*

## Module File Conventions

- **Main file:** `libs/module/index.js` — shared actions (e.g., loadProfile)
- **Helper files:** `libs/module/verbname.js` — scenario-specific actions, named with a verb (e.g., `forge.js`, `recruit.js`)
- **API file:** `app/api/module/route.js` — one per module, uses `payload.action` to triage. Imports main file, calls actions only.
- **Page file:** `app/town/pagename/page.js` — UI components

## NPCs and Adventurers

**NPCs** are system-defined agents with code-defined behaviors in `libs/npcs/<jobname>/`. They do NOT use skill books for intrinsic abilities. AI actions use inline prompt templates; script actions are hardcoded logic.

**Adventurers** have basic code behaviors (`libs/adventurer/`) extended by skill books, weapons, and database-defined instructions (`adventurers.system_prompt`).

Both NPCs and adventurers load the default skill book. Shared actions (e.g., `addNextSteps`, `loadNextStep`) live in the default skill book. Adventurer-specific shared actions (e.g., `loadProfile`) live in `libs/adventurer/index.js`.

**Assigning** accepts both NPC slugs/names and adventurer UUIDs — they're parallel entity types.

### The Four NPCs

| NPC | Name | Role |
|---|---|---|
| Questmaster | Wendy the Kitty (Cat) | Triage quests, assign adventurers, review success criteria |
| Guildmaster | Oinky the Piggy (Pig) | Recruit adventurers, liaison to user, handle review escalations |
| Blacksmith | Flash Blacksloth | Forge weapons via claudeCLI (ref: `@/docs/weapon-crafting-guideline.md`) |
| Runesmith | Nick Wildrunes | Create skill books via claudeCLI (ref: `@/docs/skill-book-crafting-guideline.md`) |

## Credentials: Potions vs Env Vars

**Potions** — temporary tokens, programmatic. Weapons access via `loadPotion()`.
**Env vars** — permanent keys in `profiles.env_vars`. Accessed through the council module (`council->getEnvVar()`), which weapons call as needed.

## Quest Lifecycle (SMART Framework)

**Stage order:** idea → assign → plan → execute → review → closing → completed

Assign before plan. Cat picks WHO, the adventurer decides HOW.

### Stage Details

**1. Idea** — interpret a new request.
- Entry: user (UI/API/MCP) or pipeline (API/MCP). New requests default to title "New Request" (convention, not enforced — if a quest arrives with a real title in idea stage, just advance to assign).
- Processing: `questmaster->interpret()` — clarity test. Unclear requests escalate to review (assigned to Pig) with a comment.
- Exit: clear description → stage becomes `assign`.

**2. Assign** — pick the adventurer.
- Entry: from idea, from clarified escalations, or from closing (next_steps).
- Processing: `questmaster->assign()` — AI reviews all adventurers' capabilities. If a match is found, assign and advance to plan. If no match → **preparation cascade** (see below).
- Exit: adventurer assigned → `plan`.

**3. Plan** — adventurer generates execution_plan.
- Requires assignee with adventurer ID (not an NPC).
- Processing: `adventurer->draftExecutionPlan()` — uses system_prompt + skill book TOCs to create `[{skillbook, action, optional waitFor, waitForUntil}]`. Then `adventurer->evaluateExecutionPlan()` — AI reality-checks expected outputs against quest deliverables. Fail → escalate to Pig in review.
- Exit: valid plan → `execute`.

**4. Execute** — run the plan steps.
- Processing: `adventurer->getSkillBook(book)->action(inputs)` step by step. Errors → log in comment, escalate to Pig in review.
- **waitFor**: for pigeon post async results. If cron loads a quest with waitFor and the item isn't in inventory, skip it. `waitForUntil` timestamp (default: few hours) — escalate if exceeded.
- Exit: all steps done → `review` (assigned to Cat).

**5. Review** — adventurer self-reviews first (guided by their `system_prompt`). Obvious success → `closing`. Unclear → stays in review, assigned to Pig → user gets global UI notification.

**6. Closing** — if `next_steps` is not empty, `adventurer->loadNextStep()`. Otherwise, summarize items and comments into a final brief report. User manually closes.

### Quest Chaining via next_steps Mutation

No child quests. One quest row serves multiple purposes sequentially. When closing, if `next_steps` has entries, `loadNextStep()` pops the first entry, replaces quest title/description, resets stage to `assign`. Record in comments for bookkeeping.

**Inventory on loadNextStep:** carries over. If the queued quest has inventory, it merges with the current quest's inventory — current quest items take priority on key conflicts (most up-to-date). In practice, item keys are designed to be unique.

### Preparation Cascade (no fitting adventurer)

When `assign()` finds no match:
1. Save current quest details into `next_steps[0]`
2. Prepend 3 preparation steps (execute in order):
   ```
   next_steps = [
     {title: "Prepare weapon for: <domain>", type: "prepare_weapon"},
     {title: "Prepare skill book for: <domain>", type: "prepare_skillbook"},
     {title: "Prepare adventurer for: <domain>", type: "prepare_adventurer"},
     {title: "<original>", description: "<original>"}  ← saved in step 1
   ]
   ```
3. `loadNextStep()` → pops "Prepare weapon", resets to assign
4. Each preparation goes through the full pipeline. The assigned NPC decides during plan whether work is actually needed.
5. After all 3 complete, original quest loads → Cat re-runs assign → finds the new adventurer.

**Prepare adventurer (Pig):** Uses pre-engineered prompts to decide if autonomous setup is possible or user interaction needed. E.g., "multiply two numbers" → autonomous. "Get events from BigQuery" → needs credential setup, escalates to user for access keys.

**Items are state vars.** E.g., `{input1: 8, input2: 9, result: 72}` or `{salesorders: [{...}]}` or `{weapon_created: "bigquery", files: [...]}`.

## Action Triggers

1. **User actions** — page UIs, API endpoints (CRUD, proving grounds)
2. **Cron** — quest advancement pipeline
3. **Webhooks** — quest assignment from pipelines, pigeon post responses with items

All triggers work by calling an adventurer/NPC first, then using an action (loading skill book if needed).

## Example Module Structure

**Quest module**  (`libs/quest/`):
- `index.js`: loadQuest(id)=>resolveAssignee()

**Adventurer module** (`libs/adventurer/`):
- `index.js`: loadProfile(id), loadQuest(id), execute(), plan(), getSkillBook()
- helpers: `doQuest.js`, `manageProfile.js`, etc.

**Skill book** (`libs/skill_book/<bookname>/`):
- `index.js`: exports `skillBook` with `toc` (table of contents) and action functions
- `toc`: `{actionName: {description, inputExample, outputExample}}`

**Weapon** (`libs/weapon/<weaponname>/`):
- `index.js`: connection logic, `loadPotion()`, action functions
- Same `toc` structure as skill books

---

## Development Gap List

30 items identified. Most will be resolved by tracing test cases through the full pipeline. See below for the first test case.

---

## Test Case 1: Fetch 20 Events from BigQuery

This quest traces the entire pipeline end-to-end and hits every NPC.

### Steps

done 1. **Create quest** — user submits: title "New Request", description "Fetch 20 events from BigQuery and return them as JSON"


2. **Idea stage (Cat)** — `questmaster->interpret()`: parse request, clarity test. This is SMART enough (clear deliverable: 20 events as JSON). Cat outputs a refined title "Fetch 20 events from BigQuery" and advances to assign.

3. **Assign stage (Cat)** — `questmaster->assign()`: scans adventurer roster. No adventurer has BigQuery capabilities → **preparation cascade triggers**.
   - Save original quest to `next_steps[3]`
   - Prepend: prepare_weapon, prepare_skillbook, prepare_adventurer
   - `loadNextStep()` → quest becomes "Prepare weapon for: BigQuery"

4. **Prepare weapon — assign (Cat)** — routes to Blacksmith (hardcoded for prepare_weapon type).

5. **Prepare weapon — plan (Blacksmith)** — generates execution plan: `[{skillbook: "blacksmith", action: "forgeWeapon"}]`. The weapon spec describes a BigQuery connector that authenticates with a service account JSON key and runs queries.

6. **Prepare weapon — execute (Blacksmith)** — `forgeWeapon()` invokes claudeCLI which reads `docs/weapon-crafting-guideline.md` and writes:
   - `libs/weapon/bigquery/index.js` — connection logic, query action
   - Registers weapon in weapon registry
   - Item produced: `{weapon_created: "bigquery", files_modified: [...]}`

7. **Prepare weapon — review/closing** — self-review passes. `loadNextStep()` → quest becomes "Prepare skill book for: BigQuery"

8. **Prepare skill book — assign (Cat)** → routes to Runesmith.

9. **Prepare skill book — plan (Runesmith)** — execution plan: `[{skillbook: "blacksmith", action: "forgeWeapon"}]` (Runesmith uses Blacksmith's forge with a skill book spec). The spec describes a `bigquery` skill book with action `fetchEvents(query, limit)`.

10. **Prepare skill book — execute (Runesmith)** — claudeCLI reads `docs/skill-book-crafting-guideline.md` and writes:
    - `libs/skill_book/bigquery/index.js` — exports `skillBook` with `fetchEvents` action that uses the bigquery weapon
    - Registers in skill book index
    - Item produced: `{skillbook_created: "bigquery", actions: ["fetchEvents"]}`

11. **Prepare skill book — review/closing** — `loadNextStep()` → quest becomes "Prepare adventurer for: BigQuery"

12. **Prepare adventurer — assign (Cat)** → routes to Pig.

13. **Prepare adventurer — plan (Pig)** — uses pre-engineered prompts. Determines: BigQuery needs a service account JSON key → **this requires user input**. Pig checks if `env_vars` already has a BigQuery credential. If not → escalate to review (assigned to Pig) with comment: "Please add BigQuery service account JSON to env_vars via Council Hall > Formulary, key name: `BIGQUERY_SERVICE_ACCOUNT`"

14. **User provides credential** — adds the key in Formulary. Moves quest back to plan.

15. **Prepare adventurer — execute (Pig)** — creates adventurer row: name "BigQuery Analyst", system_prompt describing BigQuery expertise, skill_books: ["bigquery"], capabilities: "Fetch and query data from Google BigQuery".

16. **Prepare adventurer — review/closing** — `loadNextStep()` → quest becomes original "Fetch 20 events from BigQuery". Stage resets to assign.

17. **Assign (Cat)** — scans roster again. Finds "BigQuery Analyst" → assigns.

18. **Plan (BigQuery Analyst)** — `draftExecutionPlan()`: reads system_prompt + bigquery skill book TOC → `[{skillbook: "bigquery", action: "fetchEvents", params: {query: "SELECT * FROM events LIMIT 20"}}]`. `evaluateExecutionPlan()` confirms output item will contain event data matching quest deliverable.

19. **Execute (BigQuery Analyst)** — calls `bigquery.fetchEvents({query, limit: 20})`. Weapon loads env_var credential via council module, authenticates, runs query. Item produced: `{events: [{...}, ...20 items]}`

20. **Review** — adventurer self-reviews: inventory contains `events` with 20 items matching the quest description. Passes → closing.

21. **Closing** — `next_steps` is empty. Summarize: "Fetched 20 events from BigQuery. See inventory.events for results." Quest complete.
