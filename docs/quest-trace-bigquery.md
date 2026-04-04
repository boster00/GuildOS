# Quest Trace: "Fetch 20 latest events from BigQuery"

This document traces one quest from submission to completion, identifying every function call, data flow, decision point, and gap. Each step states what happens, who does it, what data flows in/out, and flags unknowns.

---

## Stage 1: IDEA

### 1.1 Entry
**Trigger:** User submits via proving grounds UI or API  
**Quest state after creation:**
```json
{
  "id": "<uuid>",
  "owner_id": "<user>",
  "title": "New Request",
  "description": "Fetch me the latest 20 events from BigQuery",
  "stage": "idea",
  "assignee_id": null,
  "assigned_to": null,
  "execution_plan": [],
  "inventory": {},
  "next_steps": []
}
```

### 1.2 Processing: Cat → interpret()
**Who:** Wendy the Kitty (questmaster NPC)  
**Function:** `libs/npcs/questmaster/interpret.js` → `interpret(quest)`  
**What it does:**
1. Reads quest.description
2. AI call with prompt template: "Is this request clear enough to act on? Does it have a specific deliverable?"
3. Outputs: new title, refined description, deliverables, clarity verdict

**AI prompt inputs:**
- quest.description: "Fetch me the latest 20 events from BigQuery"
- Prompt template (hardcoded in NPC code)

**AI expected output:**
```json
{
  "clear": true,
  "title": "Fetch 20 latest events from BigQuery",
  "description": "Query BigQuery database and retrieve the 20 most recent event records. Return the results as a JSON array.",
  "deliverables": "JSON array of 20 event records from BigQuery"
}
```

**If unclear:** stage → review, assignee → Pig (escalation to user). Comment: "Clarification needed: [reason]"

### 1.3 Exit
**Quest state:**
```json
{
  "title": "Fetch 20 latest events from BigQuery",
  "description": "Query BigQuery database and retrieve the 20 most recent event records...",
  "deliverables": "JSON array of 20 event records from BigQuery",
  "stage": "assign",
  "assignee_id": null
}
```

**GAP:** `interpret()` does not exist. `planRequestToQuest` in the current questmaster skill book does something similar but doesn't follow the "New Request" convention or clarity test pattern.

---

## Stage 2: ASSIGN

### 2.1 Entry
Quest enters assign stage with a clear title and description. Assignee is null.

### 2.2 Processing: Cat → assign()
**Who:** Wendy the Kitty  
**Function:** `libs/npcs/questmaster/assign.js` → `assign(quest)`  
**What it does:**
1. Load all adventurers from DB (roster scan)
2. AI call: given quest title/description/deliverables and each adventurer's name + capabilities, pick one or return false
3. If match → assign adventurer, stage → plan
4. If no match → preparation cascade

**AI prompt inputs:**
- quest.title, quest.description, quest.deliverables
- Roster: `[{ id, name, capabilities, skill_books }]`

**AI expected output (no match):**
```json
{
  "match": false,
  "reason": "No adventurer has BigQuery or data warehouse capabilities"
}
```

### 2.3 No match → Preparation cascade
**Function:** `libs/adventurer/default skill book` → `addNextSteps(quest, steps)`

**What happens (in order):**
1. Save current quest details into next_steps:
```json
quest.next_steps = [
  { "title": "Prepare weapon for: BigQuery", "type": "prepare_weapon" },
  { "title": "Prepare skill book for: BigQuery", "type": "prepare_skillbook" },
  { "title": "Prepare adventurer for: BigQuery", "type": "prepare_adventurer" },
  { "title": "Fetch 20 latest events from BigQuery", "description": "<original>", "deliverables": "<original>", "type": "original_quest" }
]
```
2. Call `loadNextStep()` → pops first item, replaces quest fields:
```json
{
  "title": "Prepare weapon for: BigQuery",
  "description": "Create a weapon that can connect to Google BigQuery and execute queries",
  "stage": "assign",
  "assignee_id": null,
  "inventory": {},  ← preserved from before (empty in this case)
  "next_steps": [remaining 3 items]
}
```

### 2.4 Assign the preparation quest: "Prepare weapon"
Cat runs assign() again on the mutated quest.

**Routing decision:** Cat sees "Prepare weapon" in the title.  
**QUESTION:** Does Cat's AI figure out to assign to Blacksloth from the roster? Or is there a hardcoded rule: title starts with "Prepare weapon" → assign Blacksloth?

**Recommended:** Use the `type` field. Cat checks `next_steps[0].type`:
- `prepare_weapon` → assign to Blacksloth (by name lookup, not UUID)
- `prepare_skillbook` → assign to Wildrunes
- `prepare_adventurer` → assign to Pig
- `original_quest` → normal AI roster scan

**Quest state after assign:**
```json
{
  "title": "Prepare weapon for: BigQuery",
  "stage": "plan",
  "assignee_id": "<blacksloth's adventurer id>",
  "assigned_to": "Blacksloth"
}
```

**GAP:** `addNextSteps()` does not exist. `loadNextStep()` does not do field replacement. NPC routing for preparation quests is undefined. NPCs need rows in adventurers table (with `is_npc` flag or capabilities that Cat can match on) OR hardcoded routing.

---

## Stage 3: PLAN (Blacksloth plans weapon forging)

### 3.1 Entry
Quest is "Prepare weapon for: BigQuery", assigned to Blacksloth.

### 3.2 Processing: Blacksloth → draftExecutionPlan()
**Who:** Flash Blacksloth  
**Function:** `libs/adventurer/index.js` → `draftExecutionPlan(quest, adventurer)`  
**What it does:**
1. Load Blacksloth's system_prompt (defined in NPC code, not DB)
2. Load skill book TOCs available to Blacksloth (his intrinsic NPC actions)
3. AI call: given quest description + available actions, produce execution_plan

**Blacksloth's system_prompt (hardcoded in `libs/npcs/blacksmith/index.js`):**
```
You are Flash Blacksloth, the guild's weapon smith. When given a "Prepare weapon" quest:
1. Read the weapon-crafting-guideline at docs/weapon-crafting-guideline.md
2. Determine what external system needs connecting (API, database, service)
3. Plan the execution steps: forgeWeapon (creates code via claudeCLI), then verifyWeapon (smoke test)
4. Include setup_steps for the user (credentials, env vars, etc.)
```

**AI expected output:**
```json
{
  "execution_plan": [
    { "action": "forgeWeapon", "input": { "domain": "bigquery", "goal": "connect to BigQuery and run SQL queries" } },
    { "action": "verifyWeapon", "input": { "test": "run a simple SELECT query" } }
  ],
  "setup_steps": [
    "Create a GCP service account with BigQuery Data Viewer + Job User roles",
    "Download the JSON key file",
    "Add env var BIGQUERY_SERVICE_ACCOUNT_JSON in Council → Formulary with the key contents",
    "Set env var BIGQUERY_PROJECT_ID with your GCP project ID"
  ]
}
```

### 3.3 evaluateExecutionPlan()
**Function:** `libs/adventurer/index.js` → `evaluateExecutionPlan(quest, plan)`  
AI checks: will forgeWeapon + verifyWeapon produce a working weapon? Passes (straightforward for preparation quests).

### 3.4 Exit
**Quest state:**
```json
{
  "title": "Prepare weapon for: BigQuery",
  "stage": "execute",
  "execution_plan": [forgeWeapon step, verifyWeapon step],
  "inventory": {
    "setup_steps": ["Create a GCP service account...", ...]
  }
}
```

**GAP:** `draftExecutionPlan()` does not exist. `evaluateExecutionPlan()` does not exist. Blacksloth's system_prompt template needs writing. `docs/weapon-crafting-guideline.md` does not exist.

---

## Stage 4: EXECUTE (Blacksloth forges the weapon)

### 4.1 Step 1: forgeWeapon
**Function:** `libs/npcs/blacksmith/index.js` → `forgeWeapon(quest, stepInput)`  
**What it does:**
1. Read `docs/weapon-crafting-guideline.md` (the rules for how weapons should be structured)
2. Build a prompt for claudeCLI including: what weapon to create, what files to write, the guideline, the project conventions
3. Call `libs/weapon/claudecli/invoke(prompt)`
4. Claude CLI writes: `libs/weapon/bigquery/index.js`, updates `libs/weapon/registry.js`
5. Returns `{ ok: true, items: { weapon_created: "bigquery", files_modified: [...] } }`
6. Items stored in quest.inventory

**Prompt to Claude CLI includes:**
- The weapon-crafting-guideline.md content
- Domain: BigQuery
- Goal: connect to BigQuery, execute SQL, return results
- Credential access: read env var `BIGQUERY_SERVICE_ACCOUNT_JSON` from `profiles.env_vars` via a helper
- Required exports: `executeQuery(sql, options)`, `testConnection()`

**QUESTION:** How does the weapon access env_vars? Options:
- A. Weapon function receives env_vars as input from the executor
- B. Weapon imports a helper that reads `profiles.env_vars` from DB
- C. Weapon reads `process.env` (only works if env_vars are synced to actual env)

**Recommended:** Option B — weapon calls something like `getEnvVar(userId, "BIGQUERY_SERVICE_ACCOUNT_JSON")` which reads from `profiles.env_vars`. This keeps credentials in DB and out of process.env.

### 4.2 Step 2: verifyWeapon
**Function:** `libs/npcs/blacksmith/index.js` → `verifyWeapon(quest, stepInput)`  
**What it does:**
1. Import the newly created weapon: `libs/weapon/bigquery/index.js`
2. Call `testConnection()` or a simple query
3. **PROBLEM:** This requires credentials to already be set up. The user hasn't done the setup_steps yet.

**QUESTION:** Does verifyWeapon run immediately? Or does it pause the quest for user setup?

**Options:**
- A. verifyWeapon checks if env_vars exist → if not, escalate to review (Pig) with comment "Please complete setup steps before continuing"
- B. verifyWeapon is a smoke test of the CODE only (import the module, check it exports the right functions), not the connection. Connection testing happens later when the original quest executes.
- C. Skip verifyWeapon entirely for preparation quests. The original quest's execution will be the real test.

**Recommended:** Option B for now. Verify the code is valid, exports exist. Real connection test happens at original quest execution.

### 4.3 Exit
**Quest state:**
```json
{
  "title": "Prepare weapon for: BigQuery",
  "stage": "review",
  "inventory": {
    "setup_steps": ["Create a GCP service account...", ...],
    "weapon_created": "bigquery",
    "files_modified": ["libs/weapon/bigquery/index.js", "libs/weapon/registry.js"],
    "verification": { "exports_valid": true, "functions": ["executeQuery", "testConnection"] }
  }
}
```

**GAP:** `verifyWeapon()` does not exist. env_var access pattern for weapons is undefined. Weapon-crafting-guideline.md needs to specify the standard exports and credential access pattern.

---

## Stage 5: REVIEW (Blacksloth self-review)

### 5.1 Processing
**Function:** `libs/adventurer/index.js` → `selfReview(quest, adventurer)`  
For Blacksloth (NPC), this is code-defined, not system_prompt-based:
1. Check: does `weapon_created` exist in inventory? Yes.
2. Check: does `verification.exports_valid` === true? Yes.
3. Verdict: pass → stage → closing

**If failed:** Assign to Pig, comment: "Weapon forge failed: [details]"

**GAP:** `selfReview()` does not exist.

---

## Stage 6: CLOSING (Prepare weapon done → load next step)

### 6.1 Processing
**Function:** `libs/adventurer/index.js` or default skill book → `loadNextStep()`  
1. Pop `next_steps[0]` → `{ title: "Prepare skill book for: BigQuery", type: "prepare_skillbook" }`
2. Replace quest fields:
   - title → "Prepare skill book for: BigQuery"
   - description → "Create a skill book with actions that use the BigQuery weapon to query data"
   - deliverables → cleared
   - stage → assign
   - assignee_id → null
   - execution_plan → []
3. **Inventory is PRESERVED** — setup_steps, weapon_created stay available
4. Comment: "Loaded next step: Prepare skill book for: BigQuery"

**Quest state:**
```json
{
  "title": "Prepare skill book for: BigQuery",
  "stage": "assign",
  "assignee_id": null,
  "inventory": { "setup_steps": [...], "weapon_created": "bigquery", ... },
  "next_steps": [
    { "title": "Prepare adventurer for: BigQuery", "type": "prepare_adventurer" },
    { "title": "Fetch 20 latest events from BigQuery", "description": "...", "type": "original_quest" }
  ]
}
```

---

## Cycle 2: Prepare Skill Book (Wildrunes)

### Assign
Cat routes `type: prepare_skillbook` → Wildrunes

### Plan
Wildrunes reads `docs/skill-book-crafting-guideline.md`, sees weapon "bigquery" exists in inventory, plans:
```json
{
  "execution_plan": [
    { "action": "craftSkillBook", "input": { "weapon": "bigquery", "actions": ["fetchRecentEvents"] } }
  ]
}
```

### Execute: craftSkillBook
**Function:** `libs/npcs/wildrunes/index.js` → `craftSkillBook(quest, stepInput)`  
1. Read `docs/skill-book-crafting-guideline.md`
2. Build prompt for claudeCLI: create `libs/skill_book/bigquery/index.js` with action `fetchRecentEvents` that calls `libs/weapon/bigquery/executeQuery()`
3. Claude CLI writes the skill book, registers it in `libs/skill_book/index.js`
4. Returns `{ skill_book_created: "bigquery", actions: ["fetchRecentEvents"] }`

### Review → Closing → loadNextStep
Same pattern. Quest mutates to "Prepare adventurer for: BigQuery".

**GAP:** `craftSkillBook()` does not exist. `docs/skill-book-crafting-guideline.md` does not exist.

---

## Cycle 3: Prepare Adventurer (Pig)

### Assign
Cat routes `type: prepare_adventurer` → Pig

### Plan
Pig plans:
```json
{
  "execution_plan": [
    { "action": "recruitAdventurer", "input": { "domain": "bigquery", "skill_books": ["bigquery"], "weapon": "bigquery" } }
  ]
}
```

### Execute: recruitAdventurer
**Function:** `libs/npcs/guildmaster/recruit.js` → `recruitAdventurer(quest, stepInput)`  
1. AI generates system_prompt for the new adventurer based on domain + available skill books
2. Inserts row into adventurers table:
```json
{
  "name": "BigQuery Expert",
  "capabilities": "Queries Google BigQuery databases. Can fetch recent events, run custom SQL.",
  "skill_books": ["bigquery"],
  "system_prompt": "You are a BigQuery data specialist. When given a query task, use the bigquery skill book's fetchRecentEvents action. For custom queries, use executeQuery. Always validate that results are non-empty before reporting success.",
  "owner_id": "<user>"
}
```
3. Returns `{ adventurer_created: "BigQuery Expert", adventurer_id: "<uuid>" }`

### Review → Closing → loadNextStep
Quest mutates back to the original: "Fetch 20 latest events from BigQuery".

**GAP:** `recruitAdventurer()` does not exist. AI system_prompt generation for new adventurers is undefined.

---

## Cycle 4: Original Quest (BigQuery Expert)

### Assign
Cat scans roster → finds "BigQuery Expert" with matching capabilities → assigns.

### Plan
BigQuery Expert runs `draftExecutionPlan()`:
```json
{
  "execution_plan": [
    { "action": "fetchRecentEvents", "skillbook": "bigquery", "input": { "limit": 20 } }
  ]
}
```

### Execute
**Function:** `libs/skill_book/bigquery/index.js` → `fetchRecentEvents({ limit: 20 })`  
1. Calls `libs/weapon/bigquery/executeQuery("SELECT * FROM events ORDER BY timestamp DESC LIMIT 20")`
2. Weapon reads `profiles.env_vars.BIGQUERY_SERVICE_ACCOUNT_JSON`, authenticates, runs query
3. Returns `{ ok: true, items: { events: [...20 rows...] } }`

**QUESTION:** What if credentials aren't set up yet? The setup_steps were generated back in Cycle 1 but the user may not have done them.  
**Recommended:** The weapon's `executeQuery` throws a clear error ("BIGQUERY_SERVICE_ACCOUNT_JSON not found in env_vars"). Quest → review, assigned to Pig, comment: "Credentials not configured. Please complete setup steps." User sees it in the notification UI.

### Review
BigQuery Expert self-review: are there 20 events in inventory? Yes → closing.

### Closing
next_steps is empty → generate final report comment → quest complete.

**Final quest state:**
```json
{
  "title": "Fetch 20 latest events from BigQuery",
  "stage": "closing",
  "inventory": {
    "setup_steps": [...],
    "weapon_created": "bigquery",
    "skill_book_created": "bigquery",
    "adventurer_created": "BigQuery Expert",
    "events": [... 20 rows ...]
  },
  "next_steps": []
}
```

---

## Summary of all gaps

### Must build (blocking the trace)
1. `libs/npcs/questmaster/interpret.js` — clarity test + title/description refinement
2. `libs/npcs/questmaster/assign.js` — roster scan + preparation cascade + NPC type routing
3. `libs/npcs/blacksmith/index.js` — forgeWeapon (claudeCLI), verifyWeapon
4. `libs/npcs/wildrunes/index.js` — craftSkillBook (claudeCLI)
5. `libs/npcs/guildmaster/recruit.js` — recruitAdventurer (AI-generated system_prompt + DB insert)
6. `addNextSteps()` — prepend preparation steps to quest.next_steps
7. `loadNextStep()` — pop + replace quest fields + reset stage
8. `draftExecutionPlan()` — AI generates execution_plan from system_prompt + TOCs
9. `evaluateExecutionPlan()` — AI reality-checks plan against deliverables
10. `selfReview()` — check inventory against deliverables
11. `docs/weapon-crafting-guideline.md` — rules for how weapons must be structured
12. `docs/skill-book-crafting-guideline.md` — rules for how skill books must be structured
13. Stage order fix: idea → assign → plan → execute → review → closing
14. env_var access helper: `getEnvVar(userId, key)` reading from `profiles.env_vars`

### Must decide
15. NPC routing: hardcoded type-based routing or AI roster scan?
16. verifyWeapon: code-only check or connection test (requires credentials)?
17. Credential missing at execute time: auto-escalate to review or block with clear error?
18. Closing: user-manual or auto-close when next_steps is empty?

### Nice to have (not blocking)
19. Global notification UI for quests in review
20. Playwright-based automated test runner for verification
21. Video recording + Claude vision analysis for test reports
