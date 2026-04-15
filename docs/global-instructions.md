# GuildOS — Global Instructions for Adventurers

You are an adventurer in GuildOS, a fantasy-themed AI agent orchestration platform. This document is your orientation — read it fully at session start.

---

## Core Entities

| Term | What it is | Where it lives |
|------|-----------|----------------|
| **Quest** | A unit of work with stages | `quests` table |
| **Adventurer** | You — an AI agent mapped to a live compute session | `adventurers` table |
| **Weapon** | External service connector (API/SDK wrapper) | `libs/weapon/<name>/index.js` |
| **Skill Book** | Knowledge registry — tactical instructions for specific domains | `libs/skill_book/<name>/` |
| **Inventory** | Quest state storage — artifacts, results, screenshots | `quests.inventory` (JSONB) |
| **Pigeon Post** | Async job queue for background tasks | `pigeon_letters` table |
| **Potions** | Temporary auth tokens (OAuth) | `potions` table |

---

## Quest Lifecycle

Stages: `idea → assign → plan → execute → review → closing → completed`

**Your responsibilities as an adventurer:**
1. Pick up quests assigned to you in `execute` stage (work through them one at a time)
2. Read quest description, inventory, and comments to understand context
3. Do the work — use weapons, skill books, and your own capabilities
4. Take screenshots proving your work is done
5. Run Claude CLI to self-review screenshots before submitting
6. Call `submit_results` API to deliver artifacts and advance to review

**Stage advancement:** You advance stages by calling the GuildOS API. Instructions:
- When done with execute: call `POST /api/quest?action=submit_results` with your results
- The Questmaster will review in the review stage

---

## Using Weapons

Weapons are JS modules that connect to external services. Import and call them directly:

```javascript
// In a Node.js script (use npx tsx for @/ alias resolution):
import { searchBooks } from '@/libs/weapon/zoho';
const orders = await searchBooks('salesorders', 5, userId);

// Or with relative paths:
import { searchMessages } from './libs/weapon/gmail/index.js';
```

**@/ alias:** Only works in Next.js. For standalone scripts, use `npx tsx` with the project's `tsconfig.json` paths, or use relative imports.

**Auth:** Weapons handle authentication internally. They read credentials from:
- `profiles.env_vars` — permanent API keys
- `potions` table — temporary OAuth tokens (auto-refreshed)

You need a `userId` to pass to most weapon functions. Query the `profiles` table if you don't have one.

### Available Weapons

| Weapon | Service | Key actions |
|--------|---------|-------------|
| `zoho` | Zoho Books + CRM | `searchBooks`, `searchCrm` |
| `gmail` | Gmail REST API | `searchMessages`, `readMessage`, `starMessages` |
| `asana` | Asana | `searchTasks`, `readTask`, `writeTask` |
| `cursor` | Cursor Cloud Agents | `readAgent`, `writeFollowup`, `readConversation` |
| `figma` | Figma | `readFile`, `readNodes`, `searchProjects` |
| `supabase_storage` | Supabase Storage | `writeFile`, `readFile`, `readPublicUrl` |
| `browserclaw` | Chrome CDP | `executeSteps`, `ensureCdpChrome` |
| `bigquery` | Google BigQuery | `query` |
| `ssh` | SSH remote machines | `executeCommand`, `readRemoteFile` |
| `vercel` | Vercel | projects, deployments, domains |
| `claudecli` | Claude Code CLI | `executeTask` |

---

## Using Skill Books

Skill books are knowledge registries — they describe HOW to accomplish specific tasks. Check the relevant skill book before starting work:

1. Read the skill book's table of contents to find relevant actions
2. Follow the instructions for each action (weapon imports, parameters, workflow)
3. Skill books may contain domain-specific rules and gotchas

Skill books live in `libs/skill_book/<name>/`. Each has a `skillBook` definition with a `toc` (table of contents) describing available actions.

To discover all available skill books, query: `SELECT DISTINCT unnest(skill_books) FROM adventurers`

---

## Submitting Results

When your work is complete:

1. **Take screenshots** proving the feature/task works
2. **Self-review:** Run Claude CLI to verify your screenshots show success:
   ```bash
   claude -p "Review these screenshots and confirm the task is complete: <description>"
   ```
3. **Upload artifacts** to Supabase Storage:
   ```javascript
   import { writeFile, readPublicUrl } from '@/libs/weapon/supabase_storage';
   await writeFile({ bucket: 'GuildOS_Bucket', path: 'cursor_cloud/<questId>/screenshot.png', file: buffer });
   const { url } = await readPublicUrl({ bucket: 'GuildOS_Bucket', path: '...' });
   ```
4. **Submit results** via API:
   ```
   POST /api/quest?action=submit_results
   {
     "questId": "<quest-id>",
     "adventurerId": "<your-adventurer-id>",
     "dispatchToken": "<token-from-dispatch>",
     "type": "execute",
     "summary": "Description of what was done",
     "artifacts": [
       { "key": "screenshot_1", "url": "https://...", "description": "what it shows" }
     ]
   }
   ```

---

## Database Access

Use Supabase with the service role key:

```javascript
import { createClient } from '@supabase/supabase-js';
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRETE_KEY);
```

Key tables: `quests`, `adventurers`, `profiles`, `potions`, `pigeon_letters`

---

## Action Naming Convention

Use these six verbs only: `read`, `write`, `delete`, `search`, `transform`, `normalize`. Do not use synonyms (get, fetch, list, find, create, update).

---

## Escalation

If you cannot complete a task:
1. Add a comment to the quest explaining what's blocking you
2. Include what you tried and why it failed
3. The system will escalate to the Questmaster or user

---

## How to Communicate with Adventurers

When dispatching tasks to adventurers (Cursor cloud agents), use **natural language**, not scripts. Describe WHAT to do and the success criteria — the agent decides HOW.

**Good:** "Navigate to the Inn upstairs page and take a screenshot showing the adventurer cards with their avatars"
**Bad:** "Write a Playwright script that does chromium.launch({...}) then page.goto(...) then page.screenshot({...})"

The agent has its own tools and preferred workflows. Prescribing implementation details causes friction and failures. Just describe the goal.

### Common pitfalls when working with Cursor agents

1. **Don't use Playwright for authenticated pages** — Playwright opens a fresh browser without login cookies. Pages behind auth will redirect to /signin. Instead, tell the agent to use the native Chrome browser that's already logged in on the desktop (DISPLAY=:1).

2. **Secret scanner redaction** — The Cursor repo has a secret scanner that corrupts strings containing package names or API keys. Don't ask agents to write scripts with Supabase client code inline. Instead, have them save files to the repo and push, then handle uploads from the manager side.

3. **Always ask the agent to self-check** — After taking screenshots or producing artifacts, tell the agent to look at them and verify they show what's expected (not blank, not a sign-in page, not an error page). Then double-check yourself before presenting to the user.

4. **Stop and redirect** — If the agent is going down a wrong path (e.g., fighting the secret scanner for 10 minutes), send a followup message telling it to stop and try a different approach. Don't let it spin.

## Environment

- **Node.js** 22.x, **npm** 10.x
- **Next.js** 15.x with React 19, Turbopack (port 3002)
- **Chrome** available for headed browsing (use Playwright)
- **Claude CLI** available as subprocess for code review
- **Git** — always push your changes when done
