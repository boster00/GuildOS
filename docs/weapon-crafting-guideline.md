# Weapon Crafting Guideline

Reference document for the Blacksmith NPC (Flash Blacksloth). Used during the "Prepare weapon" quest lifecycle. Claude Code reads this document when invoked to forge weapons.

## Scope — what the Blacksmith does and does NOT do

The Blacksmith's ONLY job is to **create the weapon code and its testing infrastructure**. The Blacksmith does NOT:
- Execute the original user request (e.g., "fetch 20 events from BigQuery")
- Create skill books (that's the Runesmith's job)
- Recruit adventurers (that's the Guildmaster's job)
- Run queries, fetch data, or produce business results

The "Prepare weapon" quest is one step in a preparation cascade. After this quest closes, the pipeline moves to "Prepare skill book", then "Prepare adventurer", and finally back to the original quest. Each step has its own owner.

When evaluating user responses during review, judge ONLY whether the user has done what the Blacksmith asked (e.g., set up credentials). Do NOT ask about the original quest's deliverables — those belong to later steps.

---

## What is a weapon?

A weapon is a protocol connector to exactly ONE external system — an API, MCP server, database, or third-party service. Weapons are the only code in GuildOS that makes outbound calls to external systems.

---

## GuildOS context

General project rules (database facade, imports, dev port, etc.) are in `CLAUDE.md`. This section covers weapon-specific context only.

- **Credentials:** Permanent keys live in `profiles.env_vars`, accessed via `council.getEnvVar(keyName)`. Temporary tokens live in the `potions` table, accessed via `loadPotion(kind)`.
- **Skill books** call weapon actions. A skill book at `libs/skill_book/<name>/index.js` imports weapon functions and wraps them with business logic.

---

## File rules (strictly enforced)

### Steps 1–3 (Plan, Review, Forge): these files only

The Blacksmith may either **create a new weapon** (`libs/weapon/<entityName>/index.js`) or **extend an existing one** if GuildOS already has a connector for that service. Expansion is common when a system's auth is shared across products (e.g., adding CRM endpoints to an existing Zoho weapon). In that case, edit the existing `libs/weapon/<entityName>/index.js` and update its registry entry — do not create a new weapon file.

| # | File | Required? | Purpose |
|---|------|-----------|---------|
| 1 | `libs/weapon/<entityName>/index.js` | Yes | The weapon module. Create new, or extend existing if a connector for this service already exists. |
| 2 | `app/api/<entityName>/route.js` | No (at most 1) | Webhook endpoint or direct HTTP access. Thin handler only. |

### Steps 4–5 (Test page, Pigeon letters): additionally allowed

| # | File | Purpose |
|---|------|---------|
| 3 | `app/town/proving-grounds/weapons/<entityName>/page.js` | Server wrapper for weapon test page |
| 4 | `app/town/proving-grounds/weapons/<entityName>/WeaponTestClient.js` | Client component with all test UI |

`app/api/<entityName>/route.js` is also extended in step 4 to add a `checkCredentials` handler.

**The folder name `<entityName>` must be the lowercase name of the third-party entity** (e.g., `bigquery`, `slack`, `jira`, `zoho`), not a description of what it does.

**You may NEVER create or edit:**
- Test files, config files, migration files
- Other weapon modules
- Skill book files (the Runesmith handles those separately)
- `package.json` (if a new npm dependency is needed, note it in the output — the user installs it)
- Any file not listed in the tables above

---

## The 6 steps of "Prepare weapon"

### Step 1: Plan

**Stage:** `plan` | **Action:** `blacksmith.plan`

The Blacksmith reads this document, evaluates whether a weapon is needed, and produces a blueprint.

#### Plan prompt template

```
You are the Blacksmith, planning whether an external system connector (weapon) is needed.

Quest context:
{quest.description}

Evaluate:
1. Does this quest require connecting to an external system (API, database, MCP, third-party service)?
2. If yes, what system? What credentials or access setup is needed?
3. If no external connection is needed, this quest can be skipped.
4. What is the minimum viable set of actions needed now, and what common CRUD-like functions should also be included for completeness (even if not explicitly requested)?
5. **Trace the full input chain for the actual request:** identify the final action that delivers what the user asked for. List every input that action requires. For each input: can it be obtained programmatically (via another action on the same system, e.g. list/describe/search)? If yes, that discovery action MUST be included in `actions_to_implement`. If an input cannot be obtained programmatically AND is not an env var, set `requires_user_setup: true` and explain what the user must provide.

Respond with ONLY one JSON object:

If a weapon IS needed:
{
  "action": "forge",
  "weapon_name": "<lowercase name of the third-party entity, e.g. bigquery>",
  "external_system": "<what it connects to, e.g. Google BigQuery API>",
  "auth_type": "<env_var|potion|oauth|none>",
  "credentials_needed": "<specific key name and what it contains, e.g. BIGQUERY_SERVICE_ACCOUNT — JSON service account key>",
  "setup_steps": ["<step 1 for the user>", "<step 2>"],
  "requires_user_setup": true/false,
  "user_setup_reason": "<why user action is needed, or empty if not>",
  "actions_to_implement": ["<action1>", "<action2>"],
  "msg": "<brief rationale>"
}

If NO weapon is needed:
{
  "action": "skip",
  "msg": "<brief rationale why no external connection is required>"
}
```

**Output:** The result is stored in quest inventory as `blueprint`.

- If `action: "skip"` — the quest advances to closing (no weapon needed).
- If `action: "forge"` — the quest advances to review.

> **Gap note:** `actions_to_implement` should include the actions demanded by the quest description PLUS the basic common operations for the external system (e.g., for a database: read, write, update, delete, list). Niche/advanced functions are excluded and can be added in future quests.

---

### Step 2: Review

**Stage:** `review` | **Action:** `blacksmith.review`

The Blacksmith reads the `blueprint` from inventory and applies these criteria to decide whether user input is needed before forging.

#### Escalate to review (assign to Guildmaster/Pig) if ANY of these are true:

1. **Credentials not yet configured** — `blueprint.requires_user_setup` is true. The user must provide API keys, service account files, OAuth tokens, or other secrets before the weapon can function. The escalation comment must list:
   - Exactly what credential is needed (name, format)
   - Where to configure it: env_vars in Council Hall > Formulary, or potions in Town Square > Apothecary
   - Step-by-step setup instructions from `blueprint.setup_steps`

2. **Ambiguous external system** — `blueprint.weapon_name` or `blueprint.external_system` is empty or vague. The quest description doesn't clearly identify which specific API or service to connect to.

3. **No actions specified** — `blueprint.actions_to_implement` is empty. The Blacksmith can't forge a weapon without knowing what functions it needs.

4. **Paid API with cost implications** — the external system charges per request or has usage-based pricing. The user should approve before automated calls begin.

#### Proceed directly to forge if ALL of these are true:

1. The external system is clearly identified (`weapon_name` and `external_system` are non-empty)
2. Credentials are not needed (`auth_type: "none"`) OR `requires_user_setup` is false (credentials already configured)
3. At least one action is specified in `actions_to_implement`
4. No cost surprises for the user

**Output must include a `decision` field** to enable code-level triage:

- **Escalate:** `{ decision: "escalate", comment: "...", escalateReasons: [...] }` — the Blacksmith then calls `default.escalate({ questId, comment })` which sets stage to `review`, assigns to Pig, and posts the comment. The `escalate` action requires a non-empty `comment` explaining what the user needs to do.
- **Ready:** `{ decision: "ready", blueprint: {...} }` — proceed to execute/forge.
- **Skip:** `{ decision: "skip", msg: "..." }` — blueprint said no weapon needed, quest advances to closing.

The `decision` field is the triage key: downstream code switches on `"escalate" | "ready" | "skip"` to determine the next step.

---

### Step 3: Forge (Execute)

**Stage:** `execute` | **Action:** `blacksmith.forgeWeapon`

The Blacksmith reads the `blueprint` from inventory and invokes `claudeCLI` to write the weapon code.

#### What claudeCLI receives:

A prompt containing:
- The blueprint (weapon_name, external_system, auth_type, credentials_needed, actions_to_implement)
- The file rules from this document (exactly 2 files max, entityName convention)
- The GuildOS project context (Next.js 15, ES modules, database facade, credential access patterns)
- The TOC structure requirement for the weapon module

#### What claudeCLI must produce:

1. **`libs/weapon/<weapon_name>/index.js`** containing:
   - Exported functions that accept input objects and return results
   - Auth handling: `const db = await database.init("service"); const { data } = await db.from("profiles").select("env_vars").eq("id", userId).single(); const key = data.env_vars.KEY_NAME;`
   - Error handling with clear messages
   - Every action in `blueprint.actions_to_implement` must be implemented — no stubs

   **Naming rules:** Standard verbs only — see CLAUDE.md. Prefer multipurpose functions with parameters.

- **Discovery actions are mandatory:** if the primary action requires inputs like IDs or names that are not env vars, the weapon MUST include a discovery function (e.g., `search` with a datasets module before querying a specific table). Without discovery, the primary action is untestable.

2. **`app/api/<weapon_name>/route.js`** (create if any HTTP access is needed) containing:
   - Thin route handler importing from the weapon module
   - Auth check via `requireUser()`

3. Registration entry for `libs/weapon/registry.js`

#### What claudeCLI must NOT do:

- Edit any file outside the weapon folder and its optional API route
- Install npm packages (note them in output for the user)
- Create database migrations
- Modify skill books (Runesmith's job)
- Modify existing weapons (unless expanding an existing weapon for the same service)
- Use `createServerClient` or `createBrowserClient` directly (use the `database` facade)
- Hardcode `localhost:3000` (dev default is 3002)
- Leave any action in `actions_to_implement` unimplemented

**Output:** HTML report of files created/modified, stored in inventory as `forge_report`.

---

### Step 4: Create the testing page

**Stage:** `execute` (second pass) | **Action:** `blacksmith.createTestPage`

After the weapon code is forged, the Blacksmith creates a dedicated test page at `/town/proving-grounds/weapons/<weaponName>` with UI to manually verify every capability — and to serve as a target for Browserclaw pigeon letters.

#### What claudeCLI receives:

- The `blueprint` from inventory (weapon_name, actions_to_implement, credentials_needed, auth_type)
- The `forge_report` from inventory (which actions were actually implemented)
- The file rules for this step (files 3 and 4 from the table above, plus the existing route.js)
- The element ID conventions below

#### What claudeCLI must produce:

##### 4.1 — Credential check section

A self-check section at the top of the test page that verifies credentials exist without making external calls.

- Heading: "Credentials"
- A "Check credentials" button: `id="<weaponName>-cred-check-btn"`
- A result container: `id="<weaponName>-cred-check-result"` — renders clearly as **PASS** (green) or **FAIL** (red) + a plain-English message
- Calls `GET /api/<weaponName>?action=checkCredentials`

`app/api/<weaponName>/route.js` must be extended with a `checkCredentials` handler that:
- Reads the credential from storage (env_vars or potions, matching `blueprint.auth_type`)
- Returns `{ ok: true, msg: "Credential found (KEY_NAME set)" }` or `{ ok: false, msg: "Missing KEY_NAME — see setup steps" }`
- Makes NO external network call

##### 4.2 — Hello world (basic connection test)

A minimal end-to-end test proving the weapon reaches the external system.

- Heading: "Basic connection"
- A description of what the test does and what success looks like
- A pre-filled demo payload shown in a code block or read-only textarea
- A "Test connection" button: `id="<weaponName>-hello-btn"`
- A result container: `id="<weaponName>-hello-result"` — PASS/FAIL badge + returned data
- Uses the simplest read-only action from `actions_to_implement` (e.g., list, ping, or describe)
- Calls `POST /api/<weaponName>` with the demo payload

##### 4.3 — Capability tests (one per implemented action)

One collapsible section per action in `forge_report.actions_implemented`.

For each action:
- A heading: the action name + one-sentence description
- A pre-filled realistic demo payload (textarea, editable)
- A "Test <actionName>" button: `id="<weaponName>-<actionName>-btn"`
- A result container: `id="<weaponName>-<actionName>-result"` — PASS/FAIL + response data (truncated if long, with a "show full" toggle)
- Calls `POST /api/<weaponName>?action=<actionName>` with the payload

The scope must cover:
- All actions demanded by the quest description
- The common operations for this external system (e.g., for an API: list, get, create, update, delete, search)
- Niche/advanced functions are explicitly excluded — add a note "Advanced functions can be added in a future quest"

##### 4.4 — End-to-end test (the actual request)

A dedicated section that runs the full chain to deliver exactly what the user asked for. If the primary action needs inputs (IDs, names, etc.) that must be discovered:
- Run the discovery action automatically on page load or via a "Discover" button
- Populate the primary action's inputs from the discovery result
- Execute the primary action and show the result

This section must be automatable by Browserclaw without human input. If that is impossible, add a visible note explaining what must be provided and why.

Button ID: `<weaponName>-e2e-btn` | Result ID: `<weaponName>-e2e-result`

#### Element ID conventions (required — used by Browserclaw pigeon letters)

| Element | ID pattern |
|---|---|
| Credential check button | `<weaponName>-cred-check-btn` |
| Credential check result | `<weaponName>-cred-check-result` |
| Hello world button | `<weaponName>-hello-btn` |
| Hello world result | `<weaponName>-hello-result` |
| Capability test button | `<weaponName>-<actionName>-btn` |
| Capability test result | `<weaponName>-<actionName>-result` |

> **Gap note:** If credentials are missing, the FAIL result in 4.1 must include the specific setup instructions (what key is needed and where to add it) so a user reading the Browserclaw output knows exactly what to do without consulting other docs.

**Output:** JSON summary of test sections and element IDs created, stored in inventory as `test_page_report`:
```json
{
  "testPageUrl": "/town/proving-grounds/weapons/<weaponName>",
  "sections": [
    { "id": "cred-check", "btnId": "<weaponName>-cred-check-btn", "resultId": "<weaponName>-cred-check-result" },
    { "id": "hello",      "btnId": "<weaponName>-hello-btn",       "resultId": "<weaponName>-hello-result" },
    { "id": "<actionName>", "btnId": "<weaponName>-<actionName>-btn", "resultId": "<weaponName>-<actionName>-result" }
  ]
}
```

---

### Step 5: Draft the pigeon letters

**Stage:** `execute` (third pass) | **Action:** `blacksmith.draftPigeonLetters`

The Blacksmith reads the `test_page_report` and drafts one pigeon letter per test section. Each letter drives Browserclaw to the test page, clicks the test button, waits for the result, and reads it back. The letters are stored in quest inventory so the Guildmaster can insert them via the Pigeon Letter Test page.

#### What claudeCLI receives:

- The `blueprint` and `test_page_report` from inventory
- The Browserclaw action reference (navigate, wait, click, get, getUrl)
- The base URL pattern: `{BASE_URL}` (resolves at runtime from Browserclaw settings, default `http://localhost:3002`)

#### Letter structure

Each letter is a `steps` array. Every step uses the new action vocabulary:

| Action | Used for |
|---|---|
| `navigate` | Go to the test page URL |
| `wait` | Wait N seconds, then optionally wait for a selector to appear (combined) |
| `click` | Click a test button by its ID |
| `get` | Read a result container by its ID |
| `getUrl` | Confirm the page URL if needed |

#### Letters to draft

**Letter 1 — Check credentials**
```json
{
  "name": "Check <WeaponName> credentials",
  "description": "Navigates to the <weaponName> test page, triggers the credential check, and returns the PASS/FAIL result.",
  "channel": "browserclaw",
  "steps": [
    { "action": "navigate", "url": "{BASE_URL}/town/proving-grounds/weapons/<weaponName>" },
    { "action": "wait", "seconds": 1, "selector": "#<weaponName>-cred-check-btn" },
    { "action": "click", "selector": "#<weaponName>-cred-check-btn" },
    { "action": "wait", "seconds": 3, "selector": "#<weaponName>-cred-check-result" },
    { "action": "get", "selector": "#<weaponName>-cred-check-result", "item": "credCheckResult" }
  ]
}
```

**Letter 2 — Hello world**
```json
{
  "name": "Test <WeaponName> basic connection",
  "description": "Runs the hello world connection test for <weaponName> and returns the result.",
  "channel": "browserclaw",
  "steps": [
    { "action": "navigate", "url": "{BASE_URL}/town/proving-grounds/weapons/<weaponName>" },
    { "action": "wait", "seconds": 1, "selector": "#<weaponName>-hello-btn" },
    { "action": "click", "selector": "#<weaponName>-hello-btn" },
    { "action": "wait", "seconds": 8, "selector": "#<weaponName>-hello-result" },
    { "action": "get", "selector": "#<weaponName>-hello-result", "item": "helloResult" }
  ]
}
```

**Letter E — End-to-end (the actual request)**

Before drafting individual capability letters, draft one letter that executes the full chain from discovery to the primary action, delivering exactly what the user's quest asked for. This letter must:
- Run any required discovery steps first (e.g., `listDatasets` → extract dataset ID, `listTables` → extract table name)
- Pass discovered values into the target action (use `typeText` to fill inputs on the test page, or chain results directly if the API route accepts them)
- Read the final result container and store it as `endToEndResult`

If the end-to-end letter cannot be automated (e.g., the user must manually choose which table to query), note this explicitly in the `pigeon_letters_draft` as a `"requiresHumanInput": true` entry, and list exactly what the user must supply before the letter can run.

**Letters 3–N — One per capability**
```json
{
  "name": "Test <WeaponName> <actionName>",
  "description": "Runs the <actionName> capability test for <weaponName> and returns the result.",
  "channel": "browserclaw",
  "steps": [
    { "action": "navigate", "url": "{BASE_URL}/town/proving-grounds/weapons/<weaponName>" },
    { "action": "wait", "seconds": 1, "selector": "#<weaponName>-<actionName>-btn" },
    { "action": "click", "selector": "#<weaponName>-<actionName>-btn" },
    { "action": "wait", "seconds": 8, "selector": "#<weaponName>-<actionName>-result" },
    { "action": "get", "selector": "#<weaponName>-<actionName>-result", "item": "<actionName>Result" }
  ]
}
```

> **Wait times:** Credential check: 3s. Read-only actions: 5–8s. Write/mutate actions: 8–15s. Set the `seconds` in the final `wait` step conservatively — the selector wait will short-circuit as soon as the result appears.

#### Storage format

Stored in quest inventory as `pigeon_letters_draft` — an array ready to paste into the Pigeon Letter Test page at `/town/proving-grounds/browserclaw-test`:

```json
{
  "pigeon_letters_draft": [
    {
      "name": "Check <WeaponName> credentials",
      "description": "...",
      "channel": "browserclaw",
      "steps": [ ... ]
    },
    ...
  ]
}
```

The Guildmaster or user inserts these via the Pigeon Letter Test page, selecting the "Prepare weapon" quest as the associated quest. Once inserted, the Browserclaw settings page shows them as pending steps to execute.

> **Gap note:** The `{BASE_URL}` placeholder must be replaced with the actual configured URL before inserting. In development this is `http://localhost:3002`. The Guildmaster should substitute this automatically based on the user's environment at insert time.

**Output:** The `pigeon_letters_draft` JSON, stored in quest inventory.

---

### Step 6: Closing

**Stage:** `closing`

Before marking complete, the Blacksmith checks:
1. `forge_report` exists — weapon code was forged
2. `test_page_report` exists — test page was created
3. `pigeon_letters_draft` exists — pigeon letters are ready for the user to insert

If any are missing, the Blacksmith notes it in the closing comment. Otherwise:

If `next_steps` has more entries, `advanceToNextStep()` pops the next one (likely "Prepare skill book"). Otherwise, summarize what was forged in a comment and mark complete.

**Closing comment template:**
```
Weapon <weaponName> is ready.

Forged: <list of actions implemented>
Test page: /town/proving-grounds/weapons/<weaponName>
Pigeon letters: <count> letters drafted and stored in inventory.

Next: insert the pigeon letters via the Pigeon Letter Test page and run them with Browserclaw to verify the weapon before building the skill book.
```

---

## Registration

After forging (step 3), the weapon must be registered in `libs/weapon/registry.js` with:
```javascript
{
  id: "<weapon_name>",
  title: "<Display Name>",
  tagline: "<one-line description>",
  description: ["<paragraph>"],
  testPageUrl: "/town/proving-grounds/weapons/<weapon_name>",
  requiresActivation: false,
}
```

The `testPageUrl` field is added in step 4 (after the test page exists). The claudeCLI in step 4 must update the registry entry to add this field.

---

## Quick reference — action vocabulary for pigeon letters

| Action | Key params | Purpose |
|---|---|---|
| `navigate` | `url` | Go to a URL |
| `wait` | `seconds`, `selector` (optional) | Wait N seconds then poll for selector |
| `click` | `selector` | Full pointer+mouse click sequence |
| `get` | `selector`, `item`, `attribute` (optional), `getAll` (optional) | Read element value |
| `typeText` | `selector`, `text`, `clearContent` (default true) | Type into an input |
| `pressKey` | `selector` (optional), `key` | Send keyboard event |
| `getUrl` | `item` | Capture current tab URL |

Every step with an `item` field contributes to the result delivered to GuildOS. Steps without `item` (navigate, click, wait) run their action but deliver nothing.

See `docs/pigeon-letter-drafting-guide.md` for full parameter tables and examples.
