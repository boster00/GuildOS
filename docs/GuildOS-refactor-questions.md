# GuildOS Refactor — Resolved Decisions (2026-04-15)

All 8 questions resolved. This file is the authoritative record.

## 1. Questmaster = Cat, runs on cloud
Questmaster is a cloud-run Cursor agent. Lacks full credentials. Guildmaster (local Claude Code) has higher access and helps when Questmaster cannot.

## 2. Stages: execute → escalated → review → closing → complete
idea/plan/assign removed. Execution starts at execute. Planning happens in user chat before quest creation.

## 3. GM Desk triage button: keep
Questmaster escalates to Guildmaster. GM provides direct help or feedback, then work returns to worker agent. GM is not a decision-maker gate — it's a support layer.

## 4. Dispatch token: implementation detail
Keep or remove as needed. Not a product decision.

## 5. Self-review: no per-agent Claude CLI requirement
Worker agents use Cursor's built-in self-gating. Claude CLI lives centrally on Questmaster only.

## 6. NPC code: keep what's useful, don't extend
Blacksmith/Runesmith no longer needed for skill book creation. Keep Blacksmith's system connection code for now. Don't let NPC architecture constrain new implementation.

## 7. Closing: Questmaster handles, archives to Asana
Questmaster uploads assets/reports to Asana. Escalates to GM if unsure which Asana task. Target Asana task should already be in the quest.

## 8. Priority: high / medium / low
