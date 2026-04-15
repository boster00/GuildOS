# GuildOS Refactor

## Last Updated: 2026-04-15

---

## Implementation Checklist

### ✅ Done
- [x] Cursor weapon payload fix (writeFollowup)
- [x] Adventurer DB schema (session_id, worker_type, session_status, avatar_url, priority on quests)
- [x] Chibi avatar sprites + status-based poses
- [x] Inn upstairs redesign (avatars, status badges, quest counts, chat, Cursor link)
- [x] Adventurer API (link_session, message, conversation, session_status)
- [x] Cron: roll call → nudge confused → notify Cat of closing → re-derive
- [x] Escalated stage + GM desk triage UI
- [x] Feedback → adventurer ping (with loop prevention)
- [x] Global instructions doc (coding conventions, quest lifecycle, weapons, skill books, escalation)
- [x] Knowledge migration: 22 docs deleted, content in global/skill books/system_prompts
- [x] 6 skill books created: housekeeping, questmaster_registry, cjgeo, nexus, bosterbio, gmail (registry format)
- [x] 5 adventurers with sessions: Cat, CJGEO Dev, Nexus Armor Dev, BosterBio Website Dev, (Zoho Advisor — no session)
- [x] Stages: execute/escalated/review/closing/complete (legacy accepted on read)
- [x] Priority field: high/medium/low
- [x] Mark done → closing (not complete)
- [x] advanceQuest removed from cron
- [x] Cat created as adventurer, linked to bc-1a4bfbeb
- [x] All conflicts resolved (see GuildOS-refactor-questions.md)

### 🔲 Remaining
- [x] ~~Remove old NPC routing~~ — kept as legacy, not called from cron
- [x] Quest API default stage → execute
- [x] Quest API validation accepts legacy stages on PATCH
- [x] Inn upstairs quest counts already include escalated ✅
- [x] GM desk shows closing quests
- [x] NPC seeds → noted as deprecated, Cat now in adventurers table
- [x] Housekeeping auto-added to new adventurers via API
- [x] Agent initiation: link_session sends global + system_prompt + skill books
- [x] CLAUDE.md updated with new architecture references

### 🟡 Legacy code (not blocking, clean up later)
- `libs/proving_grounds/server.js` — advanceQuest function still exists, used by some UI buttons. Not called from cron.
- `libs/npcs/` — NPC code still exists. Not loaded by cron. Keep for reference.
- `seed_guild_adventurers` SQL function — creates NPC adventurers. Conflicts with new Cat. Don't re-run.

---

## Architecture (Final)

### Stages
`execute → escalated → review → closing → complete`

### Roles
- **Worker agents** (adventurers) — execute quests, produce deliverables
- **Questmaster (Cat)** — cloud agent, reviews submissions, handles approvals, closes to Asana. Has Claude CLI.
- **Guildmaster** — local Claude Code, higher privilege, removes obstacles via escalation

### Knowhow layers
1. **Global** → `docs/global-instructions.md`
2. **Strategic** → `adventurers.system_prompt`
3. **Tactical** → skill books

### Quest description structure
1. WBS (hierarchical tasks)
2. Deliverable spec (screenshots, acceptance criteria)
3. Reporting target (Asana task)

### Pre-execution checklist (global behavior)
Agent must NOT create quest until: clear deliverables + Asana target + priority assigned.

### Cron
1. Roll call (derive statuses)
2. Nudge confused agents
3. Notify Cat of closing quests
4. Re-derive statuses

### Escalation
Worker → Questmaster (seekHelp). If Questmaster can't help → escalate to Guildmaster.
Guildmaster provides help or feedback → work returns to worker.
