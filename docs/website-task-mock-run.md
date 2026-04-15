# GuildOS Orchestration — Implementation Tasks

## 1. Global instructions: Cat exists in DB
Add to global-instructions.md: Cat (Questmaster) exists in adventurers table. Agents must query DB for Cat's session_id when they need to seekHelp. Do not assume Cat is missing.

## 2. Questmaster nudge in cron
Add a specialized nudge for Cat: check all quests in closing stage, follow questmaster_registry.closeQuest skill book procedure for each. Similar to confused-agent nudge but targeted at Cat + closing quests.

## 3. Quest dedup on creation
In housekeeping.createQuest and the quest API: before inserting, check if a quest with the same Asana task reference already exists. If so, return the existing quest instead of creating a duplicate.

## 4. GM Desk "Resolve Escalations" button
Add a button that triggers the local Guildmaster (Claude Code) to evaluate escalated quests and auto-resolve what it can (env vars, credentials, config). Already partially built — the triage button exists but needs to actually execute resolutions, not just classify.

## 5. Comment summarization — deferred
Revisit after observing real usage patterns.

## 6. Inn UI "Re-init" button — deferred
Add button on adventurer card that calls initAgent. Low priority.

## 7. Multi-agent coordination — deferred
Already partially working. Defer until real scenario exposes need.
