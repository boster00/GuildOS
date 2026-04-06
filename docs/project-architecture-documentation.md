This is the architecture document for how GuildOS functions. It defines workflows, modules, file conventions, and standards. **This document is the source of truth** — code that conflicts must be fixed, uncovered code flagged for review.

---

## Dictionary

| Fantasy Term | Programming Term | DB column / table |
|---|---|---|
| adventurer | AI agent | `adventurers` |
| quest | task | `quests` |
| quest.inventory | state memory | `quests.inventory` — `{item_key: value, …}` |
| skill book | action collection (single-purpose business logic) | — |
| weapon | external protocol connector (API/MCP/DB) | — |
| pigeon post | async messaging queue | `pigeon_letters` |
| potions | temporary auth tokens | `potions` — Town Square > Apothecary |
| env_vars | permanent access keys | `profiles.env_vars` — Council Hall > Formulary |

---

## NPCs vs Adventurers — Critical Distinction

**NPCs** are system-defined agents. Their behavior is **code-defined** in `libs/npcs/<slug>/index.js`. They are **NOT rows in the `adventurers` table** and must never be seeded there.

**Adventurers** are user-defined agents. Their behavior comes from `adventurers.system_prompt` (DB) plus skill books. They ARE rows in `adventurers`.

Both types are identified by name string in `quests.assigned_to`. `resolveAssignee()` checks `getNpc()` first; if it returns a result → NPC. Otherwise → DB lookup → adventurer.

### The Four NPCs

| Key | Name | Role | Slug |
|---|---|---|---|
| `cat` | Wendy the Kitty | Questmaster — triage, assign | `questmaster` |
| `pig` | Oinky the Piggy | Guildmaster — review escalations, adventurer setup | `guildmaster` |
| `blacksmith` | Flash Blacksloth | Forges weapons via claudeCLI | `blacksmith` |
| `runesmith` | Nick Wildrunes | Creates skill books via claudeCLI | `runesmith` |

Each NPC module exports `doNextAction(quest, { client, userId })` — it reads `quest.stage` and performs the appropriate action for that stage. The stage machine in `server.js` calls this for any NPC-assigned quest.

### Adventurer Innate Actions

Adventurers export innate actions from `libs/adventurer/index.js`:

- **`doNextAction(quest, ctx)`** — advances the quest one stage (plan → execute → review). Delegates to `advanceQuest` in `server.js`.
- **`boast(quest, ctx)`** — self-reports the adventurer's capabilities by loading the TOC of every skill book they wield. Returns a structured briefing with action names and descriptions. The Questmaster uses this at assign time.

**`boast` vs `capabilities`:** The `capabilities` DB field is a high-level abstract description of the type of work an adventurer handles (e.g. "Manages Zoho Books and CRM data"). `boast` is the binding contract — it lists the exact actions available, derived live from skill book TOCs. At assign time, the Questmaster reads both: capabilities for quick screening, boast for precise matching. If the quest requires something not listed in the boast, the adventurer is not a match.

### Skill Book TOC Standard

**Naming:**
- Action names must use the six standard verbs: `read`, `write`, `delete`, `search`, `transform`, `normalize`. Do not use synonyms (`get`, `fetch`, `load`, `list`, `find`).
- Prefer multipurpose actions with a parameter over one action per entity. Example: one `search` with a `module` param, not `searchContacts` + `searchQuotes`.

**Description:** Caller language — what the caller gets, not what the function does internally.

**Input/output format:** Flat key-value map. Each value is a string declaring the type and constraints or example. This serves dual purpose: documents the contract AND provides a format template for AI response enforcement.

```js
toc: {
  search: {
    description: "Search any Zoho module and return up to N records.",
    input: {
      module: "string, one of: salesorders, invoices, bills, purchaseorders, creditnotes, payments, estimates, Contacts, Quotes, Leads, Deals",
      limit: "int, e.g. 5",
    },
    output: {
      records: "array of objects",
    },
  },
}
```

Three patterns for input values:
- **Free-form:** `"string, e.g. shirts"`
- **Constrained:** `"string, one of: salesorders, invoices, ..."`
- **Numeric:** `"int, e.g. 5"`

**Usage by stage:**
- **Assign** (via boast): sees `description` only — enough to decide if the adventurer fits
- **Plan**: sees `description` + `input` + `output` — the AI picks the right action and generates correct params

---

## Action Naming Conventions

Six standard verbs for non-business-logic actions. **Do not use their synonyms.**

| Verb | Intent | Banned synonyms |
|------|--------|-----------------|
| **read** | Get one record | get, load, fetch |
| **write** | Create or update | create, update, save, upsert |
| **delete** | Remove | remove, destroy |
| **search** | Find records (no criteria → list all) | list, find, query, filter |
| **transform** | Reshape data X → Y | format, convert, map |
| **normalize** | Standardize shape/defaults | clean, sanitize |

Business-logic actions (e.g. `assign`, `forge`, `escalate`) are named by what they do.

**Function threshold:** A named function must involve ≥2 steps AND be used in >1 place. Inline single-use logic.

---

## Module File Conventions

```
libs/<module>/index.js          — shared actions
libs/<module>/<verb>.js         — scenario-specific helpers (named with a verb)
app/api/<module>/route.js       — thin route handler, triages via payload.action
app/town/<page>/page.js         — UI components
```

---

## Credentials

**Potions** — temporary tokens. Accessed via `loadPotion(kind)` in weapons.
**Env vars** — permanent keys in `profiles.env_vars`. Accessed via `council.getEnvVar(keyName)`.

---

## Quest Lifecycle (SMART Framework)

**Stage order:** `idea → assign → plan → execute → review → closing → completed`

### Stage Details

**1. idea** — Cat interprets the raw request (`questmaster.planRequestToQuest`). If unclear → escalate to Pig in review. If clear → advance to `assign`.

**2. assign** — Cat scans adventurer roster (`questmaster.assign`). If match → write assignment, advance to `plan`. If **no match** → **preparation cascade** (see below).

**3. plan** — Assigned adventurer (or NPC) generates `execution_plan`. NPCs use inline prompts; adventurers use `system_prompt` from DB + skill book TOC context. Output stored on quest.

**4. execute** — Pop steps from `execution_plan` one per cron cycle. Each step calls `runProvingGroundsAction(skillbook, action, payload)`. On success: store output keys to inventory, pop step. On failure: log comment, stop.
- **waitFor**: if step declares `waitFor: ["key"]` and key isn't in inventory → skip (pigeon post async delivery pending).

**5. review** — Before closing, the system attempts **automated Chrome verification** via `claude -p` (headless Claude Code with Chrome Extension MCP tools). It navigates to the quest detail page, screenshots the result, and records pass/fail in a comment. This is best-effort — if Chrome isn't running, verification is skipped. Then advances to `closing`. For NPC-assigned quests: Cat self-reviews, uncertain results → assign to Pig → user notified.

**6. closing** — `advanceToNextStep()`: pop first `next_steps` entry, replace quest title/description/stage, route to correct NPC via `PREP_NPC_ROUTING`. If `next_steps` is empty → mark `completed`.

**7. completed** — Terminal state.

---

## Quest Chaining via next_steps

**One quest row, multiple purposes.** No child quests. When closing, `advanceToNextStep()`:
1. Pops first entry from `next_steps`
2. Replaces quest `title`, `description`, `stage` (default `assign`)
3. Routes to correct NPC (via `PREP_NPC_ROUTING` for prep types)
4. Inventory **carries over** — existing items take priority on key conflict

---

## Preparation Cascade (no matching adventurer)

When `assign()` finds no match, `triggerPreparationCascade()`:

```
next_steps = [
  { title: "Prepare weapon",    type: "prepare_weapon",    stage: "plan" },
  { title: "Prepare skill book", type: "prepare_skillbook", stage: "plan" },
  { title: "Prepare adventurer", type: "prepare_adventurer", stage: "plan" },
  { title: "<original title>",   description: "<original>",  stage: "assign" }  ← original quest saved here
]
```

Then `advanceToNextStep()` immediately → quest becomes "Prepare weapon", stage `plan`, assigned to Blacksmith.

**Routing** (from `PREP_NPC_ROUTING`):
- `prepare_weapon` → Blacksmith
- `prepare_skillbook` → Runesmith
- `prepare_adventurer` → Pig

Each prep quest runs the full pipeline. After all 3 complete, the original quest loads → Cat re-runs assign → finds the new adventurer.

**Weapon expansion:** If a weapon for the same external service already exists, the Blacksmith extends it rather than creating a new file. One weapon per external system (e.g. one `zoho` weapon covers Books + CRM — shared OAuth).

---

## Stage Machine Dispatch (server.js)

```
advanceQuest(quest):
  if closing:  advanceToNextStep() → done? completed : assign stage
  if completed: no-op
  resolve assignee (getNpc or DB lookup)
  if NPC:      load libs/npcs/<slug>/index.js → doNextAction(quest, ctx)
  if adventurer:
    plan:    AI generates execution_plan → execute
    execute: pop one step, run skill book action → review when done
    review:  auto-advance to closing (or Pig evaluates escalation)
```

---

## Action Triggers

1. **User** — page UI, API endpoints
2. **Cron** — 5-minute loop calling `advance()` on active quests
3. **Webhooks** — pigeon post delivery, external callbacks
4. **Scripts** — `claude-scripts/` (Node.js, service-role auth, `@/` alias via loader)

---

## Common Misunderstandings

**❌ NPCs are NOT adventurers.** Do not seed Cat/Pig/Blacksmith/Runesmith into the `adventurers` table. They are code-defined in `libs/npcs/`. No DB seeding needed.

**❌ `next_steps` mutation does NOT use `createSubQuest`.** It mutates the current quest row. `createSubQuest` is the old incorrect pattern. Use `advanceToNextStep()`.

**❌ The closing stage does NOT spawn child quests.** It resets the current quest to a new purpose. All context (inventory) carries over.

**❌ One weapon per external service, not per product.** Zoho Books and Zoho CRM share one OAuth → one `zoho` weapon. Add CRM endpoints to `libs/weapon/zoho/index.js`.

**❌ Adventurers are NOT NPCs.** An adventurer's behavior is entirely driven by `system_prompt` (DB) + skill books. An NPC's behavior is hardcoded in `libs/npcs/<slug>/`.

**❌ The `forgeWeapon` action reads `weapon_spec` from inventory.** After `blacksmith.plan()` the inventory has `blueprint`, not `weapon_spec`. `forgeWeapon` falls back to deriving `weapon_spec` from `blueprint` if `weapon_spec` is missing.

**❌ Weapon actions use `getAdventurerExecutionContext()` for userId/client, not `requireUser()`.** `requireUser()` reads Next.js cookies and fails outside HTTP context (scripts, cron). In execution context, use `getAdventurerExecutionUserId()` and `getAdventurerExecutionContext().client`.

**❌ `capabilities` text is NOT the sole basis for assignment.** The Questmaster uses both `capabilities` (abstract) and `boast` (specific). `boast` is derived live from skill book TOCs and is the binding contract. If the boast doesn't list an action that covers the quest, the adventurer is not a match — regardless of what `capabilities` says.

**❌ Do not create one skill book action per entity type.** Prefer multipurpose actions (e.g. one `search` with a `module` parameter) over per-module actions (`searchContacts`, `searchQuotes`). The planning AI selects the right parameters.

---

## Test Case: Fetch 5 Contacts from Zoho CRM

1. **Create quest** — "Fetch 5 contacts from Zoho CRM"
2. **Idea** — Cat interprets, advances to assign
3. **Assign** — No Zoho CRM adventurer → cascade: prepare_weapon → prepare_skillbook → prepare_adventurer → original
4. **Prepare weapon (Blacksmith plan)** — Detects existing `zoho` weapon, needs CRM scope expansion + re-auth. Escalates to user.
5. **User re-authorizes** Zoho with CRM scope (`ZohoCRM.modules.contacts.READ`)
6. **Prepare weapon (execute)** — Blacksmith expands `libs/weapon/zoho/index.js` with `searchCrm`
7. **Prepare skill book (Runesmith)** — Extends `libs/skill_book/zoho/index.js` with unified `search` action
8. **Prepare adventurer (Pig)** — Creates "Zoho Advisor" adventurer row with `zoho` skill book
9. **Original quest returns** → assign calls `boast`, finds "Zoho Advisor" covers Contacts → plan → execute `zoho.search({module:"Contacts", limit:5})` → review → closing → completed
