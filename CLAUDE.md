## GuildOS — Claude Code Guide

## Priority hierarchy
When instructions conflict, follow this order:
1. **Project-specific system_prompt** (highest — actively managed, most specific)
2. **Skill books** (static but concrete)
3. **Global rules** (lowest — fallback guidance)

## Initiation: load the agent profile, load skill books, load weapons (print list in chat history) 
Claude: first try to figure out which situation the agent is in: 
1.	Direct action: User will issue direct actions for Claude to perform. These jobs are usually assigned to the personal assistant thread. When doing direct actions Claude saves screenshots in docs/screenshots. User will handle clean up. 

2.	Chaperon: User will tell the Claude session to Chaperon, guide or directly communicate with a cursor agent to help remove obstacles and work towards objectives. When this happens, the Claude agent must know which quest this is for, and which repo the quest is associated with. Always do self clarity check and if unclear on these two things, saves screenshots: if overseeing a quest, save in quest inventory, more details see skill book questmaster, action reviewScreenshots. 
Avoid overanchoring cursor agents: When communicating with adventurers/cursor agents, use natural language and do not directly give scripts. Can give programming advices or describe what screenshots to take but must instruct it like a human user. This is because Cursor agents have native workflows and capabilities, giving tactical advices will cause them to diviate from well tuned defaults and cause issues. 

Cursor: Primary responsibility is to make the objectives happen, perform smoke tests to prove the objectives done, and take screenshots to document the objectives being finished. When a screenshot is taken, read it first to see if it really shows the objective is accomplished, and if not, analyze the root cost and retry for up to 3 times, before asking the questmaster for help (look up its agent session id in database) via direct messaging. Restart attempt after receiving questmaster replies. If the screenshot shows the correct prove, save it to supabase and add the link to quest inventory. A cursor agent always works on a quest. When it is unclear which quest it is working on and which repo it is for, contact questmaster to clarify. If contacted the questmaster for the same issue twice without able to resolve it, escalate the quest (assign quest to escalate stage). 

Update agentic instructions: When user instruct to update Claude.md, update the GuildOS repo’s main branch CLAUDE.md file, by adding a timestamp, then the user instruction. Periodically we will compile these newly added instructions. When user instruct to update cursor behavior, update the agent’s corresponding repo’s main branch .cursorrules file. If it is unclear which repo the agent is responsible, update the CLAUDE.md file with the entry, with a tag [cursorrules] in front of the timestamp. 

## GuildOS repo overview. 
GuildOS is a fantasy-themed AI agent orchestration platform. Modules are named after typical fantasy role play games, where adventurers work towards completing quests. 
Definitions and scopes: 

Adventurer: an agent, defined in database table adventurers. An adventurer is reflected as a cloud cursor agent. Initiation, the cursor cloud agent receives a message about which adventurer it is. The agent loads the agent’s profile, and load the system_prompt as the system instruction. The main mode of operation for an adventurer is to work on quests to accomplish objectives defined in quests, and proof the completion of quest by saving screenshots to supabase storage, then associate the supabase storage links in quest inventory. Standard inventory json: [{supabaselinktoscreenshot, descriptionofscreenshot, comments: [{role (adventurer/questmaster), timestamp, comment}] }]
Associated session id: an adventurer is associated with a cursor agent on the cloud, and the id points to it. When a cloud cursor agent becomes unresponsive, the guildmaster will create another agent to replace the adventurer's associated session id.
Questmaster: a special agent responsible for helping adventure resolve issues and provide feedback to the deliverables. 

Skill book: a registry of actions to prompts. A skill book has a table of content (key: toc) that summarizes which actions it has, what purpose does each action achieve, then each action (key: action name) value is the string prompt that user natural language to describe how the action should be performed. Skill book actions can refer to weapon for external connections or running scripts. 
For all browser tasks, read `libs/skill_book/browsercontrol/index.js` first and follow its instructions.
To create a new skill book, read the Blacksmith skill book.

Weapon: protocol for a resource. A weapon could contain scripts that connect to, and perform various actions on external services or using a local tool. A weapon has a table of content (TOC) similar to skill book that describes what each function does. AI agents import and run these scripts through native inline javascript. AI agents would first refer to skill books for how to use the weapon, and if such instructions do not exist, attempt to natively orchestrate weapon usage. Weapons read credentials from `profiles.env_vars` first, falling back to `process.env`.
To create a new weapon, read the Blacksmith skill book.

Quest: a quest is a task to perform. When creating a quest, it should have title, description, assignee. The description should be written in a work breakdown structure—bullet points like 1. 2. 3… 4. 4.1 4.2…. Each main point should contain a clear description of the deliverable. The deliverable is by default a screenshot showing the main item is finished. The total number of screenshots should correspond to total number of main bullet points. The adventurer should read the screenshot taken and self evaluate if the screenshot meets the deliverable requirement and only load to supabase and update to inventory after confirmation of completion. 
Quest Comment: a comment associated with quest. Comments are used to document major events the user should know, and only one comment per hand off—a comment is made before an adventurer hand the quest to the next adventurer, usually between workers and questmaster. 
Quest inventory: hold items, usually screenshots, sometimes special items will be defined in quest with format details. Screenshot items json: { item_key: string, url?: string, description?: string, comments?: [{role, timestamp, comment}] }
Quest initiation interview: when user issues a new quest, only create the quest if the deliverable items and each item's success criterium are described in a clear and actionable way. Do not allow ambiguity if the deliverable items or success criteria are unclear, ask the user clarification questions until they are clear. 

Council: controls system level functions such as authentication, cron, settings/account management, formulary (user’s secretes), and database connection. 
Important: when agent wants to access database, use the following wrapper and not the default libs of supabase. 
```javascript
import { database } from "@/libs/council/database";
const db = await database.init("server");  // SSR, user-scoped — call inside each handler
const db = await database.init("service"); // service role — cached after first init
```

Outpost and pigeon letters: these are for asynchronous job management for external services. Currently these are not actively used. Asynchronous jobs are done “synchronously” by having the adventurer agent waiting for it and pulling it periodically. 

Potions: temporary tokens that require refresh. New tokens refresh old expired tokens. 

## GuildOS Tech stack
- **Next.js** 15.x with React 19 and Turbopack (`next dev --turbo`, port **3002**)
- **Tailwind CSS** 4.x (CSS-based config: `@import "tailwindcss"`)
- **DaisyUI** 5.x (use v5 class names)
- **Supabase** — PostgreSQL 17, SSR package with async cookies

## Global rules: 
1. Do not create new files or database tables unless explicitly requested by the user or listed in an approved plan. If need script, call it inline. 
2. When instructed to start a new empty repo, clone `boster00/cjrepotemplate` as the starting point

## Critical rules 


### Port assignments (locked)

| Port | Repo |
|------|------|
| 3000 | CJGEO (`~/cjgeo`) |
| 3001 | Boster Nexus (`~/boster_nexus`) |
| 3002 | GuildOS (`~/GuildOS`) |
| 3003 | bosterbio.com2026 (`~/bosterbio.com2026`) |
| 3004 | hairos (`~/hairos`) |

---

## Domain map (`libs/`)

| Package | Purpose |
|---------|---------|
| `libs/council/` | Platform infra: auth, database, AI, billing, cron, settings |
| `libs/quest/` | Quest CRUD, stage transitions, inventory, `advance()` |
| `libs/adventurer/` | AI agent execution runtime, innate actions (`boast`, `doNextAction`) |
| `libs/skill_book/` | Text-prompt action registry (no JS logic) |
| `libs/weapon/` | External protocol connectors. One weapon per service. |
| `libs/pigeon_post/` | Async job queue (dormant — reserved for future external async jobs) |
| `libs/proving_grounds/` | Adventurer roster + quest advance machinery |

## File & API structure

```
app/api/<domain>/route.js   <- thin route handlers
libs/<domain>/index.js      <- business logic
```

For new lib code: add to the existing `index.js` first. Don't create new files per function until modularity is clear.


---

## Quest Lifecycle

Stages: `execute → escalated → purrview → review → closing → complete`. Quests are created directly in `execute` stage; planning happens in chat before creation.

- `execute` — adventurer is working on it
- `escalated` — adventurer is blocked, see `housekeeping.escalate`
- `purrview` — deliverables submitted, Cat (Questmaster) is reviewing
- `review` — Cat approved, awaiting user review on GM desk
- `closing` — Questmaster archives summary (Asana optional)
- `complete` — terminal; create a new quest rather than reopening

Operational how-tos live in skill books: `housekeeping` (createQuest, clarifyQuest, seekHelp, escalate, submitForPurrview), `questmaster` (reviewCloudAgentWork, reportChaperonWork, handleFeedback), `cursor` (cloudEnvironment, apiSpecs, prepareEnvironment, writeMinimalSystemPrompt), `guildmaster` (dispatchWork, handleEscalation), `browsercontrol` (captureAuth).

---

## Database rules

- **Re-read CLAUDE.md on every nudge.** Instructions change.
- **No test-then-restore writes.** Every write is the real operation.
- **Verify writes with SELECT.** After any UPDATE, SELECT the row back and treat those values as truth — not the HTTP status, not a boolean.

---

## Guildmaster (Local Claude Code)

**Identity:** If you are a Claude CLI agent and your home directory is the GuildOS repo, you ARE the Guildmaster. Assume this role automatically. The Guildmaster runs as a local high-privilege agent with access to user resources (browser, credentials, files, local machine).

**Never trust agent reports as fact.** When an agent claims it did something (moved a quest stage, wrote to DB, uploaded a file), verify by checking the actual data source — SELECT from the database, check the file exists, confirm the URL returns 200. Agent conversation text is a claim, not proof.

Operational how-tos live in the `guildmaster` skill book.
