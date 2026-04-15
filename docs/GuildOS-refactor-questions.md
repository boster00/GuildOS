# GuildOS Refactor — Open Questions

## 1. Questmaster: Who is it?
**Previous:** NPC Cat (code-defined) OR local Claude Code session
**New spec:** Dedicated Cursor cloud agent with Claude CLI

Options:
- (a) Replace Cat NPC entirely with the Cursor agent Questmaster
- (b) Keep Cat NPC for legacy stages, Cursor agent for review
- (c) Since idea/plan stages are being removed, Cat NPC becomes obsolete → remove

## 2. Stages: What about idea/plan/assign?
**Previous:** All 8 stages kept, escalated added
**New spec:** Only `execute → escalated → review → closing → complete`

Options:
- (a) Remove idea/plan/assign from VALID_STAGES immediately (breaks existing quests in those stages)
- (b) Keep in code but deprecated — new quests skip them
- (c) Remove and migrate existing quests to execute or complete

## 3. GM Desk triage button: local API or Questmaster agent?
**Previous:** Local API pattern-matches escalation comments
**New spec:** Questmaster agent handles approvals and triage

Options:
- (a) GM desk sends escalated quests to Questmaster Cursor agent
- (b) Keep as local pattern-matching (Guildmaster = local Claude Code)
- (c) Pattern match first, send to Questmaster for anything it can't auto-resolve

## 4. Dispatch token / atomic transitions
**Previous:** dispatch_token column + atomic guards for concurrency
**New spec:** Not mentioned — simpler model, agents manage own quests

Options:
- (a) Remove dispatch_token and guards
- (b) Keep as insurance against double-processing

## 5. Self-review gate
**Previous:** Adventurer must run Claude CLI to self-review before submitting; code enforces this
**New spec:** Adventurer self-reviews until satisfied, Questmaster uses Claude CLI for second opinions

Options:
- (a) Drop the self-review gate — trust the agent + Questmaster review
- (b) Keep as best practice in global instructions but don't enforce in code
- (c) Keep enforced — Questmaster is a second layer, self-review is first

## 6. NPC code (libs/npcs/) — what happens to it?
Cat, Pig, Blacksmith, Runesmith are all code-defined NPCs. In the new model:
- Cat → replaced by Questmaster Cursor agent?
- Pig → replaced by Guildmaster (local Claude Code)?
- Blacksmith/Runesmith → obsolete? Weapons and skill books are now created manually or by agents directly?

Options:
- (a) Archive all NPC code
- (b) Keep for legacy cron pipeline, deprecate gradually
- (c) Keep Pig as Guildmaster NPC, archive the rest

## 7. Closing stage: who does it?
**Previous:** advanceToNextStep() pops next_steps or completes. Asana archival planned.
**New spec:** Closing = summary to Asana. But who writes the summary?

Options:
- (a) Questmaster writes summary and archives to Asana
- (b) The adventurer who did the work writes the summary
- (c) Automated — pull quest description + comments, generate summary, post to Asana

## 8. Priority field: what scale?
**New spec:** Quests have priority. Agent works highest-priority first when nudged.

Options:
- (a) Numeric (1-5, lower = higher priority)
- (b) Named (critical, high, medium, low)
- (c) Simple ordering (integer, agent just sorts by it)
