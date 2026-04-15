# GuildOS Refactor Notes

## Date Started: 2026-04-14
## Last Updated: 2026-04-15

## Why

AI agents are far more capable than initially assumed. The current GuildOS architecture — skill books defining modular actions orchestrated by one-shot AI calls — is fundamentally **script-driven**. It doesn't support the **iterative, back-and-forth process** that real productivity requires.

**Old paradigm:** Script/skill-book-driven action execution, one-shot AI orchestration
**New paradigm:** Manager-worker agent hierarchy, iterative natural language dispatch, review-and-nudge loops

## Knowhow Layers (confirmed)

1. **Global** → `docs/global-instructions.md` — universal rules for all adventurers
2. **Strategic** → `adventurers.system_prompt` — project identity, conventions, workflow patterns
3. **Tactical** → skill books — action-level instructions (how to do specific things)

Separation rule: system_prompt handles **how to work**, quest handles **what to do**.

## Workflow Mapping

### Adventurers → Live Worker Agents (confirmed, implemented)
Each adventurer maps to a live Cursor VM session. DB has `session_id`, `worker_type`, `session_status`.

### Quest Stages (UPDATED 2026-04-15)

~~Old: `idea → assign → plan → execute → escalated → review → closing → completed`~~

**New: `execute → escalated → review → closing → complete`**

- **idea and plan stages removed.** Ideas live in external systems (Asana). Planning happens in user chat with the agent. Once planned, quest is created directly in `execute`.
- **Quest creation flow:** User chats with agent → agent presents WBS plan → user iterates until satisfied → agent creates quest in `execute` stage.

### Priority Field (NEW)
Quests have a priority field. When nudged, agent works on highest-priority active quest first.

### Questmaster → Separate Cursor Agent (UPDATED)

~~Previous: Questmaster = NPC Cat with code-defined behavior, or local Claude Code~~

**New: Questmaster is a dedicated Cursor cloud agent.** Has Claude CLI installed for second opinions. Responsibilities:
1. **approveOrEscalate** — When agents seek help, first ask "do you have what you need to proceed?" before providing assistance
2. **reviewSubmission** — Validate deliverables against quest description (screenshots by default). Use Claude CLI for complex judgment. Don't settle until 90% satisfied.
3. **getSecondOpinion** — Launch Claude CLI for independent evaluation

### Guildmaster (Pig) → Local Claude Code (ADJUSTED)
Still the local Claude Code session. But the Questmaster (separate Cursor agent) now handles routine approvals and reviews. Guildmaster focuses on obstacle removal that requires local machine access.

### Comment System (NEW detail)
Comments are responsible for:
1. Reporting major milestone completion
2. Escalating problems
3. NOT for every small update — only significant events

**Comment summarization:** When a quest has >10 comments, keep latest 4 and summarize the rest into the 5th comment. Prevents comment flooding.

## Skill Books (UPDATED 2026-04-15)

### housekeeping (NEW — shared by all adventurers)
| Action | Description |
|--------|-------------|
| `initAgent` | Read global instructions, read agent system_prompt, read all registered skill books |
| `comment` | Post a comment to a quest |
| `escalate` | Move quest to escalated stage with blocker description |
| `presentPlan` | Present WBS-format plan (1, 1.1, 1.2, 2...) with clear deliverables and measurement criteria |
| `createQuest` | Create a quest in execute stage after user approves the plan |
| `seekHelp` | Contact the questmaster for approval or assistance |
| `getActiveQuests` | List all non-complete quests. If >10 comments, trigger summarizeComments |
| `summarizeComments` | Keep latest 4 comments, summarize rest into 5th comment |

### questmaster (REWRITTEN — for Questmaster Cursor agent)
| Action | Description |
|--------|-------------|
| `approveOrEscalate` | When agent seeks help: first ask if it has what it needs. If yes → proceed. If not → help or escalate |
| `reviewSubmission` | Validate deliverables (screenshots default) against quest description. 90% bar. Claude CLI for complex judgment |
| `getSecondOpinion` | Launch Claude CLI for independent evaluation of submission |

## Global Instructions (UPDATED 2026-04-15)

Add to global-instructions.md:
- **Quest creation:** During chat, after user describes task, present plan first, iterate, then create quest upon approval
- **Quest clarification:** When instructions are ambiguous, look up agent's current quests and ask user which one or if new
- **Seeking help:** Contact questmaster agent, identify yourself, state quest and what you need. Follow its instructions.

## Cron (UPDATED 2026-04-15)

1. **Roll call:** Poll all live Cursor agents → update adventurer status. Cross-reference with quest stages to derive: idle, busy, confused, ailing.
2. **Nudge confused:** For agents with active quests but not busy: "If previous quest is undone, keep doing it. If done, use getActiveQuests to check which quest is alive and work on them by priority."

NPC-driven advanceQuest is kept for closing stage only (Asana archival). All other stages are agent-driven.

## Agent Initiation (NEW)

Separate from agent creation. Initiation:
1. Tell the agent which adventurer it represents
2. Fetch the adventurer profile (system_prompt, skill_books)
3. Send global instructions + system_prompt + skill book content
4. Agent stores context and is ready to work

Can be re-run to refresh context or repurpose an agent for a different project.
Agent creation remains manual for now; later becomes a Guildmaster capability.

## Cross-Cutting Contracts (UPDATED)

- **Assignment:** `quests.assignee_id` is canonical.
- **No conversation parsing:** Agents use skill book actions (comment, escalate, submit) to communicate formally.
- **Session bootstrap mandatory** before first dispatch (initAgent action).
- **Dispatch token:** ~~Every dispatch generates a UUID token~~ **REMOVED for now** — adds complexity without proven need. Can add back if double-processing becomes an issue.
- **Fallback:** ~~Claude CLI fallback when no session~~ **REMOVED** — all execution goes through live sessions. No fallback to old pipeline.

---

## CONFLICTS TO RESOLVE

### 1. Questmaster: Who is it?
**Previous:** Questmaster = NPC Cat (code-defined) OR local Claude Code session
**New:** Questmaster = dedicated Cursor cloud agent with Claude CLI

**Conflict:** The old NPC code (`libs/npcs/questmaster/`) still exists and is called by the cron. The GM desk triage we built yesterday uses local API pattern-matching, not a Cursor agent.

**Decision needed:** Do we:
- (a) Replace Cat NPC entirely with the Cursor agent Questmaster?
- (b) Keep Cat NPC for the automated pipeline stages (idea/plan) and have Cursor agent for review?
- (c) Since idea/plan stages are being removed, Cat NPC becomes obsolete?

### 2. Stages: What about idea/plan/assign?
**Previous refactor:** Kept all stages, added escalated
**New spec:** Remove idea, plan, assign entirely. Stages = execute, escalated, review, closing, complete.

**Conflict:** We already implemented `escalated` between execute and review. The VALID_STAGES array still has idea/plan/assign. NPC code routes quests through these stages.

**Decision needed:** Do we:
- (a) Remove idea/plan/assign from VALID_STAGES immediately? This breaks existing quests in those stages.
- (b) Keep them in code but mark as legacy/deprecated? New quests skip them.
- (c) Remove them and migrate any existing quests in those stages to execute or complete?

### 3. Guildmaster vs Questmaster roles
**Previous:** Guildmaster (local Claude Code) does triage on escalated quests
**New:** Questmaster (Cursor agent) handles approvals and reviews. Guildmaster removes obstacles.

**Conflict:** The GM desk triage button we built calls a local API that pattern-matches escalation comments. In the new model, the Questmaster agent should be doing this, not a local API.

**Decision needed:** Does the GM desk triage button:
- (a) Send the escalated quests to the Questmaster Cursor agent for triage?
- (b) Stay as local pattern-matching (the Guildmaster is local Claude Code after all)?
- (c) Both — pattern match first, send to Questmaster for anything it can't auto-resolve?

### 4. Dispatch token / atomic transitions
**Previous:** Dispatch tokens + atomic stage transitions for concurrency control
**New spec:** Not mentioned. Simpler model — agents manage their own quests.

**Decision needed:** Remove the dispatch_token column and the atomic transition guards? Or keep as insurance?

### 5. Internal self-review gate
**Previous:** Adventurer must run Claude CLI to self-review before submitting. Submit rejects without stamp.
**New spec:** Adventurer self-reviews until satisfied, then submits to Questmaster. No explicit Claude CLI gate — the Questmaster uses Claude CLI for second opinions.

**Decision needed:** Drop the self-review gate requirement? Or keep it as a best practice in global instructions without enforcing it in code?

### 6. Comment ping to adventurers
**Previous (implemented):** When user/guildmaster posts feedback, ping the adventurer's session.
**New spec:** The seekHelp/escalate flow goes through the Questmaster agent, not direct pings.

**Conflict:** These aren't mutually exclusive. Direct feedback pings still make sense for user→adventurer communication. SeekHelp is adventurer→questmaster. Both can coexist.

**Decision:** No conflict — keep both. Feedback ping = user to adventurer. SeekHelp = adventurer to questmaster.
