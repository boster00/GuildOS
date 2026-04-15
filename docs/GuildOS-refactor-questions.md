# GuildOS Refactor — Remaining Questions (2026-04-15)

From mock-running the BosterBio web dev scenario end-to-end.

## 1. Cat (Questmaster) needs a Cursor agent session
Cat was created as an adventurer but has no `session_id` linked. For the seekHelp flow to work, Cat needs a live Cursor cloud agent.

**Question:** Should we create a new Cursor agent for Cat now, or repurpose an existing one?

## 2. Figma references — where do they live?
The agent needs Figma file keys and node IDs to do Figma-to-code work. The bosterbio skill book's `validateFigma` action references the Figma weapon but doesn't specify which files.

**Question:** Should Figma references go in:
- (a) The quest description (per-task)
- (b) The adventurer's system_prompt (per-project)
- (c) The skill book (shared knowledge)

## 3. Asana task ID on quests
Closing stage needs to archive to Asana, but there's no field/convention for storing the target Asana task ID on a quest.

**Question:** Store it as:
- (a) A dedicated `asana_task_id` column on quests
- (b) An inventory item (e.g., `inventory.asana_task_id`)
- (c) In the quest description text

## 4. "Mark done" button goes to wrong stage
The GM desk "Mark done" button currently sets stage to `completed`. It should go to `closing` first so the Questmaster can archive to Asana.

**Decision needed:** Change the button behavior to:
- Mark done → `closing` (Questmaster archives, then auto-completes)
- Add a separate "Complete (skip closing)" for quests that don't need Asana archival

## 5. Closing stage routing
The cron calls `advanceQuest()` for closing-stage quests, which routes to NPC code. But Cat is now an adventurer (Cursor agent), not an NPC.

**Question:** For closing:
- (a) Route closing to Cat's live session (send message, Cat does Asana archival)
- (b) Keep closing as automated code (no Cat involvement) — just upload to Asana programmatically
- (c) Hybrid — try automated, escalate to Cat if it fails

## 6. Agent initiation — who triggers it?
The `initAgent` action is in the housekeeping skill book, but who sends the first message to a new/refreshed agent?

**Options:**
- (a) The cron detects `inactive` agents with `session_id` and sends initAgent
- (b) Manual — user triggers initiation from the Inn UI
- (c) The `link_session` API action auto-sends initAgent on link
