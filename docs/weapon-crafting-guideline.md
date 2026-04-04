# Weapon Crafting Guideline

Reference document for the Blacksmith NPC (Flash Blacksloth). Used during the "Prepare weapon" quest lifecycle. Claude Code reads this document when invoked to forge weapons.

## Scope — what the Blacksmith does and does NOT do

The Blacksmith's ONLY job is to **create the weapon code** (the connector to the external system). The Blacksmith does NOT:
- Execute the original user request (e.g., "fetch 20 events from BigQuery")
- Create skill books (that's the Runesmith's job)
- Recruit adventurers (that's the Guildmaster's job)
- Run queries, fetch data, or produce business results

The "Prepare weapon" quest is one step in a preparation cascade. After this quest closes, the pipeline moves to "Prepare skill book", then "Prepare adventurer", and finally back to the original quest. Each step has its own owner.

When evaluating user responses during review, judge ONLY whether the user has done what the Blacksmith asked (e.g., set up credentials). Do NOT ask about the original quest's deliverables — those belong to later steps.

## What is a weapon?

A weapon is a protocol connector to exactly ONE external system — an API, MCP server, database, or third-party service. Weapons are the only code in GuildOS that makes outbound calls to external systems.

## GuildOS context you must know

- **Project:** Next.js 15 app, ES module syntax, no TypeScript. Root is the current working directory.
- **Database facade:** Always `import { database } from "@/libs/council/database"`, call `await database.init("server")` or `await database.init("service")` inside handlers. Variable must be named `db`.
- **Credentials:** Permanent keys live in `profiles.env_vars`, accessed via `council.getEnvVar(keyName)`. Temporary tokens live in the `potions` table, accessed via `loadPotion(kind)`.
- **Skill books** call weapon actions. A skill book at `libs/skill_book/<name>/index.js` imports weapon functions and wraps them with business logic.
- **Imports:** Use `@/` absolute imports. Remove unused imports. No wildcards.

## File rules (strictly enforced)

For each weapon, the Blacksmith is allowed to create or edit **exactly these files and no others:**

| # | File | Required? | Purpose |
|---|------|-----------|---------|
| 1 | `libs/weapon/<entityName>/index.js` | Yes | The weapon module. Connection logic, auth, action functions. |
| 2 | `app/api/<entityName>/route.js` | No (at most 1) | Only if the weapon needs a webhook endpoint or direct HTTP access. Imports from the weapon module, calls actions only. |

**The folder name `<entityName>` must be the lowercase name of the third-party entity** (e.g., `bigquery`, `slack`, `jira`, `zoho`), not a description of what it does (not `data-fetcher`, not `query-runner`).

**You may NOT create or edit:**
- Test files, config files, migration files
- Other weapon modules
- Skill book files (the Runesmith handles those separately)
- `package.json` (if a new npm dependency is needed, note it in the output — the user installs it)
- Any file outside the two listed above

## The 4 steps of "Prepare weapon"

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
   - A `toc` export: `{ actionName: { description, inputExample, outputExample } }`
   - Action functions that accept input objects and return `{ ok, msg, items }`
   - Auth handling: `const db = await database.init("service"); const { data } = await db.from("profiles").select("env_vars").eq("id", userId).single(); const key = data.env_vars.KEY_NAME;`
   - Error handling with clear messages

2. **`app/api/<weapon_name>/route.js`** (optional) containing:
   - Thin route handler importing from the weapon module
   - Proper Next.js 15 patterns: `await headers()`, `await cookies()`
   - Auth check via `requireUser()`

3. Registration entry for `libs/weapon/registry.js`

#### What claudeCLI must NOT do:

- Edit any file outside the weapon folder and its optional API route
- Install npm packages (note them in output for the user)
- Create database migrations
- Modify skill books (Runesmith's job)
- Modify existing weapons
- Use `createServerClient` or `createBrowserClient` directly (use the `database` facade)
- Hardcode `localhost:3000` (dev default is 3002)

**Output:** HTML report of files created/modified, stored in inventory as `forge_report`.

### Step 4: Closing

**Stage:** `closing`

If `next_steps` has more entries, `advanceToNextStep()` pops the next one (likely "Prepare skill book"). Otherwise, summarize what was forged in a comment and mark complete.

## Registration

After forging, the weapon must be registered in `libs/weapon/registry.js` with:
```javascript
{
  id: "<weapon_name>",
  title: "<Display Name>",
  tagline: "<one-line description>",
  description: ["<paragraph>"],
  requiresActivation: false,
}
```

This is part of the forge step (claudeCLI handles it).
